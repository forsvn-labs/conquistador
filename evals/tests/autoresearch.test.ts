import { describe, expect, it } from "vitest";

import { authorizeProposal, decideExperiment, validateExperiment } from "../src/autoresearch";
import { experiment, sha } from "./helpers";

describe("bounded autoresearch", () => {
  it("permits only a declared candidate surface within fixed run and spend budgets", () => {
    const value = experiment();
    expect(() =>
      authorizeProposal({
        experiment: value,
        changedPaths: ["candidates/bounded-1/prompt.md"],
        plannedRuns: 6,
        plannedBudgetUsd: 2,
        actions: ["edit-candidate", "evaluate", "compare", "decide"],
      }),
    ).not.toThrow();
  });

  it.each([
    ["benchmark mutation", ["benchmarks/matrix-v1.json"], 1, 0, []],
    ["scope expansion", ["candidates/bounded-1/undeclared.md"], 1, 0, []],
    ["run expansion", ["candidates/bounded-1/prompt.md"], 7, 0, []],
    ["budget expansion", ["candidates/bounded-1/prompt.md"], 1, 2.01, []],
    ["release approval", ["candidates/bounded-1/prompt.md"], 1, 0, ["approve-release"]],
    ["publishing", ["candidates/bounded-1/prompt.md"], 1, 0, ["publish"]],
    ["negative runs", ["candidates/bounded-1/prompt.md"], -1, 0, []],
    ["negative budget", ["candidates/bounded-1/prompt.md"], 1, -1, []],
  ])("rejects %s", (_name, paths, runs, budget, actions) => {
    expect(() =>
      authorizeProposal({
        experiment: experiment(),
        changedPaths: paths as string[],
        plannedRuns: runs as number,
        plannedBudgetUsd: budget as number,
        actions: actions as string[],
      }),
    ).toThrow();
  });

  it("limits decisions to keep, discard, or inconclusive evidence records", () => {
    const decision = decideExperiment({
      experiment: experiment(),
      proposalDigest: sha("f"),
      evidenceRunIds: ["run-1", "run-2", "run-3"],
      verdict: "discard",
      rationale: "The proposal did not improve the frozen rubric.",
      decidedAt: "2026-08-11T02:00:00.000Z",
    });
    expect(decision.verdict).toBe("discard");
    expect(Object.keys(decision)).not.toContain("releaseApproval");
  });

  it("rejects unsafe experiment roots", () => {
    const value = experiment();
    value.mutablePaths = ["../benchmarks/matrix-v1.json"];
    expect(() => validateExperiment(value)).toThrow(/unsafe mutable path/);
  });
});
