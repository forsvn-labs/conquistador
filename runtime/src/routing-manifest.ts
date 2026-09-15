export const PARENT_JOBS = [
  "launch-or-grow",
  "create-or-improve",
  "learn-from-results",
] as const;

export type ParentJob = (typeof PARENT_JOBS)[number];

export const ENGINEERING_OUTCOMES = [
  "architect-software-system",
  "brief-product-ui",
  "build-ios-app",
  "build-web-app",
  "map-user-flow",
  "write-technical-docs",
] as const;

export type EngineeringOutcome = (typeof ENGINEERING_OUTCOMES)[number];

export const ENGINEERING_WORKFLOWS = ["specify-product-experience"] as const;

export type EngineeringWorkflow = (typeof ENGINEERING_WORKFLOWS)[number];

const ENGINEERING_OUTCOME_SET = new Set<string>(ENGINEERING_OUTCOMES);
const ENGINEERING_WORKFLOW_SET = new Set<string>(ENGINEERING_WORKFLOWS);

export function isEngineeringOutcome(id: string): boolean {
  return ENGINEERING_OUTCOME_SET.has(id);
}

export function isEngineeringWorkflow(id: string): boolean {
  return ENGINEERING_WORKFLOW_SET.has(id);
}

// Explicit engineering requests must not become marketing routes when installed
// method prose changes the lexical ranking. These patterns describe requests,
// rather than incidental mentions of software in a marketing brief.
const ENGINEERING_REQUESTS: Record<EngineeringOutcome, RegExp> = {
  "architect-software-system": /^architect\s+(?:(?:the|a|an)\s+)?(?:software\s+)?system\b/i,
  "brief-product-ui": /^(?:specify|brief|design)\s+(?:(?:the|a|an)\s+)?(?:product\s+)?(?:ui|user interface)\b/i,
  "build-ios-app": /^build\s+(?:(?:the|a|an)\s+)?ios\s+app\b/i,
  "build-web-app": /^build\s+(?:(?:the|a|an)\s+)?web\s+app\b/i,
  "map-user-flow": /^map\s+(?:(?:the|a|an)\s+)?(?:onboarding\s+)?user\s+flow\b/i,
  "write-technical-docs": /^write\s+(?:(?:the|a|an)\s+)?technical\s+(?:documentation|docs)\b/i,
};

export function requestedEngineeringOutcome(prompt: string): EngineeringOutcome | undefined {
  const request = prompt.trim().replace(/^\/conquistador\b\s*:?\s*/i, "").replace(/^(?:please\s+|(?:can|could|would)\s+you\s+(?:please\s+)?)/i, "");
  return ENGINEERING_OUTCOMES.find((id) => new RegExp(`^/?${id}(?=$|[\\s:,.!?])`, "i").test(request) || ENGINEERING_REQUESTS[id].test(request));
}

// Kept for source consumers of the original inventory API. These names describe
// historical inventory membership, not a restriction on parent routing.
/** @deprecated Use ENGINEERING_OUTCOMES. */
export const DIRECT_ONLY_ENGINEERING_OUTCOMES = ENGINEERING_OUTCOMES;
/** @deprecated Use EngineeringOutcome. */
export type DirectOnlyEngineeringOutcome = EngineeringOutcome;
/** @deprecated Use ENGINEERING_WORKFLOWS. */
export const DIRECT_ONLY_ENGINEERING_WORKFLOWS = ENGINEERING_WORKFLOWS;
/** @deprecated Use EngineeringWorkflow. */
export type DirectOnlyEngineeringWorkflow = EngineeringWorkflow;
/** @deprecated Use isEngineeringOutcome. */
export const isDirectOnlyEngineeringOutcome = isEngineeringOutcome;
/** @deprecated Use isEngineeringWorkflow. */
export const isDirectOnlyEngineeringWorkflow = isEngineeringWorkflow;
/** @deprecated Use requestedEngineeringOutcome. */
export function hasDirectOnlyEngineeringIntent(prompt: string): boolean {
  return requestedEngineeringOutcome(prompt) !== undefined;
}
