import {
  JUDGMENT_RESPONSE_SCHEMA,
  type JudgmentOutputEntry,
  type JudgmentProvider,
  type JudgmentRequestV1,
  type JudgmentResponseV1,
  outputContentDigestOf,
  responseDigestOf,
} from "../src/judgment.ts";

function bodyFor(request: JudgmentRequestV1, artifactId: string): string {
  const header = [
    `# Fixture ${request.skill.id}`,
    "",
    `Test-only judgment output for step ${request.identity.stepId}.`,
    "This body is ineligible for playbook or release evidence.",
    "",
  ];
  if (artifactId === "opportunity-briefs") {
    return [
      ...header,
      "## Ranked opportunities",
      "",
      "1. Evidence-backed angle with a declared falsifier.",
    ].join("\n");
  }
  if (artifactId === "review-packet") {
    return [...header, "## Specialist critique", "", "One specialist pass."].join(
      "\n",
    );
  }
  if (artifactId === "measurement-verdict") {
    return [...header, "## Measurement outcome", "", "Keep."].join("\n");
  }
  return [
    ...header,
    "## Finished artifact",
    "",
    `Channel-native draft from ${request.skill.id}.`,
  ].join("\n");
}

export function testResponseFor(
  request: JudgmentRequestV1,
  overrides: Partial<JudgmentResponseV1> = {},
): JudgmentResponseV1 {
  const outputs: JudgmentOutputEntry[] = request.outputContract.artifacts.map(
    (contract) => {
      const entry = {
        artifactId: contract.artifactId,
        schema: contract.schema,
        format: contract.format,
        body: bodyFor(request, contract.artifactId),
      };
      return { ...entry, contentDigest: outputContentDigestOf(entry) };
    },
  );
  const draft: Omit<JudgmentResponseV1, "responseDigest"> = {
    schema: JUDGMENT_RESPONSE_SCHEMA,
    responseId: `jrs-${request.requestId.slice(4)}`,
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    identity: structuredClone(request.identity),
    skill: structuredClone(request.skill),
    outcome: "succeeded",
    executor: {
      hostId: "test-host",
      adapterId: "test-fixture",
      adapterVersion: "1.0.0",
      executionId: `test-exec-${request.execution.idempotencyKey.slice(7, 23)}`,
      loadedAssetManifestDigest: request.skill.packageDigest,
    },
    model: {
      provider: "test-provider",
      providerCellId: "test-cell",
      model: "test-model",
      modelVersion: "1.0.0",
      settingsDigest: request.skill.interfaceDigest,
      promptTemplateDigest: request.skill.packageDigest,
    },
    outputs,
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 30,
    },
    cost: {
      billingMode: "host-covered",
      currency: "USD",
      reservedMicros: 0,
      actualMicros: null,
      chargedToRunMicros: 0,
    },
    tools: [],
    failure: null,
    redaction: {
      applied: true,
      policyDigest: request.redaction.policyDigest,
    },
    startedAt: request.execution.createdAt,
    finishedAt: request.execution.createdAt,
    ...(overrides as Record<string, unknown>),
  } as Omit<JudgmentResponseV1, "responseDigest">;
  const { responseDigest: _ignored, ...rest } = draft as Record<
    string,
    unknown
  >;
  void _ignored;
  const response = {
    ...rest,
    responseDigest: responseDigestOf(draft),
  } as unknown as JudgmentResponseV1;
  return response;
}

export function testFailureResponseFor(
  request: JudgmentRequestV1,
  code: NonNullable<JudgmentResponseV1["failure"]>["code"],
  outcome: "failed" | "cancelled" = "failed",
): JudgmentResponseV1 {
  return testResponseFor(request, {
    outcome,
    outputs: null,
    failure: {
      code,
      retryable: false,
      dispatchState: "accepted",
      safeMessage: `fixture ${code}`,
    } as JudgmentResponseV1["failure"],
  });
}

export function testJudgmentProvider(): JudgmentProvider {
  return {
    testOnly: true,
    async execute(request) {
      return testResponseFor(request);
    },
  };
}
