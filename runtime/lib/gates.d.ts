import { type Sha256 } from "./canonical.ts";
import { type ActionAuthorizationV1, type ReviewPacketV1, ReviewTransitionState, type ReviewVerdictV1, type ValidationContext } from "./review-contract.ts";
export type BoundArtifact = {
    artifactId: string;
    path: string;
    contentDigest: Sha256;
};
export type PlaybookReviewPacket = {
    schemaVersion: "conquistador.review-packet/v1";
    id: string;
    sessionId: string;
    messageId: string;
    runId: string;
    gateId: string;
    requestedOutcome: string;
    completed: string;
    deliverables: Array<{
        kind: "artifact" | "text";
        content: string;
        digest: Sha256;
    }>;
    evidence: unknown[];
    assumptions: string[];
    unknowns: string[];
    quality: Array<{
        id: string;
        status: "passed" | "warning" | "failed";
    }>;
    learningProposals: unknown[];
    actionProposals: Array<Record<string, unknown>>;
    humanRequired: true;
    modelCannotSatisfy: true;
    actionGateSeparate: true;
    outcomes: ["accept", "revise", "reject", "cancel"];
    boundArtifacts: BoundArtifact[];
    createdAt: string;
    digest: Sha256;
};
export type ActionGateRecord = {
    schemaVersion: "conquistador.action-gate/v1";
    id: string;
    runId: string;
    gateId: string;
    afterGate: string;
    requiresReviewOutcome: "accept";
    humanRequired: true;
    modelCannotSatisfy: true;
    mutationClass: "draft" | "publish" | "spend" | "account-change";
    fallback: "human-action-manifest";
    reviewPacketId: string;
    reviewPacketDigest: Sha256;
    reviewOutcome: "accept";
    boundArtifacts: BoundArtifact[];
    boundPayloadDigest: Sha256;
    executed: false;
    liveCall: false;
    credentialsUsed: false;
    createdAt: string;
    digest: Sha256;
};
export type GateEvaluation = {
    ok: true;
} | {
    ok: false;
    code: "unreviewed" | "stale-approval" | "missing-binding";
    detail: string;
};
export declare function validatePlaybookReviewPacket(value: unknown): asserts value is PlaybookReviewPacket;
export declare function validateActionGateRecord(value: unknown): asserts value is ActionGateRecord;
export declare function actionPayloadDigest(payload: {
    mutationClass: string;
    operationId: string;
    artifactContentDigests: Record<string, Sha256>;
}): Sha256;
export declare function createReviewPacket(input: {
    runId: string;
    gateId: string;
    requestedOutcome: string;
    deliverables: PlaybookReviewPacket["deliverables"];
    boundArtifacts: BoundArtifact[];
    actionProposals: Array<Record<string, unknown>>;
    createdAt: string;
}): PlaybookReviewPacket;
export declare function createActionGateRecord(input: {
    runId: string;
    gateId: string;
    afterGate: string;
    mutationClass: ActionGateRecord["mutationClass"];
    packet: PlaybookReviewPacket;
    canonicalPacket: ReviewPacketV1;
    verdict: ReviewVerdictV1;
    authorization: ActionAuthorizationV1;
    transitions: ReviewTransitionState;
    context: ValidationContext;
    operationId: string;
    createdAt: string;
}): ActionGateRecord;
export declare function evaluateReviewApproval(packet: PlaybookReviewPacket, currentContentDigests: Record<string, Sha256>): GateEvaluation;
export declare function evaluateActionGate(input: {
    packet: PlaybookReviewPacket;
    canonicalPacket: ReviewPacketV1;
    verdict: ReviewVerdictV1;
    authorization: ActionAuthorizationV1;
    transitions: ReviewTransitionState;
    context: ValidationContext;
    gate: ActionGateRecord;
    currentContentDigests: Record<string, Sha256>;
    currentPayloadDigest: Sha256;
}): GateEvaluation;
