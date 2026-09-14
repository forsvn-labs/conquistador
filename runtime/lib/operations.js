import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deepFreeze } from "./canonical.js";
export const OPERATION_VERIFICATION_STATUSES = [
    "unknown",
    "cataloged",
    "researched",
    "fixture-verified",
    "live-verified",
    "supported",
    "unsupported",
    "unverified",
];
const PREFIX = "conquistador.operations";
const DEFAULT_CATALOG_PATH = resolve(import.meta.dirname, "../fixtures/operations/v1.json");
const OPERATION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const CAPABILITY_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const OPERATION_KEYS = ["id", "provider", "capabilityId", "verificationStatus", "actionClass"];
const MANIFEST_STATUSES = new Set(["unknown", "unverified", "unsupported"]);
function fail(message) {
    throw new Error(`[${PREFIX}] ${message}`);
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, allowed, label) {
    const keys = Object.keys(value);
    if (!keys.every((key) => allowed.includes(key)))
        fail(`${label} contains an undeclared field`);
}
function nonEmpty(value, label) {
    if (typeof value !== "string" || !value.trim())
        fail(`${label} is required`);
}
export function validateVerifiedOperation(value) {
    if (!isObject(value))
        fail("operation must be an object");
    exactKeys(value, OPERATION_KEYS, "operation");
    if (typeof value.id !== "string" || !OPERATION_ID.test(value.id))
        fail("operation.id is invalid");
    nonEmpty(value.provider, "operation.provider");
    if (typeof value.capabilityId !== "string" || !CAPABILITY_ID.test(value.capabilityId)) {
        fail("operation.capabilityId is invalid");
    }
    if (!OPERATION_VERIFICATION_STATUSES.includes(value.verificationStatus)) {
        fail("operation.verificationStatus is invalid");
    }
    if (!["observe", "draft", "consequential"].includes(value.actionClass)) {
        fail("operation.actionClass is invalid");
    }
}
export function validateOperationCatalog(value) {
    if (!isObject(value))
        fail("operation catalog must be an object");
    exactKeys(value, ["schemaVersion", "records"], "operation catalog");
    if (value.schemaVersion !== "conquistador.verified-operations/v1") {
        fail("schemaVersion must be conquistador.verified-operations/v1");
    }
    if (!Array.isArray(value.records) || value.records.length === 0)
        fail("records are required");
    const ids = [];
    for (const record of value.records) {
        validateVerifiedOperation(record);
        ids.push(record.id);
    }
    if (new Set(ids).size !== ids.length)
        fail("operation ids must be unique");
}
export function loadOperationCatalog(path = DEFAULT_CATALOG_PATH) {
    const catalog = JSON.parse(readFileSync(path, "utf8"));
    validateOperationCatalog(catalog);
    return deepFreeze(structuredClone(catalog));
}
export function resolveOperation(operationId, catalog) {
    validateOperationCatalog(catalog);
    const found = catalog.records.find((record) => record.id === operationId);
    if (found)
        return found;
    return {
        id: operationId,
        provider: "unknown",
        capabilityId: "unknown.operation",
        verificationStatus: "unsupported",
        actionClass: "observe",
    };
}
function manifestReason(operation, known) {
    if (!known)
        return "unknown-operation";
    if (operation.verificationStatus === "unsupported")
        return "unsupported";
    return "unverified";
}
export function buildHumanActionManifest(input) {
    const manifest = {
        ...input.extra,
        schemaVersion: "conquistador.artifact.human-action-manifest/v1",
        operationId: input.operation.id,
        provider: input.operation.provider,
        capabilityId: input.operation.capabilityId,
        verificationStatus: input.operation.verificationStatus,
        executed: false,
        liveCall: false,
        credentialsUsed: false,
        fallback: "human-action-manifest",
        reason: manifestReason(input.operation, input.known),
        summary: input.summary,
    };
    if (manifest.executed !== false || manifest.liveCall !== false || manifest.credentialsUsed !== false) {
        fail("a human action manifest cannot claim execution");
    }
    return manifest;
}
export function renderManifestMarkdown(manifest) {
    const extraLines = Object.entries(manifest)
        .filter(([key]) => ![
        "schemaVersion",
        "operationId",
        "provider",
        "capabilityId",
        "verificationStatus",
        "executed",
        "liveCall",
        "credentialsUsed",
        "fallback",
        "reason",
        "summary",
    ].includes(key))
        .filter(([, value]) => typeof value === "string" || typeof value === "boolean" || typeof value === "number")
        .map(([key, value]) => `${key}: ${String(value)}`);
    return [
        "# Human action manifest",
        "",
        `Operation: \`${manifest.operationId}\``,
        `Provider: ${manifest.provider}`,
        `Capability: ${manifest.capabilityId}`,
        `Verification: ${manifest.verificationStatus}`,
        `Reason: ${manifest.reason}`,
        "Executed: no",
        "Live call: no",
        "Credentials used: no",
        "",
        manifest.summary,
        "",
        "The runner does not perform external actions. Exact human approval is required before any draft, publish, spend, or account change.",
        ...(extraLines.length ? ["", ...extraLines] : []),
    ].join("\n");
}
export function renderStubMarkdown(stub) {
    return [
        "# Provider draft stub",
        "",
        `Operation: \`${stub.operationId}\``,
        `Provider: ${stub.provider}`,
        `Capability: ${stub.capabilityId}`,
        `Verification: ${stub.verificationStatus}`,
        "Stubbed: yes",
        "Executed: no",
        "Live call: no",
        "Credentials used: no",
        "",
        stub.summary,
        "",
        "This ticket has no live credentials. The would-be provider call is recorded and was not executed.",
    ].join("\n");
}
export function invokeVerifiedOperation(input) {
    validateOperationCatalog(input.catalog);
    if (!OPERATION_ID.test(input.operationId))
        fail("operationId is invalid");
    const known = input.catalog.records.some((record) => record.id === input.operationId);
    const operation = resolveOperation(input.operationId, input.catalog);
    const summary = input.summary
        ?? (known
            ? `Recorded invocation of ${operation.id} through the verified-operation interface.`
            : `Unknown operation ${input.operationId} cannot execute.`);
    if (!known || MANIFEST_STATUSES.has(operation.verificationStatus)) {
        return {
            kind: "human-action-manifest",
            operation,
            executed: false,
            liveCall: false,
            credentialsUsed: false,
            manifest: buildHumanActionManifest({ operation, known, summary, extra: input.extra }),
        };
    }
    const stub = {
        ...input.extra,
        schemaVersion: "conquistador.artifact.provider-draft-stub/v1",
        operationId: operation.id,
        provider: operation.provider,
        capabilityId: operation.capabilityId,
        verificationStatus: operation.verificationStatus,
        stubbed: true,
        executed: false,
        liveCall: false,
        credentialsUsed: false,
        summary,
    };
    return {
        kind: "recorded-stub",
        operation,
        executed: false,
        liveCall: false,
        credentialsUsed: false,
        stub,
    };
}
export function defaultOperationCatalog() {
    return loadOperationCatalog();
}
