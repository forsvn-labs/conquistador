export declare const OPERATION_VERIFICATION_STATUSES: readonly ["unknown", "cataloged", "researched", "fixture-verified", "live-verified", "supported", "unsupported", "unverified"];
export type OperationVerificationStatus = (typeof OPERATION_VERIFICATION_STATUSES)[number];
export type OperationActionClass = "observe" | "draft" | "consequential";
export type VerifiedOperation = {
    id: string;
    provider: string;
    capabilityId: string;
    verificationStatus: OperationVerificationStatus;
    actionClass: OperationActionClass;
};
export type OperationCatalog = {
    schemaVersion: "conquistador.verified-operations/v1";
    records: VerifiedOperation[];
};
export type HumanActionManifestReason = "unsupported" | "unverified" | "unknown-operation";
export type HumanActionManifest = {
    schemaVersion: "conquistador.artifact.human-action-manifest/v1";
    operationId: string;
    provider: string;
    capabilityId: string;
    verificationStatus: OperationVerificationStatus;
    executed: false;
    liveCall: false;
    credentialsUsed: false;
    fallback: "human-action-manifest";
    reason: HumanActionManifestReason;
    summary: string;
    [extra: string]: unknown;
};
export type RecordedOperationStub = {
    schemaVersion: "conquistador.artifact.provider-draft-stub/v1";
    operationId: string;
    provider: string;
    capabilityId: string;
    verificationStatus: OperationVerificationStatus;
    stubbed: true;
    executed: false;
    liveCall: false;
    credentialsUsed: false;
    summary: string;
    [extra: string]: unknown;
};
export type OperationInvocation = {
    operationId: string;
    catalog: OperationCatalog;
    runId: string;
    stepId: string;
    summary?: string;
    extra?: Record<string, unknown>;
};
export type OperationResult = {
    kind: "gateway-receipt";
    operation: VerifiedOperation;
    receipt: import("./operation-bridge.ts").OperationTerminalReceipt;
} | {
    kind: "human-action-manifest";
    operation: VerifiedOperation;
    executed: false;
    liveCall: false;
    credentialsUsed: false;
    manifest: HumanActionManifest;
} | {
    kind: "recorded-stub";
    operation: VerifiedOperation;
    executed: false;
    liveCall: false;
    credentialsUsed: false;
    stub: RecordedOperationStub;
};
export declare function validateVerifiedOperation(value: unknown): asserts value is VerifiedOperation;
export declare function validateOperationCatalog(value: unknown): asserts value is OperationCatalog;
export declare function loadOperationCatalog(path?: string): OperationCatalog;
export declare function resolveOperation(operationId: string, catalog: OperationCatalog): VerifiedOperation;
export declare function buildHumanActionManifest(input: {
    operation: VerifiedOperation;
    known: boolean;
    summary: string;
    extra?: Record<string, unknown>;
}): HumanActionManifest;
export declare function renderManifestMarkdown(manifest: HumanActionManifest): string;
export declare function renderStubMarkdown(stub: RecordedOperationStub): string;
export declare function invokeVerifiedOperation(input: OperationInvocation): OperationResult;
export declare function defaultOperationCatalog(): OperationCatalog;
