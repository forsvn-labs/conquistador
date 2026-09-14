import type { AnyRun, Dimension, Run } from "./contracts.ts";
import { invariant } from "./validate.ts";

export type DimensionVariance = {
  dimensionId: string;
  sampleCount: number;
  mean: number | null;
  median: number | null;
  range: number | null;
  standardDeviation: number | null;
};

export type CaseResult = {
  caseId: string;
  candidateBuildId: string;
  providerCellId: string;
  status: "pass" | "fail" | "inconclusive";
  passingRuns: number;
  failingRuns: number;
  inconclusiveRuns: number;
  brokenRuns: number;
  brokenRate: number;
  flaky: boolean;
  releaseEligible: boolean;
  variance: DimensionVariance[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function varianceFor(runs: Run[], dimension: Dimension): DimensionVariance {
  const values = runs.flatMap((run) =>
    run.dimensionResults.filter((result) => result.dimensionId === dimension.id).map((result) => result.score),
  );
  invariant(values.length === runs.length, `${dimension.id} must be scored in every completed run`);
  if (!values.length) {
    return {
      dimensionId: dimension.id,
      sampleCount: 0,
      mean: null,
      median: null,
      range: null,
      standardDeviation: null,
    };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardDeviation = Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  );
  return {
    dimensionId: dimension.id,
    sampleCount: values.length,
    mean,
    median: median(values),
    range: Math.max(...values) - Math.min(...values),
    standardDeviation,
  };
}

export function aggregateCase(runs: AnyRun[], dimensions: Dimension[]): CaseResult {
  invariant(runs.length === 3, "a case aggregate requires all three planned repetitions");
  const first = runs[0];
  invariant(new Set(runs.map((run) => run.id)).size === 3, "run IDs must be unique");
  invariant(new Set(runs.map((run) => run.repetition)).size === 3, "repetitions 1, 2, and 3 must each appear once");
  invariant(runs.every((run) => run.caseId === first.caseId), "runs must use one Eval Case");
  invariant(runs.every((run) => run.candidateBuildId === first.candidateBuildId), "runs must use one exact Candidate Build");
  invariant(runs.every((run) => run.providerCellId === first.providerCellId), "runs must use one exact Provider Cell");
  invariant(runs.every((run) => run.terminalMarker === true), "unresolved runs cannot enter an aggregate");

  const completed = runs.filter((run): run is Run => run.schemaVersion === "conquistador.run/v1");
  invariant(completed.every((run) => run.externalActions.length === 0), "a run attempted an external action");
  invariant(
    completed.every(
      (run) =>
        run.status !== "pass" ||
        run.assertionResults.every((result) => result.status === "pass"),
    ),
    "a passing run contains a non-passing assertion",
  );
  const passingRuns = completed.filter((run) => run.status === "pass").length;
  const failingRuns = completed.filter((run) => run.status === "fail").length;
  const inconclusiveRuns = completed.filter((run) => run.status === "inconclusive").length;
  const brokenRuns = runs.length - completed.length;
  const variance = dimensions.map((dimension) => varianceFor(completed, dimension));
  const dimensionPass = dimensions.every((dimension) => {
    const result = variance.find((entry) => entry.dimensionId === dimension.id)!;
    return (
      result.median !== null &&
      result.mean !== null &&
      result.median >= dimension.medianFloor &&
      result.mean >= dimension.minimumScore
    );
  });
  const flaky = new Set(completed.map((run) => run.status)).size > 1 || brokenRuns > 0;
  const status =
    passingRuns >= 2 && brokenRuns <= 1 && dimensionPass
      ? "pass"
      : inconclusiveRuns > 0 || brokenRuns > 1
        ? "inconclusive"
        : "fail";
  return {
    caseId: first.caseId,
    candidateBuildId: first.candidateBuildId,
    providerCellId: first.providerCellId,
    status,
    passingRuns,
    failingRuns,
    inconclusiveRuns,
    brokenRuns,
    brokenRate: brokenRuns / 3,
    flaky,
    releaseEligible: status === "pass" && !flaky && brokenRuns === 0,
    variance,
  };
}
