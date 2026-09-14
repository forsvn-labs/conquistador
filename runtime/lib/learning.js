import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
export const LEARNING_KINDS = [
    "fact",
    "decision",
    "edit-delta",
    "action",
    "observed-result",
];
const PREFIX = "conquistador.learning";
const SHA = /^sha256:[a-f0-9]{64}$/;
const FORBIDDEN_BODY = /reasoning|hiddenReasoning|modelOutput|completion|inferred/i;
function invariant(condition, message) {
    if (!condition)
        throw new Error(`[${PREFIX}] ${message}`);
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, allowed, label) {
    const keys = Object.keys(value);
    invariant(keys.every((key) => allowed.includes(key)), `${label} contains an undeclared field`);
}
function nonEmpty(value, label) {
    invariant(typeof value === "string" && value.trim().length > 0, `${label} is required`);
}
function exactUtc(value, label) {
    invariant(typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value, `${label} must be an exact UTC ISO timestamp`);
}
export function learningLedgerPath(runsDir) {
    return resolve(runsDir, "learning.jsonl");
}
export function validateLearningEntry(value) {
    invariant(isObject(value), "learning entry must be an object");
    exactKeys(value, ["schemaVersion", "id", "recordedAt", "runId", "kind", "approved", "inferred", "source", "body"], "learning entry");
    invariant(value.schemaVersion === "conquistador.learning-entry/v1", "schemaVersion must be conquistador.learning-entry/v1");
    nonEmpty(value.id, "id");
    exactUtc(value.recordedAt, "recordedAt");
    nonEmpty(value.runId, "runId");
    invariant(typeof value.kind === "string" && LEARNING_KINDS.includes(value.kind), "kind is invalid");
    invariant(value.approved === true, "learning records only approved user-owned entries");
    invariant(value.inferred === false, "model-inferred learning entries are forbidden");
    invariant(isObject(value.source), "source is required");
    exactKeys(value.source, ["artifactId", "contentDigest", "reviewPacketId", "actionReceiptId"], "source");
    nonEmpty(value.source.artifactId, "source.artifactId");
    invariant(typeof value.source.contentDigest === "string" && SHA.test(value.source.contentDigest), "source.contentDigest must be a sha256 digest");
    nonEmpty(value.source.reviewPacketId, "source.reviewPacketId");
    if (value.source.actionReceiptId !== undefined) {
        nonEmpty(value.source.actionReceiptId, "source.actionReceiptId");
    }
    if (["action", "observed-result"].includes(value.kind)) {
        invariant(typeof value.source.actionReceiptId === "string", `${value.kind} entries require a terminal action receipt`);
    }
    invariant(value.body !== undefined, "body is required");
    invariant(!containsForbiddenKey(value.body), "learning body cannot store hidden reasoning or model output");
}
function containsForbiddenKey(value) {
    if (Array.isArray(value))
        return value.some((entry) => containsForbiddenKey(entry));
    if (isObject(value)) {
        return Object.entries(value).some(([key, child]) => FORBIDDEN_BODY.test(key) || containsForbiddenKey(child));
    }
    return false;
}
export function readLearningLedger(path) {
    if (!existsSync(path))
        return [];
    const lines = readFileSync(path, "utf8").split("\n").map((line) => line.trim()).filter(Boolean);
    const entries = [];
    for (const line of lines) {
        const parsed = JSON.parse(line);
        validateLearningEntry(parsed);
        entries.push(parsed);
    }
    return entries;
}
export function appendLearningEntry(ledgerPath, entry) {
    validateLearningEntry(entry);
    const existing = readLearningLedger(ledgerPath);
    if (existing.some((item) => item.id === entry.id))
        return entry;
    mkdirSync(dirname(ledgerPath), { recursive: true });
    appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`);
    return entry;
}
export function learningEntriesFromRun(input) {
    const entries = [];
    if (input.verdict.outcome !== "accept")
        return entries;
    const receipt = input.actionReceipt;
    const actionSucceeded = receipt?.status === "succeeded" && receipt.terminal === true;
    const exactCanonicalVerdict = input.verdict.packetId === input.canonicalPacket.packetId &&
        input.verdict.packetDigest === input.canonicalPacket.digest &&
        input.verdict.artifactId === input.canonicalPacket.artifact.artifactId &&
        input.verdict.artifactRevision === input.canonicalPacket.artifact.revision &&
        input.verdict.artifactDigest === input.canonicalPacket.artifact.digest;
    const exactReviewBinding = (envelope) => {
        const bound = envelope.reviewVerdict;
        return bound?.outcome === "accept" &&
            bound.packetId === input.canonicalPacket.packetId &&
            bound.packetDigest === input.canonicalPacket.digest &&
            bound.packetId === input.verdict.packetId &&
            input.verdict.packetDigest === input.canonicalPacket.digest &&
            bound.artifactId === envelope.identity.artifactId &&
            bound.artifactRevision === envelope.revision.n &&
            bound.boundContentDigest === envelope.contentDigest;
    };
    const matchesReceiptArtifact = (envelope) => Boolean(receipt) &&
        envelope.identity.artifactId === receipt.artifact.artifactId &&
        envelope.revision.n === receipt.artifact.revision &&
        envelope.contentDigest === receipt.artifact.digest;
    const matchesCanonicalVerdictArtifact = (envelope) => exactCanonicalVerdict &&
        envelope.identity.artifactId === input.verdict.artifactId &&
        envelope.revision.n === input.verdict.artifactRevision &&
        envelope.contentDigest === input.verdict.artifactDigest;
    // A result may be learned only after the same terminal receipt has an exact,
    // review-bound artifact in this run.  A manifest, a failed receipt, or an
    // unbound receipt cannot make downstream observations learnable.
    const hasReviewedTerminalReceipt = actionSucceeded && input.envelopes.some((envelope) => exactReviewBinding(envelope) &&
        matchesReceiptArtifact(envelope) &&
        matchesCanonicalVerdictArtifact(envelope));
    for (const envelope of input.envelopes) {
        const reviewed = exactReviewBinding(envelope);
        if (reviewed) {
            const kind = envelope.relationships.some((relation) => relation.kind === "decision-for") ? "decision" : "fact";
            entries.push({
                schemaVersion: "conquistador.learning-entry/v1",
                id: `${input.runId}.${kind}.${envelope.identity.artifactId}`,
                recordedAt: input.recordedAt,
                runId: input.runId,
                kind,
                approved: true,
                inferred: false,
                source: {
                    artifactId: envelope.identity.artifactId,
                    contentDigest: envelope.contentDigest,
                    reviewPacketId: input.canonicalPacket.packetId,
                },
                body: {
                    artifactId: envelope.identity.artifactId,
                    status: envelope.status,
                    contentDigest: envelope.contentDigest,
                },
            });
        }
        for (const [index, edit] of reviewed ? envelope.humanEdits.entries() : []) {
            entries.push({
                schemaVersion: "conquistador.learning-entry/v1",
                id: `${input.runId}.edit-delta.${envelope.identity.artifactId}.${index + 1}`,
                recordedAt: edit.at,
                runId: input.runId,
                kind: "edit-delta",
                approved: true,
                inferred: false,
                source: {
                    artifactId: envelope.identity.artifactId,
                    contentDigest: edit.nextContentDigest,
                    reviewPacketId: input.canonicalPacket.packetId,
                },
                body: {
                    previousContentDigest: edit.previousContentDigest,
                    nextContentDigest: edit.nextContentDigest,
                    summary: edit.summary,
                    source: "human",
                },
            });
        }
        if (hasReviewedTerminalReceipt &&
            reviewed &&
            matchesReceiptArtifact(envelope) &&
            matchesCanonicalVerdictArtifact(envelope)) {
            entries.push({
                schemaVersion: "conquistador.learning-entry/v1",
                id: `${input.runId}.action.${receipt.receiptId}`,
                recordedAt: input.recordedAt,
                runId: input.runId,
                kind: "action",
                approved: true,
                inferred: false,
                source: {
                    artifactId: envelope.identity.artifactId,
                    contentDigest: envelope.contentDigest,
                    reviewPacketId: input.canonicalPacket.packetId,
                    actionReceiptId: receipt.receiptId,
                },
                body: {
                    receiptId: receipt.receiptId,
                    receiptDigest: receipt.digest,
                    operation: receipt.operation,
                    finishedAt: receipt.finishedAt,
                },
            });
        }
        if (hasReviewedTerminalReceipt &&
            reviewed &&
            matchesCanonicalVerdictArtifact(envelope) &&
            envelope.observationWindow?.elapsed === true &&
            envelope.results.status === "known") {
            entries.push({
                schemaVersion: "conquistador.learning-entry/v1",
                id: `${input.runId}.observed-result.${envelope.identity.artifactId}`,
                recordedAt: input.recordedAt,
                runId: input.runId,
                kind: "observed-result",
                approved: true,
                inferred: false,
                source: {
                    artifactId: envelope.identity.artifactId,
                    contentDigest: envelope.contentDigest,
                    reviewPacketId: input.canonicalPacket.packetId,
                    actionReceiptId: receipt.receiptId,
                },
                body: {
                    measures: envelope.results.measures,
                    observationWindow: envelope.observationWindow,
                },
            });
        }
    }
    for (const entry of entries)
        validateLearningEntry(entry);
    return entries;
}
export function appendRunLearning(ledgerPath, entries) {
    return entries.map((entry) => appendLearningEntry(ledgerPath, entry));
}
