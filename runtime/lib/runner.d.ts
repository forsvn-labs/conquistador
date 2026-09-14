import { type Sha256 } from "./canonical.ts";
import { type PlaybookReviewPacket } from "./gates.ts";
import { type ActionAuthorizationV1, type ActionReceiptV1, type ReviewPacketV1, type ReviewTransitionSnapshot, type ReviewVerdictV1, type ValidationContext } from "./review-contract.ts";
import { type OperationCatalog } from "./operations.ts";
import { type OperationBridge } from "./operation-bridge.ts";
import type { PlaybookRecord, PlaybookStep } from "./registry.ts";
import { type JudgmentProvider } from "./judgment.ts";
export declare const DEFAULT_RUNS_DIR = ".conquistador/runs";
export type RunStatus = "running" | "awaiting-judgment" | "awaiting-operation-reconciliation" | "awaiting-review" | "awaiting-action-authorization" | "awaiting-action-receipt" | "completed" | "failed" | "cancelled" | "rejected" | "revision-requested";
export type StepStatus = "pending" | "running" | "awaiting-judgment" | "completed" | "failed" | "degraded" | "skipped";
export type JudgmentRecordState = {
    requestId: string;
    requestDigest: Sha256;
    attempt: number;
    state: "pending" | "consumed" | "cancelled" | "expired";
    requestPath: string;
    responseDigest?: Sha256;
    consumedAt?: string;
};
export type StepRecord = {
    id: string;
    status: StepStatus;
    attempts: number;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
    skippedReason?: "completed-work-preserved";
    outputDigests?: Record<string, Sha256>;
    receiptId?: string;
    judgment?: {
        requestId: string;
        requestDigest: Sha256;
        responseDigest?: Sha256;
        outcome?: "succeeded" | "failed" | "cancelled";
    };
};
export type ArtifactRecord = {
    id: string;
    path: string;
    digest: Sha256;
    producedBy: string;
    parents: string[];
    envelopePath?: string;
    contentDigest?: Sha256;
};
export type TraceEvent = {
    sequence: number;
    at: string;
    type: "run.started" | "plan.written" | "run.resumed" | "step.started" | "step.completed" | "step.failed" | "step.degraded" | "step.skipped" | "judgment.requested" | "judgment.completed" | "operation.invoked" | "gate.review" | "gate.action" | "run.stopped";
    stepId?: string;
    detail: Record<string, unknown>;
};
export type PlanArtifact = {
    schemaVersion: "conquistador.plan/v1";
    runId: string;
    playbookId: string;
    canonicalId: string;
    playbookVersion: string;
    createdAt: string;
    order: string[];
    nodes: Array<{
        id: string;
        kind: PlaybookStep["kind"];
        dependsOn: string[];
        uses: PlaybookStep["uses"];
        failureBehavior: PlaybookStep["failureBehavior"];
        idempotency: PlaybookStep["idempotency"];
    }>;
    gates: PlaybookRecord["gates"];
    budgets: PlaybookRecord["budgets"];
    digest: Sha256;
};
export type RunState = {
    schemaVersion: "conquistador.run-state/v1";
    runId: string;
    playbookId: string;
    canonicalId: string;
    playbookVersion: string;
    status: RunStatus;
    reviewAuthority: "not-reached" | "pending" | "terminal";
    idempotencyKey: Sha256;
    createdAt: string;
    updatedAt: string;
    inputs: Record<string, unknown>;
    order: string[];
    steps: Record<string, StepRecord>;
    artifacts: Record<string, ArtifactRecord>;
    values: Record<string, unknown>;
    judgments?: Record<string, JudgmentRecordState>;
    tokenUsage: {
        inputTokens: number;
        outputTokens: number;
        judgmentTokens: number;
    };
    cost: number;
    costStatus?: "known" | "incomplete";
    operationUsage?: Record<string, {
        operationId: string;
        receiptDigest: Sha256;
        unitsUsed: number;
        costUsed: number;
    }>;
    review?: {
        gateId: string;
        packetPath: string;
        outcome?: "accept" | "revise" | "reject" | "cancel";
        decidedAt?: string;
        canonicalPacketPath?: string;
        verdictDigest?: Sha256;
        authorizationDigest?: Sha256;
    };
    reviewTransitions?: ReviewTransitionSnapshot;
    terminalAuthorityStop?: "review-cancelled" | "action-receipt-failed" | "action-receipt-cancelled";
};
export type RunSnapshot = {
    runId: string;
    directory: string;
    status: RunStatus;
    plan: PlanArtifact;
    state: RunState;
    trace: TraceEvent[];
};
export type StartRunOptions = {
    playbook: unknown;
    inputs: Record<string, unknown>;
    runsDir: string;
    runId?: string;
    now?: () => Date;
    signal?: AbortSignal;
    judgment?: JudgmentProvider;
    operations?: OperationCatalog;
    operationBridge?: OperationBridge;
    operationTimeoutMs?: number;
    interruptAfter?: string;
    failStep?: {
        id: string;
        error: string;
    };
};
export type ResumeRunOptions = {
    runsDir: string;
    runId: string;
    verdict?: ReviewVerdictV1;
    verification?: ValidationContext;
    actionAuthorization?: ActionAuthorizationV1;
    actionReceipt?: ActionReceiptV1;
    judgmentResponse?: unknown;
    now?: () => Date;
    signal?: AbortSignal;
    judgment?: JudgmentProvider;
    operations?: OperationCatalog;
    operationBridge?: OperationBridge;
    operationTimeoutMs?: number;
    interruptAfter?: string;
    failStep?: {
        id: string;
        error: string;
    };
    faultAfterAuthorityBoundary?: "journal" | "state" | "trace" | "decision" | "authorization" | "gate" | "receipt";
};
export declare function canonicalPacketFromLegacy(packet: PlaybookReviewPacket, playbook: PlaybookRecord, state: RunState): ReviewPacketV1;
export declare function playbookFixturePath(id: string): string;
export declare function runSummary(snapshot: RunSnapshot): Record<string, unknown>;
export declare function startPlaybookRun(options: StartRunOptions): Promise<RunSnapshot>;
export declare function resumePlaybookRun(options: ResumeRunOptions): Promise<RunSnapshot>;
export declare function loadPlaybookRun(runsDir: string, runId: string): RunSnapshot;
