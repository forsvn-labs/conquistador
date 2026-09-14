import type { Decision, Experiment, Sha256 } from "./contracts.ts";
import { invariant, requireSha256 } from "./validate.ts";

const IMMUTABLE_ROOTS = ["benchmarks/", "schemas/", "tests/", "release/", "promptfooconfig.yaml"];
const ALLOWED_ACTIONS = new Set(["edit-candidate", "evaluate", "compare", "decide"]);

function safePath(path: string): boolean {
  return Boolean(path) && !path.startsWith("/") && !path.includes("\\") && path.split("/").every((part) => part && part !== "." && part !== "..");
}

export function validateExperiment(experiment: Experiment): void {
  invariant(experiment.schemaVersion === "conquistador.experiment/v1", "Experiment schema is not v1");
  invariant(experiment.maxRuns > 0 && Number.isInteger(experiment.maxRuns), "maxRuns must be a positive integer");
  invariant(experiment.maxBudgetUsd >= 0 && Number.isFinite(experiment.maxBudgetUsd), "maxBudgetUsd must be finite and non-negative");
  invariant(experiment.mutablePaths.length > 0, "a narrow mutable surface is required");
  invariant(new Set(experiment.mutablePaths).size === experiment.mutablePaths.length, "mutable paths must be unique");
  for (const path of experiment.mutablePaths) {
    invariant(safePath(path), `unsafe mutable path: ${path}`);
    invariant(path.startsWith(`candidates/${experiment.id}/`), `mutable path is outside candidates/${experiment.id}/`);
    invariant(!IMMUTABLE_ROOTS.some((root) => path.startsWith(root)), `immutable path cannot be mutable: ${path}`);
  }
  requireSha256(experiment.baselineDigest, "baselineDigest");
  requireSha256(experiment.benchmarkDigest, "benchmarkDigest");
}

export function authorizeProposal(input: {
  experiment: Experiment;
  changedPaths: string[];
  plannedRuns: number;
  plannedBudgetUsd: number;
  actions: string[];
}): void {
  validateExperiment(input.experiment);
  invariant(Number.isInteger(input.plannedRuns) && input.plannedRuns >= 0, "plannedRuns must be a non-negative integer");
  invariant(Number.isFinite(input.plannedBudgetUsd) && input.plannedBudgetUsd >= 0, "plannedBudgetUsd must be finite and non-negative");
  invariant(input.plannedRuns <= input.experiment.maxRuns, "proposal expands the run budget");
  invariant(input.plannedBudgetUsd <= input.experiment.maxBudgetUsd, "proposal expands the spend budget");
  invariant(input.changedPaths.length > 0, "proposal changes no declared candidate surface");
  for (const path of input.changedPaths) {
    invariant(input.experiment.mutablePaths.includes(path), `proposal changes undeclared path: ${path}`);
  }
  for (const action of input.actions) {
    invariant(ALLOWED_ACTIONS.has(action), `autoresearch action is forbidden: ${action}`);
  }
}

export function decideExperiment(input: {
  experiment: Experiment;
  proposalDigest: Sha256;
  evidenceRunIds: string[];
  verdict: Decision["verdict"];
  rationale: string;
  decidedAt: string;
}): Decision {
  validateExperiment(input.experiment);
  requireSha256(input.proposalDigest, "proposalDigest");
  invariant(input.evidenceRunIds.length > 0, "a decision requires candidate-bound runs");
  invariant(input.rationale.trim().length > 0, "a decision requires rationale");
  return {
    schemaVersion: "conquistador.decision/v1",
    id: `${input.experiment.id}:${input.verdict}`,
    experimentId: input.experiment.id,
    verdict: input.verdict,
    baselineDigest: input.experiment.baselineDigest,
    proposalDigest: input.proposalDigest,
    evidenceRunIds: [...input.evidenceRunIds],
    rationale: input.rationale,
    decidedAt: input.decidedAt,
  };
}
