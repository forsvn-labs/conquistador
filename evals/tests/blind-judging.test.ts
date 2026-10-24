import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildJudgingReport,
  formatJudgingReport,
  loadJudgingPack,
  loadJudgingSession,
  parsePassRule,
  prepareJudgingSession,
  readVerdictsFile,
  revealSessionAssignments,
  upsertVerdict,
  writeVerdictsFile,
} from "../src/blind-judging";
import type { HumanVerdict } from "../src/contracts";
import { root } from "./helpers";

const samplePack = resolve(root, "fixtures/blind-judging/sample-pack");
const nonce = "n".repeat(16) + "0123456789abcdef0123456789abcdef";
const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "blind-judging-"));
  temps.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type CaseSpec = { id: string; practice: string; bare?: string; method?: string; extra?: Record<string, string> };

function makePack(cases: CaseSpec[], arms = { baseline: "bare", candidate: "method" }): string {
  const dir = temp();
  writeFileSync(join(dir, "pack.json"), JSON.stringify({ schemaVersion: "conquistador.judging-pack/v1", id: "test-pack", arms }));
  for (const spec of cases) {
    mkdirSync(join(dir, spec.id));
    writeFileSync(join(dir, spec.id, "case.json"), JSON.stringify({ practice: spec.practice }));
    writeFileSync(join(dir, spec.id, "brief.md"), `Brief for ${spec.id}.`);
    if (spec.bare !== undefined) writeFileSync(join(dir, spec.id, `${arms.baseline}.md`), spec.bare);
    if (spec.method !== undefined) writeFileSync(join(dir, spec.id, `${arms.candidate}.md`), spec.method);
    for (const [name, body] of Object.entries(spec.extra ?? {})) writeFileSync(join(dir, spec.id, name), body);
  }
  return dir;
}

const practiceCases = (practice: string, count: number): CaseSpec[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${practice}-${index + 1}`,
    practice,
    bare: `Plain draft ${index + 1} for ${practice}.`,
    method: `Sharper draft ${index + 1} for ${practice}, with proof.`,
  }));

function prepare(packDir: string, extra: Partial<Parameters<typeof prepareJudgingSession>[0]> = {}) {
  const outDir = join(temp(), "session");
  prepareJudgingSession({ packDir, outDir, reviewer: "hung", nonce, now: () => "2026-10-24T10:00:00.000Z", ...extra });
  return outDir;
}

/** Judge every pair by naming the arm identity that wins, as a judge would by reading. */
function judge(packDir: string, sessionDir: string, winners: Record<string, "bare" | "method" | "tie" | "skip">): HumanVerdict[] {
  const session = loadJudgingSession(sessionDir);
  const assignments = revealSessionAssignments(packDir, sessionDir);
  let verdicts: HumanVerdict[] = [];
  for (const entry of session.pairs) {
    const winner = winners[entry.pair.caseId];
    if (!winner || winner === "skip") continue;
    const assignment = assignments.get(entry.pair.id)!;
    const label = winner === "tie" ? "tie" : assignment.armAIdentity === winner ? "A" : "B";
    verdicts = upsertVerdict(session, verdicts, {
      schemaVersion: "conquistador.human-verdict/v1",
      id: `${entry.pair.id}/verdict`,
      blindPairId: entry.pair.id,
      reviewer: session.reviewer,
      reviewerRevision: session.reviewerRevision,
      artifactDigests: [entry.pair.armA.artifactDigest, entry.pair.armB.artifactDigest],
      verdict: label,
      rationale: "No reason given.",
      recordedAt: "2026-10-24T10:05:00.000Z",
      assignmentDigest: entry.pair.assignmentDigest,
    });
  }
  return verdicts;
}

const allMethod = (count: number, practice = "copy") =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`${practice}-${index + 1}`, "method" as const]));

describe("judging pack", () => {
  it("loads the synthetic sample pack", () => {
    const pack = loadJudgingPack(samplePack);
    expect(pack.id).toBe("sample-synthetic");
    expect(pack.cases.map((entry) => entry.id)).toEqual(["copy-hero", "copy-pricing", "outreach-first-touch"]);
    expect(pack.cases[0]!.practice).toBe("copy");
  });

  it("rejects a case with a missing arm", () => {
    const dir = makePack([{ id: "copy-1", practice: "copy", bare: "Draft." }]);
    expect(() => loadJudgingPack(dir)).toThrow(/copy-1.*method/);
  });

  it("rejects an extra arm, a missing brief, identical drafts, and empty drafts", () => {
    expect(() => loadJudgingPack(makePack([{ id: "c1", practice: "copy", bare: "A.", method: "B.", extra: { "other.md": "C." } }]))).toThrow(/other\.md/);
    const noBrief = makePack([{ id: "c1", practice: "copy", bare: "A.", method: "B." }]);
    rmSync(join(noBrief, "c1", "brief.md"));
    expect(() => loadJudgingPack(noBrief)).toThrow(/brief/);
    expect(() => loadJudgingPack(makePack([{ id: "c1", practice: "copy", bare: "Same.", method: "Same." }]))).toThrow(/identical/);
    expect(() => loadJudgingPack(makePack([{ id: "c1", practice: "copy", bare: "---\na: b\n---\n", method: "B." }]))).toThrow(/empty/);
  });

  it("rejects a case id or arm set that would leak an identity", () => {
    expect(() => loadJudgingPack(makePack([{ id: "copy-method-1", practice: "copy", bare: "A.", method: "B." }]))).toThrow(/case id/);
    expect(() => loadJudgingPack(makePack([{ id: "c1", practice: "copy", bare: "A." }], { baseline: "bare", candidate: "bare" }))).toThrow(/distinct/);
  });
});

describe("judging session", () => {
  it("keeps identities, the nonce, file names, and removed text out of the page", () => {
    const sessionDir = prepare(samplePack);
    const html = readFileSync(join(sessionDir, "judge.html"), "utf8");
    // The client code is identical for every session; check everything the judge can see or inspect.
    const pageWithoutCode = html.replace(/<script>[\s\S]*?<\/script>/, "");
    const publicSession = readFileSync(join(sessionDir, "session.json"), "utf8");
    for (const page of [pageWithoutCode, publicSession]) {
      expect(page).not.toContain(nonce);
      expect(page).not.toMatch(/\bbare\b/i);
      expect(page).not.toMatch(/\bmethod\b/i);
      expect(page).not.toMatch(/\.md\b/);
      expect(page).not.toContain("Why these choices");
      expect(page).not.toContain("Self-score");
    }
    const session = loadJudgingSession(sessionDir);
    for (const entry of session.pairs) expect(html).toContain(entry.pair.assignmentDigest);
    expect(JSON.parse(readFileSync(join(sessionDir, "sealed", "key.json"), "utf8")).nonce).toBe(nonce);
    const audit = readFileSync(join(sessionDir, "sealed", "audit.md"), "utf8");
    expect(audit).toContain("method-section");
    expect(audit).toContain("Why these choices");
  });

  it("places each arm in both positions, reproducibly from the nonce", () => {
    const packDir = makePack(practiceCases("copy", 24));
    const first = revealSessionAssignments(packDir, prepare(packDir));
    const again = revealSessionAssignments(packDir, prepare(packDir));
    const positions = new Set([...first.values()].map((assignment) => assignment.armAIdentity));
    expect(positions).toEqual(new Set(["bare", "method"]));
    expect([...again.entries()]).toEqual([...first.entries()]);
    const other = revealSessionAssignments(packDir, prepare(packDir, { nonce: "z".repeat(48) }));
    expect([...other.values()].map((assignment) => assignment.armAIdentity)).not.toEqual([...first.values()].map((assignment) => assignment.armAIdentity));
  });

  it("escapes draft text so it cannot run script in the page", () => {
    const packDir = makePack([{ id: "c1", practice: "copy", bare: "</script><img src=x onerror=alert(1)>", method: "<b>bold</b>" }]);
    const html = readFileSync(join(prepare(packDir), "judge.html"), "utf8");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>bold</b>");
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it("refuses residual identity leaks unless allowed, and refuses output inside a Git work tree", () => {
    const leaky = makePack([{ id: "c1", practice: "copy", bare: "Pick a payment method.", method: "Pay now." }]);
    expect(() => prepare(leaky)).toThrow(/residual/);
    expect(() => prepare(leaky, { allowResidual: true })).not.toThrow();
    expect(() => prepareJudgingSession({ packDir: samplePack, outDir: join(root, "tmp-session"), reviewer: "hung", nonce })).toThrow(/Git work tree/);
  });
});

describe("verdict store", () => {
  it("replaces a second verdict for the same pair instead of keeping both", () => {
    const packDir = makePack(practiceCases("copy", 2));
    const sessionDir = prepare(packDir);
    const session = loadJudgingSession(sessionDir);
    const verdicts = judge(packDir, sessionDir, allMethod(2));
    const changed = upsertVerdict(session, verdicts, { ...verdicts[0]!, verdict: "tie", recordedAt: "2026-10-24T10:09:00.000Z" });
    expect(changed).toHaveLength(2);
    expect(changed.find((entry) => entry.blindPairId === verdicts[0]!.blindPairId)!.verdict).toBe("tie");
  });

  it("rejects a verdict bound to the wrong pair, digest order, or assignment", () => {
    const packDir = makePack(practiceCases("copy", 2));
    const sessionDir = prepare(packDir);
    const session = loadJudgingSession(sessionDir);
    const [first, second] = judge(packDir, sessionDir, allMethod(2));
    expect(() => upsertVerdict(session, [], { ...first!, blindPairId: "unknown" })).toThrow(/unknown/);
    expect(() => upsertVerdict(session, [], { ...first!, artifactDigests: [first!.artifactDigests[1], first!.artifactDigests[0]] })).toThrow(/digest/);
    expect(() => upsertVerdict(session, [], { ...first!, blindPairId: second!.blindPairId })).toThrow(/digest/);
    expect(() => upsertVerdict(session, [], { ...first!, assignmentDigest: second!.assignmentDigest })).toThrow(/assignment/);
    expect(() => upsertVerdict(session, [], { ...first!, reviewer: "someone-else" })).toThrow(/reviewer/);
  });

  it("writes the verdict file atomically and reads it back", () => {
    const packDir = makePack(practiceCases("copy", 2));
    const sessionDir = prepare(packDir);
    const path = join(temp(), "private", "verdicts.json");
    const verdicts = judge(packDir, sessionDir, allMethod(2));
    writeVerdictsFile(path, verdicts);
    expect(readVerdictsFile(path)).toEqual(verdicts);
    expect(readVerdictsFile(join(temp(), "missing.json"))).toEqual([]);
  });
});

describe("judging report", () => {
  const report = (packDir: string, sessionDir: string, verdicts: HumanVerdict[], rule = parsePassRule({})) =>
    buildJudgingReport({ packDir, sessionDir, verdicts, rule });

  it("passes when the method arm wins two thirds of at least six decided pairs, in either position", () => {
    const packDir = makePack(practiceCases("copy", 6));
    const sessionDir = prepare(packDir);
    const winners = { ...allMethod(6), "copy-5": "bare" as const, "copy-6": "bare" as const };
    const result = report(packDir, sessionDir, judge(packDir, sessionDir, winners));
    expect(result.practices[0]).toMatchObject({ practice: "copy", candidateWins: 4, baselineWins: 2, ties: 0, decided: 6, status: "pass" });
    expect(formatJudgingReport(result)).toMatch(/copy .*PASS/);
  });

  it("never counts ties as wins", () => {
    const packDir = makePack(practiceCases("copy", 9));
    const sessionDir = prepare(packDir);
    const winners: Record<string, "bare" | "method" | "tie"> = {};
    for (let index = 1; index <= 9; index += 1) winners[`copy-${index}`] = index <= 3 ? "method" : index <= 6 ? "bare" : "tie";
    const result = report(packDir, sessionDir, judge(packDir, sessionDir, winners));
    expect(result.practices[0]).toMatchObject({ candidateWins: 3, baselineWins: 3, ties: 3, decided: 6, status: "fail" });
    const fewDecided = { ...allMethod(9), "copy-4": "tie", "copy-5": "tie", "copy-6": "tie", "copy-7": "tie" } as const;
    expect(report(packDir, sessionDir, judge(packDir, sessionDir, fewDecided)).practices[0]).toMatchObject({ candidateWins: 5, decided: 5, status: "fail" });
  });

  it("reports an incomplete practice as incomplete, never as a pass", () => {
    const packDir = makePack([...practiceCases("copy", 8), ...practiceCases("outreach", 6)]);
    const sessionDir = prepare(packDir);
    const winners = { ...allMethod(8), ...allMethod(6, "outreach"), "copy-8": "skip" as const };
    const result = report(packDir, sessionDir, judge(packDir, sessionDir, winners));
    expect(result.practices.find((entry) => entry.practice === "copy")).toMatchObject({ candidateWins: 7, judged: 7, pairs: 8, status: "incomplete" });
    expect(result.practices.find((entry) => entry.practice === "outreach")).toMatchObject({ status: "pass" });
    expect(formatJudgingReport(result)).toMatch(/copy .*INCOMPLETE/);
  });

  it("takes the pass rule as a parameter", () => {
    const packDir = makePack(practiceCases("copy", 4));
    const sessionDir = prepare(packDir);
    const verdicts = judge(packDir, sessionDir, { ...allMethod(4), "copy-4": "bare" });
    expect(report(packDir, sessionDir, verdicts).practices[0]!.status).toBe("fail");
    expect(report(packDir, sessionDir, verdicts, parsePassRule({ minDecided: "4", minWinRate: "0.75" })).practices[0]!.status).toBe("pass");
    expect(report(packDir, sessionDir, verdicts, parsePassRule({ minDecided: "4", minWinRate: "4/5" })).practices[0]!.status).toBe("fail");
    expect(() => parsePassRule({ minWinRate: "3/2" })).toThrow();
    expect(() => parsePassRule({ minDecided: "0" })).toThrow();
  });

  it("rejects a pair judged twice in the verdict file", () => {
    const packDir = makePack(practiceCases("copy", 2));
    const sessionDir = prepare(packDir);
    const verdicts = judge(packDir, sessionDir, allMethod(2));
    expect(() => report(packDir, sessionDir, [...verdicts, { ...verdicts[0]!, verdict: "B" }])).toThrow(/judged twice/);
  });

  it("rejects a tampered draft, nonce, or verdict digest", () => {
    const packDir = makePack(practiceCases("copy", 2));
    const sessionDir = prepare(packDir);
    const verdicts = judge(packDir, sessionDir, allMethod(2));

    const editedPack = temp();
    cpSync(packDir, editedPack, { recursive: true });
    writeFileSync(join(editedPack, "copy-1", "method.md"), "A quietly improved draft.");
    expect(() => report(editedPack, sessionDir, verdicts)).toThrow(/changed since/);

    const keyPath = join(sessionDir, "sealed", "key.json");
    const key = JSON.parse(readFileSync(keyPath, "utf8"));
    writeFileSync(keyPath, JSON.stringify({ ...key, nonce: "y".repeat(48) }));
    expect(() => report(packDir, sessionDir, verdicts)).toThrow(/assignment/);
    writeFileSync(keyPath, JSON.stringify(key));

    const swapped = { ...verdicts[0]!, artifactDigests: [verdicts[0]!.artifactDigests[1], verdicts[0]!.artifactDigests[0]] as [typeof verdicts[0]["artifactDigests"][0], typeof verdicts[0]["artifactDigests"][0]] };
    expect(() => report(packDir, sessionDir, [swapped, verdicts[1]!])).toThrow(/digest/);
  });

  it("rejects a pack whose arm went missing after the session was prepared", () => {
    const packDir = makePack(practiceCases("copy", 2));
    const sessionDir = prepare(packDir);
    const verdicts = judge(packDir, sessionDir, allMethod(2));
    rmSync(join(packDir, "copy-2", "bare.md"));
    expect(() => report(packDir, sessionDir, verdicts)).toThrow(/copy-2.*bare/);
  });

  it("counts reject-both as undecided and runs on the sample pack", () => {
    const sessionDir = prepare(samplePack);
    const verdicts = judge(samplePack, sessionDir, { "copy-hero": "method", "copy-pricing": "tie", "outreach-first-touch": "method" });
    const session = loadJudgingSession(sessionDir);
    const pricing = session.pairs.find((entry) => entry.pair.caseId === "copy-pricing")!;
    const rejected = upsertVerdict(session, verdicts, { ...verdicts.find((entry) => entry.blindPairId === pricing.pair.id)!, verdict: "reject-both" });
    const result = buildJudgingReport({ packDir: samplePack, sessionDir, verdicts: rejected, rule: parsePassRule({}) });
    expect(result.practices.find((entry) => entry.practice === "copy")).toMatchObject({ candidateWins: 1, ties: 0, rejectBoth: 1, decided: 1, status: "fail" });
  });
});
