import { type Sha256 } from "./canonical.ts";
export declare const REVIEW_CONTRACT_VERSION: "conquistador.review-contract/v1";
export declare const REVIEW_OUTCOMES: readonly ["accept", "revise", "reject", "cancel"];
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
export type WorkState = "finished" | "partial" | "cancelled" | "failed";
export type HumanRole = "operator" | "reviewer" | "release-authority";
export type AuthenticationProof = {
    principalId: string;
    role: HumanRole;
    method: string;
    verifier: string;
    verifiedAt: string;
    authority: string;
    subjectDigest: Sha256;
    proofDigest: Sha256;
};
export type HostAuthenticationVerifier = (proof: AuthenticationProof, context: {
    authority: string;
    role: HumanRole;
    now: string;
    subjectDigest: Sha256;
}) => boolean;
export type TransportAuthentication = {
    principalId: string;
    method: string;
    verifier: string;
    verifiedAt: string;
    subjectBinding: {
        issuer: string;
        subjectDigest: Sha256;
    };
};
export type HumanAuthenticationChallenge = {
    actionPayloadDigest?: Sha256;
    transport: TransportAuthentication;
    principalId: string;
    role: "reviewer" | "operator";
    authority: "content-review" | "consequential-action";
    now: string;
    subjectDigest: Sha256;
};
export type HostHumanAuthenticator = (challenge: HumanAuthenticationChallenge) => AuthenticationProof | Promise<AuthenticationProof>;
export type ValidationContext = {
    now: string;
    verifyAuthentication: HostAuthenticationVerifier;
    expectedRole?: HumanRole;
};
export type ReviewArtifactBinding = {
    artifactId: string;
    revision: number;
    digest: Sha256;
    state: WorkState;
};
export type ReviewPacketV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    kind: "review-packet";
    packetId: string;
    revisionId: string;
    revision: number;
    producer: {
        module: "portable-plugin" | "self-hosted-agent" | "tool-module" | "eval-lab" | "release";
        sourceId: string;
        capabilityId: string;
        playbookId: string | null;
        playbookVersion: string | null;
    };
    identity: {
        sessionId: string;
        runId: string;
        candidateId: string | null;
        evidenceId: string | null;
    };
    artifact: ReviewArtifactBinding;
    strategicBet: string;
    work: {
        state: WorkState;
        summary: string;
        partialReason: string | null;
    };
    materialTactics: string[];
    evidence: Array<{
        id: string;
        digest: Sha256;
        provenance: string;
    }>;
    unresolvedLimitations: string[];
    proposedNextAction: string;
    actionProposal: null | {
        authority: string;
        operation: string;
        connectionRef: string;
        payload: unknown;
        payloadDigest: Sha256;
    };
    redaction: {
        classification: "public" | "internal" | "confidential" | "secret";
        secretFields: string[];
        applied: true;
    };
    reviewBoundary: {
        humanRequired: true;
        modelCannotDecide: true;
        oneFinalVerdict: true;
        outcomes: readonly ReviewOutcome[];
    };
    createdAt: string;
    digest: Sha256;
};
export type ReviewVerdictV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    kind: "review-verdict";
    verdictId: string;
    outcome: ReviewOutcome;
    packetId: string;
    packetDigest: Sha256;
    artifactId: string;
    artifactRevision: number;
    artifactDigest: Sha256;
    actionPayloadDigest: Sha256 | null;
    sessionId: string;
    runId: string;
    candidateId: string | null;
    evidenceId: string | null;
    authentication: AuthenticationProof;
    decidedAt: string;
    expiryPolicy: "expires";
    expiresAt: string;
    singleUse: true;
    digest: Sha256;
};
export type ActionAuthorizationV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    kind: "action-authorization";
    authorizationId: string;
    verdictId: string;
    verdictDigest: Sha256;
    packetId: string;
    packetDigest: Sha256;
    sessionId: string;
    runId: string;
    candidateId: string | null;
    artifact: ReviewArtifactBinding;
    allowed: {
        authority: string;
        operation: string;
        connectionRef: string;
        payloadDigest: Sha256;
    };
    authentication: AuthenticationProof;
    authorizedAt: string;
    expiresAt: string;
    singleUse: true;
    digest: Sha256;
};
export type ActionReceiptV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    kind: "action-receipt";
    receiptId: string;
    authorizationId: string;
    authorizationDigest: Sha256;
    sessionId: string;
    runId: string;
    candidateId: string | null;
    artifact: ReviewArtifactBinding;
    authority: string;
    operation: string;
    connectionRef: string;
    payloadDigest: Sha256;
    status: "succeeded" | "failed" | "cancelled";
    startedAt: string;
    finishedAt: string;
    redactionApplied: true;
    terminal: true;
    digest: Sha256;
};
export type ResultObservationV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    kind: "result-observation";
    observationId: string;
    receiptId: string;
    receiptDigest: Sha256;
    status: "unknown" | "known";
    measures: Record<string, unknown> | null;
    observedAt: string;
    digest: Sha256;
};
export type LearningRecordV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    kind: "learning-record";
    learningId: string;
    observationId: string;
    observationDigest: Sha256;
    status: "unknown" | "recorded";
    claim: string | null;
    createdAt: string;
    digest: Sha256;
};
export type ReviewRecord = ReviewPacketV1 | ReviewVerdictV1 | ActionAuthorizationV1 | ActionReceiptV1 | ResultObservationV1 | LearningRecordV1;
export declare function validateArtifactBinding(v: unknown): asserts v is ReviewArtifactBinding;
export declare function seal<T extends object>(body: T): T & {
    digest: Sha256;
};
export declare function validateReviewPacket(v: unknown): asserts v is ReviewPacketV1;
export declare function verdictSubjectDigest(packet: ReviewPacketV1, verdict: Pick<ReviewVerdictV1, "verdictId" | "outcome" | "decidedAt" | "expiryPolicy" | "expiresAt">): Sha256;
export declare function authorizationSubjectDigest(authorization: Pick<ActionAuthorizationV1, "authorizationId" | "verdictId" | "verdictDigest" | "packetId" | "packetDigest" | "sessionId" | "runId" | "candidateId" | "artifact" | "allowed" | "authorizedAt" | "expiresAt">): Sha256;
export declare function validateVerdict(v: unknown, p: ReviewPacketV1, c: ValidationContext): asserts v is ReviewVerdictV1;
export type QualifiedReviewVerdictV1 = {
    schemaVersion: typeof REVIEW_CONTRACT_VERSION;
    verdictId: string;
    verdictDigest: Sha256;
    packetId: string;
    packetDigest: Sha256;
    artifactDigest: Sha256;
    reviewerPrincipalId: string;
    reviewerAuthSubjectDigest: Sha256;
    candidateId: string | null;
    evidenceId: string | null;
    outcome: ReviewOutcome;
    decidedAt: string;
    expiresAt: string;
    unresolvedLimitations: string[];
};
export declare function qualifyReviewVerdict(v: unknown, p: unknown, c: ValidationContext): QualifiedReviewVerdictV1;
export declare function validateActionAuthorization(a: unknown, p: ReviewPacketV1, v: ReviewVerdictV1, c: ValidationContext): asserts a is ActionAuthorizationV1;
export declare function validateReceipt(r: unknown, a: ActionAuthorizationV1): asserts r is ActionReceiptV1;
export declare function validateObservation(o: unknown, r: ActionReceiptV1): asserts o is ResultObservationV1;
export declare function validateLearning(l: unknown, o: ResultObservationV1): asserts l is LearningRecordV1;
export type ReviewTransitionSnapshot = {
    schemaVersion: "conquistador.review-transition-state/v1";
    consumedPackets: Array<{
        packetKey: Sha256;
        verdict: ReviewVerdictV1;
    }>;
    issuedAuthorizations: ActionAuthorizationV1[];
    consumedAuthorizations: Array<{
        authorizationKey: Sha256;
        receipt: ActionReceiptV1;
    }>;
    digest: Sha256;
};
export declare function packetTransitionKey(packet: ReviewPacketV1): Sha256;
export declare function validateTransitionSnapshot(value: unknown): asserts value is ReviewTransitionSnapshot;
export declare class ReviewTransitionState {
    #private;
    constructor(snapshot?: ReviewTransitionSnapshot);
    consumeVerdict(p: ReviewPacketV1, v: ReviewVerdictV1, c: ValidationContext): ReviewVerdictV1;
    authorize(a: unknown, p: ReviewPacketV1, v: ReviewVerdictV1, c: ValidationContext): ActionAuthorizationV1;
    authorizeAccepted(a: unknown, p: ReviewPacketV1, c: ValidationContext): ActionAuthorizationV1;
    issuedAuthorization(digest: Sha256): ActionAuthorizationV1;
    consumedVerdict(packet: ReviewPacketV1): ReviewVerdictV1;
    verdictFor(packet: ReviewPacketV1): ReviewVerdictV1 | undefined;
    authorizationWasIssued(authorization: ActionAuthorizationV1): boolean;
    authorizationWasConsumed(authorization: ActionAuthorizationV1): boolean;
    consumedReceipt(authorizationDigest: Sha256): ActionReceiptV1 | undefined;
    recordReceipt(r: unknown, a: ActionAuthorizationV1): ActionReceiptV1;
    snapshot(): ReviewTransitionSnapshot;
}
export declare function renderReviewPacketText(p: ReviewPacketV1): string;
