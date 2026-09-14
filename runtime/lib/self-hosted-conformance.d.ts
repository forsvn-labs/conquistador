import { type Sha256 } from "./canonical.ts";
export declare const SELF_HOSTED_SCHEMA_VERSION = "conquistador.self-hosted-conformance/v1";
export declare const SELF_HOSTED_DECLARATION_VERSION = "exts-155.self-hosted-runtime/v1";
export declare const SELF_HOSTED_COLLECTOR_VERSION = "self-hosted-collector/v1";
export declare const SELF_HOSTED_FIXED_CLOCK = "2026-08-22T00:00:00.000Z";
export declare const SELF_HOSTED_PATHS: {
    readonly declaration: "runtime/conformance/matrix-v1.json";
    readonly schema: "runtime/conformance/schema-v1.json";
    readonly corpus: "runtime/conformance/adversarial-v1.json";
    readonly record: "release/evidence/self-hosted/conformance-v1.json";
    readonly report: "release/evidence/self-hosted/conformance-v1.md";
    readonly externalPacket: "release/evidence/self-hosted/external-execution-packet-v1.json";
};
export declare function normalizedReporter(value: unknown): unknown;
export declare function normalizedReporterDigest(report: unknown): Sha256;
declare const EXACT_CELL_IDS: readonly ["SH-API-MACOS-ARM64", "SH-CANDIDATE-MACOS-ARM64", "SH-CLEAN-HOST-LINUX-X64", "SH-CLEAN-HOST-MACOS-ARM64", "SH-CLI-CONFIG-MACOS-ARM64", "SH-HUMAN-AUTH-CANDIDATE", "SH-LINUX-X64-RUNTIME", "SH-OCI-AMD64", "SH-OCI-ARM64", "SH-PROVIDER-ANTHROPIC-LIVE", "SH-PROVIDER-DECL-MACOS-ARM64", "SH-PROVIDER-OPENAI-LIVE", "SH-PROVIDER-VERCEL-LIVE", "SH-REVIEW-AUTH-MACOS-ARM64", "SH-SECURITY-MACOS-ARM64", "SH-STATE-MACOS-ARM64", "SH-SUPPORT-LINUX-X64", "SH-SUPPORT-MACOS-ARM64"];
export type CellId = typeof EXACT_CELL_IDS[number];
export type ProofClass = "local-runtime" | "candidate-bound" | "platform" | "provider-live" | "clean-host" | "oci" | "human" | "customer-support";
export type CellStatus = "passed" | "missing";
export type SourceBinding = {
    path: string;
    sha256: Sha256;
};
export type CommandRequirement = {
    kind: "command";
    cwd: "runtime";
    argv: string[];
};
export type ReceiptRequirement = {
    kind: "external-receipt";
    receiptClass: "candidate-bound-runtime" | "linux-x64-runtime" | "provider-live" | "oci-image" | "clean-host-lifecycle" | "authenticated-human-authority" | "customer-support";
};
export type CellDeclaration = {
    id: CellId;
    ownerIssue: "EXTS-155";
    platform: "macos" | "linux" | "provider" | "oci" | "support" | "candidate";
    architecture: "arm64" | "x64" | "amd64" | "none";
    profile: string;
    identity: {
        provider: string | null;
        model: string | null;
        apiVersion: string | null;
        image: string | null;
        tag: string | null;
        imageDigest: Sha256 | null;
    };
    proofClass: ProofClass;
    required: CommandRequirement | ReceiptRequirement;
    expectedStatus: CellStatus;
    currentSupportClaim: "local-macos-arm64-only" | "unsupported-pending-exact-evidence";
    missingReason: string | null;
    sources: SourceBinding[];
};
export type SelfHostedDeclaration = {
    declarationVersion: typeof SELF_HOSTED_DECLARATION_VERSION;
    ownerIssue: "EXTS-155";
    fixedClock: typeof SELF_HOSTED_FIXED_CLOCK;
    authority: {
        releaseState: "NO-GO";
        candidateStatus: "UNBOUND";
        selectedCandidate: null;
        g3Status: "INCOMPLETE";
        landing: "disabled";
        exts161Packet: null;
    };
    timingNormalization: readonly ["startTime", "endTime", "duration"];
    cells: CellDeclaration[];
};
export type LocalObservation = {
    cellId: CellId;
    command: CommandRequirement;
    exitCode: number;
    reportDigest: Sha256;
    counts: {
        testSuites: number;
        passedTestSuites: number;
        failedTestSuites: number;
        tests: number;
        passedTests: number;
        failedTests: number;
    };
};
export type ExternalReceipt = {
    cellId: CellId;
    receiptId: string;
    receiptClass: ReceiptRequirement["receiptClass"];
    status: "succeeded";
    startedAt: string;
    finishedAt: string;
    sequence: number;
    replayNonce: string;
    subjectDigest: Sha256;
    evidence: SourceBinding;
};
export type ObservationSet = {
    fixedClock: typeof SELF_HOSTED_FIXED_CLOCK;
    declarationRawDigest: Sha256;
    local: LocalObservation[];
    external: ExternalReceipt[];
};
export type ResolvedFile = {
    path: string;
    sha256: Sha256;
    bytes: Uint8Array;
    kind: "regular" | "special";
    ancestorSymlink: boolean;
};
export type FileResolver = (path: string) => ResolvedFile;
export type ConformanceRow = CellDeclaration & {
    result: {
        status: CellStatus;
        observedAt: string | null;
        command: CommandRequirement | null;
        exitCode: number | null;
        counts: LocalObservation["counts"] | null;
        reportDigest: Sha256 | null;
        observationDigest: Sha256 | null;
        receipt: ExternalReceipt | null;
        missingReason: string | null;
    };
};
export type ConformanceRecord = {
    schemaVersion: typeof SELF_HOSTED_SCHEMA_VERSION;
    declarationVersion: typeof SELF_HOSTED_DECLARATION_VERSION;
    collectorVersion: typeof SELF_HOSTED_COLLECTOR_VERSION;
    generatedAt: typeof SELF_HOSTED_FIXED_CLOCK;
    declarationRawDigest: Sha256;
    authority: SelfHostedDeclaration["authority"];
    host: {
        platform: "macos";
        architecture: "arm64";
    };
    rows: ConformanceRow[];
    aggregate: {
        total: number;
        passed: number;
        missing: number;
        supported: number;
        byProofClass: Record<ProofClass, {
            total: number;
            passed: number;
            missing: number;
        }>;
        missingReasons: string[];
    };
    overall: "INCOMPLETE";
    digest: Sha256;
};
export declare class ConformanceError extends Error {
    readonly code: string;
    constructor(code: string, detail: string);
}
export declare function assertNoSecretLikeKeys(value: unknown, path?: string): void;
export declare function validateDeclaration(input: unknown, resolver: FileResolver): SelfHostedDeclaration;
export declare function collectConformance(declarationInput: unknown, observationInput: unknown, resolver: FileResolver): ConformanceRecord;
export declare function validateRecord(input: unknown, resolver: FileResolver): ConformanceRecord;
export declare function fileSystemResolver(productRoot: string): FileResolver;
export declare function renderConformanceReport(record: ConformanceRecord): string;
export declare function renderExternalPacket(record: ConformanceRecord): string;
export {};
