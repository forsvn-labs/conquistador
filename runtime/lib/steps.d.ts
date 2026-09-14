import { type OperationCatalog, type OperationResult } from "./operations.ts";
import type { PlaybookStep } from "./registry.ts";
export type ArtifactBody = {
    format: "markdown" | "json";
    body: unknown;
};
export type StepContext = {
    step: PlaybookStep;
    inputs: Record<string, unknown>;
    values: Record<string, unknown>;
    artifactBodies: Record<string, unknown>;
    now: Date;
    runId: string;
    operations?: OperationCatalog;
    operationResult?: OperationResult;
};
export type StepExecution = {
    artifacts: Record<string, ArtifactBody>;
    values?: Record<string, unknown>;
    operation?: OperationResult;
};
export declare function resolveSkillId(step: PlaybookStep, ctx: StepContext): string;
export declare function degradeDeclaredStep(ctx: StepContext, error: string): StepExecution;
export declare function executeDeclaredStep(ctx: StepContext): StepExecution;
