import { sha256 } from "./canonical.js";
import { renderReviewPacketText, seal, validateArtifactBinding, validateReviewPacket, } from "./review-contract.js";
import { bodyDigest, dg, exact, id, noSecret, nullableId, obj, ok, strings, text, utc, } from "./review-validation.js";
export const REVIEW_EVENT_VERSION = "conquistador.review-event/v1";
export const REVIEW_EVENT_TYPES = [
    "packet.presented",
    "annotation.created",
    "suggestion.created",
    "companion.failed",
];
export function validateReviewEvent(value, packet) {
    validateReviewPacket(packet);
    obj(value, "review event");
    exact(value, [
        "schemaVersion",
        "kind",
        "eventId",
        "sequence",
        "eventType",
        "source",
        "actor",
        "packetId",
        "packetDigest",
        "artifact",
        "sessionId",
        "runId",
        "candidateId",
        "evidenceId",
        "payload",
        "authority",
        "redaction",
        "createdAt",
        "digest",
    ], "review event");
    ok(value.schemaVersion === REVIEW_EVENT_VERSION &&
        value.kind === "review-event", "review event schema/kind invalid");
    id(value.eventId, "review event id");
    ok(Number.isInteger(value.sequence) && Number(value.sequence) > 0, "review event sequence invalid");
    ok(REVIEW_EVENT_TYPES.includes(value.eventType), "review event type invalid");
    obj(value.source, "review event source");
    exact(value.source, ["kind", "id"], "review event source");
    ok(["host", "companion"].includes(value.source.kind), "review event source kind invalid");
    id(value.source.id, "review event source id");
    obj(value.actor, "review event actor");
    exact(value.actor, ["kind", "id"], "review event actor");
    ok(["human", "agent", "system"].includes(value.actor.kind), "review event actor kind invalid");
    if (value.actor.kind === "system") {
        ok(value.actor.id === null, "system review event actor must be anonymous");
    }
    else {
        id(value.actor.id, "review event actor id");
    }
    ok(value.packetId === packet.packetId &&
        value.packetDigest === packet.digest, "review event packet mismatch");
    validateArtifactBinding(value.artifact);
    ok(sha256(value.artifact) === sha256(packet.artifact), "review event artifact mismatch");
    ok(value.sessionId === packet.identity.sessionId &&
        value.runId === packet.identity.runId &&
        value.candidateId === packet.identity.candidateId &&
        value.evidenceId === packet.identity.evidenceId, "review event identity mismatch");
    obj(value.payload, "review event payload");
    switch (value.eventType) {
        case "packet.presented":
            exact(value.payload, ["format", "presentationDigest", "canonicalTextAvailable"], "packet presented payload");
            ok(value.payload.format === "plain-text", "packet presented format invalid");
            dg(value.payload.presentationDigest, "presentation digest");
            ok(value.payload.canonicalTextAvailable === true &&
                value.source.kind === "host" && value.actor.kind === "system", "packet presentation must preserve canonical text");
            ok(value.payload.presentationDigest === sha256(renderReviewPacketText(packet)), "presentation digest does not bind canonical packet text");
            break;
        case "annotation.created":
            exact(value.payload, ["body", "anchor"], "annotation payload");
            text(value.payload.body, "annotation body");
            if (value.payload.anchor !== null) {
                text(value.payload.anchor, "annotation anchor");
            }
            ok(value.actor.kind !== "system", "annotation requires a human or agent actor");
            break;
        case "suggestion.created":
            exact(value.payload, ["body", "anchor", "replacement"], "suggestion payload");
            text(value.payload.body, "suggestion body");
            if (value.payload.anchor !== null) {
                text(value.payload.anchor, "suggestion anchor");
            }
            if (value.payload.replacement !== null) {
                text(value.payload.replacement, "suggestion replacement");
            }
            ok(value.actor.kind !== "system", "suggestion requires a human or agent actor");
            break;
        case "companion.failed":
            exact(value.payload, [
                "code",
                "message",
                "fallback",
                "canonicalReviewAvailable",
                "hostVerdictRequired",
            ], "companion failure payload");
            id(value.payload.code, "companion failure code");
            text(value.payload.message, "companion failure message");
            ok(value.payload.fallback === "plain-text" &&
                value.payload.canonicalReviewAvailable === true &&
                value.payload.hostVerdictRequired === true &&
                value.source.kind === "companion" && value.actor.kind === "system", "companion failure must fall back to plain text without authority");
            break;
    }
    obj(value.authority, "review event authority");
    exact(value.authority, [
        "canonicalOwner",
        "accept",
        "rewrite",
        "delete",
        "authorizeAction",
        "approveRelease",
    ], "review event authority");
    ok(Object.values(value.authority).every((entry) => entry === false), "review event authority must be none");
    obj(value.redaction, "review event redaction");
    exact(value.redaction, ["classification", "secretFields", "applied"], "review event redaction");
    ok(["public", "internal", "confidential", "secret"].includes(value.redaction.classification), "review event redaction class invalid");
    strings(value.redaction.secretFields, "review event secretFields", true);
    ok(value.redaction.applied === true, "review event redaction required");
    utc(value.createdAt, "review event createdAt");
    ok(Date.parse(value.createdAt) >= Date.parse(packet.createdAt), "review event chronology invalid");
    noSecret(value, "review event");
    bodyDigest(value);
}
export function validateReviewEventStream(value, packet) {
    validateReviewPacket(packet);
    ok(Array.isArray(value), "review event stream must be an array");
    if (value.length === 0)
        return;
    const ids = new Set();
    let previousAt = packet.createdAt;
    value.forEach((event, index) => {
        validateReviewEvent(event, packet);
        ok(event.sequence === index + 1, "review event stream sequence must be contiguous");
        ok(!ids.has(event.eventId), "review event ids must be unique");
        ids.add(event.eventId);
        ok(Date.parse(event.createdAt) >= Date.parse(previousAt), "review event stream chronology invalid");
        previousAt = event.createdAt;
    });
    const first = value[0];
    ok(first.eventType === "packet.presented" &&
        first.source.kind === "host" && first.actor.kind === "system" &&
        first.payload.format === "plain-text" &&
        first.payload.canonicalTextAvailable === true, "review event stream must start with canonical host plain text");
}
export function createReviewEvent(packet, input) {
    validateReviewPacket(packet);
    const event = seal({
        schemaVersion: REVIEW_EVENT_VERSION,
        kind: "review-event",
        eventId: input.eventId,
        sequence: input.sequence,
        eventType: input.eventType,
        source: input.source,
        actor: input.actor,
        packetId: packet.packetId,
        packetDigest: packet.digest,
        artifact: packet.artifact,
        sessionId: packet.identity.sessionId,
        runId: packet.identity.runId,
        candidateId: packet.identity.candidateId,
        evidenceId: packet.identity.evidenceId,
        payload: input.payload,
        authority: {
            canonicalOwner: false,
            accept: false,
            rewrite: false,
            delete: false,
            authorizeAction: false,
            approveRelease: false,
        },
        redaction: input.redaction,
        createdAt: input.createdAt,
    });
    validateReviewEvent(event, packet);
    return event;
}
