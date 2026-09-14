import { type Sha256 } from "./canonical.ts";
export declare const ARTIFACT_STATUSES: readonly ["draft", "reviewed", "approved", "acted", "observed"];
export declare const RELATIONSHIP_KINDS: readonly ["input-of", "decision-for", "action-from", "result-of"];
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];
export type ArtifactRelationshipKind = (typeof RELATIONSHIP_KINDS)[number];
export type ArtifactRelationship = {
    kind: ArtifactRelationshipKind;
    artifactId: string;
};
export type ArtifactSourceContext = {
    parentArtifactIds: string[];
};
export type ArtifactProvenance = {
    playbookId: string;
    playbookVersion: string;
    runId: string;
    stepId: string;
    skillId?: string;
    skillVersion?: string;
    skillPackageDigest?: Sha256;
    skillInterfaceDigest?: Sha256;
    scriptId?: string;
    toolOperationId?: string;
    sourceContext: ArtifactSourceContext;
};
export type ArtifactRevisionEntry = {
    n: number;
    contentDigest: Sha256;
    producedAt: string;
    source: "run" | "human-edit";
};
export type ArtifactRevision = {
    n: number;
    previousContentDigest: Sha256 | null;
    contentDigest: Sha256;
    chain: ArtifactRevisionEntry[];
};
export type ToolReceiptRef = {
    receiptId: string;
    path: string;
} & ({
    executed: false;
} | {
    catalogReceiptDigest: Sha256;
    status: import("./operation-bridge.ts").OperationTerminalReceipt["status"];
});
export type HumanEdit = {
    at: string;
    previousContentDigest: Sha256;
    nextContentDigest: Sha256;
    summary: string;
    source: "human";
};
export type ArtifactReviewVerdict = {
    packetId: string;
    packetDigest: Sha256;
    outcome: "accept" | "revise" | "reject" | "cancel";
    artifactId: string;
    artifactRevision: number;
    boundContentDigest: Sha256;
    decidedAt: string;
};
export type ArtifactApprovedAction = {
    gateId: string;
    boundPayloadDigest: Sha256;
    decidedAt: string;
    destination: ArtifactDestination;
};
export type ArtifactDestination = {
    channel: string | null;
    publicationId: string | null;
};
export type ObservationWindow = {
    declared: string;
    elapsed: boolean;
};
export type ArtifactResults = {
    status: "unknown";
} | {
    status: "known";
    measures: Record<string, unknown>;
};
export type ArtifactEnvelope = {
    schemaVersion: "conquistador.artifact-envelope/v1";
    id: string;
    identity: {
        artifactId: string;
        schema: string;
        format: "markdown" | "json";
    };
    provenance: ArtifactProvenance;
    revision: ArtifactRevision;
    status: ArtifactStatus;
    relationships: ArtifactRelationship[];
    toolReceipts: ToolReceiptRef[];
    humanEdits: HumanEdit[];
    reviewVerdict: ArtifactReviewVerdict | null;
    approvedAction: ArtifactApprovedAction | null;
    destination: ArtifactDestination | null;
    observationWindow: ObservationWindow | null;
    results: ArtifactResults;
    contentDigest: Sha256;
};
export type AttributionContext = {
    runId: string;
    playbookId: string;
    playbookVersion: string;
    produced: Array<{
        artifactId: string;
        stepId: string;
    }>;
    steps: Array<{
        id: string;
        skillId?: string;
        skillVersion?: string;
        skillPackageDigest?: Sha256;
        skillInterfaceDigest?: Sha256;
        scriptId?: string;
        toolOperationId?: string;
    }>;
};
export type PriorConsumption = {
    path: string;
    artifactId: string;
    contentDigest: Sha256;
    envelope?: ArtifactEnvelope;
    reviewedAs: "approved" | "unreviewed";
    verdict?: "accept" | "revise" | "reject" | "cancel";
    reason: "approved" | "missing-verdict" | "unapproved" | "revised-after-approval" | "stale-approval" | "missing-envelope";
};
export declare function splitMarkdown(raw: string): {
    frontMatter: Record<string, unknown>;
    body: string;
};
export declare function markdownContentDigest(raw: string): Sha256;
export declare function jsonContentDigest(raw: string): Sha256;
export declare function readArtifactContentDigest(path: string, format: "markdown" | "json"): Sha256;
export declare function artifactSidecarPath(artifactFile: string): string;
export declare function contentDigestOf(body: unknown): Sha256;
export declare function validateArtifactEnvelope(value: unknown): asserts value is ArtifactEnvelope;
export declare function assertAttribution(envelope: ArtifactEnvelope, context: AttributionContext): void;
export declare function relationshipsFor(input: {
    artifactId: string;
    parents: string[];
    scriptId?: string;
    toolOperationId?: string;
}): ArtifactRelationship[];
export declare function buildArtifactEnvelope(input: {
    artifactId: string;
    schema: string;
    format: "markdown" | "json";
    playbookId: string;
    playbookVersion: string;
    runId: string;
    stepId: string;
    skillId?: string;
    skillVersion?: string;
    skillPackageDigest?: Sha256;
    skillInterfaceDigest?: Sha256;
    scriptId?: string;
    toolOperationId?: string;
    parents: string[];
    contentDigest: Sha256;
    producedAt: string;
    toolReceipts?: ToolReceiptRef[];
    destination?: ArtifactDestination | null;
    observationWindow?: ObservationWindow | null;
    results?: ArtifactResults;
    status?: ArtifactStatus;
}): ArtifactEnvelope;
export declare function writeEnvelope(path: string, envelope: ArtifactEnvelope): void;
export declare function readEnvelope(path: string): ArtifactEnvelope;
export declare function patchEnvelope(path: string, patch: Partial<Pick<ArtifactEnvelope, "status" | "reviewVerdict" | "approvedAction" | "observationWindow" | "results" | "destination">>): ArtifactEnvelope;
export declare function applyHumanEdit(options: {
    artifactFile: string;
    envelopeFile?: string;
    newBody: unknown;
    summary: string;
    now: string;
}): ArtifactEnvelope;
export declare function consumePriorArtifact(path: string): PriorConsumption;
export declare function tryConsumePriorInput(value: unknown): PriorConsumption | undefined;
