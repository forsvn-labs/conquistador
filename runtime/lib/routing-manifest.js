export const PARENT_JOBS = [
    "launch-or-grow",
    "create-or-improve",
    "learn-from-results",
];
export const DIRECT_ONLY_ENGINEERING_OUTCOMES = [
    "architect-software-system",
    "brief-product-ui",
    "build-ios-app",
    "build-web-app",
    "map-user-flow",
    "write-technical-docs",
];
export const DIRECT_ONLY_ENGINEERING_WORKFLOWS = ["specify-product-experience"];
const DIRECT_ONLY_OUTCOME_SET = new Set(DIRECT_ONLY_ENGINEERING_OUTCOMES);
const DIRECT_ONLY_WORKFLOW_SET = new Set(DIRECT_ONLY_ENGINEERING_WORKFLOWS);
export function isDirectOnlyEngineeringOutcome(id) {
    return DIRECT_ONLY_OUTCOME_SET.has(id);
}
export function isDirectOnlyEngineeringWorkflow(id) {
    return DIRECT_ONLY_WORKFLOW_SET.has(id);
}
// Explicit engineering requests must not become marketing routes when installed
// method prose changes the lexical ranking. These patterns describe requests,
// rather than incidental mentions of software in a marketing brief.
const ENGINEERING_REQUESTS = {
    "architect-software-system": /^architect\s+(?:(?:the|a|an)\s+)?(?:software\s+)?system\b/i,
    "brief-product-ui": /^(?:specify|brief|design)\s+(?:(?:the|a|an)\s+)?(?:product\s+)?(?:ui|user interface)\b/i,
    "build-ios-app": /^build\s+(?:(?:the|a|an)\s+)?ios\s+app\b/i,
    "build-web-app": /^build\s+(?:(?:the|a|an)\s+)?web\s+app\b/i,
    "map-user-flow": /^map\s+(?:(?:the|a|an)\s+)?(?:onboarding\s+)?user\s+flow\b/i,
    "write-technical-docs": /^write\s+(?:(?:the|a|an)\s+)?technical\s+(?:documentation|docs)\b/i,
};
export function hasDirectOnlyEngineeringIntent(prompt) {
    const request = prompt.trim().replace(/^(?:please\s+|(?:can|could|would)\s+you\s+(?:please\s+)?)/i, "");
    return Object.values(ENGINEERING_REQUESTS).some((pattern) => pattern.test(request));
}
