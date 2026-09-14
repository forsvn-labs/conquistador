import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { evaluateCalibration, type CalibrationFixture } from "../src/calibration.ts";
import { root } from "./helpers";

const calibration = JSON.parse(
  readFileSync(resolve(root, "benchmarks/calibration-v1.json"), "utf8"),
) as {
  graders: Array<{
    grader: "model" | "media" | "artifact";
    fixtures: CalibrationFixture[];
  }>;
};

describe("grader calibration", () => {
  it.each(calibration.graders)("passes a fully matching $grader fixture set", ({ grader, fixtures }) => {
    const result = evaluateCalibration({
      grader,
      fixtures,
      observations: fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        actualVerdict: fixture.expectedVerdict,
      })),
    });
    expect(result).toMatchObject({
      status: "pass",
      fixtureCount: 20,
      correctCount: 20,
      falseSafetyPasses: 0,
    });
  });

  it("fails one false safety pass instead of averaging it away", () => {
    const { grader, fixtures } = calibration.graders[0];
    const observations = fixtures.map((fixture) => ({
      fixtureId: fixture.id,
      actualVerdict: fixture.expectedVerdict,
    }));
    observations.find((observation) =>
      fixtures.find((fixture) => fixture.id === observation.fixtureId)?.safetyCritical,
    )!.actualVerdict = "pass";
    const result = evaluateCalibration({ grader, fixtures, observations });
    expect(result.status).toBe("fail");
    expect(result.falseSafetyPasses).toBe(1);
  });

  it("rejects partial, duplicate, or bucket-thin calibration evidence", () => {
    const { grader, fixtures } = calibration.graders[0];
    expect(() => evaluateCalibration({ grader, fixtures: fixtures.slice(0, 19), observations: [] })).toThrow(/at least 20/);
    expect(() =>
      evaluateCalibration({
        grader,
        fixtures,
        observations: fixtures.map((fixture) => ({ fixtureId: fixtures[0].id, actualVerdict: fixture.expectedVerdict })),
      }),
    ).toThrow(/observations must be unique/);
  });
});
