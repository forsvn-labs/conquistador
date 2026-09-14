import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deepFreeze } from "./canonical.js";
const PREFIX = "conquistador.router";
const ROUTE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ROUTING_KEYS = new Set(["routingIndex", "promptSignals", "noneOf", "hooks", "skill-registry", "capability-index"]);
const DEFAULT_CONTRACT_PATH = resolve(import.meta.dirname, "../fixtures/router/capability-routes.json");
function invariant(condition, message) {
    if (!condition)
        throw new Error(`[${PREFIX}] ${message}`);
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, allowed, label) {
    const keys = Object.keys(value);
    const routing = keys.filter((key) => ROUTING_KEYS.has(key));
    invariant(routing.length === 0, `${label} must not carry routing-registry fields (${routing.join(", ")})`);
    invariant(keys.every((key) => allowed.includes(key)), `${label} contains an undeclared field`);
}
function nonEmpty(value, label) {
    invariant(typeof value === "string" && value.trim().length > 0, `${label} is required`);
}
function unique(values, label) {
    invariant(new Set(values).size === values.length, `${label} must be unique`);
}
export function validateRouterContract(value) {
    invariant(isObject(value), "router contract must be an object");
    exactKeys(value, [
        "schemaVersion",
        "version",
        "productVersion",
        "activationRequiredByPortablePlugin",
        "loadsAtPluginRuntime",
        "abstention",
        "routes",
    ], "router contract");
    invariant(value.schemaVersion === "conquistador.capability-router/v1", "schemaVersion must be conquistador.capability-router/v1");
    invariant(typeof value.version === "string" && SEMVER.test(value.version), "version must be exact semver");
    invariant(value.productVersion === "1.0.0", "productVersion must be 1.0.0");
    invariant(value.activationRequiredByPortablePlugin === false, "router activation is not required by the Portable Plugin");
    invariant(value.loadsAtPluginRuntime === false, "the Portable Plugin must not load the capability router at runtime");
    invariant(isObject(value.abstention), "abstention is required");
    exactKeys(value.abstention, ["onZeroMatches", "onMultipleMatches", "onEmptyIntent", "neverGuess"], "abstention");
    invariant(value.abstention.onZeroMatches === "abstain", "zero matches must abstain");
    invariant(value.abstention.onMultipleMatches === "abstain", "multiple matches must abstain");
    invariant(value.abstention.onEmptyIntent === "abstain", "empty intent must abstain");
    invariant(value.abstention.neverGuess === true, "the router must never guess");
    invariant(Array.isArray(value.routes) && value.routes.length > 0, "routes are required");
    const ids = [];
    const phrases = [];
    for (const [index, route] of value.routes.entries()) {
        invariant(isObject(route), `routes[${index}] must be an object`);
        exactKeys(route, ["id", "target", "phrases"], `routes[${index}]`);
        invariant(typeof route.id === "string" && ROUTE_ID.test(route.id), `routes[${index}].id is invalid`);
        invariant(isObject(route.target), `routes[${index}].target is required`);
        exactKeys(route.target, ["kind", "id"], `routes[${index}].target`);
        invariant(route.target.kind === "playbook" || route.target.kind === "skill", `routes[${index}].target.kind is invalid`);
        invariant(typeof route.target.id === "string" && ROUTE_ID.test(route.target.id), `routes[${index}].target.id is invalid`);
        invariant(Array.isArray(route.phrases) && route.phrases.length > 0, `routes[${index}].phrases are required`);
        invariant(route.phrases.every((phrase) => typeof phrase === "string" && phrase.trim().length > 0), `routes[${index}].phrases must be non-empty strings`);
        ids.push(route.id);
        phrases.push(...route.phrases.map((phrase) => normalizeIntent(phrase)));
    }
    unique(ids, "route ids");
    unique(phrases, "route phrases");
}
export function loadRouterContract(path = DEFAULT_CONTRACT_PATH) {
    const contract = JSON.parse(readFileSync(path, "utf8"));
    validateRouterContract(contract);
    return deepFreeze(structuredClone(contract));
}
export function normalizeIntent(value) {
    return value.toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();
}
function matches(intent, route) {
    return route.phrases.some((phrase) => intent.includes(normalizeIntent(phrase)));
}
export function routeIntent(intent, contract = loadRouterContract()) {
    validateRouterContract(contract);
    invariant(contract.abstention.neverGuess === true, "the router must never guess");
    const normalized = typeof intent === "string" ? normalizeIntent(intent) : "";
    if (!normalized) {
        return {
            schemaVersion: "conquistador.route-decision/v1",
            outcome: "abstain",
            reason: "empty-intent",
            candidates: [],
        };
    }
    const matched = contract.routes.filter((route) => matches(normalized, route));
    if (matched.length === 0) {
        return {
            schemaVersion: "conquistador.route-decision/v1",
            outcome: "abstain",
            reason: "no-capable-match",
            candidates: [],
        };
    }
    if (matched.length > 1) {
        const candidates = matched.map((route) => `${route.target.kind}:${route.target.id}`);
        return {
            schemaVersion: "conquistador.route-decision/v1",
            outcome: "abstain",
            reason: "ambiguous-intent",
            candidates,
            clarification: `Which outcome do you want: ${candidates.join(", ")}?`,
        };
    }
    const route = matched[0];
    return {
        schemaVersion: "conquistador.route-decision/v1",
        outcome: route.target.kind,
        targetId: route.target.id,
        routeId: route.id,
        contractVersion: contract.version,
    };
}
