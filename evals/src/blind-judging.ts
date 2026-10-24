/**
 * Blind pairwise judging: load a private pack of cases, seal each pair with the existing blind
 * assignment, record HumanVerdicts, and report each practice against an explicit pass rule.
 * Drafts, keys, and verdicts are private; every output path is refused inside a Git work tree.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { renderJudgingPage, renderMarkdown } from "./blind-judging-page.ts";
import { createBlindPair, revealBlindAssignment, type BlindAssignment } from "./blind-review.ts";
import type { BlindPair, HumanVerdict, Sha256 } from "./contracts.ts";
import { digestBytes } from "./digest.ts";
import { normalizeDraft, type NormalizedDraft, type Removal } from "./draft-normalizer.ts";
import { invariant } from "./validate.ts";

export const JUDGING_REVISION = "conquistador.blind-pairwise/v1";
export const NO_REASON = "No reason given.";

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERDICTS = new Set<HumanVerdict["verdict"]>(["A", "B", "tie", "reject-both"]);

export type PackArms = { baseline: string; candidate: string };
export type PackCase = {
  id: string;
  practice: string;
  brief: string;
  briefDigest: Sha256;
  drafts: { baseline: NormalizedDraft; candidate: NormalizedDraft };
};
export type JudgingPack = { dir: string; id: string; arms: PackArms; stripHeadings: string[]; cases: PackCase[] };

export type SessionPair = { practice: string; briefDigest: Sha256; pair: BlindPair };
export type JudgingSession = {
  schemaVersion: "conquistador.judging-session/v1";
  sessionId: string;
  packId: string;
  reviewer: string;
  reviewerRevision: string;
  createdAt: string;
  pairs: SessionPair[];
};
type JudgingKey = { schemaVersion: "conquistador.judging-key/v1"; sessionId: string; packId: string; nonce: string; arms: PackArms };

const readJson = <T>(path: string, label: string): T => {
  invariant(existsSync(path), `${label} is missing: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(`[eval-lab] ${label} is not valid JSON: ${path}`);
  }
};
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const tokenIn = (id: string, token: string) => new RegExp(`(^|[-_.])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([-_.]|$)`, "i").test(id);

/** Private material must never land in a repository, where a commit could publish it. */
export function requirePrivatePath(path: string, label: string): string {
  const target = resolve(path);
  for (let dir = target; ; dir = dirname(dir)) {
    invariant(!existsSync(join(dir, ".git")), `${label} is inside a Git work tree (${dir}); use a private folder outside any repository`);
    if (dirname(dir) === dir) return target;
  }
}

export function loadJudgingPack(packDir: string): JudgingPack {
  const dir = resolve(packDir);
  const manifest = readJson<{ schemaVersion?: string; id?: string; arms?: Partial<PackArms>; normalize?: { stripHeadings?: unknown } }>(join(dir, "pack.json"), "pack.json");
  invariant(manifest.schemaVersion === "conquistador.judging-pack/v1", "pack.json schemaVersion must be conquistador.judging-pack/v1");
  invariant(typeof manifest.id === "string" && SLUG.test(manifest.id), "pack.json id must be a simple name");
  const arms = manifest.arms ?? {};
  invariant(typeof arms.baseline === "string" && SLUG.test(arms.baseline), "pack.json arms.baseline must be a simple name");
  invariant(typeof arms.candidate === "string" && SLUG.test(arms.candidate), "pack.json arms.candidate must be a simple name");
  invariant(arms.baseline.toLowerCase() !== arms.candidate.toLowerCase(), "pack arms must be distinct");
  const stripHeadings = manifest.normalize?.stripHeadings ?? [];
  invariant(Array.isArray(stripHeadings) && stripHeadings.every((entry) => typeof entry === "string"), "normalize.stripHeadings must be a list of headings");
  const identityTokens = [arms.baseline, arms.candidate];
  const options = { identityTokens, stripHeadings: stripHeadings as string[] };

  const cases: PackCase[] = [];
  const folders = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name).sort();
  invariant(folders.length > 0, `pack ${manifest.id} has no case folders`);
  for (const id of folders) {
    invariant(SLUG.test(id), `case id ${id} must be a simple name`);
    for (const token of [...identityTokens, "conquistador"]) invariant(!tokenIn(id, token), `case id ${id} contains an arm or product name; rename the folder`);
    const caseDir = join(dir, id);
    const expected = new Set(["case.json", "brief.md", `${arms.baseline}.md`, `${arms.candidate}.md`]);
    for (const name of readdirSync(caseDir)) {
      if (!name.startsWith(".")) invariant(expected.has(name), `case ${id} has an unexpected file ${name}; a case holds case.json, brief.md, ${arms.baseline}.md, and ${arms.candidate}.md`);
    }
    const meta = readJson<{ practice?: string }>(join(caseDir, "case.json"), `case ${id} case.json`);
    invariant(typeof meta.practice === "string" && SLUG.test(meta.practice), `case ${id} case.json needs a practice name`);
    invariant(existsSync(join(caseDir, "brief.md")), `case ${id} is missing brief.md`);
    const brief = readFileSync(join(caseDir, "brief.md"), "utf8").replace(/\r\n?/g, "\n").trim();
    invariant(brief.length > 0, `case ${id} brief.md is empty`);
    const draft = (arm: string) => {
      const path = join(caseDir, `${arm}.md`);
      invariant(existsSync(path), `case ${id} is missing the ${arm} arm (${arm}.md)`);
      const normalized = normalizeDraft(readFileSync(path, "utf8"), options);
      invariant(normalized.text.length > 0, `the ${arm} draft for case ${id} is empty after normalization`);
      return normalized;
    };
    const drafts = { baseline: draft(arms.baseline), candidate: draft(arms.candidate) };
    invariant(drafts.baseline.text !== drafts.candidate.text, `drafts for case ${id} are identical after normalization`);
    cases.push({ id, practice: meta.practice, brief, briefDigest: digestBytes(brief), drafts });
  }
  return { dir, id: manifest.id, arms: { baseline: arms.baseline, candidate: arms.candidate }, stripHeadings: stripHeadings as string[], cases };
}

function sealPairs(pack: JudgingPack, sessionId: string, nonce: string, presentedAt: string) {
  return pack.cases.map((entry) => {
    const sealed = createBlindPair({
      id: `${sessionId}:${entry.id}`,
      caseId: entry.id,
      left: { identity: pack.arms.baseline, artifactDigest: digestBytes(entry.drafts.baseline.text) },
      right: { identity: pack.arms.candidate, artifactDigest: digestBytes(entry.drafts.candidate.text) },
      nonce,
      presentedAt,
    });
    return { entry, ...sealed };
  });
}

function auditMarkdown(pack: JudgingPack, sessionId: string): string {
  const lines = [
    `# Normalization audit · session ${sessionId}`,
    "",
    "Sealed. This file names the arms. Do not open it before the judge finishes, unless you are a separate auditor.",
    "Each entry lists text the judge did not see. A residual leak is an identity word still visible to the judge.",
    "",
  ];
  const block = (removal: Removal) => [`- **${removal.rule}**`, "", ...removal.excerpt.split("\n").map((line) => `    ${line}`), ""];
  for (const entry of pack.cases) {
    lines.push(`## ${entry.id} (${entry.practice})`, "");
    for (const [role, arm] of [["baseline", pack.arms.baseline], ["candidate", pack.arms.candidate]] as const) {
      const draft = entry.drafts[role];
      lines.push(`### ${arm} · ${draft.words} words shown · ${draft.removals.length} removals`, "");
      if (draft.residualLeaks.length) lines.push(`Residual leaks: ${draft.residualLeaks.join(", ")}`, "");
      for (const removal of draft.removals) lines.push(...block(removal));
    }
    const [a, b] = [entry.drafts.baseline.words, entry.drafts.candidate.words];
    if (Math.max(a, b) > 1.5 * Math.max(1, Math.min(a, b))) lines.push(`Length warning: shown drafts differ by more than 1.5x (${a} and ${b} words).`, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function prepareJudgingSession(input: {
  packDir: string;
  outDir: string;
  reviewer: string;
  nonce?: string;
  now?: () => string;
  allowResidual?: boolean;
}): { sessionDir: string; session: JudgingSession } {
  const sessionDir = requirePrivatePath(input.outDir, "session output");
  invariant(!existsSync(join(sessionDir, "session.json")), `${sessionDir} already holds a session; choose a new folder so saved verdicts are not replaced`);
  const reviewer = input.reviewer?.trim() ?? "";
  invariant(reviewer.length > 0 && !/[\n\r]/.test(reviewer), "a reviewer name is required");
  const pack = loadJudgingPack(input.packDir);
  const residual = pack.cases.flatMap((entry) => [
    ...entry.drafts.baseline.residualLeaks.map((token) => `${entry.id}/${pack.arms.baseline}: ${token}`),
    ...entry.drafts.candidate.residualLeaks.map((token) => `${entry.id}/${pack.arms.candidate}: ${token}`),
  ]);
  invariant(!residual.length || input.allowResidual, `residual identity words remain after normalization (${residual.join("; ")}). Edit the drafts, add normalize.stripHeadings, or pass --allow-residual after a human check`);

  const nonce = input.nonce ?? randomBytes(32).toString("hex");
  const createdAt = (input.now ?? (() => new Date().toISOString()))();
  const sessionId = `${pack.id}-${digestBytes(`${nonce}\0session`).slice(7, 15)}`;
  const sealed = sealPairs(pack, sessionId, nonce, createdAt);
  const session: JudgingSession = {
    schemaVersion: "conquistador.judging-session/v1",
    sessionId,
    packId: pack.id,
    reviewer,
    reviewerRevision: JUDGING_REVISION,
    createdAt,
    pairs: sealed.map(({ entry, pair }) => ({ practice: entry.practice, briefDigest: entry.briefDigest, pair })),
  };
  const html = renderJudgingPage({
    sessionId,
    reviewer,
    reviewerRevision: JUDGING_REVISION,
    pairs: sealed.map(({ entry, pair, assignment }) => {
      const text = (identity: string) => (identity === pack.arms.baseline ? entry.drafts.baseline.text : entry.drafts.candidate.text);
      return {
        pairId: pair.id,
        practice: entry.practice,
        brief: renderMarkdown(entry.brief),
        a: renderMarkdown(text(assignment.armAIdentity)),
        b: renderMarkdown(text(assignment.armBIdentity)),
        armA: pair.armA.artifactDigest,
        armB: pair.armB.artifactDigest,
        assignmentDigest: pair.assignmentDigest,
      };
    }),
  });
  mkdirSync(join(sessionDir, "sealed"), { recursive: true });
  writeJson(join(sessionDir, "session.json"), session);
  writeFileSync(join(sessionDir, "judge.html"), html);
  writeJson(join(sessionDir, "sealed", "key.json"), { schemaVersion: "conquistador.judging-key/v1", sessionId, packId: pack.id, nonce, arms: pack.arms } satisfies JudgingKey);
  writeJson(join(sessionDir, "sealed", "audit.json"), pack.cases.map((entry) => ({
    caseId: entry.id,
    practice: entry.practice,
    [pack.arms.baseline]: { words: entry.drafts.baseline.words, residualLeaks: entry.drafts.baseline.residualLeaks, removals: entry.drafts.baseline.removals },
    [pack.arms.candidate]: { words: entry.drafts.candidate.words, residualLeaks: entry.drafts.candidate.residualLeaks, removals: entry.drafts.candidate.removals },
  })));
  writeFileSync(join(sessionDir, "sealed", "audit.md"), auditMarkdown(pack, sessionId));
  return { sessionDir, session };
}

export function loadJudgingSession(sessionDir: string): JudgingSession {
  const session = readJson<JudgingSession>(join(resolve(sessionDir), "session.json"), "session.json");
  invariant(session.schemaVersion === "conquistador.judging-session/v1", "session.json schemaVersion must be conquistador.judging-session/v1");
  invariant(Array.isArray(session.pairs) && session.pairs.length > 0, "session.json has no pairs");
  return session;
}

/**
 * Re-derive every pair from the pack and the sealed nonce, and require it to match the session.
 * This detects an edited draft or brief, an edited session file, and a changed nonce.
 */
export function verifySession(packDir: string, sessionDir: string): { pack: JudgingPack; session: JudgingSession; assignments: Map<string, BlindAssignment> } {
  const session = loadJudgingSession(sessionDir);
  const key = readJson<JudgingKey>(join(resolve(sessionDir), "sealed", "key.json"), "sealed/key.json");
  const pack = loadJudgingPack(packDir);
  invariant(key.sessionId === session.sessionId && key.packId === session.packId && pack.id === session.packId, "pack, session, and sealed key belong to different sessions");
  invariant(key.arms?.baseline === pack.arms.baseline && key.arms?.candidate === pack.arms.candidate, "pack arms changed since the session was prepared");
  const caseIds = new Set(pack.cases.map((entry) => entry.id));
  for (const { pair } of session.pairs) invariant(caseIds.has(pair.caseId), `session pair ${pair.id} has no case in the pack`);
  invariant(pack.cases.length === session.pairs.length, "the pack has cases that are not in the session");
  const assignments = new Map<string, BlindAssignment>();
  for (const { entry, pair, assignment } of sealPairs(pack, session.sessionId, key.nonce, session.createdAt)) {
    const stored = session.pairs.find((item) => item.pair.id === pair.id);
    invariant(stored, `session has no pair for case ${entry.id}`);
    invariant(stored.pair.assignmentDigest === pair.assignmentDigest, `blind assignment for pair ${pair.id} does not match the sealed key`);
    invariant(
      stored.pair.armA.artifactDigest === pair.armA.artifactDigest && stored.pair.armB.artifactDigest === pair.armB.artifactDigest && stored.briefDigest === entry.briefDigest,
      `a draft or brief for case ${entry.id} changed since the session was prepared`,
    );
    invariant(stored.practice === entry.practice, `the practice for case ${entry.id} changed since the session was prepared`);
    assignments.set(pair.id, assignment);
  }
  return { pack, session, assignments };
}

export function revealSessionAssignments(packDir: string, sessionDir: string): Map<string, BlindAssignment> {
  return verifySession(packDir, sessionDir).assignments;
}

export function validateVerdict(session: JudgingSession, verdict: HumanVerdict): SessionPair {
  invariant(Boolean(verdict) && typeof verdict === "object", "a verdict must be an object");
  invariant(verdict.schemaVersion === "conquistador.human-verdict/v1", "verdict schemaVersion must be conquistador.human-verdict/v1");
  invariant(typeof verdict.id === "string" && verdict.id.length > 0, "verdict id is required");
  const entry = session.pairs.find((item) => item.pair.id === verdict.blindPairId);
  invariant(entry, `verdict names an unknown pair: ${String(verdict.blindPairId)}`);
  const { pair } = entry;
  invariant(
    Array.isArray(verdict.artifactDigests) && verdict.artifactDigests.length === 2
      && verdict.artifactDigests[0] === pair.armA.artifactDigest && verdict.artifactDigests[1] === pair.armB.artifactDigest,
    `verdict for pair ${pair.id} has artifact digests in the wrong order or from another pair`,
  );
  invariant(verdict.assignmentDigest === pair.assignmentDigest, `verdict for pair ${pair.id} is not sealed to this pair's assignment`);
  invariant(VERDICTS.has(verdict.verdict), `verdict for pair ${pair.id} must be A, B, tie, or reject-both`);
  invariant(verdict.reviewer === session.reviewer, `verdict reviewer ${String(verdict.reviewer)} is not the session reviewer`);
  invariant(verdict.reviewerRevision === session.reviewerRevision, `verdict reviewer revision is not ${session.reviewerRevision}`);
  invariant(typeof verdict.rationale === "string" && verdict.rationale.trim().length > 0 && verdict.rationale.length <= 500, `verdict for pair ${pair.id} needs a reason of at most 500 characters`);
  invariant(typeof verdict.recordedAt === "string" && !Number.isNaN(Date.parse(verdict.recordedAt)), `verdict for pair ${pair.id} needs an ISO recordedAt time`);
  return entry;
}

/** Add a verdict, or replace the earlier verdict for the same pair. A pair never holds two verdicts. */
export function upsertVerdict(session: JudgingSession, verdicts: HumanVerdict[], incoming: HumanVerdict): HumanVerdict[] {
  validateVerdict(session, incoming);
  const index = verdicts.findIndex((entry) => entry.blindPairId === incoming.blindPairId);
  if (index < 0) return [...verdicts, incoming];
  return verdicts.map((entry, position) => (position === index ? incoming : entry));
}

export function readVerdictsFile(path: string): HumanVerdict[] {
  if (!existsSync(path)) return [];
  const value = readJson<unknown>(path, "verdict file");
  invariant(Array.isArray(value), `verdict file must hold a JSON array of HumanVerdict records: ${path}`);
  return value as HumanVerdict[];
}

/** Write to a temporary file and rename it, so a crash never leaves a half-written verdict file. */
export function writeVerdictsFile(path: string, verdicts: HumanVerdict[]): void {
  const target = requirePrivatePath(path, "verdict file");
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(verdicts, null, 2)}\n`);
  renameSync(temporary, target);
}

export type PassRule = { minDecided: number; minWinRate: { numerator: number; denominator: number } };

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Default rule: at least 6 decided pairs, and the candidate arm wins at least 2/3 of them. */
export function parsePassRule(input: { minDecided?: string | number; minWinRate?: string | number }): PassRule {
  const minDecided = Number(input.minDecided ?? 6);
  invariant(Number.isInteger(minDecided) && minDecided >= 1, "minimum decided pairs must be a whole number of at least 1");
  const raw = String(input.minWinRate ?? "2/3").trim();
  let numerator: number;
  let denominator: number;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(raw);
  if (fraction) {
    numerator = Number(fraction[1]);
    denominator = Number(fraction[2]);
  } else {
    invariant(/^(0?\.\d+|1(\.0+)?|0)$/.test(raw), `minimum win rate must be a fraction like 2/3 or a decimal like 0.75, not ${raw}`);
    denominator = 1_000_000;
    numerator = Math.round(Number(raw) * denominator);
  }
  invariant(denominator > 0 && numerator > 0 && numerator <= denominator, "minimum win rate must be above 0 and at most 1");
  const divisor = gcd(numerator, denominator);
  return { minDecided, minWinRate: { numerator: numerator / divisor, denominator: denominator / divisor } };
}

export type PracticeResult = {
  practice: string;
  pairs: number;
  judged: number;
  candidateWins: number;
  baselineWins: number;
  ties: number;
  rejectBoth: number;
  decided: number;
  status: "pass" | "fail" | "incomplete";
  reason: string;
};

export type JudgingReport = {
  schemaVersion: "conquistador.judging-report/v1";
  sessionId: string;
  packId: string;
  reviewer: string;
  arms: PackArms;
  rule: PassRule;
  practices: PracticeResult[];
  generatedAt: string;
};

export function buildJudgingReport(input: { packDir: string; sessionDir: string; verdicts: HumanVerdict[]; rule: PassRule; now?: () => string }): JudgingReport {
  const { pack, session, assignments } = verifySession(input.packDir, input.sessionDir);
  const seen = new Set<string>();
  for (const verdict of input.verdicts) {
    invariant(!seen.has(verdict.blindPairId), `pair ${verdict.blindPairId} was judged twice in the verdict file`);
    seen.add(verdict.blindPairId);
  }
  const winners = new Map<string, string>();
  for (const verdict of input.verdicts) {
    const { pair } = validateVerdict(session, verdict);
    const assignment = revealBlindAssignment(pair, verdict, assignments.get(pair.id)!);
    winners.set(pair.id, verdict.verdict === "A" ? assignment.armAIdentity : verdict.verdict === "B" ? assignment.armBIdentity : verdict.verdict);
  }
  const { minDecided, minWinRate } = input.rule;
  const rate = `${minWinRate.numerator}/${minWinRate.denominator}`;
  const practices: PracticeResult[] = [];
  for (const practice of [...new Set(session.pairs.map((entry) => entry.practice))]) {
    const pairs = session.pairs.filter((entry) => entry.practice === practice);
    const outcomes = pairs.map((entry) => winners.get(entry.pair.id));
    const count = (value: string) => outcomes.filter((outcome) => outcome === value).length;
    const result = {
      practice,
      pairs: pairs.length,
      judged: outcomes.filter(Boolean).length,
      candidateWins: count(pack.arms.candidate),
      baselineWins: count(pack.arms.baseline),
      ties: count("tie"),
      rejectBoth: count("reject-both"),
    };
    const decided = result.candidateWins + result.baselineWins;
    let status: PracticeResult["status"];
    let reason: string;
    if (result.judged < result.pairs) {
      status = "incomplete";
      reason = `${result.pairs - result.judged} of ${result.pairs} pairs not judged`;
    } else if (decided < minDecided) {
      status = "fail";
      reason = `${decided} decided pairs; the rule needs at least ${minDecided}`;
    } else {
      const share = `${pack.arms.candidate} won ${result.candidateWins} of ${decided} decided pairs (${Math.round((100 * result.candidateWins) / decided)}%)`;
      status = result.candidateWins * minWinRate.denominator >= minWinRate.numerator * decided ? "pass" : "fail";
      reason = status === "pass" ? share : `${share}; the rule needs at least ${rate}`;
    }
    practices.push({ ...result, decided, status, reason });
  }
  return {
    schemaVersion: "conquistador.judging-report/v1",
    sessionId: session.sessionId,
    packId: session.packId,
    reviewer: session.reviewer,
    arms: pack.arms,
    rule: input.rule,
    practices,
    generatedAt: (input.now ?? (() => new Date().toISOString()))(),
  };
}

export function formatJudgingReport(report: JudgingReport): string {
  const { candidate, baseline } = report.arms;
  const rate = `${report.rule.minWinRate.numerator}/${report.rule.minWinRate.denominator}`;
  const width = Math.max(8, ...report.practices.map((entry) => entry.practice.length));
  const columns = [candidate, baseline, "tie", "reject", "judged"];
  const cell = (value: string | number, index: number) => String(value).padStart(Math.max(columns[index]!.length, 6));
  const lines = [
    `Blind pairwise report · session ${report.sessionId} · judge ${report.reviewer}`,
    `Rule: at least ${report.rule.minDecided} decided pairs, and ${candidate} wins at least ${rate} of decided pairs.`,
    `Decided means ${candidate} or ${baseline} won. Ties and reject-both are neither wins nor decided.`,
    "",
    `${"practice".padEnd(width)}  ${columns.map(cell).join("  ")}  result`,
  ];
  for (const entry of report.practices) {
    const values = [entry.candidateWins, entry.baselineWins, entry.ties, entry.rejectBoth, `${entry.judged}/${entry.pairs}`];
    lines.push(`${entry.practice.padEnd(width)}  ${values.map(cell).join("  ")}  ${entry.status.toUpperCase()} · ${entry.reason}`);
  }
  return `${lines.join("\n")}\n`;
}
