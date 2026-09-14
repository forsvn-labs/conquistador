import { describe, expect, it } from "vitest";

import type { PlaybookStep } from "../src/registry.ts";
import {
  degradeDeclaredStep,
  executeDeclaredStep,
  resolveSkillId,
  type StepContext,
} from "../src/steps.ts";

function ctx(step: PlaybookStep, extra: Partial<StepContext> = {}): StepContext {
  return {
    step,
    inputs: {},
    values: {},
    artifactBodies: {},
    now: new Date("2026-08-21T00:00:00.000Z"),
    runId: "run-steps",
    ...extra,
  };
}

const scriptStep: PlaybookStep = {
  id: "load-context",
  kind: "script",
  uses: { scriptId: "load-approved-context" },
  dependsOn: [],
  inputArtifacts: [],
  outputArtifacts: ["approved-context"],
  completion: "",
  timeoutSeconds: 60,
  idempotency: "required",
  failureBehavior: "stop",
};

const branchStep: PlaybookStep = {
  id: "create-artifact",
  kind: "skill",
  uses: {
    branch: {
      on: "hypothesis.nativeFormat",
      cases: [
        { when: "social", skillId: "write-social" },
        { when: "copy", skillId: "write-copy" },
      ],
    },
  },
  dependsOn: [],
  inputArtifacts: [],
  outputArtifacts: ["created-artifact"],
  completion: "",
  timeoutSeconds: 60,
  idempotency: "none",
  failureBehavior: "stop",
};

describe("deterministic declared steps", () => {
  it("runs script steps locally without any judgment provider", () => {
    const produced = executeDeclaredStep(
      ctx(scriptStep, {
        inputs: {
          product: "Conquistador",
          audience: "founders",
          channel: "linkedin",
          goals: "one post",
        },
      }),
    );
    expect(produced.artifacts["approved-context"].format).toBe("markdown");
    expect(String(produced.artifacts["approved-context"].body)).toContain(
      "# Approved context",
    );
    expect(produced.operation).toBeUndefined();
  });

  it("keeps tool-operation manifests non-executing", () => {
    const step: PlaybookStep = {
      ...scriptStep,
      id: "approved-action",
      kind: "tool-operation",
      uses: {
        toolOperationId: "distribution.create-draft",
        maturity: "unverified",
        fallback: "human-action-manifest",
      },
      outputArtifacts: ["action-receipt"],
    };
    const produced = degradeDeclaredStep(ctx(step), "unavailable");
    expect(produced.operation?.kind).toBe("human-action-manifest");
    if (produced.operation?.kind === "gateway-receipt") throw new Error("default runtime has no bridge");
    expect(produced.operation?.executed).toBe(false);
    expect(produced.operation?.liveCall).toBe(false);
  });

  it("resolves direct and branch skill identities", () => {
    expect(resolveSkillId(branchStep, ctx(branchStep, {
      values: { hypothesis: { nativeFormat: "copy" } },
    }))).toBe("write-copy");
    expect(resolveSkillId(branchStep, ctx(branchStep, {
      values: { hypothesis: { nativeFormat: "social" } },
    }))).toBe("write-social");
    expect(() =>
      resolveSkillId(
        { ...branchStep, uses: {} },
        ctx(branchStep),
      ),
    ).toThrow(/does not declare a skill/);
    expect(() =>
      resolveSkillId(branchStep, ctx(branchStep)),
    ).toThrow(/is missing for step|has no case/);
  });

  it("fails skill steps that try to bypass the judgment seam", () => {
    const direct: PlaybookStep = {
      ...branchStep,
      uses: { skillId: "write-social" },
    };
    expect(() => executeDeclaredStep(ctx(direct))).toThrow(
      /only through the durable judgment seam/,
    );
  });
});
it("observation receipt does not deny dispatch or infer business success", () => {
  const step: PlaybookStep = { ...scriptStep, id: "observe-results", kind: "tool-operation", uses: { toolOperationId: "performance.observe-window" }, outputArtifacts: ["observation-record"] };
  const produced = executeDeclaredStep(ctx(step, { artifactBodies: { "action-receipt": "attested" }, operationResult: {
    kind: "gateway-receipt", operation: { id: "performance.observe-window", provider: "test", capabilityId: "performance.observe", verificationStatus: "supported", actionClass: "observe" },
    receipt: { schemaVersion: "conquistador.operation-terminal-receipt/v1", catalogReceiptDigest: `sha256:${"a".repeat(64)}`, requestDigest: `sha256:${"b".repeat(64)}`, status: "succeeded", terminalRecord: true, usageKnown: true, accepted: true, unitsUsed: 1, costUsed: 0, data: { testOnly: true } },
  } }));
  const body = String(produced.artifacts["observation-record"].body);
  expect(body).not.toContain("Executed: no"); expect(body).not.toContain("Live call: no");
  expect(body).toContain("Business result: not inferred"); expect(body).toContain("Status: succeeded");
});
it("normalization preserves blocked receipt provenance without inventing signals", () => {
  const tool: PlaybookStep = { ...scriptStep, id: "pull-signals", kind: "tool-operation", uses: { toolOperationId: "signals.pull-bounded" }, outputArtifacts: ["signal-bundle"] };
  const operationReceipt = { schemaVersion: "conquistador.operation-terminal-receipt/v1" as const, catalogReceiptDigest: `sha256:${"a".repeat(64)}` as const, requestDigest: `sha256:${"b".repeat(64)}` as const, status: "blocked" as const, terminalRecord: true as const, usageKnown: true, accepted: false, unitsUsed: 0, costUsed: 0, data: {} };
  const pulled = executeDeclaredStep(ctx(tool, { artifactBodies: { "approved-context": "test" }, operationResult: { kind: "gateway-receipt", operation: { id: "signals.pull-bounded", provider: "test", capabilityId: "signals.bounded-pull", verificationStatus: "unverified", actionClass: "observe" }, receipt: operationReceipt } }));
  const normalized = executeDeclaredStep(ctx({ ...scriptStep, id: "normalize-signals", uses: { scriptId: "normalize-signals" } }, { artifactBodies: { "signal-bundle": pulled.artifacts["signal-bundle"].body } }));
  expect(normalized.artifacts["normalized-signals"].body).toMatchObject({ handoffPreserved: true, signals: [], operationReceipt: { status: "blocked", catalogReceiptDigest: operationReceipt.catalogReceiptDigest } });
});
