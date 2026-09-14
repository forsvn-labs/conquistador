export type RouterTargetKind = "playbook" | "skill";
export type RouterTarget = {
    kind: RouterTargetKind;
    id: string;
};
export type CapabilityRoute = {
    id: string;
    target: RouterTarget;
    phrases: string[];
};
export type RouterAbstention = {
    onZeroMatches: "abstain";
    onMultipleMatches: "abstain";
    onEmptyIntent: "abstain";
    neverGuess: true;
};
export type RouterContract = {
    schemaVersion: "conquistador.capability-router/v1";
    version: string;
    productVersion: "1.0.0";
    activationRequiredByPortablePlugin: false;
    loadsAtPluginRuntime: false;
    abstention: RouterAbstention;
    routes: CapabilityRoute[];
};
export type RouteDecision = {
    schemaVersion: "conquistador.route-decision/v1";
    outcome: "playbook" | "skill";
    targetId: string;
    routeId: string;
    contractVersion: string;
} | {
    schemaVersion: "conquistador.route-decision/v1";
    outcome: "abstain";
    reason: "empty-intent" | "no-capable-match" | "ambiguous-intent";
    candidates: string[];
    clarification?: string;
};
export declare function validateRouterContract(value: unknown): asserts value is RouterContract;
export declare function loadRouterContract(path?: string): RouterContract;
export declare function normalizeIntent(value: string): string;
export declare function routeIntent(intent: string, contract?: RouterContract): RouteDecision;
