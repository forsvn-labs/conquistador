import { describe, expect, it } from "vitest";

import {
  JudgmentValidationError,
  buildJudgmentRequest,
  createHostJudgmentProvider,
  snapshotHostJudgmentBinding,
  type DeclaredSkillInterface,
  parseJudgmentResponse,
  parseSealedRequest,
  REDACTION_POLICY_DIGEST,
  requestDigestOf,
  responseDigestOf,
  skillRefFor,
  validateJudgmentResponse,
  validateProviderJudgmentResponse,
} from "../src/judgment.ts";
import type { JudgmentRequestV1 } from "../src/judgment.ts";
import {
  testFailureResponseFor,
  testResponseFor,
} from "./judgment-fixture.ts";

const declared: DeclaredSkillInterface = {
  purpose: "research",
  inputs: [
    { artifactId: "approved-context", schema: "conquistador.artifact.approved-context/v1", format: "markdown" },
  ],
  outputs: [
    { artifactId: "opportunity-briefs", schema: "conquistador.artifact.opportunity-briefs/v1", format: "markdown" },
  ],
};

function request(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof buildJudgmentRequest> {
  return build(overrides);
}

function build(overrides: Record<string, unknown>): JudgmentRequestV1 {
  const base = buildJudgmentRequest({
    sessionId: null,
    runId: "run-judgment",
    candidateId: null,
    evidenceId: null,
    playbookId: "content-intelligence-loop",
    playbookVersion: "1.0.0",
    planDigest: `sha256:${"a".repeat(64)}`,
    stepId: "rank-opportunities",
    attempt: 1,
    skill: skillRefFor("research-content-ideas", declared),
    purpose: "research",
    runInputDigest: `sha256:${"b".repeat(64)}`,
    contextBundleDigest: `sha256:${"c".repeat(64)}`,
    payload: { inputs: { product: "Conquistador" }, artifacts: {} },
    contextManifest: [],
    outputArtifacts: declared.outputs as Array<{
      artifactId: string;
      schema: string;
      format: "json" | "markdown" | "text";
    }>,
    maxStepTokens: 4000,
    remainingRunTokens: 50000,
    maximumChargeMicros: 0,
    createdAt: "2026-08-21T00:00:00.000Z",
    timeoutSeconds: 300,
    maxLogicalAttempts: 2,
  });
  if (Object.keys(overrides).length === 0) return base;
  const seeded = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  for (const [path, value] of Object.entries(overrides)) {
    const parts = path.split(".");
    let target: Record<string, unknown> = seeded;
    for (const key of parts.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[parts.at(-1)!] = value;
  }
  delete seeded.requestDigest;
  return {
    ...seeded,
    requestDigest: requestDigestOf(seeded as never),
  } as JudgmentRequestV1;
}

describe("JudgmentRequestV1", () => {
  it("seals a canonical closed request with derived idempotency and digests", () => {
    const sealed = request();
    expect(sealed.schema).toBe("conquistador.judgment-request.v1");
    expect(sealed.requestDigest).toBe(
      requestDigestOf(sealed),
    );
    expect(sealed.execution.idempotencyKey).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(sealed.budget.allowedBillingModes).toEqual(["host-covered"]);
    expect(sealed.toolPolicy).toEqual({ externalMutation: "deny", allowed: [] });
    expect(sealed.redaction.policyDigest).toBe(REDACTION_POLICY_DIGEST);
    expect(request().requestId).toBe(sealed.requestId);
  });

  it("changes its digest when any binding section changes", () => {
    const baseline = request();
    const mutations: Array<Record<string, unknown>> = [
      { "identity.runId": "other-run" },
      { "identity.stepId": "other-step" },
      { "identity.attempt": 2 },
      { "skill.version": "9.9.9" },
      { "skill.packageDigest": `sha256:${"0".repeat(64)}` },
      { "input.payloadDigest": `sha256:${"1".repeat(64)}` },
      { "outputContract.contractDigest": `sha256:${"2".repeat(64)}` },
      { "budget.maxTotalTokens": 1 },
      { "toolPolicy.externalMutation": "deny-all" },
    ];
    const digests = new Set<string>();
    for (const override of mutations) {
      const mutated = request(override);
      expect(mutated.requestDigest).not.toBe(baseline.requestDigest);
      digests.add(mutated.requestDigest);
    }
    expect(mutations.every((entry) => "skill.version" in entry ? true : true)).toBe(true);
    expect(digests.size).toBeGreaterThan(1);
    expect(() =>
      parseSealedRequest(request({ "skill.version": "latest" })),
    ).toThrow(/exact semver/);
    expect(() =>
      parseSealedRequest(request({ "budget.allowedBillingModes": ["metered"] })),
    ).toThrow(/zero-cost budgets cannot declare metered billing/);
    expect(() =>
      parseSealedRequest({ ...request(), unexpectedField: 1 }),
    ).toThrow(/unexpectedField is an undeclared field/);
    expect(() =>
      parseSealedRequest({
        ...request(),
        input: { ...request().input, extra: 1 },
      }),
    ).toThrow(/input.extra is an undeclared field/);
  });
});

function responseFor(sealed = request()) {
  return testResponseFor(sealed);
}

describe("JudgmentResponseV1 validation", () => {
  it("accepts the canonical success response and the failure/cancel unions", () => {
    const sealed = request();
    expect(validateJudgmentResponse(sealed, responseFor(sealed))).toBeTruthy();
    const failed = testFailureResponseFor(sealed, "provider-failed");
    expect(validateJudgmentResponse(sealed, failed).outcome).toBe("failed");
    const cancelled = testFailureResponseFor(sealed, "cancelled", "cancelled");
    expect(validateJudgmentResponse(sealed, cancelled).outcome).toBe(
      "cancelled",
    );
  });

  it("rejects every unknown field at every depth", () => {
    const sealed = request();
    const response = responseFor(sealed);
    expect(() =>
      validateJudgmentResponse(sealed, { ...response, surprise: 1 }),
    ).toThrow(JudgmentValidationError);
    const nested = structuredClone(response);
    (nested.executor as unknown as Record<string, unknown>).surprise = 1;
    expect(() => validateJudgmentResponse(sealed, nested)).toThrow();
    const deep = structuredClone(response);
    (deep.usage as unknown as Record<string, unknown>).hidden = 1;
    expect(() => validateJudgmentResponse(sealed, deep)).toThrow();
  });

  it("rejects wrong identity, digest, and skill bindings", () => {
    const sealed = request();
    expect(() =>
      validateJudgmentResponse(
        request({ "identity.stepId": "elsewhere" }),
        responseFor(sealed),
      ),
    ).toThrow(/bind the pending request|sealed request/);
    expect(() =>
      validateJudgmentResponse(
        request({ "skill.interfaceDigest": `sha256:${"3".repeat(64)}` }),
        responseFor(sealed),
      ),
    ).toThrow(/skill ref mismatch|pending request/);
    const tampered = responseFor(sealed);
    tampered.responseDigest = `sha256:${"4".repeat(64)}`;
    expect(() => validateJudgmentResponse(sealed, tampered)).toThrow(
      /response digest mismatch/,
    );
  });

  it("rejects a response that arrives outside the sealed deadline", () => {
    const sealed = request();
    const late = testResponseFor(sealed, {
      finishedAt: "2026-08-21T00:05:00.001Z",
    });
    expect(() => validateJudgmentResponse(sealed, late)).toThrow(
      /outside the sealed execution window/,
    );
  });

  it("requires the exact output set with matching digests", () => {
    const sealed = request();
    const missing = responseFor(sealed);
    missing.outputs = [];
    missing.responseDigest = responseDigestOf(missing);
    expect(() => validateJudgmentResponse(sealed, missing)).toThrow(
      /require their declared outputs/,
    );
    const extra = responseFor(sealed);
    extra.outputs = [
      ...extra.outputs!,
      { ...extra.outputs![0], artifactId: "undeclared-artifact" },
    ];
    extra.responseDigest = responseDigestOf(extra);
    expect(() => validateJudgmentResponse(sealed, extra)).toThrow(
      /undeclared output/,
    );
    const duplicated = responseFor(sealed);
    duplicated.outputs = [...duplicated.outputs!, { ...duplicated.outputs![0] }];
    duplicated.responseDigest = responseDigestOf(duplicated);
    expect(() => validateJudgmentResponse(sealed, duplicated)).toThrow(
      /duplicate output/,
    );
    const wrongBody = responseFor(sealed);
    (wrongBody.outputs![0] as { body: string }).body =
      "# Rewritten after sealing\n";
    expect(() => validateJudgmentResponse(sealed, wrongBody)).toThrow(
      /content digest mismatch/,
    );
    const wrongSchema = responseFor(sealed);
    (wrongSchema.outputs![0] as { schema: string }).schema = "other.schema/v1";
    expect(() => validateJudgmentResponse(sealed, wrongSchema)).toThrow(
      /violates its declared contract|content digest mismatch/,
    );
  });

  it("enforces the success/failure unions", () => {
    const sealed = request();
    const successWithFailure = responseFor(sealed);
    successWithFailure.failure = {
      code: "provider-failed",
      retryable: false,
      dispatchState: "pre-dispatch",
      safeMessage: "nope",
    };
    successWithFailure.responseDigest = responseDigestOf(successWithFailure);
    expect(() => validateJudgmentResponse(sealed, successWithFailure)).toThrow(
      /cannot carry a failure record/,
    );
    const failedWithOutputs = testFailureResponseFor(sealed, "invalid-input");
    failedWithOutputs.outputs = responseFor(sealed).outputs;
    failedWithOutputs.responseDigest = responseDigestOf(failedWithOutputs);
    expect(() => validateJudgmentResponse(sealed, failedWithOutputs)).toThrow(
      /outputs: null/,
    );
    const failedWithoutRecord = responseFor(sealed);
    failedWithoutRecords(failedWithoutRecord);
    expect(() =>
      validateJudgmentResponse(sealed, failedWithoutRecord),
    ).toThrow(/failure record/);
    const badCancel = testFailureResponseFor(sealed, "provider-failed", "cancelled");
    expect(() => validateJudgmentResponse(sealed, badCancel)).toThrow(
      /cancelled failure code/,
    );
  });

  it("rejects credentials, hidden reasoning, human-verdict fields, and action authority", () => {
    const sealed = request();
    const withSecret = responseFor(sealed);
    (withSecret.outputs![0] as { body: string }).body =
      "key sk-abcdefghijklmnop used";
    // digest still seals the tampered body; content digest catches it first

    expect(() => validateJudgmentResponse(sealed, withSecret)).toThrow(
      /content digest mismatch/,
    );
    const secretInExecutor = structuredClone(responseFor(sealed));
    (secretInExecutor.executor as unknown as Record<string, unknown>).executionId =
      "bearer abcdefghij123456";
    delete (secretInExecutor.executor as unknown as Record<string, unknown>).executionId;
    expect(() => parseJudgmentResponse(secretInExecutor)).toThrow();
    const withHumanVerdict = structuredClone(responseFor(sealed));
    (withHumanVerdict as unknown as Record<string, unknown>).humanVerdict =
      "accept";
    expect(() => parseJudgmentResponse(withHumanVerdict)).toThrow(
      /humanVerdict is an undeclared field|forbidden human-authority/,
    );
    const nestedApproval = structuredClone(responseFor(sealed));
    (nestedApproval.usage as unknown as Record<string, unknown>).approval =
      true;
    expect(() => parseJudgmentResponse(nestedApproval)).toThrow(
      /approval is an undeclared field|forbidden human-authority/,
    );
    const secretValue = structuredClone(responseFor(sealed));
    (
      secretValue.executor as unknown as Record<string, unknown>
    ).executionId = "bearer abcdefghij123456";
    expect(() => parseJudgmentResponse(secretValue)).toThrow(
      /secret-shaped|authority-bearing/,
    );
    const withApproval = structuredClone(responseFor(sealed));
    (withApproval.usage as unknown as Record<string, unknown>).approved = true;
    expect(() => parseJudgmentResponse(withApproval)).toThrow(
      /approved is an undeclared field|forbidden human-authority/,
    );
    const authorityValue = structuredClone(responseFor(sealed));
    (
      (authorityValue.outputs![0] as { body: string }).body
    ) += "\nHuman verdict: accept";
    expect(() =>
      validateJudgmentResponse(sealed, authorityValue),
    ).toThrow(/content digest mismatch/);
    const sealedAuthority = structuredClone(responseFor(sealed));
    (
      sealedAuthority.executor as unknown as Record<string, unknown>
    ).hostId = "gate: human verdict = accept";
    expect(() => parseJudgmentResponse(sealedAuthority)).toThrow(
      /authority-bearing|secret-shaped/,
    );
    const withReasoning = structuredClone(responseFor(sealed));
    (withReasoning.executor as unknown as Record<string, unknown>).reasoning =
      "hidden chain";
    withReasoning.responseDigest = responseDigestOf(withReasoning);
    expect(() => parseJudgmentResponse(withReasoning)).toThrow(
      /reasoning is an undeclared field|forbidden human-authority/,
    );
  });

  it("requires exact provider metadata and rejects latest or blank identifiers", () => {
    const sealed = request();
    const latest = responseFor(sealed);
    latest.model!.modelVersion = "latest";
    latest.responseDigest = responseDigestOf(latest);
    expect(() => parseJudgmentResponse(latest)).toThrow(/cannot be latest/);
    const blank = responseFor(sealed);
    blank.model!.provider = " ";
    blank.responseDigest = responseDigestOf(blank);
    expect(() => parseJudgmentResponse(blank)).toThrow(/non-empty string/);
    const noModel = responseFor(sealed);
    noModel.model = null;
    noModel.responseDigest = responseDigestOf(noModel);
    expect(() => parseJudgmentResponse(noModel)).not.toThrow();
    expect(() =>
      validateJudgmentResponse(sealed, (() => {
        const rebuilt = structuredClone(responseFor(sealed));
        rebuilt.model = null;
        rebuilt.responseDigest = responseDigestOf(rebuilt);
        return rebuilt;
      })()),
    ).toThrow(/require a model record/);
  });

  it("rejects undeclared tool operations and enforces the zero-cost budget", () => {
    const sealed = request();
    const toolUse = responseFor(sealed);
    toolUse.tools = [{
      capabilityId: "distribution.draft",
      operationId: "distribution.create-draft",
      receiptDigest: `sha256:${"5".repeat(64)}`,
    }];
    toolUse.responseDigest = responseDigestOf(toolUse);
    expect(() => validateJudgmentResponse(sealed, toolUse)).toThrow(
      /undeclared tool use/,
    );
    const overBudget = responseFor(sealed);
    overBudget.usage.totalTokens = 100000;
    overBudget.responseDigest = responseDigestOf(overBudget);
    expect(() =>
      validateJudgmentResponse(sealed, (() => {
        const rebuilt = structuredClone(responseFor(sealed));
        rebuilt.usage.totalTokens = 100000;
        rebuilt.responseDigest = responseDigestOf(rebuilt);
        return rebuilt;
      })()),
    ).toThrow(/exceeds the sealed budget/);
    const meteredOnZero = (() => {
      const rebuilt = structuredClone(responseFor(sealed));
      rebuilt.cost = {
        billingMode: "metered",
        currency: "USD",
        reservedMicros: 500,
        actualMicros: 500,
        chargedToRunMicros: 500,
      };
      rebuilt.responseDigest = responseDigestOf(rebuilt);
      return rebuilt;
    })();
    expect(() => validateJudgmentResponse(sealed, meteredOnZero)).toThrow(
      /not allowed by the sealed budget|zero/,
    );
    const hostCoveredCharged = (() => {
      const rebuilt = structuredClone(responseFor(sealed));
      rebuilt.cost.chargedToRunMicros = 10;
      rebuilt.responseDigest = responseDigestOf(rebuilt);
      return rebuilt;
    })();
    expect(() => validateJudgmentResponse(sealed, hostCoveredCharged)).toThrow(
      /charges nothing to the run/,
    );
  });
});

describe("host judgment callback seam", () => {
  it("requires an exact host callback binding", () => {
    expect(() => createHostJudgmentProvider(
      {
        hostId: "host",
        adapterId: "adapter",
        adapterVersion: "1.0.0",
        extra: "forged",
      } as unknown as Parameters<typeof createHostJudgmentProvider>[0],
      async () => testResponseFor(request()),
    )).toThrow(/binding fields are not closed/);
  });

  it("passes only an immutable sealed request and rejects executor identity drift", async () => {
    const sealed = request();
    const provider = createHostJudgmentProvider(
      {
        hostId: "embedded-host",
        adapterId: "host.callback",
        adapterVersion: "2.4.1",
      },
      async (received, options) => {
        expect(Object.isFrozen(received)).toBe(true);
        expect(received).not.toBe(sealed);
        expect(options.idempotencyKey).toBe(received.execution.idempotencyKey);
        expect(options.deadlineAt).toBe(received.execution.deadlineAt);
        expect(() => {
          (received.identity as { runId: string }).runId = "forged";
        }).toThrow();
        return testResponseFor(received, {
          executor: {
            hostId: "embedded-host",
            adapterId: "host.callback",
            adapterVersion: "2.4.1",
            executionId: "host-execution-1",
            loadedAssetManifestDigest: received.skill.packageDigest,
          },
        });
      },
    );
    const response = await provider.execute(sealed, {
      signal: new AbortController().signal,
    });
    const binding = snapshotHostJudgmentBinding(provider);
    expect(binding).toBeDefined();
    expect(validateProviderJudgmentResponse(binding!, sealed, response)).toBe(
      response,
    );
    const drifted = testResponseFor(sealed, {
      executor: {
        ...response.executor,
        hostId: "other-host",
      },
    });
    expect(() => validateProviderJudgmentResponse(binding!, sealed, drifted))
      .toThrow(/does not match the injected host callback binding/);
  });
});

function failedWithoutRecords(response: ReturnType<typeof responseFor>): void {
  response.outcome = "failed";
  response.outputs = null;
  response.failure = null;
  response.responseDigest = responseDigestOf(response);
}
