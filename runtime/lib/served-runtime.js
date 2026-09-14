import { readOwnedArtifact, AUTHORITY_ARTIFACTS } from "./artifact-read.js";
import { validatePlaybookRecord } from "./registry.js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { deepFreeze, sha256 } from "./canonical.js";
import { ensureLocalStateRoot, dataRoot, } from "./local-state.js";
import { isCanonicalId } from "./principal.js";
import { validateReceipt, authorizationSubjectDigest, renderReviewPacketText, REVIEW_CONTRACT_VERSION, ReviewTransitionState, seal, validateReviewPacket, validateVerdict, verdictSubjectDigest, } from "./review-contract.js";
import { createReviewEvent, validateReviewEventStream, } from "./review-events.js";
import { routeIntent } from "./router.js";
import { loadPlaybookRun, playbookFixturePath, resumePlaybookRun, startPlaybookRun, } from "./runner.js";
import { RuntimeFailure } from "./runtime.js";
const SESSION_SCHEMA = "conquistador.served-session/v1";
const MESSAGE_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isSessionState(value) {
    return value === "idle" || value === "running" ||
        value === "awaiting-review" || value === "terminal";
}
function isSessionView(value) {
    if (!isPlainObject(value))
        return false;
    // SAFETY: JSON session views are property bags; each field is checked below.
    const view = value;
    return view.schemaVersion === "conquistador.session/v1" &&
        isNonEmptyString(view.id) &&
        isNonEmptyString(view.principalId) &&
        isSessionState(view.state) &&
        isNonEmptyString(view.createdAt) &&
        isNonEmptyString(view.updatedAt);
}
function isStringList(value) {
    if (!Array.isArray(value))
        return false;
    for (const item of value) {
        if (!isNonEmptyString(item))
            return false;
    }
    return true;
}
function isNullableString(value) {
    return value === null || isNonEmptyString(value);
}
function isPersistedSession(value) {
    if (!isPlainObject(value))
        return false;
    // SAFETY: JSON sidecars are property bags; each field is checked below.
    const candidate = value;
    return candidate.schemaVersion === SESSION_SCHEMA &&
        isSessionView(candidate.view) &&
        Array.isArray(candidate.events) &&
        isStringList(candidate.usedMessageIds) &&
        isNullableString(candidate.runId) &&
        isNullableString(candidate.playbookId);
}
function isServedMessageBody(value) {
    return isPlainObject(value);
}
function readRequiredInput(body, field) {
    const value = body[field];
    if (!isNonEmptyString(value)) {
        throw new RuntimeFailure("invalid", `playbook input ${field} is required`);
    }
    return value;
}
export function parseServedPlaybookRequest(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch {
        throw new RuntimeFailure("invalid", "served message content must be JSON playbook input");
    }
    if (!isServedMessageBody(parsed)) {
        throw new RuntimeFailure("invalid", "served message content must be a JSON object");
    }
    let playbookId;
    if (isNonEmptyString(parsed.playbook)) {
        playbookId = parsed.playbook.trim();
    }
    else if (isNonEmptyString(parsed.intent)) {
        const decision = routeIntent(parsed.intent);
        if (decision.outcome === "playbook")
            playbookId = decision.targetId;
        else if (decision.outcome === "skill") {
            throw new RuntimeFailure("invalid", "served sessions execute playbooks only");
        }
        else {
            throw new RuntimeFailure("invalid", "served intent did not select a playbook");
        }
    }
    else {
        throw new RuntimeFailure("invalid", "served message needs playbook or intent");
    }
    return {
        playbookId,
        inputs: {
            product: readRequiredInput(parsed, "product"),
            audience: readRequiredInput(parsed, "audience"),
            channel: readRequiredInput(parsed, "channel"),
            goals: readRequiredInput(parsed, "goals"),
        },
    };
}
function writeJsonAtomic(path, value) {
    const temporary = resolve(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
    try {
        writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
        renameSync(temporary, path);
    }
    catch (error) {
        try {
            unlinkSync(temporary);
        }
        catch {
            // Leftover tmp is skipped on the next persist.
        }
        throw error;
    }
}
export class DurableServedRuntime {
    #root;
    #maximumTokensPerRun;
    #actionBusy = new Set();
    #sessions = new Map();
    #now;
    #maximumSessions;
    #maximumQueuedMessages;
    #verifyAuthentication;
    #operationBridge;
    #judgment;
    #ready = true;
    constructor(options) {
        this.#maximumTokensPerRun = options.maximumTokensPerRun ?? Number.MAX_SAFE_INTEGER;
        this.#root = dataRoot(options.dataDir);
        this.#now = options.now ?? (() => new Date());
        this.#maximumSessions = options.maximumSessions ?? 4;
        this.#maximumQueuedMessages = options.maximumQueuedMessages ?? 20;
        this.#verifyAuthentication = options.verifyAuthentication ?? (() => false);
        this.#judgment = options.judgment;
        this.#operationBridge = options.operationBridge;
        ensureLocalStateRoot(this.#root, {
            instanceId: options.instanceId,
            now: this.#now().toISOString(),
        });
        this.#reload();
    }
    ready() {
        return this.#ready;
    }
    async shutdown() {
        this.#ready = false;
        for (const session of this.#sessions.values()) {
            session.active?.controller.abort();
            this.#rejectQueued(session, "service is shutting down");
            this.#persist(session);
        }
    }
    createSession(input) {
        this.#assertReady();
        if (!isCanonicalId(input.principalId)) {
            throw new RuntimeFailure("invalid", "authenticated principal must be a canonical principal ID");
        }
        const active = [...this.#sessions.values()].filter((session) => session.state !== "terminal").length;
        if (active >= this.#maximumSessions) {
            throw new RuntimeFailure("conflict", "active session ceiling reached");
        }
        const timestamp = this.#now().toISOString();
        const session = {
            schemaVersion: "conquistador.session/v1",
            id: `session-${randomUUID()}`,
            principalId: input.principalId,
            state: "idle",
            createdAt: timestamp,
            updatedAt: timestamp,
            events: [],
            queue: [],
            reviews: new Map(),
            usedMessageIds: new Set(),
            runId: null,
            playbookId: null,
        };
        mkdirSync(this.#sessionDirectory(session.id), { recursive: true });
        this.#sessions.set(session.id, session);
        this.#persist(session);
        return this.#view(session);
    }
    sendMessage(sessionId, message) {
        this.#assertReady();
        const session = this.#owned(sessionId, message.principalId);
        if (session.state === "terminal")
            throw new RuntimeFailure("conflict", "session is terminal");
        if (session.state === "awaiting-review") {
            throw new RuntimeFailure("conflict", "final review decision is required");
        }
        if (!MESSAGE_ID.test(message.id) || !message.content.trim()) {
            throw new RuntimeFailure("invalid", "message needs a stable ID and non-empty content");
        }
        parseServedPlaybookRequest(message.content);
        if (session.usedMessageIds.has(message.id)) {
            throw new RuntimeFailure("conflict", "message ID was already used");
        }
        if (session.queue.length >= this.#maximumQueuedMessages) {
            throw new RuntimeFailure("conflict", "session queue ceiling reached");
        }
        session.usedMessageIds.add(message.id);
        return new Promise((resolvePromise, reject) => {
            session.queue.push({ message: structuredClone(message), resolve: resolvePromise, reject });
            void this.#drain(session);
        });
    }
    events(sessionId, after, principalId) {
        const session = this.#owned(sessionId, principalId);
        if (!Number.isInteger(after) || after < 0)
            throw new RuntimeFailure("invalid", "event cursor is invalid");
        return deepFreeze(structuredClone(session.events.filter((event) => event.sequence > after)));
    }
    cancel(sessionId, principalId) {
        this.#assertReady();
        const session = this.#owned(sessionId, principalId);
        if (!session.active)
            throw new RuntimeFailure("conflict", "session has no active turn");
        session.active.controller.abort();
    }
    async decideReview(sessionId, reviewPacketId, request) {
        this.#assertReady();
        const session = this.#owned(sessionId, request.transport.principalId);
        const review = session.reviews.get(reviewPacketId);
        if (!review)
            throw new RuntimeFailure("not-found", "review packet was not found");
        if (review.state.verdictFor(review.packet)) {
            throw new RuntimeFailure("conflict", "review packet was already decided");
        }
        if (request.packetDigest !== review.packet.digest) {
            throw new RuntimeFailure("forbidden", "review decision digest differs from the packet");
        }
        if (!["accept", "revise", "reject", "cancel"].includes(request.outcome)) {
            throw new RuntimeFailure("invalid", "review decision is invalid");
        }
        const decidedAt = this.#now().toISOString();
        const basis = {
            schemaVersion: REVIEW_CONTRACT_VERSION,
            kind: "review-verdict",
            verdictId: `${reviewPacketId}.verdict`,
            outcome: request.outcome,
            packetId: review.packet.packetId,
            packetDigest: review.packet.digest,
            artifactId: review.packet.artifact.artifactId,
            artifactRevision: review.packet.artifact.revision,
            artifactDigest: review.packet.artifact.digest,
            actionPayloadDigest: review.packet.actionProposal?.payloadDigest ?? null,
            sessionId: review.packet.identity.sessionId,
            runId: review.packet.identity.runId,
            candidateId: review.packet.identity.candidateId,
            evidenceId: review.packet.identity.evidenceId,
            decidedAt,
            expiryPolicy: "expires",
            expiresAt: new Date(Date.parse(decidedAt) + 3_600_000).toISOString(),
            singleUse: true,
        };
        const subjectDigest = verdictSubjectDigest(review.packet, basis);
        let authentication;
        try {
            authentication = await request.authenticateHuman({
                transport: request.transport,
                principalId: request.transport.principalId,
                role: "reviewer",
                authority: "content-review",
                now: decidedAt,
                subjectDigest,
            });
        }
        catch {
            throw new RuntimeFailure("forbidden", "explicit host-verified human review authority is required");
        }
        const verdict = seal({
            ...basis,
            authentication,
        });
        const verification = {
            now: decidedAt,
            expectedRole: "reviewer",
            verifyAuthentication: (proof, context) => proof.principalId === request.transport.principalId &&
                this.#verifyAuthentication(proof, context),
        };
        try {
            validateVerdict(verdict, review.packet, verification);
        }
        catch {
            throw new RuntimeFailure("forbidden", "host human authentication proof failed canonical validation");
        }
        if (session.runId) {
            try {
                const resumeOptions = {
                    runsDir: this.#runsDir(),
                    runId: session.runId,
                    verdict,
                    verification,
                    now: this.#now,
                };
                if (this.#judgment) {
                    resumeOptions.judgment = this.#judgment;
                }
                await resumePlaybookRun(resumeOptions);
            }
            catch {
                throw new RuntimeFailure("conflict", "playbook resume failed");
            }
        }
        try {
            review.state.consumeVerdict(review.packet, verdict, verification);
        }
        catch {
            if (!session.runId) {
                throw new RuntimeFailure("forbidden", "host human authentication proof failed canonical validation");
            }
        }
        session.state = "terminal";
        session.updatedAt = verdict.decidedAt;
        this.#rejectQueued(session, "session became terminal before queued work started");
        this.#emit(session, "final.result", { reviewVerdict: verdict });
        this.#persist(session);
        return verdict;
    }
    listArtifacts(sessionId, principalId) {
        const session = this.#owned(sessionId, principalId);
        if (!session.runId)
            throw new RuntimeFailure("conflict", "session has no run");
        const run = loadPlaybookRun(this.#runsDir(), session.runId);
        return { sessionId, artifactIds: Object.keys(run.state.artifacts).filter(id => !AUTHORITY_ARTIFACTS.has(id)) };
    }
    readArtifact(sessionId, artifactId, principalId) {
        const session = this.#owned(sessionId, principalId);
        if (!session.runId)
            throw new RuntimeFailure("conflict", "session has no run");
        return readOwnedArtifact(loadPlaybookRun(this.#runsDir(), session.runId), artifactId);
    }
    actionState(sessionId, principalId) {
        const session = this.#owned(sessionId, principalId);
        if (!session.runId)
            throw new RuntimeFailure("conflict", "session has no run");
        const run = loadPlaybookRun(this.#runsDir(), session.runId);
        const transitions = new ReviewTransitionState(run.state.reviewTransitions);
        const authorization = run.state.review?.authorizationDigest
            ? transitions.issuedAuthorization(run.state.review.authorizationDigest) : null;
        return deepFreeze({
            status: run.status,
            authorization,
            receipt: authorization ? transitions.consumedReceipt(authorization.digest) ?? null : null,
            receiptEvidence: authorization && transitions.consumedReceipt(authorization.digest)
                ? { classification: "operator-attested", liveProviderEvidence: false, measures: "unknown" } : null,
            externalDispatchPerformed: false,
        });
    }
    async authorizeAction(sessionId, packetId, request) {
        this.#assertReady();
        const session = this.#owned(sessionId, request.transport.principalId);
        const review = session.reviews.get(packetId);
        if (!review || review.packet.digest !== request.packetDigest)
            throw new RuntimeFailure("forbidden", "exact owned review packet is required");
        if (!session.runId || this.#actionBusy.has(sessionId))
            throw new RuntimeFailure("conflict", "action transition is unavailable");
        this.#actionBusy.add(sessionId);
        try {
            const run = loadPlaybookRun(this.#runsDir(), session.runId);
            if (run.status !== "awaiting-action-authorization")
                throw new RuntimeFailure("conflict", "run is not awaiting action authorization");
            const verdict = new ReviewTransitionState(run.state.reviewTransitions).consumedVerdict(review.packet);
            const now = this.#now().toISOString();
            let authorization;
            try {
                authorization = await this.#authorizationFor(review.packet, verdict, request, now);
            }
            catch {
                throw new RuntimeFailure("forbidden", "separate exact human action approval is required");
            }
            if (!authorization)
                throw new RuntimeFailure("conflict", "accepted review has no action proposal");
            try {
                await resumePlaybookRun({
                    runsDir: this.#runsDir(), runId: session.runId, actionAuthorization: authorization,
                    verification: { now, verifyAuthentication: (proof, context) => proof.principalId === request.transport.principalId && this.#verifyAuthentication(proof, context) },
                    now: this.#now,
                });
            }
            catch {
                throw new RuntimeFailure("conflict", "action authorization failed exact runner validation");
            }
            return deepFreeze(authorization);
        }
        finally {
            this.#actionBusy.delete(sessionId);
        }
    }
    async importActionReceipt(sessionId, receipt, request) {
        receipt = deepFreeze(structuredClone(receipt));
        this.#assertReady();
        const session = this.#owned(sessionId, request.transport.principalId);
        if (!session.runId || this.#actionBusy.has(sessionId))
            throw new RuntimeFailure("conflict", "action transition is unavailable");
        this.#actionBusy.add(sessionId);
        try {
            const run = loadPlaybookRun(this.#runsDir(), session.runId);
            if (run.status !== "awaiting-action-receipt" || !run.state.review?.authorizationDigest)
                throw new RuntimeFailure("conflict", "run is not awaiting a terminal receipt");
            const transitions = new ReviewTransitionState(run.state.reviewTransitions);
            const authorization = transitions.issuedAuthorization(run.state.review.authorizationDigest);
            try {
                validateReceipt(receipt, authorization);
            }
            catch {
                throw new RuntimeFailure("invalid", "receipt does not match the exact issued action authority");
            }
            const now = this.#now().toISOString();
            if (Date.parse(receipt.finishedAt) > Date.parse(now))
                throw new RuntimeFailure("invalid", "terminal receipt cannot finish in the future");
            let proof;
            try {
                proof = await request.authenticateHuman({
                    transport: request.transport, principalId: request.transport.principalId,
                    role: "operator", authority: "consequential-action", now,
                    subjectDigest: receipt.digest, actionPayloadDigest: authorization.allowed.payloadDigest,
                });
                if (proof.principalId !== request.transport.principalId || !this.#verifyAuthentication(proof, {
                    now, subjectDigest: receipt.digest, role: "operator", authority: "consequential-action",
                }))
                    throw new Error("invalid receipt importer");
            }
            catch {
                throw new RuntimeFailure("forbidden", "human authentication of this exact receipt is required");
            }
            const attestation = { schemaVersion: "conquistador.operator-receipt-import/v1", receiptDigest: receipt.digest, authentication: proof, liveProviderEvidence: false };
            // Record who supplied the receipt. Its hash is not proof of a live call.
            writeJsonAtomic(resolve(run.directory, "operator-receipt-import.json"), attestation);
            try {
                await resumePlaybookRun({ runsDir: this.#runsDir(), runId: session.runId, actionReceipt: receipt, judgment: this.#judgment, now: this.#now });
            }
            catch {
                throw new RuntimeFailure("conflict", "receipt import or subsequent runner work failed");
            }
            this.#persist(session);
            return this.actionState(sessionId, request.transport.principalId);
        }
        finally {
            this.#actionBusy.delete(sessionId);
        }
    }
    reviewVerdict(sessionId, principalId) {
        const session = this.#owned(sessionId, principalId);
        const fromReview = [...session.reviews.values()]
            .map((review) => review.state.verdictFor(review.packet))
            .find((candidate) => candidate !== undefined);
        if (fromReview)
            return deepFreeze(structuredClone(fromReview));
        const event = [...session.events]
            .reverse()
            .find((candidate) => candidate.type === "final.result");
        if (event && event.type === "final.result") {
            return deepFreeze(structuredClone(event.payload.reviewVerdict));
        }
        return undefined;
    }
    async #drain(session) {
        if (session.active)
            return;
        const item = session.queue.shift();
        if (!item)
            return;
        const controller = new AbortController();
        session.active = { controller, messageId: item.message.id };
        session.state = "running";
        session.updatedAt = this.#now().toISOString();
        this.#emit(session, "input.accepted", {
            messageId: item.message.id,
            messageDigest: sha256(item.message.content),
        });
        this.#emit(session, "progress", { messageId: item.message.id, stage: "producing" });
        this.#persist(session);
        try {
            const request = parseServedPlaybookRequest(item.message.content);
            const playbookPath = playbookFixturePath(request.playbookId);
            const playbook = JSON.parse(readFileSync(playbookPath, "utf8"));
            validatePlaybookRecord(playbook);
            playbook.budgets.tokensPerRun = Math.min(playbook.budgets.tokensPerRun, this.#maximumTokensPerRun);
            playbook.budgets.judgmentNodesMaxTokens = Math.min(playbook.budgets.judgmentNodesMaxTokens, this.#maximumTokensPerRun);
            const hasRun = session.runId !== null && existsSync(resolve(this.#runsDir(), session.runId, "state.json"));
            // Persist the run identity before dispatch so a process exit during generation
            // cannot orphan the runner's already durable judgment request.
            session.runId ??= session.id;
            session.playbookId = request.playbookId;
            this.#persist(session);
            const snapshot = hasRun
                ? await resumePlaybookRun(this.#runnerOptions({
                    runsDir: this.#runsDir(),
                    runId: session.runId,
                    signal: controller.signal,
                    now: this.#now,
                }))
                : await startPlaybookRun(this.#runnerOptions({
                    playbook,
                    inputs: request.inputs,
                    runsDir: this.#runsDir(),
                    runId: session.id,
                    signal: controller.signal,
                    now: this.#now,
                }));
            session.runId = snapshot.runId;
            session.playbookId = snapshot.state.playbookId;
            if (snapshot.status === "awaiting-review") {
                const packet = this.#presentPacket(session, snapshot);
                this.#rejectQueued(session, "final review decision is required");
                this.#persist(session);
                item.resolve(packet);
                return;
            }
            if (snapshot.status === "cancelled") {
                throw new RuntimeFailure("cancelled", "turn was cancelled");
            }
            throw new RuntimeFailure("provider-failure", "playbook stopped without a review packet");
        }
        catch (error) {
            const failure = error instanceof RuntimeFailure
                ? error
                : error instanceof Error &&
                    (error.message.includes("abort") || error.message.includes("cancelled"))
                    ? new RuntimeFailure("cancelled", "turn was cancelled")
                    : new RuntimeFailure("provider-failure", "provider failed without exposing provider detail");
            if (failure.code === "cancelled") {
                this.#rejectQueued(session, "turn was cancelled");
            }
            session.state = failure.code === "cancelled" ? "terminal" : "idle";
            session.updatedAt = this.#now().toISOString();
            this.#emit(session, "failure", {
                messageId: item.message.id,
                code: failure.code === "invalid" || failure.code === "conflict" ||
                    failure.code === "not-found" || failure.code === "forbidden"
                    ? "provider-failure"
                    : failure.code,
                retryable: failure.code !== "cancelled",
            });
            item.reject(failure);
            this.#persist(session);
        }
        finally {
            session.active = undefined;
            if (session.state === "idle")
                void this.#drain(session);
        }
    }
    #presentPacket(session, snapshot) {
        const packetPath = resolve(snapshot.directory, "canonical-review-packet.json");
        if (!existsSync(packetPath)) {
            throw new RuntimeFailure("provider-failure", "playbook review packet is missing");
        }
        const packetUnknown = JSON.parse(readFileSync(packetPath, "utf8"));
        validateReviewPacket(packetUnknown);
        const packet = packetUnknown;
        const createdAt = packet.createdAt;
        const presentationEvent = createReviewEvent(packet, {
            eventId: `${packet.packetId}.presentation.1`,
            sequence: 1,
            eventType: "packet.presented",
            source: { kind: "host", id: "served-http" },
            actor: { kind: "system", id: null },
            payload: {
                format: "plain-text",
                presentationDigest: sha256(renderReviewPacketText(packet)),
                canonicalTextAvailable: true,
            },
            redaction: { classification: "internal", secretFields: [], applied: true },
            createdAt,
        });
        validateReviewEventStream([presentationEvent], packet);
        session.reviews.set(packet.packetId, {
            packet,
            state: new ReviewTransitionState(),
        });
        session.state = "awaiting-review";
        session.updatedAt = createdAt;
        this.#emit(session, "review.packet", { reviewPacket: packet, presentationEvent });
        return packet;
    }
    async #authorizationFor(packet, verdict, request, decidedAt) {
        if (verdict.outcome !== "accept" || !packet.actionProposal)
            return undefined;
        const expiresAt = verdict.expiresAt;
        const authorizationBasis = {
            schemaVersion: REVIEW_CONTRACT_VERSION,
            kind: "action-authorization",
            authorizationId: `${verdict.verdictId}.authorization`,
            verdictId: verdict.verdictId,
            verdictDigest: verdict.digest,
            packetId: packet.packetId,
            packetDigest: packet.digest,
            sessionId: packet.identity.sessionId,
            runId: packet.identity.runId,
            candidateId: packet.identity.candidateId,
            artifact: packet.artifact,
            allowed: {
                authority: packet.actionProposal.authority,
                operation: packet.actionProposal.operation,
                connectionRef: packet.actionProposal.connectionRef,
                payloadDigest: packet.actionProposal.payloadDigest,
            },
            authorizedAt: decidedAt,
            expiresAt,
            singleUse: true,
        };
        const subjectDigest = authorizationSubjectDigest(authorizationBasis);
        const authentication = await request.authenticateHuman({
            transport: request.transport,
            principalId: request.transport.principalId,
            role: "operator",
            authority: "consequential-action",
            actionPayloadDigest: packet.actionProposal.payloadDigest,
            now: decidedAt,
            subjectDigest,
        });
        return seal({
            ...authorizationBasis,
            authentication,
        });
    }
    #reload() {
        const sessionsDir = this.#runsDir();
        if (!existsSync(sessionsDir))
            return;
        for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
            if (!entry.isDirectory())
                continue;
            try {
                this.#loadPersistedSession(sessionsDir, entry.name);
            }
            catch {
                continue;
            }
        }
    }
    #loadPersistedSession(sessionsDir, directoryName) {
        const persistedPath = resolve(sessionsDir, directoryName, "session.json");
        if (!existsSync(persistedPath))
            return;
        const persistedUnknown = JSON.parse(readFileSync(persistedPath, "utf8"));
        if (!isPersistedSession(persistedUnknown))
            return;
        const persisted = persistedUnknown;
        if (!MESSAGE_ID.test(directoryName) || persisted.view.id !== directoryName ||
            (persisted.runId !== null && persisted.runId !== directoryName) ||
            !isCanonicalId(persisted.view.principalId))
            return;
        const session = {
            ...persisted.view,
            events: persisted.events,
            queue: [],
            reviews: new Map(),
            usedMessageIds: new Set(persisted.usedMessageIds),
            runId: persisted.runId,
            playbookId: persisted.playbookId,
        };
        for (const [index, event] of session.events.entries()) {
            if (!event || event.sessionId !== session.id || event.sequence !== index + 1)
                throw new Error("invalid persisted event identity");
            if (event.type === "review.packet") {
                validateReviewPacket(event.payload.reviewPacket);
                validateReviewEventStream([event.payload.presentationEvent], event.payload.reviewPacket);
                session.reviews.set(event.payload.reviewPacket.packetId, {
                    packet: event.payload.reviewPacket,
                    state: new ReviewTransitionState(),
                });
            }
            if (event.type === "final.result") {
                const packetId = event.payload.reviewVerdict.packetId;
                const review = session.reviews.get(packetId);
                if (!review)
                    throw new Error("persisted verdict has no review packet");
                if (review) {
                    review.state = new ReviewTransitionState();
                    try {
                        review.state.consumeVerdict(review.packet, event.payload.reviewVerdict, {
                            now: event.payload.reviewVerdict.decidedAt,
                            expectedRole: "reviewer",
                            verifyAuthentication: this.#verifyAuthentication,
                        });
                    }
                    catch {
                        throw new Error("persisted verdict failed authentication");
                    }
                }
            }
        }
        if (session.runId && existsSync(resolve(sessionsDir, session.runId, "state.json"))) {
            const snapshot = loadPlaybookRun(sessionsDir, session.runId);
            if (snapshot.status === "awaiting-review" && session.state !== "terminal") {
                if (session.reviews.size === 0) {
                    try {
                        this.#presentPacket(session, snapshot);
                        this.#persist(session);
                    }
                    catch {
                        session.state = "awaiting-review";
                    }
                }
                else {
                    session.state = "awaiting-review";
                }
            }
            if ((snapshot.status === "awaiting-judgment" || snapshot.status === "running") &&
                session.state !== "terminal" &&
                this.#judgment) {
                void this.#recoverInFlight(session);
            }
        }
        this.#sessions.set(session.id, session);
    }
    async #recoverInFlight(session) {
        if (!session.runId || !this.#judgment)
            return;
        const controller = new AbortController();
        session.active = { controller, messageId: "recovery" };
        session.state = "running";
        try {
            const snapshot = await resumePlaybookRun(this.#runnerOptions({
                runsDir: this.#runsDir(),
                runId: session.runId,
                signal: controller.signal,
                now: this.#now,
            }));
            if (snapshot.status === "awaiting-review") {
                this.#presentPacket(session, snapshot);
                this.#rejectQueued(session, "final review decision is required");
            }
            this.#persist(session);
        }
        catch {
            session.state = "idle";
            this.#persist(session);
        }
        finally {
            session.active = undefined;
            if (session.state === "idle")
                void this.#drain(session);
        }
    }
    #runnerOptions(options) {
        return { ...options, judgment: this.#judgment, operationBridge: this.#operationBridge };
    }
    #assertReady() {
        if (!this.#ready)
            throw new RuntimeFailure("conflict", "service is shutting down");
    }
    #rejectQueued(session, message) {
        const abandoned = session.queue.splice(0);
        for (const item of abandoned) {
            item.reject(new RuntimeFailure("conflict", message));
        }
    }
    #owned(id, principalId) {
        const session = this.#sessions.get(id);
        if (!session)
            throw new RuntimeFailure("not-found", "session was not found");
        if (session.principalId !== principalId) {
            throw new RuntimeFailure("forbidden", "session principal differs from transport identity");
        }
        return session;
    }
    #emit(session, type, payload) {
        // SAFETY: `type` is a RuntimeEvent discriminant and `payload` is EventPayloadMap[Type].
        const event = deepFreeze({
            schemaVersion: "conquistador.event/v1",
            id: `${session.id}.event.${session.events.length + 1}`,
            sessionId: session.id,
            sequence: session.events.length + 1,
            type,
            createdAt: this.#now().toISOString(),
            payload: structuredClone(payload),
        });
        session.events.push(event);
    }
    #view(session) {
        return deepFreeze({
            schemaVersion: session.schemaVersion,
            id: session.id,
            principalId: session.principalId,
            state: session.state,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        });
    }
    #runsDir() {
        return resolve(this.#root, "sessions");
    }
    #sessionDirectory(sessionId) {
        return resolve(this.#runsDir(), sessionId);
    }
    #persist(session) {
        const record = {
            schemaVersion: SESSION_SCHEMA,
            view: {
                schemaVersion: session.schemaVersion,
                id: session.id,
                principalId: session.principalId,
                state: session.state,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
            events: session.events,
            usedMessageIds: [...session.usedMessageIds],
            runId: session.runId,
            playbookId: session.playbookId,
        };
        mkdirSync(this.#sessionDirectory(session.id), { recursive: true });
        writeJsonAtomic(resolve(this.#sessionDirectory(session.id), "session.json"), record);
    }
}
