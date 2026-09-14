export declare const PARENT_JOBS: readonly ["launch-or-grow", "create-or-improve", "learn-from-results"];
export type ParentJob = (typeof PARENT_JOBS)[number];
export declare const DIRECT_ONLY_ENGINEERING_OUTCOMES: readonly ["architect-software-system", "brief-product-ui", "build-ios-app", "build-web-app", "map-user-flow", "write-technical-docs"];
export type DirectOnlyEngineeringOutcome = (typeof DIRECT_ONLY_ENGINEERING_OUTCOMES)[number];
export declare const DIRECT_ONLY_ENGINEERING_WORKFLOWS: readonly ["specify-product-experience"];
export type DirectOnlyEngineeringWorkflow = (typeof DIRECT_ONLY_ENGINEERING_WORKFLOWS)[number];
export declare function isDirectOnlyEngineeringOutcome(id: string): boolean;
export declare function isDirectOnlyEngineeringWorkflow(id: string): boolean;
export declare function hasDirectOnlyEngineeringIntent(prompt: string): boolean;
