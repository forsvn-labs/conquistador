export type SkillRecord = {
    schemaVersion: "conquistador.skill-record/v1";
    id: string;
    version: string;
    kind: "outcome-skill";
    trigger: {
        description: string;
        examples: string[];
    };
    inputs: VersionedFields;
    outputs: VersionedOutputs;
    compatiblePlaybooks: string[];
    toolRequirements: {
        capabilityIds: string[];
        requiredForStandalone: false;
    };
    qualityCriteria: Array<{
        id: string;
        description: string;
    }>;
    failureBehavior: {
        onInvalidInput: "reject" | "ask-once";
        onMissingTools: "degrade-to-local" | "stop";
        onQualityFail: "revise-once" | "stop";
    };
    provenance: SkillProvenance;
    installEligibility: InstallEligibility;
};
export type InstallEligibility = {
    independentlyInstallable: true;
    requiresSiblingSkill: false;
    requiresPlaybookRunner: false;
    requiresRegistryActivation: false;
    requiresGeneratedCatalog: false;
};
export type SkillProvenance = {
    sourcePath: string;
    independentlyVersioned: true;
    recordedAt: string;
};
export type VersionedFields = {
    version: string;
    fields: ContractField[];
};
export type VersionedOutputs = VersionedFields & {
    deliverable: string;
};
export type ContractField = {
    name: string;
    type: "string" | "number" | "boolean" | "string[]" | "artifact";
    required: boolean;
    description: string;
};
export type SkillRegistry = {
    schemaVersion: "conquistador.skill-registry/v1";
    productVersion: "1.0.0";
    activationRequiredByPortablePlugin: false;
    loadsAtPluginRuntime: false;
    records: SkillRecord[];
};
export type PlaybookRecord = {
    schemaVersion: "conquistador.playbook-record/v1";
    id: string;
    canonicalId: string;
    version: string;
    kind: "executable-playbook";
    executionStatus: "fixture-not-executable" | "unimplemented" | "executable";
    notExecutableReason?: string;
    proseSource?: string;
    inputs: VersionedFields;
    completionCriteria: string[];
    stepGraph: {
        nodes: PlaybookStep[];
    };
    artifacts: ArtifactContract[];
    budgets: PlaybookBudgets;
    retry: {
        maxAttempts: number;
        preserveCompletedSteps: true;
    };
    resume: {
        enabled: true;
        preserveCompletedWork: true;
    };
    timeout: {
        seconds: number;
    };
    idempotency: {
        required: true;
        keyFrom: string[];
    };
    gates: {
        review: ReviewGate[];
        action: ActionGate[];
    };
    provenance: PlaybookProvenance;
    receipts: {
        required: true;
        redaction: "required";
        includeToolOperations: true;
    };
    evalSignals: {
        criteria: EvalCriterion[];
    };
    finalDeliverable: {
        artifactId: string;
        description: string;
        accompanyingArtifactIds: string[];
    };
    nextDecision: {
        id: string;
        description: string;
    };
    activation: PlaybookActivation;
};
export type PlaybookStep = {
    id: string;
    kind: "skill" | "script" | "tool-operation";
    uses: StepUses;
    dependsOn: string[];
    inputArtifacts: string[];
    outputArtifacts: string[];
    completion: string;
    timeoutSeconds: number;
    idempotency: "none" | "required";
    retry?: {
        maxAttempts: number;
    };
    failureBehavior: "stop" | "degrade";
    budget?: {
        maxTokens: number;
    };
};
export type StepUses = {
    skillId?: string;
    scriptId?: string;
    toolOperationId?: string;
    branch?: {
        on: string;
        cases: Array<{
            when: string;
            skillId: string;
        }>;
    };
    maturity?: "unverified";
    fallback?: "human-action-manifest";
};
export type ArtifactContract = {
    id: string;
    name: string;
    format: "markdown" | "json";
    schema: string;
    provenanceRequired: true;
};
export type PlaybookBudgets = {
    tokensPerRun: number;
    judgmentNodesMaxTokens: number;
    maximumCostPerRun: number;
};
export type ReviewGate = {
    id: string;
    kind: "review";
    afterStep: string;
    humanRequired: true;
    modelCannotSatisfy: true;
    outcomes: ["accept", "revise", "reject"];
    artifactIds: string[];
    stopOnReject: true;
};
export type ActionGate = {
    id: string;
    kind: "action";
    afterStep: string;
    afterGate: string;
    requiresReviewOutcome: "accept";
    humanRequired: true;
    modelCannotSatisfy: true;
    mutationClass: "draft" | "publish" | "spend" | "account-change";
    fallback: "human-action-manifest";
};
export type PlaybookProvenance = {
    sourcePath: string;
    recordedAt: string;
    proseCompositionKind: "compatibility-map-only";
};
export type EvalCriterion = {
    id: string;
    description: string;
    source: "artifact" | "trace" | "human-verdict" | "observed-result";
};
export type PlaybookActivation = {
    requiredByPortablePlugin: false;
    loadsAtPluginRuntime: false;
    customerManagedCatalog: false;
};
export type PlaybookRegistry = {
    schemaVersion: "conquistador.playbook-registry/v1";
    productVersion: "1.0.0";
    activationRequiredByPortablePlugin: false;
    loadsAtPluginRuntime: false;
    records: PlaybookRecord[];
};
export declare function validateSkillRecord(value: unknown): asserts value is SkillRecord;
export declare function validateSkillRegistry(value: unknown): asserts value is SkillRegistry;
export declare function validatePlaybookRecord(value: unknown): asserts value is PlaybookRecord;
export declare function validatePlaybookRegistry(value: unknown): asserts value is PlaybookRegistry;
