export declare const PARENT_JOBS: readonly ["launch-or-grow", "create-or-improve", "learn-from-results"];
export type ParentJob = (typeof PARENT_JOBS)[number];
export declare const ENGINEERING_OUTCOMES: readonly ["architect", "ui", "build", "flow", "docs"];
export type EngineeringOutcome = (typeof ENGINEERING_OUTCOMES)[number];
export declare const ENGINEERING_WORKFLOWS: readonly ["spec"];
export type EngineeringWorkflow = (typeof ENGINEERING_WORKFLOWS)[number];
export declare function isEngineeringOutcome(id: string): boolean;
export declare function isEngineeringWorkflow(id: string): boolean;
export declare function requestedEngineeringOutcome(prompt: string): EngineeringOutcome | undefined;
/** @deprecated Use ENGINEERING_OUTCOMES. */
export declare const DIRECT_ONLY_ENGINEERING_OUTCOMES: readonly ["architect", "ui", "build", "flow", "docs"];
/** @deprecated Use EngineeringOutcome. */
export type DirectOnlyEngineeringOutcome = EngineeringOutcome;
/** @deprecated Use ENGINEERING_WORKFLOWS. */
export declare const DIRECT_ONLY_ENGINEERING_WORKFLOWS: readonly ["spec"];
/** @deprecated Use EngineeringWorkflow. */
export type DirectOnlyEngineeringWorkflow = EngineeringWorkflow;
/** @deprecated Use isEngineeringOutcome. */
export declare const isDirectOnlyEngineeringOutcome: typeof isEngineeringOutcome;
/** @deprecated Use isEngineeringWorkflow. */
export declare const isDirectOnlyEngineeringWorkflow: typeof isEngineeringWorkflow;
/** @deprecated Use requestedEngineeringOutcome. */
export declare function hasDirectOnlyEngineeringIntent(prompt: string): boolean;
