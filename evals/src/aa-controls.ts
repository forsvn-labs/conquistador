import type { Sha256 } from "./contracts.ts";
import { invariant, requireSha256 } from "./validate.ts";

export const AA_CLASSES = ["normal", "boundary", "deep", "parent"] as const;
export type AaClass = (typeof AA_CLASSES)[number];

export type AaExecution = {
  id: string;
  providerCellId: string;
  caseClass: AaClass;
  inputDigest: Sha256;
  outputDigest: Sha256;
  score: number;
};

export type AaMeasurement = {
  status: "measured";
  providerCellId: string;
  executionCount: 12;
  classCounts: Record<AaClass, number>;
  uniqueOutputCount: number;
  scoreMean: number;
  scoreStandardDeviation: number;
  authority: "none";
};

export function measureAaControl(executions: AaExecution[], providerCellId: string): AaMeasurement {
  invariant(executions.length === 12, "A/A control requires exactly 12 executions per Provider Cell");
  invariant(new Set(executions.map((execution) => execution.id)).size === 12, "A/A execution IDs must be unique");
  invariant(executions.every((execution) => execution.providerCellId === providerCellId), "A/A control mixes Provider Cells");
  const classCounts = Object.fromEntries(
    AA_CLASSES.map((caseClass) => {
      const classExecutions = executions.filter((execution) => execution.caseClass === caseClass);
      invariant(classExecutions.length === 3, `A/A control requires three ${caseClass} executions`);
      invariant(new Set(classExecutions.map((execution) => execution.inputDigest)).size === 1, `${caseClass} A/A inputs differ`);
      return [caseClass, classExecutions.length];
    }),
  ) as Record<AaClass, number>;
  for (const execution of executions) {
    requireSha256(execution.inputDigest, `${execution.id}.inputDigest`);
    requireSha256(execution.outputDigest, `${execution.id}.outputDigest`);
    invariant(Number.isFinite(execution.score), `${execution.id}.score must be finite`);
  }
  const scoreMean = executions.reduce((sum, execution) => sum + execution.score, 0) / executions.length;
  const scoreStandardDeviation = Math.sqrt(
    executions.reduce((sum, execution) => sum + (execution.score - scoreMean) ** 2, 0) /
      executions.length,
  );
  return {
    status: "measured",
    providerCellId,
    executionCount: 12,
    classCounts,
    uniqueOutputCount: new Set(executions.map((execution) => execution.outputDigest)).size,
    scoreMean,
    scoreStandardDeviation,
    authority: "none",
  };
}
