import { type Sha256 } from "./canonical.ts";
import { type ReviewArtifactBinding, type ReviewPacketV1 } from "./review-contract.ts";
export declare const REVIEW_EVENT_VERSION: "conquistador.review-event/v1";
export declare const REVIEW_EVENT_TYPES: readonly ["packet.presented", "annotation.created", "suggestion.created", "companion.failed"];
export type ReviewEventType = (typeof REVIEW_EVENT_TYPES)[number];
export type ReviewEventSource = {
    kind: "host" | "companion";
    id: string;
};
export type ReviewEventActor = {
    kind: "human" | "agent";
    id: string;
} | {
    kind: "system";
    id: null;
};
export type ReviewEventAuthority = {
    canonicalOwner: false;
    accept: false;
    rewrite: false;
    delete: false;
    authorizeAction: false;
    approveRelease: false;
};
export type ReviewEventPayloadMap = {
    "packet.presented": {
        format: "plain-text";
        presentationDigest: Sha256;
        canonicalTextAvailable: true;
    };
    "annotation.created": {
        body: string;
        anchor: string | null;
    };
    "suggestion.created": {
        body: string;
        anchor: string | null;
        replacement: string | null;
    };
    "companion.failed": {
        code: string;
        message: string;
        fallback: "plain-text";
        canonicalReviewAvailable: true;
        hostVerdictRequired: true;
    };
};
type ReviewEventBase = {
    schemaVersion: typeof REVIEW_EVENT_VERSION;
    kind: "review-event";
    eventId: string;
    sequence: number;
    source: ReviewEventSource;
    actor: ReviewEventActor;
    packetId: string;
    packetDigest: Sha256;
    artifact: ReviewArtifactBinding;
    sessionId: string;
    runId: string;
    candidateId: string | null;
    evidenceId: string | null;
    authority: ReviewEventAuthority;
    redaction: {
        classification: "public" | "internal" | "confidential" | "secret";
        secretFields: string[];
        applied: true;
    };
    createdAt: string;
    digest: Sha256;
};
export type ReviewEventV1 = {
    [Type in ReviewEventType]: ReviewEventBase & {
        eventType: Type;
        payload: ReviewEventPayloadMap[Type];
    };
}[ReviewEventType];
export type ReviewPresentationEventV1 = Extract<ReviewEventV1, {
    eventType: "packet.presented";
}>;
export declare function validateReviewEvent(value: unknown, packet: ReviewPacketV1): asserts value is ReviewEventV1;
export declare function validateReviewEventStream(value: unknown, packet: ReviewPacketV1): asserts value is ReviewEventV1[];
export declare function createReviewEvent<Type extends ReviewEventType>(packet: ReviewPacketV1, input: {
    eventId: string;
    sequence: number;
    eventType: Type;
    source: ReviewEventSource;
    actor: ReviewEventActor;
    payload: ReviewEventPayloadMap[Type];
    redaction: ReviewEventV1["redaction"];
    createdAt: string;
}): Extract<ReviewEventV1, {
    eventType: Type;
}>;
export {};
