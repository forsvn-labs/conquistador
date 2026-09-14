import { type Sha256 } from "./canonical.ts";
export declare const JUDGMENT_REQUEST_SCHEMA = "conquistador.judgment-request.v1";
export declare const JUDGMENT_RESPONSE_SCHEMA = "conquistador.judgment-response.v1";
export type JudgmentPurpose = "research" | "creation" | "quality-review" | "measurement";
export type SkillRefV1 = {
    id: string;
    version: string;
    packageDigest: Sha256;
    interfaceDigest: Sha256;
};
export type ContextManifestEntry = {
    artifactId: string;
    schema: string;
    revision: number;
    contentDigest: Sha256;
};
export type OutputContractEntry = {
    artifactId: string;
    schema: string;
    format: "json" | "markdown" | "text";
    required: true;
};
export type JudgmentRequestV1 = {
    schema: typeof JUDGMENT_REQUEST_SCHEMA;
    requestId: string;
    requestDigest: Sha256;
    revision: 1;
    identity: {
        sessionId: string | null;
        runId: string;
        candidateId: string | null;
        evidenceId: string | null;
        playbookId: string;
        playbookVersion: string;
        planDigest: Sha256;
        stepId: string;
        attempt: number;
    };
    purpose: JudgmentPurpose;
    skill: SkillRefV1;
    input: {
        runInputDigest: Sha256;
        contextBundleDigest: Sha256;
        payload: unknown;
        payloadDigest: Sha256;
        contextManifest: ContextManifestEntry[];
    };
    outputContract: {
        artifacts: OutputContractEntry[];
        contractDigest: Sha256;
    };
    execution: {
        idempotencyKey: Sha256;
        createdAt: string;
        deadlineAt: string;
        maxLogicalAttempts: number;
    };
    budget: {
        maxInputTokens: number;
        maxOutputTokens: number;
        maxTotalTokens: number;
        remainingRunTokens: number;
        maximumChargeMicros: number;
        currency: "USD";
        allowedBillingModes: Array<"host-covered" | "metered">;
    };
    toolPolicy: {
        externalMutation: "deny";
        allowed: Array<{
            capabilityId: string;
            operationId: string;
        }>;
    };
    redaction: {
        applied: true;
        classification: "public" | "internal" | "confidential";
        removedPaths: string[];
        policyDigest: Sha256;
    };
};
export type JudgmentResponseV1 = {
    schema: typeof JUDGMENT_RESPONSE_SCHEMA;
    responseId: string;
    responseDigest: Sha256;
    requestId: string;
    requestDigest: Sha256;
    identity: JudgmentRequestV1["identity"];
    skill: SkillRefV1;
    outcome: "succeeded" | "failed" | "cancelled";
    executor: {
        hostId: string;
        adapterId: string;
        adapterVersion: string;
        executionId: string;
        loadedAssetManifestDigest: Sha256;
    };
    model: {
        provider: string;
        providerCellId: string;
        model: string;
        modelVersion: string;
        settingsDigest: Sha256;
        promptTemplateDigest: Sha256;
    } | null;
    outputs: Array<{
        artifactId: string;
        schema: string;
        format: "json" | "markdown" | "text";
        body: unknown;
        contentDigest: Sha256;
    }> | null;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        totalTokens: number;
    };
    cost: {
        billingMode: "host-covered" | "metered";
        currency: "USD";
        reservedMicros: number;
        actualMicros: number | null;
        chargedToRunMicros: number;
    };
    tools: Array<{
        capabilityId: string;
        operationId: string;
        receiptDigest: Sha256;
    }>;
    failure: {
        code: "skill-unavailable" | "skill-digest-mismatch" | "invalid-input" | "budget-exceeded" | "deadline-exceeded" | "provider-rejected" | "provider-failed" | "cancelled";
        retryable: boolean;
        dispatchState: "pre-dispatch" | "accepted" | "unknown";
        safeMessage: string;
    } | null;
    redaction: {
        applied: true;
        policyDigest: Sha256;
    };
    startedAt: string;
    finishedAt: string;
};
export type JudgmentProviderBinding = {
    /** Stable host-owned identity. It never contains a credential or account ID. */
    hostId: string;
    /** Exact host adapter identity, not a vendor or model selector. */
    adapterId: string;
    adapterVersion: string;
};
export type HostJudgmentCallback = (request: Readonly<JudgmentRequestV1>, options: Readonly<{
    signal: AbortSignal;
    idempotencyKey: Sha256;
    deadlineAt: string;
}>) => Promise<JudgmentResponseV1>;
/**
 * Host-owned execution seam. Conquistador owns the sealed request and validates
 * the response; the embedding host owns provider choice, credentials, billing,
 * retries beyond the declared logical attempt, and any provider SDK.
 */
export type JudgmentProvider = {
    readonly testOnly?: true;
    execute(request: Readonly<JudgmentRequestV1>, options: {
        signal: AbortSignal;
    }): Promise<JudgmentResponseV1>;
};
/** A host callback adds an optional executor-identity check to the generic seam. */
export type HostJudgmentProvider = JudgmentProvider & {
    readonly binding: Readonly<JudgmentProviderBinding>;
};
export declare function isTestOnlyProvider(provider: JudgmentProvider): boolean;
/**
 * Turns a host callback into the provider-neutral runner contract. The callback
 * gets an immutable, independently re-parsed sealed request and no credentials,
 * configuration, or authority objects. It must return a complete V1 response;
 * the runner validates that response before it can advance a step.
 */
export declare function createHostJudgmentProvider(binding: JudgmentProviderBinding, callback: HostJudgmentCallback, options?: {
    testOnly?: true;
}): HostJudgmentProvider;
export declare function isHostJudgmentProvider(provider: JudgmentProvider): provider is HostJudgmentProvider;
/**
 * Captures the optional host identity before dispatch.  Provider objects are
 * caller-owned and therefore cannot be consulted again after execute() has
 * run: a callback may mutate or replace its own structural fields.
 */
export declare function snapshotHostJudgmentBinding(provider: JudgmentProvider): Readonly<JudgmentProviderBinding> | undefined;
export declare class JudgmentValidationError extends Error {
    readonly code: "closed-fields" | "identity-mismatch" | "executor-mismatch" | "skill-mismatch" | "input-mismatch" | "output-contract-mismatch" | "digest-mismatch" | "tool-policy-violation" | "budget-exceeded" | "forbidden-field" | "lifecycle-invalid";
    constructor(code: JudgmentValidationError["code"], message: string);
}
export declare const REDACTION_POLICY_DIGEST: Sha256;
export declare function purposeOfSkill(skillId: string): JudgmentPurpose;
export declare function pinnedSkillVersion(skillId: string): string;
export type DeclaredSkillInterface = {
    purpose: JudgmentPurpose;
    inputs: Array<{
        artifactId: string;
        schema: string;
        format: "json" | "markdown" | "text";
    }>;
    outputs: Array<{
        artifactId: string;
        schema: string;
        format: "json" | "markdown" | "text";
    }>;
};
export type JudgmentOutputEntry = {
    artifactId: string;
    schema: string;
    format: "json" | "markdown" | "text";
    body: unknown;
    contentDigest: Sha256;
};
export declare function interfaceDigestOf(skillId: string, version: string, declared: DeclaredSkillInterface): Sha256;
export declare function packageDigestOf(skillId: string, version: string, interfaceDigest: Sha256): Sha256;
export declare function skillRefFor(skillId: string, declared: DeclaredSkillInterface): SkillRefV1;
export declare function outputContentDigestOf(output: {
    schema: string;
    format: string;
    body: unknown;
}): Sha256;
export declare function requestDigestOf(request: Omit<JudgmentRequestV1, "requestDigest">): Sha256;
export declare function responseDigestOf(response: Omit<JudgmentResponseV1, "responseDigest">): Sha256;
export type JudgmentRequestBuildInput = {
    sessionId: string | null;
    runId: string;
    candidateId: string | null;
    evidenceId: string | null;
    playbookId: string;
    playbookVersion: string;
    planDigest: Sha256;
    stepId: string;
    attempt: number;
    skill: SkillRefV1;
    purpose: JudgmentPurpose;
    runInputDigest: Sha256;
    contextBundleDigest: Sha256;
    payload: unknown;
    contextManifest: ContextManifestEntry[];
    outputArtifacts: Array<{
        artifactId: string;
        schema: string;
        format: "json" | "markdown" | "text";
    }>;
    maxStepTokens: number;
    remainingRunTokens: number;
    maximumChargeMicros: number;
    createdAt: string;
    timeoutSeconds: number;
    maxLogicalAttempts: number;
};
export declare function buildJudgmentRequest(input: JudgmentRequestBuildInput): JudgmentRequestV1;
export declare function parseSealedRequest(raw: unknown): JudgmentRequestV1;
export declare function parseJudgmentResponse(raw: unknown): JudgmentResponseV1;
export declare function validateJudgmentResponse(request: JudgmentRequestV1, raw: unknown): JudgmentResponseV1;
/** Validates a response and binds it to the injected host callback identity. */
export declare function validateProviderJudgmentResponse(binding: Readonly<JudgmentProviderBinding>, request: JudgmentRequestV1, raw: unknown): JudgmentResponseV1;
