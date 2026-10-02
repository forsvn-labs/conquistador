export const PARENT_JOBS = [
    "launch-or-grow",
    "create-or-improve",
    "learn-from-results",
];
export const ENGINEERING_OUTCOMES = [
    "architect",
    "ui",
    "build",
    "flow",
    "docs",
];
export const ENGINEERING_WORKFLOWS = ["spec"];
const ENGINEERING_OUTCOME_SET = new Set(ENGINEERING_OUTCOMES);
const ENGINEERING_WORKFLOW_SET = new Set(ENGINEERING_WORKFLOWS);
export function isEngineeringOutcome(id) {
    return ENGINEERING_OUTCOME_SET.has(id);
}
export function isEngineeringWorkflow(id) {
    return ENGINEERING_WORKFLOW_SET.has(id);
}
// Explicit engineering requests must not become marketing routes when installed
// method prose changes the lexical ranking. These patterns describe requests,
// rather than incidental mentions of software in a marketing brief.
const ENGINEERING_REQUESTS = {
    "architect": /^architect\s+(?:(?:the|a|an)\s+)?(?:software\s+)?system\b/i,
    "ui": /^(?:specify|brief|design)\s+(?:(?:the|a|an)\s+)?(?:product\s+)?(?:ui|user interface)\b/i,
    "build": /^build\s+(?:(?:the|a|an)\s+)?(?:ios|web)\s+app\b/i,
    "flow": /^map\s+(?:(?:the|a|an)\s+)?(?:onboarding\s+)?user\s+flow\b/i,
    "docs": /^write\s+(?:(?:the|a|an)\s+)?technical\s+(?:documentation|docs)\b/i,
};
export function requestedEngineeringOutcome(prompt) {
    // A bare command name ("build", "docs") names the outcome only after an explicit /conquistador.
    const explicit = /^\/conquistador\b/i.test(prompt.trim());
    const request = prompt.trim().replace(/^\/conquistador\b\s*:?\s*/i, "").replace(/^(?:please\s+|(?:can|could|would)\s+you\s+(?:please\s+)?)/i, "");
    return ENGINEERING_OUTCOMES.find((id) => (explicit && new RegExp(`^${id}(?=$|[\\s:,.!?])`, "i").test(request)) || ENGINEERING_REQUESTS[id].test(request));
}
// Kept for source consumers of the original inventory API. These names describe
// historical inventory membership, not a restriction on parent routing.
/** @deprecated Use ENGINEERING_OUTCOMES. */
export const DIRECT_ONLY_ENGINEERING_OUTCOMES = ENGINEERING_OUTCOMES;
/** @deprecated Use ENGINEERING_WORKFLOWS. */
export const DIRECT_ONLY_ENGINEERING_WORKFLOWS = ENGINEERING_WORKFLOWS;
/** @deprecated Use isEngineeringOutcome. */
export const isDirectOnlyEngineeringOutcome = isEngineeringOutcome;
/** @deprecated Use isEngineeringWorkflow. */
export const isDirectOnlyEngineeringWorkflow = isEngineeringWorkflow;
/** @deprecated Use requestedEngineeringOutcome. */
export function hasDirectOnlyEngineeringIntent(prompt) {
    return requestedEngineeringOutcome(prompt) !== undefined;
}
