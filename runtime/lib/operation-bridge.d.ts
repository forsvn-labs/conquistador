import { type OperationCatalog, type OperationResult } from "./operations.ts";
export type OperationBridgeRequest = {
    operationId: string;
    actionClass: "observe" | "draft" | "consequential";
    runId: string;
    stepId: string;
    idempotencyKey: string;
    remainingCost: number;
    unitsUsedForOperation: number;
    inputs: Readonly<Record<string, unknown>>;
    values: Readonly<Record<string, unknown>>;
    artifactBodies: Readonly<Record<string, unknown>>;
    signal: AbortSignal;
    deadlineAt: string;
};
/** Credential-free projection; full catalog receipt remains in the host receipt store. */
export type OperationTerminalReceipt = {
    schemaVersion: "conquistador.operation-terminal-receipt/v1";
    catalogReceiptDigest: `sha256:${string}`;
    requestDigest: `sha256:${string}`;
    status: "succeeded" | "partial" | "failed" | "pending" | "unknown" | "rejected" | "expired" | "blocked";
    terminalRecord: true;
    usageKnown: boolean;
    accepted: boolean;
    unitsUsed: number | null;
    costUsed: number | null;
    data: Record<string, unknown>;
};
export type OperationBridgeOutcome = {
    kind: "receipt";
    receipt: OperationTerminalReceipt;
} | {
    kind: "handoff";
};
export type OperationBridge = {
    invoke(request: OperationBridgeRequest): Promise<OperationBridgeOutcome>;
};
export declare class OperationReconciliationRequired extends Error {
    readonly receipt?: OperationTerminalReceipt;
    constructor(receipt?: OperationTerminalReceipt);
}
export declare function validateOperationTerminalReceipt(value: unknown): asserts value is OperationTerminalReceipt;
export declare function hasOperationDispatch(directory: string, runId: string, stepId: string): boolean;
export declare function invokeDurableOperation(input: {
    bridge?: OperationBridge;
    catalog: OperationCatalog;
    directory: string;
    request: Omit<OperationBridgeRequest, "idempotencyKey" | "actionClass">;
}): Promise<OperationResult>;
