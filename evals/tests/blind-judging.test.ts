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
  sequentialDecision,
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

function makePack(cases: CaseSpec[], arms = { baseline: "bare", candidate: "method" }, id = "test-pack"): string {
  const dir = temp();
  writeFileSync(join(dir, "pack.json"), JSON.stringify({ schemaVersion: "conquistador.judging-pack/v1", id, arms }));
  return addCases(dir, cases, arms);
}

function addCases(dir: string, cases: CaseSpec[], arms = { baseline: "bare", candidate: "method" }): string {
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
function judge(packDir: string, sessionDir: string, winners: Record<string, "bare" | "method" | "tie" | "skip">, earlier: string[] = []): HumanVerdict[] {
  const session = loadJudgingSession(sessionDir);
  const assignments = revealSessionAssignments(packDir, sessionDir, earlier);
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

const allMethod = (count: number, practice = "copy", from = 1) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`${practice}-${index + from}`, "method" as const]));

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

describe("sequential pass rule", () => {
  const report = (packDir: string, sessionDir: string, verdicts: HumanVerdict[]) =>
    buildJudgingReport({ packDir, sessionDir, verdicts, rule: parsePassRule({ sequential: true }) });

  it("decides at 6 decided pairs: PASS at 6-0 and 5-1, FAIL at 2-4 or worse, otherwise EXTEND by 4", () => {
    expect(sequentialDecision(6, 6).status).toBe("pass");
    expect(sequentialDecision(5, 6).status).toBe("pass");
    expect(sequentialDecision(4, 6)).toMatchObject({ status: "extend", addPairs: 4 });
    expect(sequentialDecision(3, 6)).toMatchObject({ status: "extend", addPairs: 4 });
    expect(sequentialDecision(2, 6).status).toBe("fail");
    expect(sequentialDecision(1, 6).status).toBe("fail");
    expect(sequentialDecision(0, 6).status).toBe("fail");
  });

  it("decides at 10 decided pairs: PASS at 8 or more, otherwise FAIL", () => {
    expect(sequentialDecision(10, 10).status).toBe("pass");
    expect(sequentialDecision(8, 10).status).toBe("pass");
    expect(sequentialDecision(7, 10).status).toBe("fail");
    expect(sequentialDecision(5, 10).status).toBe("fail");
  });

  it("asks for more pairs below 6 decided, and between 6 and 10 unless the 10-pair result is already fixed", () => {
    expect(sequentialDecision(5, 5)).toMatchObject({ status: "extend", addPairs: 1 });
    expect(sequentialDecision(0, 0)).toMatchObject({ status: "extend", addPairs: 6 });
    expect(sequentialDecision(6, 8)).toMatchObject({ status: "extend", addPairs: 2 });
    expect(sequentialDecision(8, 9).status).toBe("pass");
    expect(sequentialDecision(4, 7).status).toBe("fail");
    expect(sequentialDecision(5, 7)).toMatchObject({ status: "extend", addPairs: 3 });
  });

  it("holds the 10-pair share above 10 decided pairs", () => {
    expect(sequentialDecision(10, 12).status).toBe("pass");
    expect(sequentialDecision(9, 12).status).toBe("fail");
  });

  it("explains every result and its next step in plain words", () => {
    for (const [wins, decided] of [[6, 6], [4, 6], [2, 6], [8, 10], [7, 10], [3, 4]] as const) {
      const decision = sequentialDecision(wins, decided);
      expect(decision.reason.length).toBeGreaterThan(10);
      expect(decision.nextStep).toMatch(/^[A-Z]/);
    }
    expect(sequentialDecision(4, 6).nextStep).toMatch(/4 new cases/);
    expect(sequentialDecision(6, 6).nextStep).toMatch(/practices\.json/);
    expect(sequentialDecision(2, 6).nextStep).toMatch(/[Dd]o not ship/);
  });

  it("reports EXTEND, PASS, and FAIL per practice, and INCOMPLETE while a pair is unjudged", () => {
    const packDir = makePack([...practiceCases("copy", 6), ...practiceCases("ads", 6), ...practiceCases("social", 6), ...practiceCases("video", 6)]);
    const sessionDir = prepare(packDir);
    const winners = {
      ...allMethod(6), "copy-5": "bare" as const, "copy-6": "bare" as const,
      ...allMethod(6, "ads"), "ads-6": "bare" as const,
      ...allMethod(6, "social"), "social-1": "bare" as const, "social-2": "bare" as const, "social-3": "bare" as const, "social-4": "bare" as const,
      ...allMethod(6, "video"), "video-6": "skip" as const,
    };
    const result = report(packDir, sessionDir, judge(packDir, sessionDir, winners));
    const status = Object.fromEntries(result.practices.map((entry) => [entry.practice, entry.status]));
    expect(status).toEqual({ copy: "extend", ads: "pass", social: "fail", video: "incomplete" });
    const text = formatJudgingReport(result);
    expect(text).toMatch(/sequential/i);
    expect(text).toMatch(/copy .*EXTEND/);
    expect(text).toMatch(/ads .*PASS/);
    expect(text).toMatch(/social .*FAIL/);
    expect(text).toMatch(/Next: .*copy/i);
  });

  it("keeps the default rule when --sequential is absent, and refuses to mix the two rules", () => {
    expect(parsePassRule({})).toEqual({ minDecided: 6, minWinRate: { numerator: 2, denominator: 3 } });
    expect(() => parsePassRule({ sequential: true, minDecided: "4" })).toThrow(/sequential/);
    expect(() => parsePassRule({ sequential: true, minWinRate: "3/4" })).toThrow(/sequential/);
  });
});


describe("extending a sequential test", () => {
  const sequential = parsePassRule({ sequential: true });
  /** First session: 6 copy cases judged 3-3 (EXTEND), verdicts saved in the session folder. */
  function firstLook(winsOfSix = 3) {
    const packDir = makePack(practiceCases("copy", 6));
    const first = prepare(packDir);
    const winners: Record<string, "bare" | "method"> = {};
    for (let index = 1; index <= 6; index += 1) winners[`copy-${index}`] = index <= winsOfSix ? "method" : "bare";
    writeVerdictsFile(join(first, "verdicts.json"), judge(packDir, first, winners));
    return { packDir, first };
  }
  const grow = (packDir: string, count = 4) => addCases(packDir, practiceCases("copy", 6 + count).slice(6));
  const extendFrom = (packDir: string, earlier: string[], extra: Partial<Parameters<typeof prepareJudgingSession>[0]> = {}) =>
    prepare(packDir, { extend: earlier, nonce: "e".repeat(48), ...extra });
  const combined = (packDir: string, chain: Array<{ sessionDir: string; verdicts: HumanVerdict[] }>, rule = sequential) =>
    buildJudgingReport({ packDir, sessions: chain, rule });

  it("seals only the new cases into a linked session, with its own key", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    const second = extendFrom(packDir, [first]);
    const session = loadJudgingSession(second);
    expect(session.pairs.map((entry) => entry.pair.caseId)).toEqual(["copy-10", "copy-7", "copy-8", "copy-9"]);
    expect(session.extends).toEqual([{ sessionId: loadJudgingSession(first).sessionId, caseIds: ["copy-1", "copy-2", "copy-3", "copy-4", "copy-5", "copy-6"] }]);
    expect(session.sessionId).not.toBe(loadJudgingSession(first).sessionId);
    expect(JSON.parse(readFileSync(join(second, "sealed", "key.json"), "utf8")).nonce).toBe("e".repeat(48));
    const html = readFileSync(join(second, "judge.html"), "utf8");
    expect(html).not.toContain("Plain draft 1 for copy");
    expect(html).toContain("Plain draft 7 for copy");
  });

  it("reports the combined 10-pair result: 3-3 then 4-0 fails at 7, 4-2 then 4-0 passes at 8", () => {
    for (const [winsOfSix, status] of [[3, "fail"], [4, "pass"]] as const) {
      const { packDir, first } = firstLook(winsOfSix);
      grow(packDir);
      const second = extendFrom(packDir, [first]);
      const result = combined(packDir, [
        { sessionDir: first, verdicts: readVerdictsFile(join(first, "verdicts.json")) },
        { sessionDir: second, verdicts: judge(packDir, second, allMethod(4, "copy", 7), [first]) },
      ]);
      expect(result.practices[0]).toMatchObject({ practice: "copy", pairs: 10, judged: 10, candidateWins: winsOfSix + 4, decided: 10, status });
      expect(result.sessionIds).toHaveLength(2);
      expect(formatJudgingReport(result)).toContain(result.sessionIds![1]!);
    }
  });

  it("refuses to extend when a draft of an earlier case changed, the pack is different, or nothing is new", () => {
    const { packDir, first } = firstLook();
    expect(() => extendFrom(packDir, [first])).toThrow(/no new cases/);
    grow(packDir);
    writeFileSync(join(packDir, "copy-2", "method.md"), "A quietly improved draft.");
    expect(() => extendFrom(packDir, [first])).toThrow(/copy-2 changed since/);

    const other = firstLook();
    const renamed = makePack(practiceCases("copy", 10), { baseline: "bare", candidate: "method" }, "other-pack");
    expect(() => extendFrom(renamed, [other.first])).toThrow(/pack test-pack, not other-pack/);
    const rearmed = makePack(practiceCases("copy", 10).map(({ bare, method, ...rest }) => ({ ...rest, bare, method: undefined, extra: { "candidate.md": method! } })), { baseline: "bare", candidate: "candidate" });
    expect(() => extendFrom(rearmed, [other.first])).toThrow(/arms changed/);
  });

  it("refuses to extend for another judge, a new practice, unjudged pairs, or a result that is already decided", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    expect(() => extendFrom(packDir, [first], { reviewer: "someone-else" })).toThrow(/reviewer/);
    addCases(packDir, practiceCases("ads", 1));
    expect(() => extendFrom(packDir, [first])).toThrow(/practice ads is not in the earlier sessions/);
    rmSync(join(packDir, "ads-1"), { recursive: true });

    const verdicts = readVerdictsFile(join(first, "verdicts.json"));
    writeVerdictsFile(join(first, "verdicts.json"), verdicts.slice(1));
    expect(() => extendFrom(packDir, [first])).toThrow(/judge every pair/);
    rmSync(join(first, "verdicts.json"));
    expect(() => extendFrom(packDir, [first])).toThrow(/judge every pair/);

    for (const [winsOfSix, decided] of [[5, /PASS/], [2, /FAIL/]] as const) {
      const look = firstLook(winsOfSix);
      grow(look.packDir);
      expect(() => extendFrom(look.packDir, [look.first])).toThrow(decided);
    }
  });

  it("refuses a second extension of the same session, so a test cannot fork", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    const second = extendFrom(packDir, [first]);
    expect(() => prepare(packDir, { extend: [first], nonce: "f".repeat(48) })).toThrow(/already extended/);
    expect(loadJudgingSession(second).extends).toHaveLength(1);
  });

  it("refuses an extension or a grown base passed alone, sessions out of order, and the same session twice", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    const second = extendFrom(packDir, [first]);
    const firstVerdicts = readVerdictsFile(join(first, "verdicts.json"));
    const secondVerdicts = judge(packDir, second, allMethod(4, "copy", 7), [first]);
    expect(() => buildJudgingReport({ packDir, sessionDir: second, verdicts: secondVerdicts, rule: sequential })).toThrow(/extends .*pass every session/);
    expect(() => buildJudgingReport({ packDir, sessionDir: first, verdicts: firstVerdicts, rule: sequential })).toThrow(/extended by .*pass that session too/);
    const grownOnly = firstLook();
    grow(grownOnly.packDir);
    expect(() => buildJudgingReport({ packDir: grownOnly.packDir, sessionDir: grownOnly.first, verdicts: [], rule: sequential })).toThrow(/copy-10, copy-7, copy-8, copy-9.*not in the session|not in the session.*copy-10/);
    expect(() => combined(packDir, [{ sessionDir: first, verdicts: firstVerdicts }])).toThrow(/extended by/);
    expect(() => combined(packDir, [{ sessionDir: second, verdicts: secondVerdicts }, { sessionDir: first, verdicts: firstVerdicts }])).toThrow(/oldest first/);
    expect(() => combined(packDir, [{ sessionDir: first, verdicts: firstVerdicts }, { sessionDir: first, verdicts: firstVerdicts }])).toThrow(/copy-1 is in sessions/);
  });

  it("refuses a verdict file from another session, a changed draft after extension, and mixed judges", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    const second = extendFrom(packDir, [first]);
    const firstVerdicts = readVerdictsFile(join(first, "verdicts.json"));
    const secondVerdicts = judge(packDir, second, allMethod(4, "copy", 7), [first]);
    expect(() => combined(packDir, [{ sessionDir: first, verdicts: secondVerdicts }, { sessionDir: second, verdicts: firstVerdicts }])).toThrow(/unknown pair/);

    const sessionPath = join(second, "session.json");
    const original = readFileSync(sessionPath, "utf8");
    writeFileSync(sessionPath, JSON.stringify({ ...JSON.parse(original), reviewer: "someone-else" }));
    expect(() => combined(packDir, [{ sessionDir: first, verdicts: firstVerdicts }, { sessionDir: second, verdicts: secondVerdicts }])).toThrow(/reviewer/);
    writeFileSync(sessionPath, JSON.stringify({ ...JSON.parse(original), extends: [] }));
    expect(() => combined(packDir, [{ sessionDir: first, verdicts: firstVerdicts }, { sessionDir: second, verdicts: secondVerdicts }])).toThrow(/links changed/);
    writeFileSync(sessionPath, original);

    writeFileSync(join(packDir, "copy-3", "bare.md"), "A quietly weakened draft.");
    expect(() => combined(packDir, [{ sessionDir: first, verdicts: firstVerdicts }, { sessionDir: second, verdicts: secondVerdicts }])).toThrow(/copy-3 changed since/);
  });

  it("combines sessions only under the sequential rule, and refuses a re-judged earlier look that is now decided", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    const second = extendFrom(packDir, [first]);
    const chain = [
      { sessionDir: first, verdicts: readVerdictsFile(join(first, "verdicts.json")) },
      { sessionDir: second, verdicts: judge(packDir, second, allMethod(4, "copy", 7), [first]) },
    ];
    expect(() => combined(packDir, chain, parsePassRule({}))).toThrow(/sequential/);
    const rejudged = judge(packDir, first, { ...allMethod(6), "copy-6": "bare" });
    expect(() => combined(packDir, [{ ...chain[0]!, verdicts: rejudged }, chain[1]!])).toThrow(/already PASS after session/);
  });

  it("keeps a practice with unjudged new pairs incomplete", () => {
    const { packDir, first } = firstLook();
    grow(packDir);
    const second = extendFrom(packDir, [first]);
    const result = combined(packDir, [
      { sessionDir: first, verdicts: readVerdictsFile(join(first, "verdicts.json")) },
      { sessionDir: second, verdicts: judge(packDir, second, { ...allMethod(4, "copy", 7), "copy-10": "skip" }, [first]) },
    ]);
    expect(result.practices[0]).toMatchObject({ pairs: 10, judged: 9, status: "incomplete" });
  });
});
