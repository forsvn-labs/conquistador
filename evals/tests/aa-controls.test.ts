import { describe, expect, it } from "vitest";

import { AA_CLASSES, measureAaControl, type AaExecution } from "../src/aa-controls.ts";
import { sha } from "./helpers";

function executions(): AaExecution[] {
  return AA_CLASSES.flatMap((caseClass, classIndex) =>
    ([1, 2, 3] as const).map((repetition) => ({
      id: `${caseClass}-${repetition}`,
      providerCellId: "cell-1",
      caseClass,
      inputDigest: sha(String(classIndex)),
      outputDigest: sha(String(classIndex + repetition)),
      score: classIndex + repetition,
    })),
  );
}

describe("A/A stochastic controls", () => {
  it("measures twelve executions across all four classes without granting authority", () => {
    const result = measureAaControl(executions(), "cell-1");
    expect(result).toMatchObject({
      status: "measured",
      executionCount: 12,
      classCounts: { normal: 3, boundary: 3, deep: 3, parent: 3 },
      authority: "none",
    });
    expect(result.uniqueOutputCount).toBeGreaterThan(1);
    expect(result.scoreStandardDeviation).toBeGreaterThan(0);
  });

  it("rejects partial, mixed-cell, or non-identical A/A inputs", () => {
    expect(() => measureAaControl(executions().slice(0, 11), "cell-1")).toThrow(/exactly 12/);
    const mixed = executions();
    mixed[0].providerCellId = "cell-2";
    expect(() => measureAaControl(mixed, "cell-1")).toThrow(/mixes Provider Cells/);
    const differentInput = executions();
    differentInput[0].inputDigest = sha("f");
    expect(() => measureAaControl(differentInput, "cell-1")).toThrow(/inputs differ/);
  });
});
