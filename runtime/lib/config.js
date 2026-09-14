import { isIP } from "node:net";
const PROVIDERS = new Set(["openai", "anthropic", "vercel-ai-gateway"]);
const SECRET_VALUE = /(?:sk-[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{20,}|bearer\s+[A-Za-z0-9._-]{8,})/i;
function invariant(condition, message) {
    if (!condition)
        throw new Error(`[conquistador.config] ${message}`);
}
function exactKeys(value, keys, label) {
    invariant(Object.keys(value).every((key) => keys.includes(key)), `${label} contains an undeclared field`);
}
function parseScalar(value, line) {
    const trimmed = value.trim();
    if (trimmed.startsWith('"')) {
        try {
            return JSON.parse(trimmed);
        }
        catch {
            throw new Error(`[conquistador.config] invalid quoted value on line ${line}`);
        }
    }
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            invariant(Array.isArray(parsed), `line ${line} must be an inline array`);
            return parsed;
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith("[conquistador.config]"))
                throw error;
            throw new Error(`[conquistador.config] invalid inline array on line ${line}`);
        }
    }
    if (trimmed === "true")
        return true;
    if (trimmed === "false")
        return false;
    if (trimmed === "null")
        return null;
    if (/^-?\d+$/.test(trimmed))
        return Number(trimmed);
    invariant(!/[&*!|>{}]/.test(trimmed), `unsupported YAML feature on line ${line}`);
    return trimmed;
}
function parseRestrictedYaml(text) {
    invariant(!text.includes("\t"), "tabs are not allowed");
    const root = {};
    const stack = [{ indent: -2, value: root }];
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
        const lineNumber = index + 1;
        if (!raw.trim() || raw.trimStart().startsWith("#"))
            continue;
        const match = /^( *)([A-Za-z][A-Za-z0-9]*):(?: +(.*))?$/.exec(raw);
        invariant(match, `invalid mapping syntax on line ${lineNumber}`);
        const indent = match[1].length;
        invariant(indent % 2 === 0, `indentation must use two spaces on line ${lineNumber}`);
        while (stack.length > 1 && indent <= stack.at(-1).indent)
            stack.pop();
        const parent = stack.at(-1);
        invariant(indent === parent.indent + 2, `invalid indentation on line ${lineNumber}`);
        const key = match[2];
        invariant(!Object.hasOwn(parent.value, key), `duplicate key ${key} on line ${lineNumber}`);
        if (match[3] === undefined) {
            const child = {};
            parent.value[key] = child;
            stack.push({ indent, value: child });
        }
        else {
            parent.value[key] = parseScalar(match[3], lineNumber);
        }
    }
    return root;
}
function model(value, label) {
    invariant(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
    const record = value;
    exactKeys(record, ["provider", "model", "credentialEnv", "billingMode"], label);
    invariant(typeof record.provider === "string" && PROVIDERS.has(record.provider), `${label} provider is unsupported`);
    invariant(typeof record.model === "string" && record.model.trim().length > 0, `${label} model is required`);
    invariant(!/^(?:latest|default|auto)$/i.test(record.model), `${label} model ID must be exact`);
    invariant(typeof record.credentialEnv === "string" && /^[A-Z][A-Z0-9_]{2,63}$/.test(record.credentialEnv), `${label} credentialEnv must be an environment reference`);
    invariant(record.billingMode === undefined || record.billingMode === "host-covered", `${label} billingMode must be host-covered when declared`);
    return record;
}
function positiveInteger(value, label, allowZero = false) {
    invariant(Number.isInteger(value) && (allowZero ? Number(value) >= 0 : Number(value) > 0), `${label} must be a bounded integer`);
}
function stringArray(value, label) {
    invariant(Array.isArray(value) && value.every((entry) => typeof entry === "string"), `${label} must be a string array`);
}
export function validateConfig(value) {
    invariant(Boolean(value) && typeof value === "object" && !Array.isArray(value), "config must be an object");
    const config = value;
    exactKeys(config, ["schemaVersion", "instance", "models", "server", "data", "memory", "sandbox", "limits", "tools"], "config");
    invariant(config.schemaVersion === "conquistador.config/v1", "schemaVersion must be conquistador.config/v1");
    invariant(Boolean(config.instance) && typeof config.instance === "object", "instance is required");
    exactKeys(config.instance, ["id"], "instance");
    invariant(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(config.instance.id), "instance.id must be a stable ID");
    invariant(Boolean(config.models) && typeof config.models === "object", "models are required");
    exactKeys(config.models, ["primary", "fast", "judge"], "models");
    model(config.models.primary, "models.primary");
    model(config.models.fast, "models.fast");
    model(config.models.judge, "models.judge");
    invariant(Boolean(config.server) && typeof config.server === "object", "server is required");
    exactKeys(config.server, ["profile", "bind", "port", "publicUrl", "auth", "allowedOrigins", "trustedProxies"], "server");
    invariant(["local", "single-node"].includes(config.server.profile), "server.profile is invalid");
    invariant(typeof config.server.bind === "string" && config.server.bind.trim().length > 0, "server.bind is required");
    positiveInteger(config.server.port, "server.port");
    invariant(config.server.port <= 65535, "server.port exceeds 65535");
    stringArray(config.server.allowedOrigins, "server.allowedOrigins");
    stringArray(config.server.trustedProxies, "server.trustedProxies");
    invariant(config.server.trustedProxies.every((entry) => isIP(entry) > 0), "server.trustedProxies must contain exact IP addresses");
    invariant(Boolean(config.server.auth) && typeof config.server.auth === "object", "server.auth is required");
    const auth = config.server.auth;
    if (auth.mode === "local")
        exactKeys(auth, ["mode"], "server.auth");
    else if (auth.mode === "bearer") {
        exactKeys(auth, ["mode", "tokenEnv"], "server.auth");
        invariant(/^[A-Z][A-Z0-9_]{2,63}$/.test(auth.tokenEnv), "server.auth.tokenEnv must be an environment reference");
    }
    else if (auth.mode === "oidc") {
        exactKeys(auth, ["mode", "issuer", "audience", "jwksUrl"], "server.auth");
        invariant([auth.issuer, auth.audience, auth.jwksUrl].every((entry) => typeof entry === "string" && entry.length > 0), "OIDC fields are required");
        invariant(auth.issuer.startsWith("https://") && auth.jwksUrl.startsWith("https://"), "OIDC issuer and JWKS URL must use HTTPS");
    }
    else
        throw new Error("[conquistador.config] server.auth mode is invalid");
    const loopback = ["127.0.0.1", "::1", "localhost"].includes(config.server.bind);
    if (config.server.profile === "local") {
        invariant(loopback && auth.mode === "local", "local profile requires loopback and local auth");
    }
    if (!loopback) {
        invariant(config.server.profile === "single-node" &&
            auth.mode !== "local" &&
            typeof config.server.publicUrl === "string" &&
            config.server.publicUrl.startsWith("https://") &&
            config.server.allowedOrigins.length > 0 &&
            config.server.trustedProxies.length > 0, "non-loopback bind requires single-node auth, HTTPS publicUrl, origins, and proxy policy");
    }
    invariant(Boolean(config.data) && typeof config.data === "object", "data is required");
    exactKeys(config.data, ["dir", "sessionRetentionDays", "traceRetentionDays", "artifactPolicy", "backupPolicy"], "data");
    invariant(typeof config.data.dir === "string" && config.data.dir.trim().length > 0, "data.dir is required");
    positiveInteger(config.data.sessionRetentionDays, "data.sessionRetentionDays");
    positiveInteger(config.data.traceRetentionDays, "data.traceRetentionDays");
    invariant(["accepted-only", "reviewed"].includes(config.data.artifactPolicy), "data.artifactPolicy is invalid");
    invariant(config.data.backupPolicy === "operator", "data.backupPolicy must remain operator-owned");
    invariant(Boolean(config.memory) && typeof config.memory === "object", "memory is required");
    exactKeys(config.memory, ["mode", "scopePolicy"], "memory");
    invariant(["off", "review-promoted"].includes(config.memory.mode), "memory.mode is invalid");
    invariant(config.memory.scopePolicy === "instance-workspace-project", "memory.scopePolicy is invalid");
    invariant(Boolean(config.sandbox) && typeof config.sandbox === "object", "sandbox is required");
    exactKeys(config.sandbox, ["mode", "projectRoots"], "sandbox");
    invariant(config.sandbox.mode === "disabled", "sandbox.mode must be disabled; docker is unimplemented");
    stringArray(config.sandbox.projectRoots, "sandbox.projectRoots");
    invariant(Boolean(config.limits) && typeof config.limits === "object", "limits are required");
    exactKeys(config.limits, ["activeSessions", "internalSpecialists", "tokensPerRun", "timeoutSeconds", "queuedMessages", "bodyBytes"], "limits");
    positiveInteger(config.limits.activeSessions, "limits.activeSessions");
    positiveInteger(config.limits.internalSpecialists, "limits.internalSpecialists", true);
    positiveInteger(config.limits.tokensPerRun, "limits.tokensPerRun");
    positiveInteger(config.limits.timeoutSeconds, "limits.timeoutSeconds");
    positiveInteger(config.limits.queuedMessages, "limits.queuedMessages");
    positiveInteger(config.limits.bodyBytes, "limits.bodyBytes");
    invariant(Boolean(config.tools) && typeof config.tools === "object", "tools are required");
    exactKeys(config.tools, ["catalogPath", "actionPolicy"], "tools");
    invariant(config.tools.catalogPath === undefined || typeof config.tools.catalogPath === "string", "tools.catalogPath must be a path");
    invariant(config.tools.actionPolicy === "human-bound", "tools.actionPolicy must remain human-bound");
    invariant(!SECRET_VALUE.test(JSON.stringify(config)), "literal secret material is forbidden");
}
export function parseConfigYaml(text) {
    const raw = parseRestrictedYaml(text);
    const models = raw.models;
    invariant(Boolean(models?.primary), "models.primary is required");
    models.fast ??= structuredClone(models.primary);
    models.judge ??= structuredClone(models.primary);
    validateConfig(raw);
    return structuredClone(raw);
}
