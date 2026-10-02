import { loadSkillAssets } from "./skill-assets.js";
import { deepFreeze, redact, sha256 } from "./canonical.js";
export const JUDGMENT_REQUEST_SCHEMA = "conquistador.judgment-request.v1";
export const JUDGMENT_RESPONSE_SCHEMA = "conquistador.judgment-response.v1";
export function isTestOnlyProvider(provider) {
    return provider.testOnly === true;
}
function validateProviderBinding(binding) {
    const keys = ["hostId", "adapterId", "adapterVersion"];
    if (!binding || typeof binding !== "object" ||
        Object.keys(binding).length !== keys.length ||
        Object.keys(binding).some((key) => !keys.includes(key))) {
        throw new JudgmentValidationError("closed-fields", "provider binding fields are not closed");
    }
    for (const key of keys) {
        const value = binding[key];
        nonBlank(value, `provider.binding.${key}`);
        if (/^latest$/i.test(value)) {
            throw new JudgmentValidationError("closed-fields", `provider.binding.${key} cannot be latest`);
        }
    }
}
/**
 * Turns a host callback into the provider-neutral runner contract. The callback
 * gets an immutable, independently re-parsed sealed request and no credentials,
 * configuration, or authority objects. It must return a complete V1 response;
 * the runner validates that response before it can advance a step.
 */
export function createHostJudgmentProvider(binding, callback, options = {}) {
    validateProviderBinding(binding);
    if (typeof callback !== "function") {
        throw new JudgmentValidationError("closed-fields", "host callback is required");
    }
    const fixedBinding = deepFreeze(structuredClone(binding));
    return Object.freeze({
        binding: fixedBinding,
        ...(options.testOnly ? { testOnly: true } : {}),
        async execute(request, execution) {
            const sealed = deepFreeze(parseSealedRequest(structuredClone(request)));
            return callback(sealed, Object.freeze({
                signal: execution.signal,
                idempotencyKey: sealed.execution.idempotencyKey,
                deadlineAt: sealed.execution.deadlineAt,
            }));
        },
    });
}
export function isHostJudgmentProvider(provider) {
    return typeof provider === "object" && provider !== null && "binding" in provider;
}
/**
 * Captures the optional host identity before dispatch.  Provider objects are
 * caller-owned and therefore cannot be consulted again after execute() has
 * run: a callback may mutate or replace its own structural fields.
 */
export function snapshotHostJudgmentBinding(provider) {
    if (!isHostJudgmentProvider(provider))
        return undefined;
    const binding = structuredClone(provider.binding);
    validateProviderBinding(binding);
    return deepFreeze(binding);
}
export class JudgmentValidationError extends Error {
    code;
    constructor(code, message) {
        super(`[conquistador.judgment] ${message}`);
        this.name = "JudgmentValidationError";
        this.code = code;
    }
}
export const REDACTION_POLICY_DIGEST = sha256("conquistador.redaction-policy/v1");
const SKILL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PURPOSE_BY_SKILL = {
    "ideas": "research",
    "social": "creation",
    "article": "creation",
    "video": "creation",
    "copy": "creation",
    "critique": "quality-review",
    "measure": "measurement",
    "creative": "creation",
    "ads": "creation",
    "diagnose": "measurement",
    "results": "measurement",
};
export function purposeOfSkill(skillId) {
    const purpose = PURPOSE_BY_SKILL[skillId];
    if (!purpose) {
        throw new JudgmentValidationError("closed-fields", `skill ${skillId} has no declared judgment purpose`);
    }
    return purpose;
}
export function pinnedSkillVersion(skillId) {
    const source = loadSkillAssets(skillId).files.find((file) => file.path === "COMMAND.md")?.content;
    const version = source?.match(/^  version: ([0-9]+\.[0-9]+\.[0-9]+)\s*$/m)?.[1];
    if (!version) {
        throw new JudgmentValidationError("closed-fields", `skill ${skillId} has no pinned exact version`);
    }
    return version;
}
export function interfaceDigestOf(skillId, version, declared) {
    return sha256({
        schemaVersion: "conquistador.skill-interface/v1",
        id: skillId,
        version,
        purpose: declared.purpose,
        inputs: declared.inputs,
        outputs: declared.outputs,
    });
}
export function packageDigestOf(skillId, version, interfaceDigest) {
    return sha256({
        schemaVersion: "conquistador.skill-package-ref/v1",
        assetManifestDigest: loadSkillAssets(skillId).digest,
        id: skillId,
        version,
        interfaceDigest,
    });
}
export function skillRefFor(skillId, declared) {
    if (!SKILL_ID.test(skillId)) {
        throw new JudgmentValidationError("closed-fields", `skill id ${skillId} is invalid`);
    }
    const version = pinnedSkillVersion(skillId);
    const interfaceDigest = interfaceDigestOf(skillId, version, declared);
    return {
        id: skillId,
        version,
        packageDigest: packageDigestOf(skillId, version, interfaceDigest),
        interfaceDigest,
    };
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, keys, label) {
    if (!isObject(value)) {
        throw new JudgmentValidationError("closed-fields", `${label} must be an object`);
    }
    const actual = Object.keys(value);
    for (const key of actual) {
        if (!keys.includes(key)) {
            throw new JudgmentValidationError("closed-fields", `${label}.${key} is an undeclared field`);
        }
    }
    for (const key of keys) {
        if (!(key in value)) {
            throw new JudgmentValidationError("closed-fields", `${label}.${key} is missing`);
        }
    }
    return value;
}
function digest(value, label) {
    if (typeof value !== "string" || !SHA_PATTERN.test(value)) {
        throw new JudgmentValidationError("closed-fields", `${label} must be a sha256 digest`);
    }
    return value;
}
function iso(value, label) {
    if (typeof value !== "string" ||
        !ISO.test(value) ||
        Number.isNaN(Date.parse(value))) {
        throw new JudgmentValidationError("closed-fields", `${label} must be an exact UTC timestamp`);
    }
    return value;
}
function integer(value, label) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new JudgmentValidationError("closed-fields", `${label} must be an integer`);
    }
    return value;
}
function nonBlank(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new JudgmentValidationError("closed-fields", `${label} must be a non-empty string`);
    }
    return value;
}
function semver(value, label) {
    if (typeof value !== "string" || !SEMVER.test(value)) {
        throw new JudgmentValidationError("closed-fields", `${label} must be exact semver without ranges or latest`);
    }
    if (value.toLowerCase() === "latest") {
        throw new JudgmentValidationError("closed-fields", `${label} cannot be latest`);
    }
    return value;
}
const FORBIDDEN_KEY = /^(approved|approval|humanVerdict|human_verdict|human-verdict|actionAuthorization|action_authorization|reviewVerdict|review-verdict|verdict|authorization|authorisation|reasoning|chainOfThought|chain_of_thought|scratchpad|apiKey|api_key|secret|password|credential|credentials)$/i;
const FORBIDDEN_VALUE = /(?:sk-[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{20,}|bearer\s+[A-Za-z0-9._-]{8,}|BEGIN [A-Z ]*PRIVATE KEY|human\s+verdict\s*[:=]|action\s+authoriz)/i;
function rejectForbiddenContent(value, label) {
    if (typeof value === "string") {
        if (FORBIDDEN_VALUE.test(value)) {
            throw new JudgmentValidationError("forbidden-field", `${label} carries a secret-shaped or authority-bearing value`);
        }
        return;
    }
    if (Array.isArray(value)) {
        for (const [index, entry] of value.entries()) {
            rejectForbiddenContent(entry, `${label}[${index}]`);
        }
        return;
    }
    if (isObject(value)) {
        for (const [key, child] of Object.entries(value)) {
            if (FORBIDDEN_KEY.test(key)) {
                throw new JudgmentValidationError("forbidden-field", `${label}.${key} carries a forbidden human-authority or credential field`);
            }
            rejectForbiddenContent(child, `${label}.${key}`);
        }
    }
}
export function outputContentDigestOf(output) {
    return sha256({ schema: output.schema, format: output.format, body: output.body });
}
function withoutKey(value, key) {
    const copy = { ...value };
    delete copy[key];
    return copy;
}
export function requestDigestOf(request) {
    return sha256(withoutKey(request, "requestDigest"));
}
export function responseDigestOf(response) {
    return sha256(withoutKey(response, "responseDigest"));
}
export function buildJudgmentRequest(input) {
    const payload = redact(input.payload);
    const payloadDigest = sha256(payload);
    const artifacts = input.outputArtifacts.map((entry) => ({
        artifactId: entry.artifactId,
        schema: entry.schema,
        format: entry.format,
        required: true,
    }));
    const contractDigest = sha256(artifacts);
    const deadlineMs = Date.parse(input.createdAt) + input.timeoutSeconds * 1000;
    if (Number.isNaN(deadlineMs)) {
        throw new JudgmentValidationError("closed-fields", "createdAt is invalid");
    }
    const draft = {
        schema: JUDGMENT_REQUEST_SCHEMA,
        revision: 1,
        identity: {
            sessionId: input.sessionId,
            runId: input.runId,
            candidateId: input.candidateId,
            evidenceId: input.evidenceId,
            playbookId: input.playbookId,
            playbookVersion: input.playbookVersion,
            planDigest: input.planDigest,
            stepId: input.stepId,
            attempt: input.attempt,
        },
        purpose: input.purpose,
        skill: input.skill,
        input: {
            runInputDigest: input.runInputDigest,
            contextBundleDigest: input.contextBundleDigest,
            payload,
            payloadDigest,
            contextManifest: input.contextManifest,
        },
        outputContract: { artifacts, contractDigest },
        execution: {
            idempotencyKey: sha256({
                runId: input.runId,
                stepId: input.stepId,
                attempt: input.attempt,
                skill: input.skill,
                runInputDigest: input.runInputDigest,
                contextBundleDigest: input.contextBundleDigest,
                payloadDigest,
                contractDigest,
                maximumChargeMicros: input.maximumChargeMicros,
                maxTotalTokens: input.maxStepTokens,
            }),
            createdAt: input.createdAt,
            deadlineAt: new Date(deadlineMs).toISOString(),
            maxLogicalAttempts: input.maxLogicalAttempts,
        },
        budget: {
            maxInputTokens: input.maxStepTokens,
            maxOutputTokens: input.maxStepTokens,
            maxTotalTokens: input.maxStepTokens,
            remainingRunTokens: input.remainingRunTokens,
            maximumChargeMicros: input.maximumChargeMicros,
            currency: "USD",
            allowedBillingModes: input.maximumChargeMicros > 0
                ? ["host-covered", "metered"]
                : ["host-covered"],
        },
        toolPolicy: { externalMutation: "deny", allowed: [] },
        redaction: {
            applied: true,
            classification: "internal",
            removedPaths: [],
            policyDigest: REDACTION_POLICY_DIGEST,
        },
    };
    const requestId = `jrq-${draft.execution.idempotencyKey.slice("sha256:".length, 7 + 16)}`;
    const withId = { ...draft, requestId };
    const requestDigest = requestDigestOf(withId);
    const request = {
        ...withId,
        requestDigest,
    };
    validateRequestShape(request);
    return request;
}
function validateIdentityShape(value, label) {
    const record = exactKeys(value, [
        "sessionId",
        "runId",
        "candidateId",
        "evidenceId",
        "playbookId",
        "playbookVersion",
        "planDigest",
        "stepId",
        "attempt",
    ], label);
    if (record.sessionId !== null)
        nonBlank(record.sessionId, `${label}.sessionId`);
    nonBlank(record.runId, `${label}.runId`);
    if (record.candidateId !== null)
        nonBlank(record.candidateId, `${label}.candidateId`);
    if (record.evidenceId !== null)
        nonBlank(record.evidenceId, `${label}.evidenceId`);
    nonBlank(record.playbookId, `${label}.playbookId`);
    semver(record.playbookVersion, `${label}.playbookVersion`);
    digest(record.planDigest, `${label}.planDigest`);
    nonBlank(record.stepId, `${label}.stepId`);
    integer(record.attempt, `${label}.attempt`);
    if (record.attempt < 1) {
        throw new JudgmentValidationError("closed-fields", `${label}.attempt starts at 1`);
    }
}
function validateSkillShape(value, label) {
    const record = exactKeys(value, ["id", "version", "packageDigest", "interfaceDigest"], label);
    nonBlank(record.id, `${label}.id`);
    semver(record.version, `${label}.version`);
    digest(record.packageDigest, `${label}.packageDigest`);
    digest(record.interfaceDigest, `${label}.interfaceDigest`);
    return record;
}
function validateRequestShape(value) {
    const request = exactKeys(value, [
        "schema",
        "requestId",
        "requestDigest",
        "revision",
        "identity",
        "purpose",
        "skill",
        "input",
        "outputContract",
        "execution",
        "budget",
        "toolPolicy",
        "redaction",
    ], "request");
    if (request.schema !== JUDGMENT_REQUEST_SCHEMA) {
        throw new JudgmentValidationError("closed-fields", "request schema tag is invalid");
    }
    if (request.revision !== 1) {
        throw new JudgmentValidationError("closed-fields", "request revision must be 1");
    }
    validateIdentityShape(request.identity, "request.identity");
    validateSkillShape(request.skill, "request.skill");
    const input = exactKeys(request.input, ["runInputDigest", "contextBundleDigest", "payload", "payloadDigest", "contextManifest"], "request.input");
    digest(input.runInputDigest, "request.input.runInputDigest");
    digest(input.contextBundleDigest, "request.input.contextBundleDigest");
    digest(input.payloadDigest, "request.input.payloadDigest");
    if (!Array.isArray(input.contextManifest)) {
        throw new JudgmentValidationError("closed-fields", "contextManifest must be an array");
    }
    for (const [index, entry] of input.contextManifest.entries()) {
        const manifest = exactKeys(entry, ["artifactId", "schema", "revision", "contentDigest"], `request.input.contextManifest[${index}]`);
        nonBlank(manifest.artifactId, `contextManifest[${index}].artifactId`);
        nonBlank(manifest.schema, `contextManifest[${index}].schema`);
        integer(manifest.revision, `contextManifest[${index}].revision`);
        digest(manifest.contentDigest, `contextManifest[${index}].contentDigest`);
    }
    if (sha256(request.input.payload) !== input.payloadDigest) {
        throw new JudgmentValidationError("digest-mismatch", "payload digest mismatch");
    }
    const contract = exactKeys(request.outputContract, ["artifacts", "contractDigest"], "request.outputContract");
    if (!Array.isArray(contract.artifacts) || contract.artifacts.length === 0) {
        throw new JudgmentValidationError("closed-fields", "outputContract needs artifacts");
    }
    const ids = [];
    for (const [index, entry] of contract.artifacts.entries()) {
        const artifact = exactKeys(entry, ["artifactId", "schema", "format", "required"], `outputContract.artifacts[${index}]`);
        nonBlank(artifact.artifactId, `artifacts[${index}].artifactId`);
        nonBlank(artifact.schema, `artifacts[${index}].schema`);
        if (!["json", "markdown", "text"].includes(artifact.format)) {
            throw new JudgmentValidationError("closed-fields", `artifacts[${index}].format is invalid`);
        }
        if (artifact.required !== true) {
            throw new JudgmentValidationError("closed-fields", "every declared output is required");
        }
        ids.push(artifact.artifactId);
    }
    if (new Set(ids).size !== ids.length) {
        throw new JudgmentValidationError("closed-fields", "output artifact ids must be unique");
    }
    digest(contract.contractDigest, "outputContract.contractDigest");
    if (sha256(contract.artifacts) !== contract.contractDigest) {
        throw new JudgmentValidationError("digest-mismatch", "contract digest mismatch");
    }
    const execution = exactKeys(request.execution, ["idempotencyKey", "createdAt", "deadlineAt", "maxLogicalAttempts"], "request.execution");
    digest(execution.idempotencyKey, "execution.idempotencyKey");
    iso(execution.createdAt, "execution.createdAt");
    iso(execution.deadlineAt, "execution.deadlineAt");
    integer(execution.maxLogicalAttempts, "execution.maxLogicalAttempts");
    const budget = exactKeys(request.budget, [
        "maxInputTokens",
        "maxOutputTokens",
        "maxTotalTokens",
        "remainingRunTokens",
        "maximumChargeMicros",
        "currency",
        "allowedBillingModes",
    ], "request.budget");
    for (const key of [
        "maxInputTokens",
        "maxOutputTokens",
        "maxTotalTokens",
        "remainingRunTokens",
    ]) {
        integer(budget[key], `budget.${key}`);
    }
    if (budget.currency !== "USD") {
        throw new JudgmentValidationError("closed-fields", "budget currency must be USD");
    }
    integer(budget.maximumChargeMicros, "budget.maximumChargeMicros");
    if (!Array.isArray(budget.allowedBillingModes)) {
        throw new JudgmentValidationError("closed-fields", "allowedBillingModes must be an array");
    }
    for (const mode of budget.allowedBillingModes) {
        if (!["host-covered", "metered"].includes(mode)) {
            throw new JudgmentValidationError("closed-fields", "billing mode is invalid");
        }
    }
    if (budget.maximumChargeMicros === 0 &&
        budget.allowedBillingModes.includes("metered")) {
        throw new JudgmentValidationError("budget-exceeded", "zero-cost budgets cannot declare metered billing");
    }
    const policy = exactKeys(request.toolPolicy, ["externalMutation", "allowed"], "request.toolPolicy");
    if (policy.externalMutation !== "deny") {
        throw new JudgmentValidationError("closed-fields", "external mutation must be denied");
    }
    if (!Array.isArray(policy.allowed)) {
        throw new JudgmentValidationError("closed-fields", "toolPolicy.allowed must be an array");
    }
    for (const [index, entry] of policy.allowed.entries()) {
        exactKeys(entry, ["capabilityId", "operationId"], `toolPolicy.allowed[${index}]`);
    }
    const redaction = exactKeys(request.redaction, ["applied", "classification", "removedPaths", "policyDigest"], "request.redaction");
    if (redaction.applied !== true) {
        throw new JudgmentValidationError("closed-fields", "redaction must be applied");
    }
    if (!["public", "internal", "confidential"].includes(redaction.classification)) {
        throw new JudgmentValidationError("closed-fields", "classification is invalid");
    }
    if (!Array.isArray(redaction.removedPaths)) {
        throw new JudgmentValidationError("closed-fields", "removedPaths must be an array");
    }
    if (redaction.policyDigest !== REDACTION_POLICY_DIGEST) {
        throw new JudgmentValidationError("digest-mismatch", "redaction policy digest mismatch");
    }
    if (requestDigestOf(request) !== request.requestDigest) {
        throw new JudgmentValidationError("digest-mismatch", "request digest mismatch");
    }
    return request;
}
export function parseSealedRequest(raw) {
    return validateRequestShape(raw);
}
function parseExecutor(value) {
    const record = exactKeys(value, ["hostId", "adapterId", "adapterVersion", "executionId", "loadedAssetManifestDigest"], "response.executor");
    for (const key of ["hostId", "adapterId", "adapterVersion", "executionId"]) {
        nonBlank(record[key], `executor.${key}`);
        if (/^latest$/i.test(record[key])) {
            throw new JudgmentValidationError("closed-fields", `executor.${key} cannot be latest`);
        }
    }
    digest(record.loadedAssetManifestDigest, "executor.loadedAssetManifestDigest");
    return record;
}
function parseModel(value) {
    if (value === null)
        return null;
    const record = exactKeys(value, ["provider", "providerCellId", "model", "modelVersion", "settingsDigest", "promptTemplateDigest"], "response.model");
    for (const key of ["provider", "providerCellId", "model", "modelVersion"]) {
        nonBlank(record[key], `model.${key}`);
        if (/^latest$/i.test(record[key])) {
            throw new JudgmentValidationError("closed-fields", `model.${key} cannot be latest`);
        }
    }
    digest(record.settingsDigest, "model.settingsDigest");
    digest(record.promptTemplateDigest, "model.promptTemplateDigest");
    return record;
}
function parseUsage(value) {
    const record = exactKeys(value, ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "totalTokens"], "response.usage");
    for (const key of [
        "inputTokens",
        "outputTokens",
        "cacheReadTokens",
        "cacheWriteTokens",
        "totalTokens",
    ]) {
        if (integer(record[key], `usage.${key}`) < 0) {
            throw new JudgmentValidationError("closed-fields", `usage.${key} cannot be negative`);
        }
    }
    return record;
}
function parseCost(value) {
    const record = exactKeys(value, ["billingMode", "currency", "reservedMicros", "actualMicros", "chargedToRunMicros"], "response.cost");
    if (!["host-covered", "metered"].includes(record.billingMode)) {
        throw new JudgmentValidationError("closed-fields", "cost.billingMode is invalid");
    }
    if (record.currency !== "USD") {
        throw new JudgmentValidationError("closed-fields", "cost currency must be USD");
    }
    integer(record.reservedMicros, "cost.reservedMicros");
    if (record.actualMicros !== null)
        integer(record.actualMicros, "cost.actualMicros");
    integer(record.chargedToRunMicros, "cost.chargedToRunMicros");
    return record;
}
function parseOutputs(value) {
    if (value === null)
        return null;
    if (!Array.isArray(value)) {
        throw new JudgmentValidationError("closed-fields", "outputs must be an array or null");
    }
    return value.map((entry, index) => {
        const record = exactKeys(entry, ["artifactId", "schema", "format", "body", "contentDigest"], `response.outputs[${index}]`);
        nonBlank(record.artifactId, `outputs[${index}].artifactId`);
        nonBlank(record.schema, `outputs[${index}].schema`);
        if (!["json", "markdown", "text"].includes(record.format)) {
            throw new JudgmentValidationError("closed-fields", `outputs[${index}].format is invalid`);
        }
        digest(record.contentDigest, `outputs[${index}].contentDigest`);
        if (outputContentDigestOf(record) !== record.contentDigest) {
            throw new JudgmentValidationError("digest-mismatch", `outputs[${index}] content digest mismatch`);
        }
        return record;
    });
}
function parseFailure(value) {
    if (value === null)
        return null;
    const record = exactKeys(value, ["code", "retryable", "dispatchState", "safeMessage"], "response.failure");
    if (![
        "skill-unavailable",
        "skill-digest-mismatch",
        "invalid-input",
        "budget-exceeded",
        "deadline-exceeded",
        "provider-rejected",
        "provider-failed",
        "cancelled",
    ].includes(record.code)) {
        throw new JudgmentValidationError("closed-fields", "failure.code is invalid");
    }
    if (typeof record.retryable !== "boolean") {
        throw new JudgmentValidationError("closed-fields", "failure.retryable must be boolean");
    }
    if (!["pre-dispatch", "accepted", "unknown"].includes(record.dispatchState)) {
        throw new JudgmentValidationError("closed-fields", "failure.dispatchState is invalid");
    }
    nonBlank(record.safeMessage, "failure.safeMessage");
    return record;
}
export function parseJudgmentResponse(raw) {
    const response = exactKeys(raw, [
        "schema",
        "responseId",
        "responseDigest",
        "requestId",
        "requestDigest",
        "identity",
        "skill",
        "outcome",
        "executor",
        "model",
        "outputs",
        "usage",
        "cost",
        "tools",
        "failure",
        "redaction",
        "startedAt",
        "finishedAt",
    ], "response");
    if (response.schema !== JUDGMENT_RESPONSE_SCHEMA) {
        throw new JudgmentValidationError("closed-fields", "response schema tag is invalid");
    }
    nonBlank(response.responseId, "response.responseId");
    digest(response.responseDigest, "response.responseDigest");
    nonBlank(response.requestId, "response.requestId");
    digest(response.requestDigest, "response.requestDigest");
    validateIdentityShape(response.identity, "response.identity");
    validateSkillShape(response.skill, "response.skill");
    if (!["succeeded", "failed", "cancelled"].includes(response.outcome)) {
        throw new JudgmentValidationError("closed-fields", "response.outcome is invalid");
    }
    parseExecutor(response.executor);
    parseModel(response.model);
    parseOutputs(response.outputs);
    parseUsage(response.usage);
    parseCost(response.cost);
    if (!Array.isArray(response.tools)) {
        throw new JudgmentValidationError("closed-fields", "response.tools must be an array");
    }
    for (const [index, entry] of response.tools.entries()) {
        const tool = exactKeys(entry, ["capabilityId", "operationId", "receiptDigest"], `response.tools[${index}]`);
        nonBlank(tool.capabilityId, `tools[${index}].capabilityId`);
        nonBlank(tool.operationId, `tools[${index}].operationId`);
        digest(tool.receiptDigest, `tools[${index}].receiptDigest`);
    }
    parseFailure(response.failure);
    const redaction = exactKeys(response.redaction, ["applied", "policyDigest"], "response.redaction");
    if (redaction.applied !== true) {
        throw new JudgmentValidationError("closed-fields", "response redaction must be applied");
    }
    digest(redaction.policyDigest, "response.redaction.policyDigest");
    const startedAt = iso(response.startedAt, "response.startedAt");
    const finishedAt = iso(response.finishedAt, "response.finishedAt");
    if (Date.parse(startedAt) > Date.parse(finishedAt)) {
        throw new JudgmentValidationError("lifecycle-invalid", "response startedAt cannot be after finishedAt");
    }
    rejectForbiddenContent(raw, "response");
    if (responseDigestOf(response) !== response.responseDigest) {
        throw new JudgmentValidationError("digest-mismatch", "response digest mismatch");
    }
    return response;
}
function sameIdentity(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
export function validateJudgmentResponse(request, raw) {
    const response = parseJudgmentResponse(raw);
    if (response.requestId !== request.requestId ||
        response.requestDigest !== request.requestDigest) {
        throw new JudgmentValidationError("identity-mismatch", "response does not bind the pending request");
    }
    if (!sameIdentity(response.identity, request.identity)) {
        throw new JudgmentValidationError("identity-mismatch", "response identity differs from the sealed request");
    }
    if (!sameIdentity(response.skill, request.skill)) {
        throw new JudgmentValidationError("skill-mismatch", "response skill ref mismatch");
    }
    if (Date.parse(response.startedAt) < Date.parse(request.execution.createdAt) ||
        Date.parse(response.finishedAt) > Date.parse(request.execution.deadlineAt)) {
        throw new JudgmentValidationError("lifecycle-invalid", "response falls outside the sealed execution window");
    }
    if (response.outcome === "succeeded") {
        if (response.failure !== null) {
            throw new JudgmentValidationError("lifecycle-invalid", "successful responses cannot carry a failure record");
        }
        if (response.model === null) {
            throw new JudgmentValidationError("lifecycle-invalid", "successful model-backed responses require a model record");
        }
        if (response.outputs === null || response.outputs.length === 0) {
            throw new JudgmentValidationError("output-contract-mismatch", "successful responses require their declared outputs");
        }
        const expected = new Map(request.outputContract.artifacts.map((entry) => [entry.artifactId, entry]));
        const seen = new Set();
        for (const output of response.outputs) {
            if (!expected.has(output.artifactId)) {
                throw new JudgmentValidationError("output-contract-mismatch", `undeclared output ${output.artifactId}`);
            }
            if (seen.has(output.artifactId)) {
                throw new JudgmentValidationError("output-contract-mismatch", `duplicate output ${output.artifactId}`);
            }
            seen.add(output.artifactId);
            const contract = expected.get(output.artifactId);
            if (output.schema !== contract.schema || output.format !== contract.format) {
                throw new JudgmentValidationError("output-contract-mismatch", `output ${output.artifactId} violates its declared contract`);
            }
        }
        for (const artifactId of expected.keys()) {
            if (!seen.has(artifactId)) {
                throw new JudgmentValidationError("output-contract-mismatch", `missing output ${artifactId}`);
            }
        }
    }
    else {
        if (response.outputs !== null) {
            throw new JudgmentValidationError("lifecycle-invalid", "failed or cancelled responses must carry outputs: null");
        }
        if (response.failure === null) {
            throw new JudgmentValidationError("lifecycle-invalid", "failed or cancelled responses require a failure record");
        }
        if (response.outcome === "cancelled" && response.failure.code !== "cancelled") {
            throw new JudgmentValidationError("lifecycle-invalid", "cancelled outcomes require the cancelled failure code");
        }
    }
    const allowedTools = new Set(request.toolPolicy.allowed.map((entry) => `${entry.capabilityId}:${entry.operationId}`));
    for (const tool of response.tools) {
        if (!allowedTools.has(`${tool.capabilityId}:${tool.operationId}`)) {
            throw new JudgmentValidationError("tool-policy-violation", `undeclared tool use ${tool.capabilityId}:${tool.operationId}`);
        }
    }
    const budget = request.budget;
    if (response.usage.inputTokens > budget.maxInputTokens ||
        response.usage.outputTokens > budget.maxOutputTokens ||
        response.usage.totalTokens > budget.maxTotalTokens) {
        throw new JudgmentValidationError("budget-exceeded", "reported token usage exceeds the sealed budget");
    }
    if (!budget.allowedBillingModes.includes(response.cost.billingMode)) {
        throw new JudgmentValidationError("budget-exceeded", `billing mode ${response.cost.billingMode} is not allowed by the sealed budget`);
    }
    if (response.cost.reservedMicros > budget.maximumChargeMicros) {
        throw new JudgmentValidationError("budget-exceeded", "reservation exceeds the maximum charge");
    }
    if (response.cost.billingMode === "metered") {
        if (budget.maximumChargeMicros <= 0) {
            throw new JudgmentValidationError("budget-exceeded", "metered execution requires an authorized non-zero maximum charge");
        }
        if (response.cost.actualMicros !== null &&
            response.cost.actualMicros > budget.maximumChargeMicros) {
            throw new JudgmentValidationError("budget-exceeded", "actual metered cost exceeds the maximum charge");
        }
    }
    if (response.cost.billingMode === "host-covered") {
        if (response.cost.chargedToRunMicros !== 0) {
            throw new JudgmentValidationError("budget-exceeded", "host-covered execution charges nothing to the run");
        }
    }
    else if (response.cost.chargedToRunMicros > budget.maximumChargeMicros) {
        throw new JudgmentValidationError("budget-exceeded", "charged cost exceeds the maximum charge");
    }
    if (response.redaction.policyDigest !== request.redaction.policyDigest) {
        throw new JudgmentValidationError("digest-mismatch", "response redaction policy differs from the request");
    }
    return response;
}
/** Validates a response and binds it to the injected host callback identity. */
export function validateProviderJudgmentResponse(binding, request, raw) {
    validateProviderBinding(binding);
    const response = validateJudgmentResponse(request, raw);
    if (response.executor.hostId !== binding.hostId ||
        response.executor.adapterId !== binding.adapterId ||
        response.executor.adapterVersion !== binding.adapterVersion) {
        throw new JudgmentValidationError("executor-mismatch", "response executor does not match the injected host callback binding");
    }
    return response;
}
