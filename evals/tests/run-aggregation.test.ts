import { describe, expect, it } from "vitest";

import { aggregateCase } from "../src/run-aggregation";
import { brokenRun, dimension, run } from "./helpers";

describe("run aggregation", () => {
  it("passes three stable repetitions and reports variance", () => {
    const result = aggregateCase([run(1, "pass", 3), run(2, "pass", 4), run(3, "pass", 5)], [dimension]);
    expect(result.status).toBe("pass");
    expect(result.releaseEligible).toBe(true);
    expect(result.flaky).toBe(false);
    expect(result.variance[0]).toMatchObject({ sampleCount: 3, mean: 4, median: 4, range: 2 });
    expect(result.variance[0].standardDeviation).toBeGreaterThan(0);
  });

  it("keeps one broken repetition visible and never release-eligible", () => {
    const result = aggregateCase([run(1), run(2), brokenRun(3)], [dimension]);
    expect(result.status).toBe("pass");
    expect(result.brokenRuns).toBe(1);
    expect(result.brokenRate).toBe(1 / 3);
    expect(result.flaky).toBe(true);
    expect(result.releaseEligible).toBe(false);
  });

  it("rejects missing, duplicate, mixed-build, and external-action runs", () => {
    expect(() => aggregateCase([run(1), run(2)], [dimension])).toThrow(/all three/);
    expect(() => aggregateCase([run(1), run(1), run(3)], [dimension])).toThrow(/run IDs|repetitions/);
    const mixed = run(3);
    mixed.candidateBuildId = "other-build";
    expect(() => aggregateCase([run(1), run(2), mixed], [dimension])).toThrow(/one exact Candidate Build/);
    const external = run(3) as any;
    external.externalActions = ["publish"];
    expect(() => aggregateCase([run(1), run(2), external], [dimension])).toThrow(/external action/);
    const invalidPass = run(3);
    invalidPass.assertionResults[0].status = "fail";
    expect(() => aggregateCase([run(1), run(2), invalidPass], [dimension])).toThrow(/passing run/);
  });

  it("does not pass two broken repetitions", () => {
    const result = aggregateCase([run(1), brokenRun(2), brokenRun(3)], [dimension]);
    expect(result.status).toBe("inconclusive");
    expect(result.releaseEligible).toBe(false);
  });

  it("reports null variance rather than fabricated numbers when all runs break", () => {
    const result = aggregateCase([brokenRun(1), brokenRun(2), brokenRun(3)], [dimension]);
    expect(result.status).toBe("inconclusive");
    expect(result.variance[0]).toEqual({
      dimensionId: "quality",
      sampleCount: 0,
      mean: null,
      median: null,
      range: null,
      standardDeviation: null,
    });
  });
});
