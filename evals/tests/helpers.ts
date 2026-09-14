import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BrokenRun, CandidateBuild, Dimension, EvalCase, Experiment, ProviderCell, Run, Sha256 } from "../src/contracts";

export const root = resolve(import.meta.dirname, "..");
export const sha = (character: string): Sha256 => `sha256:${character.repeat(64)}` as Sha256;
export const candidateId = "c".repeat(64);

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(root, "fixtures", name), "utf8")) as T;
}

export const candidate = (): CandidateBuild => structuredClone(fixture<CandidateBuild>("example-candidate.json"));
export const evalCase = (): EvalCase => structuredClone(fixture<EvalCase>("example-case.json"));
export const provider = (): ProviderCell => structuredClone(fixture<ProviderCell>("example-provider.json"));

export const dimension: Dimension = {
  schemaVersion: "conquistador.dimension/v1",
  id: "quality",
  rubricVersion: "1.0.0",
  description: "Finished-outcome quality",
  minimumScore: 3,
  medianFloor: 3,
};

export function run(repetition: 1 | 2 | 3, status: Run["status"] = "pass", score = 4): Run {
  return {
    schemaVersion: "conquistador.run/v1",
    id: `run-${repetition}`,
    caseId: "example-normal",
    candidateBuildId: candidateId,
    providerCellId: "example-provider-cell",
    repetition,
    status,
    startedAt: "2026-08-11T00:00:00.000Z",
    finishedAt: "2026-08-11T00:00:01.000Z",
    traceDigest: sha(String(repetition)),
    artifactDigests: [sha("a")],
    assertionResults: [{ assertionId: "finished-outcome", status, evidenceDigests: [sha("b")] }],
    dimensionResults: [{ dimensionId: "quality", score }],
    externalActions: [],
    terminalMarker: true,
  };
}

export function brokenRun(repetition: 1 | 2 | 3): BrokenRun {
  return {
    schemaVersion: "conquistador.broken-run/v1",
    id: `broken-${repetition}`,
    caseId: "example-normal",
    candidateBuildId: candidateId,
    providerCellId: "example-provider-cell",
    repetition,
    status: "broken",
    startedAt: "2026-08-11T00:00:00.000Z",
    finishedAt: "2026-08-11T00:00:01.000Z",
    cause: "provider transport failed before a result",
    traceDigest: sha("c"),
    terminalMarker: true,
  };
}

export const experiment = (): Experiment => ({
  schemaVersion: "conquistador.experiment/v1",
  id: "bounded-1",
  candidateBuildId: candidateId,
  baselineDigest: sha("d"),
  mutablePaths: ["candidates/bounded-1/prompt.md"],
  maxRuns: 6,
  maxBudgetUsd: 2,
  stopConditions: ["six runs complete", "budget reached"],
  benchmarkDigest: sha("e"),
});
