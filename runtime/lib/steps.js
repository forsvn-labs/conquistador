import { buildHumanActionManifest, defaultOperationCatalog, invokeVerifiedOperation, renderManifestMarkdown, renderStubMarkdown, resolveOperation, } from "./operations.js";
const CHANNEL_FORMAT = {
    social: "social",
    twitter: "social",
    x: "social",
    linkedin: "social",
    facebook: "social",
    instagram: "social",
    reddit: "social",
    blog: "longform",
    article: "longform",
    newsletter: "longform",
    longform: "longform",
    medium: "longform",
    tiktok: "shortform",
    shorts: "shortform",
    reels: "shortform",
    shortform: "shortform",
    copy: "copy",
    landing: "copy",
};
function fail(message) {
    throw new Error(`[conquistador.runner] ${message}`);
}
function catalogOf(ctx) {
    return ctx.operations ?? defaultOperationCatalog();
}
function invokeStepOperation(ctx, summary, extra = {}) {
    if (ctx.operationResult)
        return ctx.operationResult;
    const operationId = ctx.step.uses.toolOperationId;
    if (!operationId)
        fail(`step ${ctx.step.id} is missing toolOperationId`);
    return invokeVerifiedOperation({
        operationId,
        catalog: catalogOf(ctx),
        runId: ctx.runId,
        stepId: ctx.step.id,
        summary,
        extra,
    });
}
function jsonBodyFrom(result) {
    return result.kind === "gateway-receipt" ? { ...result.receipt.data, operationReceipt: result.receipt } : result.kind === "human-action-manifest" ? result.manifest : result.stub;
}
function markdownBodyFrom(result) {
    if (result.kind === "gateway-receipt")
        return `# Catalog operation receipt\n\nStatus: ${result.receipt.status}\nCatalog receipt digest: ${result.receipt.catalogReceiptDigest}\n\n${JSON.stringify(result.receipt.data, null, 2)}`;
    return result.kind === "human-action-manifest"
        ? renderManifestMarkdown(result.manifest)
        : renderStubMarkdown(result.stub);
}
function requiredString(inputs, name) {
    const value = inputs[name];
    if (typeof value !== "string" || !value.trim())
        fail(`required input ${name} is missing`);
    return value.trim();
}
function lookup(path, ctx) {
    const [root, ...rest] = path.split(".");
    let current = ctx.values[root] ?? ctx.inputs[root];
    for (const key of rest) {
        if (!current || typeof current !== "object" || Array.isArray(current))
            return undefined;
        current = current[key];
    }
    return current;
}
function nativeFormatFor(channel) {
    const key = channel.toLowerCase().trim();
    if (CHANNEL_FORMAT[key])
        return CHANNEL_FORMAT[key];
    for (const [token, format] of Object.entries(CHANNEL_FORMAT)) {
        if (key.includes(token))
            return format;
    }
    return "social";
}
function loadApprovedContext(ctx) {
    const product = requiredString(ctx.inputs, "product");
    const audience = requiredString(ctx.inputs, "audience");
    const channel = requiredString(ctx.inputs, "channel");
    const goals = requiredString(ctx.inputs, "goals");
    const prior = typeof ctx.inputs.priorApprovedContext === "string" ? ctx.inputs.priorApprovedContext : "";
    const consumption = ctx.values.priorConsumption && typeof ctx.values.priorConsumption === "object"
        ? ctx.values.priorConsumption
        : undefined;
    const priorLines = consumption
        ? [
            `- Prior artifact: ${consumption.artifactId ?? "unknown"}`,
            `- Prior consumption: ${consumption.reviewedAs ?? "unreviewed"}`,
            consumption.reviewedAs === "approved"
                ? "- Prior verdict: accept (attached; user-owned, not universal truth)"
                : `- Prior artifact is unreviewed (${consumption.reason ?? "missing-verdict"}); do not treat as truth`,
        ]
        : [prior ? `- Prior approved context: ${prior}` : "- Prior approved context: none"];
    const body = {
        product,
        audience,
        channel,
        goals,
        priorApprovedContext: prior || undefined,
        priorConsumption: consumption,
    };
    return {
        artifacts: {
            "approved-context": {
                format: "markdown",
                body: [
                    "# Approved context",
                    "",
                    `- Product: ${product}`,
                    `- Audience: ${audience}`,
                    `- Channel: ${channel}`,
                    `- Goals: ${goals}`,
                    ...priorLines,
                ].join("\n"),
            },
        },
        values: { context: body },
    };
}
function pullSignals(ctx) {
    const context = ctx.artifactBodies["approved-context"];
    if (context === undefined)
        fail("pull-signals requires approved-context");
    const operation = invokeStepOperation(ctx, "Pull bounded search, audience, competitor, and owned-performance signals from verified operations, or record the handoff.", { signals: [], handoff: true });
    return {
        artifacts: {
            "signal-bundle": {
                format: "json",
                body: operation.kind === "gateway-receipt" ? { operationReceipt: operation.receipt, signals: operation.receipt.status === "succeeded" || operation.receipt.status === "partial" ? [{ catalogReceiptDigest: operation.receipt.catalogReceiptDigest, data: operation.receipt.data }] : [], handoff: operation.receipt.status !== "succeeded" } : jsonBodyFrom(operation),
            },
        },
        operation,
    };
}
function normalizeSignals(ctx) {
    const bundle = ctx.artifactBodies["signal-bundle"];
    if (bundle === undefined)
        fail("normalize-data requires signal-bundle");
    const record = bundle && typeof bundle === "object" && !Array.isArray(bundle)
        ? bundle
        : {};
    const signals = Array.isArray(record.signals) ? [...record.signals] : [];
    signals.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return {
        artifacts: {
            "normalized-signals": {
                format: "json",
                body: {
                    schema: "conquistador.artifact.normalized-signals/v1",
                    sourceProvenancePreserved: true,
                    handoffPreserved: record.handoff === true || record.fallback === "human-action-manifest" || record.schemaVersion === "conquistador.artifact.human-action-manifest/v1",
                    ...(record.operationReceipt ? { operationReceipt: record.operationReceipt } : {}),
                    normalizedAt: ctx.now.toISOString(),
                    signals,
                },
            },
        },
    };
}
function selectHypothesis(ctx) {
    const briefs = String(ctx.artifactBodies["opportunity-briefs"] ?? "");
    const context = (ctx.values.context ?? {});
    const channel = typeof context.channel === "string" ? context.channel : requiredString(ctx.inputs, "channel");
    const nativeFormat = nativeFormatFor(channel);
    const hypothesis = {
        statement: "Publish one evidence-backed piece on the declared channel and measure one success signal.",
        channel,
        nativeFormat,
        successSignal: typeof context.goals === "string" ? context.goals : "one declared success signal",
        guardrail: "Do not fabricate attribution or treat missing results as proof.",
        stopRule: "Stop the cycle after one review and one next decision.",
        sourceBriefs: briefs.slice(0, 240),
    };
    return {
        artifacts: {
            hypothesis: {
                format: "markdown",
                body: [
                    "# Selected hypothesis",
                    "",
                    `- Statement: ${hypothesis.statement}`,
                    `- Channel: ${hypothesis.channel}`,
                    `- nativeFormat: ${hypothesis.nativeFormat}`,
                    `- Success signal: ${hypothesis.successSignal}`,
                    `- Guardrail: ${hypothesis.guardrail}`,
                    `- Stop rule: ${hypothesis.stopRule}`,
                ].join("\n"),
            },
        },
        values: { hypothesis },
    };
}
function createDraft(ctx) {
    if (ctx.artifactBodies["created-artifact"] === undefined)
        fail("approved-action requires created-artifact");
    const operation = invokeStepOperation(ctx, `Create a provider draft for the approved artifact, or record the exact handoff for run ${ctx.runId}.`, { runId: ctx.runId });
    return {
        artifacts: {
            "action-receipt": {
                format: "markdown",
                body: markdownBodyFrom(operation),
            },
        },
        operation,
    };
}
function observeWindow(ctx) {
    if (ctx.artifactBodies["action-receipt"] === undefined)
        fail("observe-results requires action-receipt");
    const operation = invokeStepOperation(ctx, "Pull results after the declared observation window, or record the missing window as unknown.", { window: "declared, not elapsed", result: "unknown" });
    const prefix = [
        "# Observation record",
        "",
        ...(operation.kind === "gateway-receipt"
            ? ["Window validation: host responsibility.", "Business result: not inferred from operation status."]
            : ["Window: declared, not elapsed.", "Result: unknown", "Executed: no", "Live call: no"]),
        "",
        "Missing results remain unknown. The runner does not fabricate attribution.",
        "",
    ].join("\n");
    return {
        artifacts: {
            "observation-record": {
                format: "markdown",
                body: `${prefix}${markdownBodyFrom(operation)}`,
            },
        },
        operation,
    };
}
function storeLearning(ctx) {
    if (ctx.artifactBodies["measurement-verdict"] === undefined)
        fail("store-learning requires measurement-verdict");
    return {
        artifacts: {
            "learning-record": {
                format: "markdown",
                body: [
                    "# Learning record",
                    "",
                    "User-owned facts, decisions, and observed or explicitly unknown results for the next cycle.",
                    "Hidden reasoning is not stored. Unreviewed output is not treated as universal truth.",
                    "",
                    `- Run: ${ctx.runId}`,
                    `- Recorded at: ${ctx.now.toISOString()}`,
                ].join("\n"),
            },
        },
    };
}
const SCRIPTS = {
    "load-approved-context": loadApprovedContext,
    "normalize-signals": normalizeSignals,
    "select-hypothesis": selectHypothesis,
    "store-learning-record": storeLearning,
};
const TOOLS = {
    "signals.pull-bounded": pullSignals,
    "distribution.create-draft": createDraft,
    "performance.observe-window": observeWindow,
};
export function resolveSkillId(step, ctx) {
    if (step.uses.skillId)
        return step.uses.skillId;
    const branch = step.uses.branch;
    if (!branch)
        fail(`step ${step.id} does not declare a skill`);
    const value = lookup(branch.on, ctx);
    if (typeof value !== "string" || !value.trim())
        fail(`branch ${branch.on} is missing for step ${step.id}`);
    const match = branch.cases.find((entry) => entry.when === value);
    if (!match)
        fail(`step ${step.id} has no case for ${branch.on}=${value}`);
    return match.skillId;
}
export function degradeDeclaredStep(ctx, error) {
    const step = ctx.step;
    if (step.kind === "tool-operation" && step.uses.toolOperationId) {
        const catalog = catalogOf(ctx);
        const known = catalog.records.some((record) => record.id === step.uses.toolOperationId);
        const operation = resolveOperation(step.uses.toolOperationId, catalog);
        const manifest = buildHumanActionManifest({
            operation,
            known,
            summary: `Degraded: ${error}`,
            extra: { degraded: true, error },
        });
        const result = {
            kind: "human-action-manifest",
            operation,
            executed: false,
            liveCall: false,
            credentialsUsed: false,
            manifest,
        };
        const artifactId = step.outputArtifacts[0];
        const format = artifactId.endsWith("receipt") || artifactId.includes("record") ? "markdown" : "json";
        const body = format === "json" ? manifest : renderManifestMarkdown(manifest);
        return { artifacts: { [artifactId]: { format, body } }, operation: result };
    }
    fail(`step ${step.id} failed and cannot degrade: ${error}`);
}
export function executeDeclaredStep(ctx) {
    const step = ctx.step;
    if (step.kind === "script") {
        const scriptId = step.uses.scriptId;
        if (!scriptId)
            fail(`step ${step.id} is missing scriptId`);
        const handler = SCRIPTS[scriptId];
        if (!handler)
            fail(`unknown script ${scriptId}`);
        return handler(ctx);
    }
    if (step.kind === "tool-operation") {
        const toolId = step.uses.toolOperationId;
        if (!toolId)
            fail(`step ${step.id} is missing toolOperationId`);
        const handler = TOOLS[toolId];
        if (handler)
            return handler(ctx);
        const operation = invokeStepOperation(ctx, `Unsupported or unknown operation ${toolId} cannot execute.`);
        const artifactId = step.outputArtifacts[0];
        const format = artifactId.endsWith("receipt") || artifactId.includes("record") ? "markdown" : "json";
        return {
            artifacts: {
                [artifactId]: {
                    format,
                    body: format === "json" ? jsonBodyFrom(operation) : markdownBodyFrom(operation),
                },
            },
            operation,
        };
    }
    fail(`step ${step.id} is a skill step and executes only through the durable judgment seam`);
}
