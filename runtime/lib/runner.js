import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, } from "node:fs";
import { resolve } from "node:path";
import { buildArtifactEnvelope, contentDigestOf, patchEnvelope, readArtifactContentDigest, readEnvelope, tryConsumePriorInput, writeEnvelope, } from "./artifacts.js";
import { deepFreeze, redact, sha256 } from "./canonical.js";
import { actionPayloadDigest, createActionGateRecord, createReviewPacket, evaluateActionGate, evaluateReviewApproval, validateActionGateRecord, validatePlaybookReviewPacket, } from "./gates.js";
import { packetTransitionKey, ReviewTransitionState, seal, validateActionAuthorization, validateReceipt as validateCanonicalReceipt, validateReviewPacket, } from "./review-contract.js";
import { appendRunLearning, learningEntriesFromRun, learningLedgerPath, } from "./learning.js";
import { defaultOperationCatalog } from "./operations.js";
import { hasOperationDispatch, invokeDurableOperation, OperationReconciliationRequired } from "./operation-bridge.js";
import { validatePlaybookRecord } from "./registry.js";
import { degradeDeclaredStep, executeDeclaredStep, resolveSkillId, } from "./steps.js";
import { buildJudgmentRequest, isTestOnlyProvider, snapshotHostJudgmentBinding, parseJudgmentResponse, parseSealedRequest, pinnedSkillVersion, purposeOfSkill, skillRefFor, validateProviderJudgmentResponse, validateJudgmentResponse, } from "./judgment.js";
export const DEFAULT_RUNS_DIR = ".conquistador/runs";
const PREFIX = "conquistador.runner";
const RUN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i;
function fail(message) {
    throw new Error(`[${PREFIX}] ${message}`);
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
function writeJsonAtomic(path, value) {
    const temporary = `${path}.tmp`;
    writeJson(temporary, value);
    renameSync(temporary, path);
}
function authorityCommitPath(directory) {
    return resolve(directory, "authority-commit.json");
}
function validateAuthorityCommit(value) {
    if (!isObject(value))
        fail("authority commit is invalid");
    const keys = [
        "schemaVersion",
        "phase",
        "state",
        "trace",
        "projections",
        "digest",
    ];
    if (Object.keys(value).length !== keys.length ||
        keys.some((key) => !(key in value)))
        fail("authority commit fields are not closed");
    if (value.schemaVersion !== "conquistador.authority-commit/v1" ||
        !["prepared", "applied", "retired"].includes(value.phase))
        fail("authority commit schema or phase is invalid");
    const { digest, ...body } = value;
    if (sha256(body) !== digest)
        fail("authority commit digest mismatch");
    if (!isObject(value.projections) || !Array.isArray(value.trace)) {
        fail("authority commit payload is invalid");
    }
    const projectionKeys = ["decision", "authorization", "gate", "receipt"];
    if (Object.keys(value.projections).some((key) => !projectionKeys.includes(key))) {
        fail("authority commit projection fields are not closed");
    }
    const projections = value.projections;
    if (projections.decision) {
        if (!isObject(projections.decision) ||
            Object.keys(projections.decision).sort().join(",") !== "path,value")
            fail("authority decision projection is not closed");
        validatePlaybookReviewPacket(projections.decision.value);
    }
    if (projections.gate)
        validateActionGateRecord(projections.gate);
    if (projections.authorization) {
        const snapshot = value.state.reviewTransitions;
        if (!snapshot)
            fail("authority commit lacks transition snapshot");
        const transitions = new ReviewTransitionState(snapshot);
        const issued = transitions.issuedAuthorization(projections.authorization.digest);
        if (JSON.stringify(issued) !== JSON.stringify(projections.authorization)) {
            fail("authority projection does not match issued authorization");
        }
        if (projections.receipt) {
            validateCanonicalReceipt(projections.receipt, issued);
        }
    }
    else if (projections.receipt) {
        fail("receipt projection lacks authorization");
    }
}
function applyAuthorityCommit(directory, commit, faultAfter) {
    const inject = (boundary) => {
        if (faultAfter === boundary) {
            fail(`injected authority fault after ${boundary}`);
        }
    };
    writeJsonAtomic(resolve(directory, "state.json"), commit.state);
    inject("state");
    writeJsonAtomic(resolve(directory, "trace.json"), commit.trace);
    inject("trace");
    if (commit.projections.decision) {
        writeJsonAtomic(resolve(directory, commit.projections.decision.path), commit.projections.decision.value);
        inject("decision");
    }
    if (commit.projections.authorization) {
        writeJsonAtomic(resolve(directory, "canonical-action-authorization.json"), commit.projections.authorization);
        inject("authorization");
    }
    if (commit.projections.gate) {
        writeJsonAtomic(resolve(directory, "action-gate.json"), commit.projections.gate);
        inject("gate");
    }
    if (commit.projections.receipt) {
        writeJsonAtomic(resolve(directory, "canonical-action-receipt.json"), commit.projections.receipt);
        inject("receipt");
    }
    const appliedBody = { ...commit, phase: "applied" };
    const { digest: _oldDigest, ...withoutDigest } = appliedBody;
    writeJsonAtomic(authorityCommitPath(directory), {
        ...withoutDigest,
        digest: sha256(withoutDigest),
    });
}
function repairAuthorityProjections(directory, commit) {
    if (commit.projections.decision) {
        writeJsonAtomic(resolve(directory, commit.projections.decision.path), commit.projections.decision.value);
    }
    if (commit.projections.authorization) {
        writeJsonAtomic(resolve(directory, "canonical-action-authorization.json"), commit.projections.authorization);
    }
    if (commit.projections.gate) {
        writeJsonAtomic(resolve(directory, "action-gate.json"), commit.projections.gate);
    }
    if (commit.projections.receipt) {
        writeJsonAtomic(resolve(directory, "canonical-action-receipt.json"), commit.projections.receipt);
    }
}
function sameAuthorityState(current, checkpoint) {
    return JSON.stringify({
        reviewAuthority: current.reviewAuthority,
        review: current.review,
        reviewTransitions: current.reviewTransitions,
        terminalAuthorityStop: current.terminalAuthorityStop,
    }) === JSON.stringify({
        reviewAuthority: checkpoint.reviewAuthority,
        review: checkpoint.review,
        reviewTransitions: checkpoint.reviewTransitions,
        terminalAuthorityStop: checkpoint.terminalAuthorityStop,
    });
}
function retireAuthorityCommitIfAdvanced(directory, state, trace) {
    const path = authorityCommitPath(directory);
    if (!existsSync(path))
        return;
    const commit = readJson(path);
    validateAuthorityCommit(commit);
    if (commit.phase !== "applied")
        return;
    if (state.status === commit.state.status &&
        state.updatedAt === commit.state.updatedAt &&
        trace.length === commit.trace.length)
        return;
    if (!sameAuthorityState(state, commit.state)) {
        fail("post-authority progress changed immutable authority state");
    }
    const { digest: _digest, ...body } = { ...commit, phase: "retired" };
    writeJsonAtomic(path, { ...body, digest: sha256(body) });
}
function commitAuthority(directory, state, trace, projections, faultAfter) {
    const body = {
        schemaVersion: "conquistador.authority-commit/v1",
        phase: "prepared",
        state: { ...state, inputs: redact(state.inputs) },
        trace,
        projections,
    };
    const commit = { ...body, digest: sha256(body) };
    validateAuthorityCommit(commit);
    writeJsonAtomic(authorityCommitPath(directory), commit);
    if (faultAfter === "journal")
        fail("injected authority fault after journal");
    applyAuthorityCommit(directory, commit, faultAfter);
}
function recoverAuthorityCommit(directory) {
    const path = authorityCommitPath(directory);
    if (!existsSync(path))
        return;
    const commit = readJson(path);
    validateAuthorityCommit(commit);
    if (commit.phase === "prepared" || commit.phase === "applied") {
        applyAuthorityCommit(directory, commit);
        return;
    }
    const current = readJson(resolve(directory, "state.json"));
    if (!sameAuthorityState(current, commit.state)) {
        fail("retired authority checkpoint does not match immutable state");
    }
    repairAuthorityProjections(directory, commit);
}
function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
function topologicalOrder(nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const index = new Map(nodes.map((node, position) => [node.id, position]));
    const remaining = new Map(nodes.map((node) => [node.id, new Set(node.dependsOn)]));
    const ordered = [];
    while (remaining.size > 0) {
        const ready = [...remaining.entries()]
            .filter(([, deps]) => deps.size === 0)
            .map(([id]) => id)
            .sort((left, right) => index.get(left) - index.get(right));
        if (ready.length === 0)
            fail("step graph contains a cycle");
        const id = ready[0];
        remaining.delete(id);
        ordered.push(byId.get(id));
        for (const deps of remaining.values())
            deps.delete(id);
    }
    return ordered;
}
function validateInputs(playbook, inputs) {
    if (!isObject(inputs))
        fail("inputs must be an object");
    for (const field of playbook.inputs.fields) {
        const value = inputs[field.name];
        if (value === undefined || value === null || value === "") {
            if (field.required)
                fail(`required input ${field.name} is missing`);
            continue;
        }
        if (field.type === "string" || field.type === "artifact") {
            if (typeof value !== "string") {
                fail(`input ${field.name} must be a string`);
            }
        }
        else if (field.type === "number") {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                fail(`input ${field.name} must be a number`);
            }
        }
        else if (field.type === "boolean") {
            if (typeof value !== "boolean") {
                fail(`input ${field.name} must be a boolean`);
            }
        }
        else if (field.type === "string[]") {
            if (!Array.isArray(value) ||
                value.some((entry) => typeof entry !== "string")) {
                fail(`input ${field.name} must be a string array`);
            }
        }
    }
}
function artifactBodies(directory, state, playbook) {
    const bodies = {};
    for (const [id, record] of Object.entries(state.artifacts)) {
        const contract = playbook.artifacts.find((artifact) => artifact.id === id);
        const raw = readFileSync(resolve(directory, record.path), "utf8");
        if (contract?.format === "json") {
            const parsed = JSON.parse(raw);
            bodies[id] = parsed.body ?? parsed;
        }
        else {
            bodies[id] = raw;
        }
    }
    return bodies;
}
function envelopeRelative(artifactId) {
    return `artifacts/${artifactId}.meta.json`;
}
function initialStatus(artifactId, reviewAccepted) {
    if (!reviewAccepted)
        return "draft";
    if (artifactId === "action-receipt")
        return "acted";
    if (artifactId === "observation-record")
        return "observed";
    return "draft";
}
function writeArtifactFile(directory, playbook, state, step, artifactId, format, body, now, skillId, skillLineage, operationReceipt) {
    const contract = playbook.artifacts.find((artifact) => artifact.id === artifactId);
    if (!contract)
        fail(`unknown artifact ${artifactId}`);
    const parents = step.inputArtifacts.filter((id) => state.artifacts[id]);
    const relative = `artifacts/${artifactId}.${contract.format === "json" ? "json" : "md"}`;
    const path = resolve(directory, relative);
    const contentDigest = contentDigestOf(body);
    const provenance = {
        artifactId,
        schema: contract.schema,
        runId: state.runId,
        stepId: step.id,
        playbookId: playbook.id,
        playbookVersion: playbook.version,
        ...(skillLineage?.version ? { skillVersion: skillLineage.version } : {}),
        ...(skillLineage?.packageDigest
            ? { skillPackageDigest: skillLineage.packageDigest }
            : {}),
        ...(skillLineage?.interfaceDigest
            ? { skillInterfaceDigest: skillLineage.interfaceDigest }
            : {}),
        producedAt: now,
        parents,
        contentDigest,
    };
    const rendered = contract.format === "json" || format === "json"
        ? `${JSON.stringify({ provenance, body }, null, 2)}\n`
        : `---\n${Object.entries(provenance).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join("\n")}\n---\n\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}\n`;
    mkdirSync(resolve(directory, "artifacts"), { recursive: true });
    writeFileSync(path, rendered);
    const toolReceipts = [{
            receiptId: `${step.id}.json`,
            path: `receipts/${step.id}.json`,
            ...(operationReceipt ? { catalogReceiptDigest: operationReceipt.catalogReceiptDigest, status: operationReceipt.status } : { executed: false }),
        }];
    const envelope = buildArtifactEnvelope({
        artifactId,
        schema: contract.schema,
        format: contract.format,
        playbookId: playbook.id,
        playbookVersion: playbook.version,
        runId: state.runId,
        stepId: step.id,
        skillId,
        skillVersion: skillLineage?.version,
        skillPackageDigest: skillLineage?.packageDigest,
        skillInterfaceDigest: skillLineage?.interfaceDigest,
        scriptId: step.uses.scriptId,
        toolOperationId: step.uses.toolOperationId,
        parents,
        contentDigest,
        producedAt: now,
        toolReceipts,
        destination: artifactId === "action-receipt"
            ? {
                channel: typeof state.inputs.channel === "string"
                    ? state.inputs.channel
                    : null,
                publicationId: null,
            }
            : null,
        observationWindow: artifactId === "observation-record"
            ? { declared: "declared, not elapsed", elapsed: false }
            : null,
        results: { status: "unknown" },
        status: initialStatus(artifactId, state.review?.outcome === "accept"),
    });
    writeEnvelope(resolve(directory, envelopeRelative(artifactId)), envelope);
    return {
        id: artifactId,
        path: relative,
        digest: sha256(rendered),
        producedBy: step.id,
        parents,
        envelopePath: envelopeRelative(artifactId),
        contentDigest,
    };
}
function currentContentDigests(directory, playbook, state) {
    const digests = {};
    for (const [id, record] of Object.entries(state.artifacts)) {
        const contract = playbook.artifacts.find((artifact) => artifact.id === id);
        digests[id] = readArtifactContentDigest(resolve(directory, record.path), contract?.format ?? "markdown");
    }
    return digests;
}
function readRunEnvelopes(directory, state) {
    const envelopes = [];
    for (const record of Object.values(state.artifacts)) {
        const relative = record.envelopePath ?? envelopeRelative(record.id);
        const path = resolve(directory, relative);
        if (existsSync(path))
            envelopes.push(readEnvelope(path));
    }
    return envelopes;
}
function markReviewedArtifacts(directory, artifactIds, status) {
    for (const artifactId of artifactIds) {
        const path = resolve(directory, envelopeRelative(artifactId));
        if (existsSync(path))
            patchEnvelope(path, { status });
    }
}
function applyEnvelopeVerdict(directory, packet, verdict, action) {
    for (const bound of packet.boundArtifacts) {
        const path = resolve(directory, envelopeRelative(bound.artifactId));
        if (!existsSync(path))
            continue;
        const status = verdict.outcome === "accept"
            ? "approved"
            : "reviewed";
        patchEnvelope(path, {
            status,
            reviewVerdict: {
                packetId: verdict.packetId,
                packetDigest: verdict.packetDigest,
                outcome: verdict.outcome,
                artifactId: bound.artifactId,
                artifactRevision: readEnvelope(path).revision.n,
                boundContentDigest: bound.contentDigest,
                decidedAt: verdict.decidedAt,
            },
            approvedAction: verdict.outcome === "accept" && action
                ? {
                    gateId: action.gateId,
                    boundPayloadDigest: action.boundPayloadDigest,
                    decidedAt: action.createdAt,
                    destination: { channel: null, publicationId: null },
                }
                : null,
        });
    }
    // The canonical receipt binds this sealed review bundle, never the later
    // non-executed action-manifest artifact.
    const canonicalPath = resolve(directory, envelopeRelative(verdict.artifactId));
    if (existsSync(canonicalPath)) {
        const canonical = readEnvelope(canonicalPath);
        if (canonical.revision.n === verdict.artifactRevision &&
            canonical.contentDigest === verdict.artifactDigest) {
            patchEnvelope(canonicalPath, {
                status: verdict.outcome === "accept" ? "approved" : "reviewed",
                reviewVerdict: {
                    packetId: verdict.packetId,
                    packetDigest: verdict.packetDigest,
                    outcome: verdict.outcome,
                    artifactId: canonical.identity.artifactId,
                    artifactRevision: canonical.revision.n,
                    boundContentDigest: canonical.contentDigest,
                    decidedAt: verdict.decidedAt,
                },
            });
        }
    }
}
function persistLearning(directory, runsDir, state, now) {
    if (state.review?.outcome !== "accept")
        return;
    const canonicalPacketPath = resolve(directory, state.review.canonicalPacketPath ?? "canonical-review-packet.json");
    if (!existsSync(canonicalPacketPath))
        return;
    const canonicalPacket = readJson(canonicalPacketPath);
    validateReviewPacket(canonicalPacket);
    const transitions = new ReviewTransitionState(state.reviewTransitions);
    const verdict = transitions.consumedVerdict(canonicalPacket);
    const receipt = state.review.authorizationDigest
        ? transitions.consumedReceipt(state.review.authorizationDigest)
        : undefined;
    const entries = learningEntriesFromRun({
        runId: state.runId,
        recordedAt: now,
        envelopes: readRunEnvelopes(directory, state),
        canonicalPacket,
        verdict,
        ...(receipt ? { actionReceipt: receipt } : {}),
    });
    appendRunLearning(learningLedgerPath(runsDir), entries);
}
function persist(directory, plan, state, trace) {
    mkdirSync(resolve(directory, "receipts"), { recursive: true });
    mkdirSync(resolve(directory, "artifacts"), { recursive: true });
    retireAuthorityCommitIfAdvanced(directory, state, trace);
    writeJson(resolve(directory, "plan.json"), plan);
    writeJsonAtomic(resolve(directory, "state.json"), {
        ...state,
        inputs: redact(state.inputs),
    });
    writeJson(resolve(directory, "trace.json"), trace);
    writeJson(resolve(directory, "receipts/run.json"), redact({
        schemaVersion: "conquistador.run-receipt/v1",
        runId: state.runId,
        playbookId: state.playbookId,
        status: state.status,
        updatedAt: state.updatedAt,
        usage: state.tokenUsage,
        cost: state.cost,
        costStatus: state.costStatus ?? "known",
        steps: Object.fromEntries(Object.entries(state.steps).map(([id, step]) => [id, {
                status: step.status,
                attempts: step.attempts,
                receiptId: step.receiptId,
            }])),
        artifacts: Object.fromEntries(Object.entries(state.artifacts).map(([id, artifact]) => [id, {
                digest: artifact.digest,
                producedBy: artifact.producedBy,
                parents: artifact.parents,
            }])),
        review: state.review,
        redaction: "required",
    }));
    writeJson(resolve(directory, "lineage.json"), {
        schemaVersion: "conquistador.artifact-lineage/v1",
        runId: state.runId,
        nodes: Object.values(state.artifacts),
    });
}
function snapshot(directory, plan, state, trace) {
    return deepFreeze(structuredClone({
        runId: state.runId,
        directory,
        status: state.status,
        plan,
        state,
        trace,
    }));
}
function validateLoadedAuthorityState(directory, state) {
    if (!isObject(state))
        fail("run state is invalid");
    const allowedStateFields = new Set([
        "schemaVersion",
        "runId",
        "playbookId",
        "canonicalId",
        "playbookVersion",
        "status",
        "reviewAuthority",
        "idempotencyKey",
        "createdAt",
        "updatedAt",
        "inputs",
        "order",
        "steps",
        "artifacts",
        "values",
        "judgments",
        "tokenUsage",
        "cost",
        "costStatus",
        "operationUsage",
        "review",
        "reviewTransitions",
        "terminalAuthorityStop",
    ]);
    if (Object.keys(state).some((key) => !allowedStateFields.has(key))) {
        fail("run authority state fields are not closed");
    }
    if (state.schemaVersion !== "conquistador.run-state/v1") {
        fail("run state schema is invalid");
    }
    const statuses = [
        "running",
        "awaiting-judgment",
        "awaiting-operation-reconciliation",
        "awaiting-review",
        "awaiting-action-authorization",
        "awaiting-action-receipt",
        "completed",
        "failed",
        "cancelled",
        "rejected",
        "revision-requested",
    ];
    if (!statuses.includes(state.status))
        fail("run status is invalid");
    if (state.costStatus !== undefined && !["known", "incomplete"].includes(state.costStatus))
        fail("invalid cost status");
    if (state.operationUsage !== undefined) {
        if (!isObject(state.operationUsage))
            fail("invalid operation usage");
        let operationCost = 0;
        for (const [stepId, usage] of Object.entries(state.operationUsage)) {
            if (!state.steps[stepId] || !isObject(usage) || Object.keys(usage).some((key) => !["operationId", "receiptDigest", "unitsUsed", "costUsed"].includes(key)) ||
                typeof usage.operationId !== "string" || !/^sha256:[a-f0-9]{64}$/.test(usage.receiptDigest) ||
                !Number.isFinite(usage.unitsUsed) || usage.unitsUsed < 0 || !Number.isFinite(usage.costUsed) || usage.costUsed < 0)
                fail("invalid operation usage entry");
            operationCost += usage.costUsed;
        }
        if (!Number.isFinite(state.cost) || state.cost < operationCost)
            fail("operation usage exceeds recorded run cost");
    }
    if (state.judgments !== undefined) {
        if (!isObject(state.judgments))
            fail("judgment records are invalid");
        for (const [stepId, record] of Object.entries(state.judgments)) {
            const allowed = new Set([
                "requestId",
                "requestDigest",
                "attempt",
                "state",
                "requestPath",
                "responseDigest",
                "consumedAt",
            ]);
            if (!isObject(record) || Object.keys(record).some((key) => !allowed.has(key))) {
                fail(`judgment record for ${stepId} is not closed`);
            }
            if (!["pending", "consumed", "cancelled", "expired"].includes(record.state))
                fail(`judgment record state for ${stepId} is invalid`);
        }
    }
    if (state.status === "awaiting-judgment") {
        const pending = Object.values(state.judgments ?? {}).find((record) => record.state === "pending");
        if (!pending)
            fail("awaiting-judgment requires a pending judgment request");
    }
    if (state.terminalAuthorityStop !== undefined &&
        ![
            "review-cancelled",
            "action-receipt-failed",
            "action-receipt-cancelled",
        ].includes(state.terminalAuthorityStop))
        fail("terminal authority stop is invalid");
    if (!["not-reached", "pending", "terminal"].includes(state.reviewAuthority)) {
        fail("run review authority marker is invalid or missing");
    }
    if (!state.review) {
        if (state.reviewAuthority !== "not-reached") {
            fail("review authority marker requires persisted review state");
        }
        if (state.reviewTransitions)
            fail("transition state exists without review");
        return;
    }
    const reviewFields = new Set([
        "gateId",
        "packetPath",
        "outcome",
        "decidedAt",
        "canonicalPacketPath",
        "verdictDigest",
        "authorizationDigest",
    ]);
    if (Object.keys(state.review).some((key) => !reviewFields.has(key))) {
        fail("persisted review authority fields are not closed");
    }
    const terminalReview = state.review.outcome !== undefined ||
        [
            "awaiting-action-receipt",
            "completed",
            "rejected",
            "revision-requested",
        ].includes(state.status);
    if (terminalReview !== (state.reviewAuthority === "terminal")) {
        fail("review authority marker does not match review state");
    }
    if (!terminalReview) {
        if (state.reviewAuthority !== "pending") {
            fail("pending review authority marker is missing");
        }
        if (state.reviewTransitions)
            fail("unconsumed review has transition state");
        return;
    }
    if (!state.review.outcome || !state.review.decidedAt ||
        !state.review.verdictDigest || !state.reviewTransitions) {
        fail("terminal review is missing authority state");
    }
    const transitions = new ReviewTransitionState(state.reviewTransitions);
    const packet = readJson(resolve(directory, state.review.canonicalPacketPath ?? "canonical-review-packet.json"));
    validateReviewPacket(packet);
    const consumed = state.reviewTransitions.consumedPackets.find((entry) => entry.packetKey === packetTransitionKey(packet));
    if (!consumed || consumed.verdict.digest !== state.review.verdictDigest) {
        fail("terminal review packet consumption is missing or mismatched");
    }
    if (consumed.verdict.packetId !== packet.packetId ||
        consumed.verdict.packetDigest !== packet.digest ||
        consumed.verdict.artifactId !== packet.artifact.artifactId ||
        consumed.verdict.artifactRevision !== packet.artifact.revision ||
        consumed.verdict.artifactDigest !== packet.artifact.digest ||
        consumed.verdict.outcome !== state.review.outcome ||
        consumed.verdict.decidedAt !== state.review.decidedAt) {
        fail("persisted verdict does not match the exact packet or review state");
    }
    if (consumed.verdict.outcome === "cancel") {
        if (state.status !== "cancelled" ||
            state.terminalAuthorityStop !== "review-cancelled")
            fail("review cancellation terminal status is missing or mismatched");
    }
    else if (state.terminalAuthorityStop === "review-cancelled") {
        fail("review cancellation marker does not match verdict");
    }
    if (state.status === "awaiting-action-authorization" &&
        (state.review.outcome !== "accept" || state.review.authorizationDigest)) {
        fail("awaiting authorization requires accepted review without issued action authority");
    }
    if (state.review.authorizationDigest) {
        const authorization = transitions.issuedAuthorization(state.review.authorizationDigest);
        if (authorization.verdictDigest !== consumed.verdict.digest ||
            authorization.packetId !== packet.packetId ||
            authorization.packetDigest !== packet.digest ||
            JSON.stringify(authorization.artifact) !== JSON.stringify(packet.artifact)) {
            fail("persisted authorization does not match verdict or packet");
        }
        const receiptConsumption = state.reviewTransitions.consumedAuthorizations
            .find((entry) => entry.authorizationKey === authorization.digest);
        if (!receiptConsumption && state.status !== "awaiting-action-receipt") {
            fail("issued authorization is missing its terminal receipt");
        }
        if (receiptConsumption && state.status === "awaiting-action-receipt") {
            fail("received authorization cannot remain awaiting receipt");
        }
        if (receiptConsumption) {
            validateCanonicalReceipt(receiptConsumption.receipt, authorization);
            if (receiptConsumption.receipt.status === "failed") {
                if (state.status !== "failed" ||
                    state.terminalAuthorityStop !== "action-receipt-failed")
                    fail("failed receipt terminal status is missing or mismatched");
            }
            else if (receiptConsumption.receipt.status === "cancelled") {
                if (state.status !== "cancelled" ||
                    state.terminalAuthorityStop !== "action-receipt-cancelled")
                    fail("cancelled receipt terminal status is missing or mismatched");
            }
            else if (state.terminalAuthorityStop !== undefined) {
                fail("succeeded receipt forbids a terminal authority stop");
            }
        }
        else if (state.terminalAuthorityStop !== undefined) {
            fail("terminal authority stop lacks a terminal receipt");
        }
    }
    else if (state.terminalAuthorityStop !== undefined &&
        state.terminalAuthorityStop !== "review-cancelled") {
        fail("action terminal marker lacks authorization");
    }
    if (state.status === "awaiting-action-receipt" &&
        !state.review.authorizationDigest) {
        fail("awaiting action receipt lacks issued authorization");
    }
}
function loadRun(runsDir, runId) {
    if (!RUN_ID.test(runId))
        fail("run id is invalid");
    const directory = resolve(runsDir, runId);
    recoverAuthorityCommit(directory);
    if (!existsSync(resolve(directory, "state.json"))) {
        fail(`run ${runId} was not found`);
    }
    const playbook = JSON.parse(readFileSync(resolve(directory, "playbook.json"), "utf8"));
    validatePlaybookRecord(playbook);
    const state = readJson(resolve(directory, "state.json"));
    validateLoadedAuthorityState(directory, state);
    return {
        directory,
        playbook,
        plan: readJson(resolve(directory, "plan.json")),
        state,
        trace: readJson(resolve(directory, "trace.json")),
    };
}
function emit(trace, now, type, detail, stepId) {
    trace.push({
        sequence: trace.length + 1,
        at: now,
        type,
        ...(stepId ? { stepId } : {}),
        detail,
    });
}
function dependencyOk(step, state) {
    return step.dependsOn.every((id) => {
        const status = state.steps[id]?.status;
        return status === "completed" || status === "degraded" ||
            status === "skipped";
    });
}
function writeReviewPacket(directory, playbook, state, now) {
    const reviewGate = playbook.gates.review[0];
    const contentDigests = currentContentDigests(directory, playbook, state);
    const packet = createReviewPacket({
        runId: state.runId,
        gateId: reviewGate.id,
        requestedOutcome: playbook.finalDeliverable.description,
        deliverables: reviewGate.artifactIds.map((id) => ({
            kind: "artifact",
            content: state.artifacts[id]?.path ?? id,
            digest: state.artifacts[id]?.digest ?? sha256(id),
        })),
        boundArtifacts: reviewGate.artifactIds.map((id) => ({
            artifactId: id,
            path: state.artifacts[id]?.path ?? id,
            contentDigest: contentDigests[id] ?? state.artifacts[id]?.contentDigest ??
                sha256(id),
        })),
        actionProposals: playbook.gates.action.map((gate) => ({
            gateId: gate.id,
            mutationClass: gate.mutationClass,
            fallback: gate.fallback,
            executed: false,
            blockedUntil: "human-review-accept",
        })),
        createdAt: now,
    });
    const relative = "review-packet.json";
    writeJson(resolve(directory, relative), packet);
    const canonicalPacket = canonicalPacketFromLegacy(packet, playbook, state);
    writeJson(resolve(directory, "canonical-review-packet.json"), canonicalPacket);
    const reviewBundleBody = packet.boundArtifacts;
    const reviewBundleRelative = "artifacts/review-bundle.json";
    const reviewBundleRendered = `${JSON.stringify({ body: reviewBundleBody }, null, 2)}\n`;
    writeFileSync(resolve(directory, reviewBundleRelative), reviewBundleRendered);
    const reviewBundleEnvelope = buildArtifactEnvelope({
        artifactId: canonicalPacket.artifact.artifactId,
        schema: "conquistador.review-bundle/v1",
        format: "json",
        playbookId: playbook.id,
        playbookVersion: playbook.version,
        runId: state.runId,
        stepId: reviewGate.afterStep,
        parents: reviewGate.artifactIds,
        contentDigest: canonicalPacket.artifact.digest,
        producedAt: now,
        status: "reviewed",
    });
    writeEnvelope(resolve(directory, envelopeRelative(canonicalPacket.artifact.artifactId)), reviewBundleEnvelope);
    state.artifacts[canonicalPacket.artifact.artifactId] = {
        id: canonicalPacket.artifact.artifactId,
        path: reviewBundleRelative,
        digest: sha256(reviewBundleRendered),
        producedBy: reviewGate.afterStep,
        parents: reviewGate.artifactIds,
        envelopePath: envelopeRelative(canonicalPacket.artifact.artifactId),
        contentDigest: canonicalPacket.artifact.digest,
    };
    markReviewedArtifacts(directory, reviewGate.artifactIds, "reviewed");
    return relative;
}
export function canonicalPacketFromLegacy(packet, playbook, state) {
    validatePlaybookReviewPacket(packet);
    const actionGate = playbook.gates.action.find((gate) => gate.afterGate === packet.gateId);
    const mutationStep = actionGate
        ? playbook.stepGraph.nodes.find((node) => node.kind === "tool-operation" &&
            node.dependsOn.includes(actionGate.afterStep))
        : undefined;
    const actionPayload = actionGate
        ? {
            mutationClass: actionGate.mutationClass,
            operationId: mutationStep?.uses.toolOperationId ?? actionGate.id,
            artifactContentDigests: Object.fromEntries(packet.boundArtifacts.map((entry) => [entry.artifactId, entry.contentDigest])),
        }
        : null;
    const body = {
        schemaVersion: "conquistador.review-contract/v1",
        kind: "review-packet",
        packetId: `${packet.id}.canonical`,
        revisionId: `${packet.id}.canonical.r1`,
        revision: 1,
        producer: {
            module: "self-hosted-agent",
            sourceId: playbook.canonicalId,
            capabilityId: playbook.id,
            playbookId: playbook.id,
            playbookVersion: playbook.version,
        },
        identity: {
            sessionId: packet.sessionId,
            runId: state.runId,
            candidateId: null,
            evidenceId: null,
        },
        artifact: {
            artifactId: "review-bundle",
            revision: 1,
            digest: sha256(packet.boundArtifacts),
            state: "finished",
        },
        strategicBet: `Run ${playbook.id} under one terminal human review boundary.`,
        work: {
            state: "finished",
            summary: packet.completed,
            partialReason: null,
        },
        materialTactics: [
            "Bind the complete review bundle to one terminal verdict.",
        ],
        evidence: [{
                id: "legacy-packet-projection",
                digest: packet.digest,
                provenance: "Non-authoritative compatibility packet projected by the runner.",
            }],
        unresolvedLimitations: packet.unknowns.length > 0
            ? packet.unknowns
            : ["No unresolved limitations were declared."],
        proposedNextAction: playbook.nextDecision.description,
        actionProposal: actionPayload
            ? {
                authority: "conquistador.runner",
                operation: "continue-approved-playbook",
                connectionRef: "local.runner",
                payload: actionPayload,
                payloadDigest: sha256(actionPayload),
            }
            : null,
        redaction: {
            classification: "internal",
            secretFields: [],
            applied: true,
        },
        reviewBoundary: {
            humanRequired: true,
            modelCannotDecide: true,
            oneFinalVerdict: true,
            outcomes: ["accept", "revise", "reject", "cancel"],
        },
        createdAt: packet.createdAt,
    };
    const canonical = seal(body);
    validateReviewPacket(canonical);
    return canonical;
}
function loadSealedJudgmentRequest(directory, pending, stepId) {
    const request = deepFreeze(parseSealedRequest(readJson(resolve(directory, pending.requestPath))));
    if (request.requestId !== pending.requestId ||
        request.requestDigest !== pending.requestDigest ||
        request.identity.stepId !== stepId ||
        request.identity.attempt !== pending.attempt) {
        fail("persisted judgment request does not match its pending record");
    }
    return request;
}
function judgmentRequestRelative(stepId, attempt) {
    return `judgments/${stepId}.a${attempt}.request.json`;
}
function declaredInterfaceFor(playbook, step, purpose) {
    const contractOf = (artifactId) => {
        const contract = playbook.artifacts.find((entry) => entry.id === artifactId);
        if (!contract)
            fail(`unknown artifact ${artifactId}`);
        return { artifactId, schema: contract.schema, format: contract.format };
    };
    return {
        purpose,
        inputs: step.inputArtifacts.map(contractOf),
        outputs: step.outputArtifacts.map(contractOf),
    };
}
function accountOperationUsage(state, stepId, operationId, receipt) {
    if (!receipt.usageKnown) {
        state.costStatus = "incomplete";
        return;
    }
    state.operationUsage ??= {};
    const previous = state.operationUsage[stepId];
    if (previous && previous.receiptDigest !== receipt.catalogReceiptDigest)
        fail("operation receipt accounting mismatch");
    if (!previous) {
        state.operationUsage[stepId] = { operationId, receiptDigest: receipt.catalogReceiptDigest, unitsUsed: receipt.unitsUsed, costUsed: receipt.costUsed };
        state.cost += receipt.costUsed;
    }
}
function accountJudgmentUsage(playbook, state, response) {
    const usage = response.usage;
    state.tokenUsage.inputTokens += usage.inputTokens;
    state.tokenUsage.outputTokens += usage.outputTokens;
    state.tokenUsage.judgmentTokens += usage.inputTokens + usage.outputTokens;
    state.cost += response.cost.chargedToRunMicros / 1_000_000;
    if (state.tokenUsage.inputTokens + state.tokenUsage.outputTokens >
        playbook.budgets.tokensPerRun) {
        fail("run token budget exceeded");
    }
    if (state.tokenUsage.judgmentTokens >
        playbook.budgets.judgmentNodesMaxTokens) {
        fail("judgment token budget exceeded");
    }
    if (state.cost > playbook.budgets.maximumCostPerRun) {
        fail("run cost budget exceeded");
    }
}
async function runJudgmentStep(options) {
    const { directory, playbook, plan, state, trace, step, record } = options;
    const timestamp = () => options.now().toISOString();
    if (state.costStatus === "incomplete")
        fail("judgment dispatch requires reconciled run cost");
    const remainingChargeMicros = Math.floor((playbook.budgets.maximumCostPerRun - state.cost) * 1_000_000);
    if (!Number.isSafeInteger(remainingChargeMicros) || remainingChargeMicros < 0)
        fail("insufficient remaining run cost budget for judgment dispatch");
    state.judgments ??= {};
    let pending = state.judgments[step.id];
    let request;
    if (!options.resume) {
        const attempt = record.attempts + 1;
        record.attempts = attempt;
        const ctx = {
            step,
            inputs: state.inputs,
            values: state.values,
            artifactBodies: {},
            now: options.now(),
            runId: state.runId,
            operations: options.operations,
        };
        const skillId = resolveSkillId(step, ctx);
        const purpose = purposeOfSkill(skillId);
        const skill = skillRefFor(skillId, declaredInterfaceFor(playbook, step, purpose));
        const manifest = step.inputArtifacts.flatMap((artifactId) => {
            const artifactRecord = state.artifacts[artifactId];
            const contract = playbook.artifacts.find((entry) => entry.id === artifactId);
            if (!artifactRecord || !contract)
                return [];
            return [{
                    artifactId,
                    schema: contract.schema,
                    revision: 1,
                    contentDigest: artifactRecord.contentDigest ?? artifactRecord.digest,
                }];
        });
        const bodies = artifactBodies(directory, state, playbook);
        const payload = {
            inputs: state.inputs,
            artifacts: Object.fromEntries(step.inputArtifacts
                .filter((id) => id in bodies)
                .map((id) => [id, bodies[id]])),
        };
        const remainingRunTokens = playbook.budgets.tokensPerRun -
            (state.tokenUsage.inputTokens + state.tokenUsage.outputTokens);
        if (attempt * (step.budget?.maxTokens ?? playbook.budgets.judgmentNodesMaxTokens) > remainingRunTokens) {
            fail("insufficient remaining run token budget for judgment dispatch");
        }
        request = buildJudgmentRequest({
            sessionId: null,
            runId: state.runId,
            candidateId: null,
            evidenceId: null,
            playbookId: playbook.id,
            playbookVersion: playbook.version,
            planDigest: plan.digest,
            stepId: step.id,
            attempt,
            skill,
            purpose,
            runInputDigest: sha256(redact(state.inputs)),
            contextBundleDigest: sha256(manifest),
            payload,
            contextManifest: manifest,
            outputArtifacts: declaredInterfaceFor(playbook, step, purpose).outputs,
            maxStepTokens: step.budget?.maxTokens ??
                playbook.budgets.judgmentNodesMaxTokens,
            remainingRunTokens,
            maximumChargeMicros: remainingChargeMicros,
            createdAt: timestamp(),
            timeoutSeconds: step.timeoutSeconds,
            maxLogicalAttempts: step.retry?.maxAttempts ?? 1,
        });
        const relative = judgmentRequestRelative(step.id, attempt);
        mkdirSync(resolve(directory, "judgments"), { recursive: true });
        writeJsonAtomic(resolve(directory, relative), request);
        pending = {
            requestId: request.requestId,
            requestDigest: request.requestDigest,
            attempt,
            state: "pending",
            requestPath: relative,
        };
        state.judgments[step.id] = pending;
        emit(trace, timestamp(), "judgment.requested", {
            requestId: request.requestId,
            requestDigest: request.requestDigest,
            skillId,
            purpose,
            attempt,
            idempotencyKey: request.execution.idempotencyKey,
        }, step.id);
        record.status = "awaiting-judgment";
        state.status = "awaiting-judgment";
        state.updatedAt = timestamp();
        persist(directory, plan, state, trace);
    }
    else {
        if (!pending || pending.state !== "pending") {
            fail(`step ${step.id} has no pending judgment request`);
        }
        request = loadSealedJudgmentRequest(directory, pending, step.id);
        if (Date.parse(request.execution.deadlineAt) < Date.parse(timestamp())) {
            pending.state = "expired";
            record.status = "failed";
            record.finishedAt = timestamp();
            record.error = "judgment request expired";
            state.status = "failed";
            state.updatedAt = record.finishedAt;
            emit(trace, record.finishedAt, "judgment.completed", {
                requestId: pending.requestId,
                outcome: "expired",
                reason: "deadline-exceeded",
            }, step.id);
            emit(trace, record.finishedAt, "run.stopped", {
                reason: "judgment-expired",
                stepId: step.id,
            });
            persist(directory, plan, state, trace);
            return undefined;
        }
        state.updatedAt = timestamp();
    }
    if (!options.judgment && options.judgmentResponse === undefined) {
        return undefined;
    }
    if (!pending || pending.state !== "pending") {
        fail(`step ${step.id} has no pending judgment request`);
    }
    // Never dispatch the object that was just built in memory. The persisted
    // sealed record is the single request authority for every provider path.
    request = loadSealedJudgmentRequest(directory, pending, step.id);
    if (request.budget.maximumChargeMicros > remainingChargeMicros)
        fail("persisted judgment ceiling exceeds remaining run budget");
    let rawResponse;
    let testOnly = false;
    const hostBinding = options.judgment
        ? snapshotHostJudgmentBinding(options.judgment)
        : undefined;
    if (options.judgmentResponse !== undefined) {
        if (options.judgment) {
            fail("resume accepts either one imported response or an injected provider, not both");
        }
        rawResponse = options.judgmentResponse;
    }
    else {
        testOnly = isTestOnlyProvider(options.judgment);
        try {
            rawResponse = await options.judgment.execute(request, {
                signal: options.signal ?? new AbortController().signal,
            });
        }
        catch (error) {
            state.status = "awaiting-judgment";
            throw error instanceof Error
                ? error
                : new Error("[conquistador.runner] judgment provider failed");
        }
    }
    const response = options.judgment
        ? hostBinding
            ? validateProviderJudgmentResponse(hostBinding, request, rawResponse)
            : validateJudgmentResponse(request, rawResponse)
        : validateJudgmentResponse(request, rawResponse);
    accountJudgmentUsage(playbook, state, response);
    record.attempts = pending.attempt;
    record.judgment = {
        requestId: request.requestId,
        requestDigest: request.requestDigest,
        responseDigest: response.responseDigest,
        outcome: response.outcome,
    };
    pending.state = "consumed";
    pending.responseDigest = response.responseDigest;
    pending.consumedAt = timestamp();
    if (response.outcome !== "succeeded") {
        record.status = "failed";
        record.finishedAt = timestamp();
        record.error = response.failure?.safeMessage ?? response.outcome;
        state.status = response.outcome === "cancelled" ? "cancelled" : "failed";
        state.updatedAt = record.finishedAt;
        emit(trace, record.finishedAt, "judgment.completed", {
            requestId: request.requestId,
            responseDigest: response.responseDigest,
            outcome: response.outcome,
            skillId: request.skill.id,
            error: record.error,
            evidenceEligible: false,
        }, step.id);
        emit(trace, record.finishedAt, "run.stopped", {
            reason: `judgment-${response.outcome}`,
            stepId: step.id,
            actionNotTaken: true,
        });
        persist(directory, plan, state, trace);
        return undefined;
    }
    return { request, response, testOnly };
}
async function continueRun(options) {
    const { directory, playbook, plan, state, trace } = options;
    const byId = new Map(playbook.stepGraph.nodes.map((node) => [node.id, node]));
    if (options.judgmentResponse !== undefined) {
        const parsed = parseJudgmentResponse(options.judgmentResponse);
        const consumed = Object.values(state.judgments ?? {}).find((record) => record.state === "consumed" &&
            record.responseDigest === parsed.responseDigest);
        if (consumed) {
            return snapshot(directory, plan, state, trace);
        }
    }
    for (const stepId of state.order) {
        const step = byId.get(stepId);
        if (!step)
            fail(`unknown step ${stepId}`);
        const record = state.steps[stepId];
        const timestamp = () => options.now().toISOString();
        if (options.signal?.aborted) {
            state.status = "cancelled";
            state.updatedAt = timestamp();
            for (const pending of Object.values(state.judgments ?? {})) {
                if (pending.state === "pending") {
                    pending.state = "cancelled";
                    pending.consumedAt = timestamp();
                }
            }
            emit(trace, state.updatedAt, "run.stopped", { reason: "cancelled" });
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (record.status === "completed" || record.status === "degraded" ||
            record.status === "skipped") {
            if (!record.skippedReason && record.status === "completed") {
                record.skippedReason = "completed-work-preserved";
            }
            if (record.status === "completed" || record.status === "degraded") {
                emit(trace, timestamp(), "step.skipped", {
                    reason: "completed-work-preserved",
                    status: record.status,
                    digest: record.outputDigests,
                }, stepId);
            }
            continue;
        }
        if (!dependencyOk(step, state)) {
            state.status = "failed";
            state.updatedAt = timestamp();
            record.status = "failed";
            record.error = "prerequisite step did not complete";
            emit(trace, state.updatedAt, "step.failed", { error: record.error }, stepId);
            emit(trace, state.updatedAt, "run.stopped", {
                reason: "prerequisite-failed",
                stepId,
            });
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        const maxAttempts = step.retry?.maxAttempts ?? 1;
        let lastError = "step failed";
        let produced;
        let judgmentCommit;
        if (record.status === "awaiting-judgment") {
            const resumed = await runJudgmentStep({
                ...options,
                step,
                record,
                resume: true,
            });
            if (!resumed)
                return snapshot(directory, plan, state, trace);
            judgmentCommit = resumed;
            options.judgmentResponse = undefined;
        }
        else {
            record.status = "running";
            record.startedAt = timestamp();
            state.status = "running";
            state.updatedAt = record.startedAt;
            emit(trace, record.startedAt, "step.started", {
                kind: step.kind,
                uses: step.uses,
                attempt: record.attempts + 1,
            }, stepId);
            persist(directory, plan, state, trace);
            if (step.kind === "skill") {
                const dispatched = await runJudgmentStep({
                    ...options,
                    step,
                    record,
                    resume: false,
                });
                if (!dispatched)
                    return snapshot(directory, plan, state, trace);
                judgmentCommit = dispatched;
            }
            else {
                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                    record.attempts = attempt;
                    try {
                        if (options.failStep?.id === stepId)
                            fail(options.failStep.error);
                        const operationResult = step.kind === "tool-operation" &&
                            !playbook.gates.action.some((gate) => step.dependsOn.includes(gate.afterStep)) &&
                            (options.operationBridge || hasOperationDispatch(directory, state.runId, stepId))
                            ? await invokeDurableOperation({
                                bridge: options.operationBridge, catalog: options.operations ?? defaultOperationCatalog(), directory,
                                request: { operationId: step.uses.toolOperationId, runId: state.runId, stepId,
                                    remainingCost: Math.max(0, playbook.budgets.maximumCostPerRun - state.cost),
                                    unitsUsedForOperation: Object.values(state.operationUsage ?? {}).filter((usage) => usage.operationId === step.uses.toolOperationId).reduce((sum, usage) => sum + usage.unitsUsed, 0),
                                    inputs: state.inputs, values: state.values, artifactBodies: artifactBodies(directory, state, playbook),
                                    signal: options.signal ?? new AbortController().signal,
                                    deadlineAt: new Date(Date.now() + (options.operationTimeoutMs ?? Math.min(step.timeoutSeconds * 1000, 3_600_000))).toISOString() },
                            }) : undefined;
                        produced = executeDeclaredStep({
                            operationResult,
                            step,
                            inputs: state.inputs,
                            values: state.values,
                            artifactBodies: artifactBodies(directory, state, playbook),
                            now: options.now(),
                            runId: state.runId,
                            operations: options.operations,
                        });
                        lastError = "";
                        break;
                    }
                    catch (error) {
                        if (error instanceof OperationReconciliationRequired) {
                            if (error.receipt)
                                accountOperationUsage(state, stepId, step.uses.toolOperationId, error.receipt);
                            else
                                state.costStatus = "incomplete";
                            state.status = "awaiting-operation-reconciliation";
                            record.error = error.message;
                            emit(trace, timestamp(), "run.stopped", { reason: "operation-reconciliation-required", stepId });
                            persist(directory, plan, state, trace);
                            return snapshot(directory, plan, state, trace);
                        }
                        lastError = error instanceof Error
                            ? error.message.replace(/^\[conquistador\.runner\]\s*/, "")
                            : "step failed";
                        if (attempt < maxAttempts)
                            continue;
                    }
                }
                if (!produced) {
                    if (step.failureBehavior === "degrade") {
                        produced = degradeDeclaredStep({
                            step,
                            inputs: state.inputs,
                            values: state.values,
                            artifactBodies: artifactBodies(directory, state, playbook),
                            now: options.now(),
                            runId: state.runId,
                            operations: options.operations,
                        }, lastError);
                        record.status = "degraded";
                        record.error = lastError;
                        emit(trace, timestamp(), "step.degraded", {
                            error: lastError,
                            failureBehavior: "degrade",
                        }, stepId);
                    }
                    else {
                        record.status = "failed";
                        record.finishedAt = timestamp();
                        record.error = lastError;
                        state.status = "failed";
                        state.updatedAt = record.finishedAt;
                        emit(trace, record.finishedAt, "step.failed", {
                            error: lastError,
                            failureBehavior: "stop",
                        }, stepId);
                        emit(trace, record.finishedAt, "run.stopped", {
                            reason: "declared-stop",
                            stepId,
                        });
                        persist(directory, plan, state, trace);
                        return snapshot(directory, plan, state, trace);
                    }
                }
            }
        }
        const invokedOperation = produced?.operation;
        if (invokedOperation?.kind === "gateway-receipt") {
            accountOperationUsage(state, stepId, invokedOperation.operation.id, invokedOperation.receipt);
            persist(directory, plan, state, trace);
            if (state.cost > playbook.budgets.maximumCostPerRun || (!invokedOperation.receipt.accepted && invokedOperation.receipt.status !== "blocked")) {
                state.status = "failed";
                record.status = "failed";
                record.error = "catalog operation exceeded run cost ceiling";
                persist(directory, plan, state, trace);
                return snapshot(directory, plan, state, trace);
            }
        }
        if (invokedOperation) {
            emit(trace, timestamp(), "operation.invoked", {
                operationId: invokedOperation.operation.id,
                provider: invokedOperation.operation.provider,
                capabilityId: invokedOperation.operation.capabilityId,
                verificationStatus: invokedOperation.operation.verificationStatus,
                kind: invokedOperation.kind,
                ...(invokedOperation.kind === "gateway-receipt" ? { catalogReceiptDigest: invokedOperation.receipt.catalogReceiptDigest, status: invokedOperation.receipt.status } : { executed: false, liveCall: false, credentialsUsed: false }),
            }, stepId);
        }
        if (produced?.values)
            Object.assign(state.values, produced.values);
        if (judgmentCommit) {
            emit(trace, timestamp(), "judgment.completed", {
                requestId: judgmentCommit.request.requestId,
                requestDigest: judgmentCommit.request.requestDigest,
                responseDigest: judgmentCommit.response.responseDigest,
                outcome: "succeeded",
                skillId: judgmentCommit.request.skill.id,
                skillVersion: judgmentCommit.request.skill.version,
                purpose: judgmentCommit.request.purpose,
                usage: judgmentCommit.response.usage,
                billingMode: judgmentCommit.response.cost.billingMode,
                chargedToRunMicros: judgmentCommit.response.cost.chargedToRunMicros,
                adapterId: judgmentCommit.response.executor.adapterId,
                model: judgmentCommit.response.model?.model ?? null,
                evidenceEligible: !judgmentCommit.testOnly,
            }, stepId);
        }
        const digests = {};
        const resolvedSkillId = judgmentCommit?.request.skill.id ??
            step.uses.skillId;
        const skillLineage = judgmentCommit
            ? {
                version: judgmentCommit.request.skill.version,
                packageDigest: judgmentCommit.request.skill.packageDigest,
                interfaceDigest: judgmentCommit.request.skill.interfaceDigest,
            }
            : undefined;
        const renderedArtifacts = judgmentCommit
            ? judgmentCommit.response.outputs.map((output) => [
                output.artifactId,
                {
                    format: output.format === "json" ? "json" : "markdown",
                    body: output.body,
                },
            ])
            : Object.entries(produced.artifacts);
        for (const [artifactId, artifact] of renderedArtifacts) {
            const stored = writeArtifactFile(directory, playbook, state, step, artifactId, artifact.format, artifact.body, timestamp(), resolvedSkillId, skillLineage, invokedOperation?.kind === "gateway-receipt" ? invokedOperation.receipt : undefined);
            state.artifacts[artifactId] = stored;
            digests[artifactId] = stored.digest;
        }
        if (invokedOperation?.kind === "gateway-receipt" && invokedOperation.receipt.status !== "succeeded")
            record.status = "degraded";
        if (record.status !== "degraded")
            record.status = "completed";
        record.finishedAt = timestamp();
        record.outputDigests = digests;
        const receipt = redact({
            schemaVersion: "conquistador.step-receipt/v1",
            id: `${state.runId}.${stepId}.${record.attempts}`,
            runId: state.runId,
            stepId,
            kind: step.kind,
            uses: step.uses,
            status: record.status,
            attempts: record.attempts,
            startedAt: record.startedAt,
            finishedAt: record.finishedAt,
            outputDigests: digests,
            judgment: judgmentCommit
                ? {
                    requestId: judgmentCommit.request.requestId,
                    requestDigest: judgmentCommit.request.requestDigest,
                    responseDigest: judgmentCommit.response.responseDigest,
                    outcome: judgmentCommit.response.outcome,
                    executor: judgmentCommit.response.executor,
                    model: judgmentCommit.response.model,
                    usage: judgmentCommit.response.usage,
                    cost: judgmentCommit.response.cost,
                    tools: judgmentCommit.response.tools,
                    testOnlyProvider: judgmentCommit.testOnly,
                    evidenceEligible: !judgmentCommit.testOnly,
                }
                : undefined,
            toolOperation: step.kind === "tool-operation"
                ? {
                    id: step.uses.toolOperationId,
                    maturity: step.uses.maturity ?? "unverified",
                    provider: invokedOperation?.operation.provider,
                    capabilityId: invokedOperation?.operation.capabilityId,
                    verificationStatus: invokedOperation?.operation.verificationStatus,
                    ...(invokedOperation?.kind === "gateway-receipt" ? { catalogReceiptDigest: invokedOperation.receipt.catalogReceiptDigest, status: invokedOperation.receipt.status } : { executed: false, liveCall: false, credentialsUsed: false }),
                    fallback: invokedOperation?.kind === "gateway-receipt" ? "gateway-receipt" : invokedOperation?.kind === "human-action-manifest"
                        ? "human-action-manifest"
                        : "recorded-stub",
                }
                : undefined,
            redaction: "required",
        });
        const receiptId = `${stepId}.json`;
        writeJson(resolve(directory, "receipts", receiptId), receipt);
        record.receiptId = receiptId;
        if (record.status === "completed") {
            emit(trace, record.finishedAt, "step.completed", {
                artifacts: Object.keys(digests),
                idempotency: step.idempotency,
            }, stepId);
        }
        state.updatedAt = record.finishedAt;
        persist(directory, plan, state, trace);
        const reviewGate = playbook.gates.review.find((gate) => gate.afterStep === stepId);
        if (reviewGate && !state.review?.outcome) {
            const packetPath = writeReviewPacket(directory, playbook, state, record.finishedAt);
            state.review = {
                gateId: reviewGate.id,
                packetPath,
                canonicalPacketPath: "canonical-review-packet.json",
            };
            state.reviewAuthority = "pending";
            state.status = "awaiting-review";
            state.updatedAt = record.finishedAt;
            emit(trace, record.finishedAt, "gate.review", {
                gateId: reviewGate.id,
                humanRequired: true,
                modelCannotSatisfy: true,
                outcomes: reviewGate.outcomes,
                actionNotTaken: true,
                packetPath,
            }, stepId);
            emit(trace, record.finishedAt, "run.stopped", {
                reason: "awaiting-review",
                gateId: reviewGate.id,
            });
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (options.interruptAfter === stepId) {
            state.status = "cancelled";
            state.updatedAt = timestamp();
            emit(trace, state.updatedAt, "run.stopped", {
                reason: "interrupted",
                stepId,
            });
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
    }
    const doneAt = options.now().toISOString();
    state.status = "completed";
    state.updatedAt = doneAt;
    emit(trace, doneAt, "run.stopped", {
        reason: "completed",
        nextDecision: playbook.nextDecision,
    });
    persist(directory, plan, state, trace);
    persistLearning(directory, resolve(directory, ".."), state, doneAt);
    return snapshot(directory, plan, state, trace);
}
export function playbookFixturePath(id) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
        fail("playbook id is invalid");
    }
    return resolve(import.meta.dirname, "../fixtures/playbooks", `${id}.json`);
}
export function runSummary(snapshot) {
    return {
        runId: snapshot.runId,
        status: snapshot.status,
        directory: snapshot.directory,
        playbookId: snapshot.state.playbookId,
        steps: Object.fromEntries(Object.entries(snapshot.state.steps).map(([id, step]) => [id, step.status])),
        review: snapshot.state.review,
        nextDecision: snapshot.trace.at(-1)?.detail.nextDecision,
    };
}
export async function startPlaybookRun(options) {
    validatePlaybookRecord(options.playbook);
    const playbook = options.playbook;
    if (playbook.executionStatus !== "executable") {
        fail(`playbook ${playbook.id} is not executable: ${playbook.notExecutableReason ?? playbook.executionStatus}`);
    }
    if (!isObject(options.inputs))
        fail("inputs must be an object");
    validateInputs(playbook, options.inputs);
    const runId = options.runId ?? `run-${randomUUID()}`;
    if (!RUN_ID.test(runId))
        fail("run id is invalid");
    const directory = resolve(options.runsDir, runId);
    if (existsSync(resolve(directory, "state.json"))) {
        fail(`run ${runId} already exists`);
    }
    mkdirSync(directory, { recursive: true });
    const now = options.now ?? (() => new Date());
    const createdAt = now().toISOString();
    const order = topologicalOrder(playbook.stepGraph.nodes).map((node) => node.id);
    const planBasis = {
        schemaVersion: "conquistador.plan/v1",
        runId,
        playbookId: playbook.id,
        canonicalId: playbook.canonicalId,
        playbookVersion: playbook.version,
        createdAt,
        order,
        nodes: playbook.stepGraph.nodes.map((node) => ({
            id: node.id,
            kind: node.kind,
            dependsOn: node.dependsOn,
            uses: node.uses,
            failureBehavior: node.failureBehavior,
            idempotency: node.idempotency,
        })),
        gates: playbook.gates,
        budgets: playbook.budgets,
    };
    const plan = { ...planBasis, digest: sha256(planBasis) };
    const state = {
        schemaVersion: "conquistador.run-state/v1",
        runId,
        playbookId: playbook.id,
        canonicalId: playbook.canonicalId,
        playbookVersion: playbook.version,
        status: "running",
        idempotencyKey: sha256({
            canonicalId: playbook.canonicalId,
            version: playbook.version,
            inputs: options.inputs,
        }),
        createdAt,
        updatedAt: createdAt,
        inputs: structuredClone(options.inputs),
        order,
        steps: Object.fromEntries(order.map((id) => [id, { id, status: "pending", attempts: 0 }])),
        artifacts: {},
        values: {},
        tokenUsage: { inputTokens: 0, outputTokens: 0, judgmentTokens: 0 },
        cost: 0,
        reviewAuthority: "not-reached",
    };
    const prior = tryConsumePriorInput(options.inputs.priorApprovedContext);
    if (prior)
        state.values.priorConsumption = prior;
    const trace = [];
    writeJson(resolve(directory, "playbook.json"), playbook);
    emit(trace, createdAt, "run.started", {
        playbookId: playbook.id,
        canonicalId: playbook.canonicalId,
        version: playbook.version,
    });
    emit(trace, createdAt, "plan.written", { digest: plan.digest, order });
    persist(directory, plan, state, trace);
    return continueRun({
        directory,
        playbook,
        plan,
        state,
        trace,
        now,
        signal: options.signal,
        judgment: options.judgment,
        operations: options.operations,
        operationBridge: options.operationBridge,
        operationTimeoutMs: options.operationTimeoutMs,
        interruptAfter: options.interruptAfter,
        failStep: options.failStep,
    });
}
export async function resumePlaybookRun(options) {
    const loaded = loadRun(options.runsDir, options.runId);
    const { directory, playbook, plan } = loaded;
    const state = structuredClone(loaded.state);
    const trace = structuredClone(loaded.trace);
    if (options.judgmentResponse !== undefined) {
        let parsed;
        try {
            parsed = parseJudgmentResponse(options.judgmentResponse);
        }
        catch (error) {
            // an unparseable imported response must not mutate anything
            throw error;
        }
        const consumed = Object.values(state.judgments ?? {}).find((record) => record.state === "consumed" &&
            record.responseDigest === parsed.responseDigest);
        if (consumed) {
            return snapshot(directory, plan, state, trace);
        }
        const pending = Object.values(state.judgments ?? {}).find((record) => record.state === "pending");
        if (pending && state.status === "awaiting-judgment") {
            const request = parseSealedRequest(readJson(resolve(directory, pending.requestPath)));
            // reject invalid bindings before any persistence happens
            validateJudgmentResponse(request, parsed);
        }
    }
    const now = options.now ?? (() => new Date());
    const timestamp = now().toISOString();
    emit(trace, timestamp, "run.resumed", {
        status: state.status,
        verdictId: options.verdict?.verdictId ?? null,
    });
    let handledReceipt = false;
    if (state.status === "awaiting-action-receipt") {
        if (options.verdict || options.actionAuthorization) {
            fail("awaiting action receipt accepts only the exact terminal receipt");
        }
        if (!state.review?.authorizationDigest || !state.reviewTransitions) {
            fail("awaiting action receipt lacks durable authority state");
        }
        if (!options.actionReceipt) {
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        const transitions = new ReviewTransitionState(state.reviewTransitions);
        const authorization = transitions.issuedAuthorization(state.review.authorizationDigest);
        const projectedAuthorization = readJson(resolve(directory, "canonical-action-authorization.json"));
        if (projectedAuthorization.digest !== authorization.digest) {
            fail("persisted authorization projection mismatch");
        }
        const decided = readJson(resolve(directory, state.review.packetPath));
        validatePlaybookReviewPacket(decided);
        const actionRecord = readJson(resolve(directory, "action-gate.json"));
        validateActionGateRecord(actionRecord);
        const canonicalPacket = readJson(resolve(directory, state.review.canonicalPacketPath ?? "canonical-review-packet.json"));
        const canonicalVerdict = transitions.consumedVerdict(canonicalPacket);
        transitions.recordReceipt(options.actionReceipt, authorization);
        state.reviewTransitions = transitions.snapshot();
        state.updatedAt = timestamp;
        state.status = options.actionReceipt.status === "succeeded"
            ? "running"
            : options.actionReceipt.status === "failed"
                ? "failed"
                : "cancelled";
        state.terminalAuthorityStop = options.actionReceipt.status === "failed"
            ? "action-receipt-failed"
            : options.actionReceipt.status === "cancelled"
                ? "action-receipt-cancelled"
                : undefined;
        if (state.status !== "running") {
            emit(trace, timestamp, "run.stopped", {
                reason: state.terminalAuthorityStop,
                actionNotTaken: options.actionReceipt.status !== "succeeded",
            });
        }
        commitAuthority(directory, state, trace, {
            decision: { path: state.review.packetPath, value: decided },
            authorization,
            gate: actionRecord,
            receipt: options.actionReceipt,
        }, options.faultAfterAuthorityBoundary);
        applyEnvelopeVerdict(directory, decided, canonicalVerdict, actionRecord);
        handledReceipt = true;
        if (state.status !== "running") {
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
    }
    if (!handledReceipt &&
        !["awaiting-review", "awaiting-action-receipt"].includes(state.status) &&
        options.actionReceipt) {
        fail("run is not awaiting an action receipt");
    }
    if (options.judgmentResponse !== undefined) {
        if (state.status === "failed" || state.status === "cancelled") {
            // fall through to the restart path below; the response is consumed there
        }
        else if (state.status !== "awaiting-judgment") {
            fail("run is not awaiting a judgment response");
        }
    }
    if (state.status !== "awaiting-review" && options.verdict) {
        if (!options.verification || !state.review) {
            fail("canonical verdict requires host verification context and review state");
        }
        const canonicalPacket = readJson(resolve(directory, state.review.canonicalPacketPath ?? "canonical-review-packet.json"));
        const transitions = new ReviewTransitionState(state.reviewTransitions);
        transitions.consumeVerdict(canonicalPacket, options.verdict, options.verification);
        fail("run is not awaiting review");
    }
    if (state.status === "awaiting-review" || state.status === "awaiting-action-authorization") {
        const awaitingAuthorization = state.status === "awaiting-action-authorization";
        if (awaitingAuthorization && (options.verdict || options.actionReceipt))
            fail("action authorization is a separate transition");
        const verdict = awaitingAuthorization && state.review && state.reviewTransitions
            ? new ReviewTransitionState(state.reviewTransitions).consumedVerdict(readJson(resolve(directory, state.review.canonicalPacketPath ?? "canonical-review-packet.json")))
            : options.verdict;
        if (awaitingAuthorization && !options.actionAuthorization)
            return snapshot(directory, plan, state, trace);
        if (!verdict) {
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (!options.verification) {
            fail("canonical verdict requires host verification context");
        }
        if (!state.review)
            fail("review packet is missing");
        const review = state.review;
        const packetPath = resolve(directory, review.packetPath);
        const presented = JSON.parse(readFileSync(packetPath, "utf8"));
        validatePlaybookReviewPacket(presented);
        const canonicalPath = resolve(directory, review.canonicalPacketPath ?? "canonical-review-packet.json");
        const canonicalPacket = readJson(canonicalPath);
        validateReviewPacket(canonicalPacket);
        const transitions = new ReviewTransitionState(state.reviewTransitions);
        const outcome = verdict.outcome;
        const actionGate = playbook.gates.action.find((gate) => gate.afterGate === review.gateId);
        if (outcome === "accept") {
            const current = currentContentDigests(directory, playbook, state);
            const check = evaluateReviewApproval(presented, current);
            if (!check.ok)
                fail(`stale approval: ${check.detail}`);
            if (options.actionAuthorization && awaitingAuthorization) {
                transitions.authorizeAccepted(options.actionAuthorization, canonicalPacket, options.verification);
            }
            else if (options.actionAuthorization) {
                transitions.authorize(options.actionAuthorization, canonicalPacket, verdict, options.verification);
            }
            else {
                transitions.consumeVerdict(canonicalPacket, verdict, options.verification);
            }
        }
        else {
            transitions.consumeVerdict(canonicalPacket, verdict, options.verification);
        }
        state.reviewTransitions = transitions.snapshot();
        review.outcome = outcome;
        review.decidedAt = verdict.decidedAt;
        review.verdictDigest = verdict.digest;
        state.reviewAuthority = "terminal";
        if (options.actionAuthorization) {
            review.authorizationDigest = options.actionAuthorization.digest;
        }
        state.status = outcome === "reject"
            ? "rejected"
            : outcome === "cancel"
                ? "cancelled"
                : outcome === "revise"
                    ? "revision-requested"
                    : actionGate
                        ? options.actionAuthorization ? "awaiting-action-receipt" : "awaiting-action-authorization"
                        : "running";
        state.terminalAuthorityStop = outcome === "cancel"
            ? "review-cancelled"
            : undefined;
        state.updatedAt = timestamp;
        const decided = presented;
        if (!awaitingAuthorization)
            emit(trace, timestamp, "gate.review", {
                gateId: review.gateId,
                outcome,
                humanRequired: true,
                modelCannotSatisfy: true,
                packetDigest: canonicalPacket.digest,
                verdictDigest: verdict.digest,
                authority: "canonical-review-contract",
            });
        if (state.status === "awaiting-action-authorization") {
            emit(trace, timestamp, "run.stopped", { reason: "awaiting-action-authorization", actionNotTaken: true });
            commitAuthority(directory, state, trace, { decision: { path: review.packetPath, value: decided } }, options.faultAfterAuthorityBoundary);
            applyEnvelopeVerdict(directory, decided, verdict);
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (outcome === "reject") {
            emit(trace, timestamp, "run.stopped", {
                reason: "review-rejected",
                actionNotTaken: true,
            });
            commitAuthority(directory, state, trace, {
                decision: { path: review.packetPath, value: decided },
            }, options.faultAfterAuthorityBoundary);
            applyEnvelopeVerdict(directory, decided, verdict);
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (outcome === "cancel") {
            emit(trace, timestamp, "run.stopped", {
                reason: "review-cancelled",
                actionNotTaken: true,
            });
            commitAuthority(directory, state, trace, {
                decision: { path: review.packetPath, value: decided },
            }, options.faultAfterAuthorityBoundary);
            applyEnvelopeVerdict(directory, decided, verdict);
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (outcome === "revise") {
            emit(trace, timestamp, "run.stopped", {
                reason: "review-revise",
                actionNotTaken: true,
            });
            commitAuthority(directory, state, trace, {
                decision: { path: review.packetPath, value: decided },
            }, options.faultAfterAuthorityBoundary);
            applyEnvelopeVerdict(directory, decided, verdict);
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        let actionRecord;
        if (actionGate) {
            const mutationStep = playbook.stepGraph.nodes.find((node) => node.kind === "tool-operation" &&
                node.dependsOn.includes(actionGate.afterStep));
            const operationId = mutationStep?.uses.toolOperationId ?? actionGate.id;
            actionRecord = createActionGateRecord({
                runId: state.runId,
                gateId: actionGate.id,
                afterGate: actionGate.afterGate,
                mutationClass: actionGate.mutationClass,
                packet: decided,
                canonicalPacket,
                verdict: verdict,
                authorization: options.actionAuthorization,
                transitions,
                context: options.verification,
                operationId,
                createdAt: timestamp,
            });
            const current = currentContentDigests(directory, playbook, state);
            const boundDigests = Object.fromEntries(decided.boundArtifacts.map((entry) => [
                entry.artifactId,
                current[entry.artifactId] ?? entry.contentDigest,
            ]));
            const payloadNow = actionPayloadDigest({
                mutationClass: actionGate.mutationClass,
                operationId,
                artifactContentDigests: boundDigests,
            });
            const gateCheck = evaluateActionGate({
                packet: decided,
                canonicalPacket,
                verdict: verdict,
                authorization: options.actionAuthorization,
                transitions,
                context: options.verification,
                gate: actionRecord,
                currentContentDigests: current,
                currentPayloadDigest: payloadNow,
            });
            if (!gateCheck.ok)
                fail(`stale approval: ${gateCheck.detail}`);
            emit(trace, timestamp, "gate.action", {
                gateId: actionGate.id,
                afterGate: actionGate.afterGate,
                requiresReviewOutcome: "accept",
                humanRequired: true,
                modelCannotSatisfy: true,
                mutationClass: actionGate.mutationClass,
                executed: false,
                fallback: actionGate.fallback,
                boundPayloadDigest: actionRecord.boundPayloadDigest,
            });
        }
        if (actionGate && !options.actionReceipt) {
            emit(trace, timestamp, "run.stopped", {
                reason: "awaiting-action-receipt",
                actionNotTaken: true,
            });
            commitAuthority(directory, state, trace, {
                decision: { path: review.packetPath, value: decided },
                authorization: options.actionAuthorization,
                gate: actionRecord,
            }, options.faultAfterAuthorityBoundary);
            applyEnvelopeVerdict(directory, decided, verdict, actionRecord);
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        if (actionGate && options.actionReceipt && options.actionAuthorization) {
            validateCanonicalReceipt(options.actionReceipt, options.actionAuthorization);
            transitions.recordReceipt(options.actionReceipt, options.actionAuthorization);
            state.reviewTransitions = transitions.snapshot();
            state.status = options.actionReceipt.status === "succeeded"
                ? "running"
                : options.actionReceipt.status === "failed"
                    ? "failed"
                    : "cancelled";
            state.terminalAuthorityStop = options.actionReceipt.status === "failed"
                ? "action-receipt-failed"
                : options.actionReceipt.status === "cancelled"
                    ? "action-receipt-cancelled"
                    : undefined;
            if (state.status !== "running") {
                emit(trace, timestamp, "run.stopped", {
                    reason: state.terminalAuthorityStop,
                    actionNotTaken: true,
                });
            }
            commitAuthority(directory, state, trace, {
                decision: { path: review.packetPath, value: decided },
                authorization: options.actionAuthorization,
                gate: actionRecord,
                receipt: options.actionReceipt,
            }, options.faultAfterAuthorityBoundary);
        }
        if (!actionGate) {
            commitAuthority(directory, state, trace, { decision: { path: review.packetPath, value: decided } }, options.faultAfterAuthorityBoundary);
        }
        applyEnvelopeVerdict(directory, decided, verdict, actionRecord);
        state.updatedAt = timestamp;
        if (state.status !== "running") {
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
    }
    else if (state.status === "completed" || state.status === "rejected" ||
        state.status === "revision-requested") {
        persist(directory, plan, state, trace);
        return snapshot(directory, plan, state, trace);
    }
    else if (state.status === "failed" || state.status === "cancelled") {
        if (state.terminalAuthorityStop) {
            persist(directory, plan, state, trace);
            return snapshot(directory, plan, state, trace);
        }
        state.status = "running";
        state.updatedAt = timestamp;
        for (const record of Object.values(state.steps)) {
            if (record.status === "failed" || record.status === "running") {
                record.status = "pending";
                record.error = undefined;
            }
        }
    }
    persist(directory, plan, state, trace);
    return continueRun({
        directory,
        playbook,
        plan,
        state,
        trace,
        now,
        signal: options.signal,
        judgment: options.judgment,
        judgmentResponse: options.judgmentResponse,
        operations: options.operations,
        operationBridge: options.operationBridge,
        operationTimeoutMs: options.operationTimeoutMs,
        interruptAfter: options.interruptAfter,
        failStep: options.failStep,
    });
}
export function loadPlaybookRun(runsDir, runId) {
    const { directory, plan, state, trace } = loadRun(runsDir, runId);
    return snapshot(directory, plan, state, trace);
}
