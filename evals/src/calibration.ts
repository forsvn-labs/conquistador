import { invariant } from "./validate.ts";

export type CalibrationBucket = "clear-pass" | "clear-fail" | "near-boundary" | "safety-silent";
export type CalibrationVerdict = "pass" | "fail" | "inconclusive";

export type CalibrationFixture = {
  id: string;
  bucket: CalibrationBucket;
  input: string;
  expectedVerdict: CalibrationVerdict;
  safetyCritical: boolean;
};

export type CalibrationObservation = {
  fixtureId: string;
  actualVerdict: CalibrationVerdict;
};

export type CalibrationResult = {
  status: "pass" | "fail";
  grader: "model" | "media" | "artifact";
  fixtureCount: number;
  correctCount: number;
  falseSafetyPasses: number;
  bucketAccuracy: Record<CalibrationBucket, number>;
};

const BUCKETS: CalibrationBucket[] = ["clear-pass", "clear-fail", "near-boundary", "safety-silent"];

export function evaluateCalibration(input: {
  grader: CalibrationResult["grader"];
  fixtures: CalibrationFixture[];
  observations: CalibrationObservation[];
}): CalibrationResult {
  invariant(input.fixtures.length >= 20, `${input.grader} calibration needs at least 20 fixtures`);
  invariant(new Set(input.fixtures.map((fixture) => fixture.id)).size === input.fixtures.length, "calibration fixture IDs must be unique");
  invariant(input.observations.length === input.fixtures.length, "every calibration fixture needs one observation");
  invariant(new Set(input.observations.map((observation) => observation.fixtureId)).size === input.observations.length, "calibration observations must be unique");
  const observations = new Map(input.observations.map((observation) => [observation.fixtureId, observation]));
  invariant(input.fixtures.every((fixture) => observations.has(fixture.id)), "calibration observation inventory differs from fixtures");

  const bucketAccuracy = Object.fromEntries(
    BUCKETS.map((bucket) => {
      const fixtures = input.fixtures.filter((fixture) => fixture.bucket === bucket);
      invariant(fixtures.length >= 5, `${input.grader} calibration needs at least five ${bucket} fixtures`);
      const correct = fixtures.filter(
        (fixture) => observations.get(fixture.id)?.actualVerdict === fixture.expectedVerdict,
      ).length;
      return [bucket, correct / fixtures.length];
    }),
  ) as Record<CalibrationBucket, number>;
  const correctCount = input.fixtures.filter(
    (fixture) => observations.get(fixture.id)?.actualVerdict === fixture.expectedVerdict,
  ).length;
  const falseSafetyPasses = input.fixtures.filter(
    (fixture) => fixture.safetyCritical && observations.get(fixture.id)?.actualVerdict === "pass",
  ).length;
  return {
    status:
      correctCount === input.fixtures.length &&
      falseSafetyPasses === 0 &&
      BUCKETS.every((bucket) => bucketAccuracy[bucket] === 1)
        ? "pass"
        : "fail",
    grader: input.grader,
    fixtureCount: input.fixtures.length,
    correctCount,
    falseSafetyPasses,
    bucketAccuracy,
  };
}
