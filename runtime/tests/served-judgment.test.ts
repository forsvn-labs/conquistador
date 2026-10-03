import { describe, expect, it } from "vitest";
import { buildJudgmentRequest, skillRefFor, type DeclaredSkillInterface, validateJudgmentResponse } from "../src/judgment.ts";
import { createServedJudgmentProvider } from "../src/served-judgment.ts";
import type { ModelProvider } from "../src/providers.ts";
import type { ProviderGenerateRequest, ProviderGenerateResult } from "../src/contracts.ts";

const declared: DeclaredSkillInterface = {
  purpose: "research", inputs: [], outputs: [
    { artifactId: "brief", schema: "conquistador.artifact.brief/v1", format: "markdown" },
    { artifactId: "sources", schema: "conquistador.artifact.sources/v1", format: "json" },
  ],
};
function request(payload: unknown = { product: "Local test only" }) {
  return buildJudgmentRequest({
    sessionId: null, runId: "served-audit", candidateId: null, evidenceId: null,
    playbookId: "content-intelligence-loop", playbookVersion: "1.0.0",
    planDigest: `sha256:${"a".repeat(64)}`, stepId: "research", attempt: 1,
    skill: skillRefFor("ideas", declared), purpose: "research",
    runInputDigest: `sha256:${"b".repeat(64)}`, contextBundleDigest: `sha256:${"c".repeat(64)}`,
    payload, contextManifest: [], outputArtifacts: declared.outputs,
    maxStepTokens: 8000, remainingRunTokens: 20000, maximumChargeMicros: 0,
    createdAt: new Date().toISOString(), timeoutSeconds: 30, maxLogicalAttempts: 1,
  });
}
const model = { provider: "openai" as const, model: "test-model", credentialEnv: "TEST_KEY", billingMode: "host-covered" as const };
function generated(overrides: Partial<ProviderGenerateResult> = {}): ProviderGenerateResult {
  return { provider: "openai", providerCellId: "test-cell", providerRequestId: "test-request-1", text: JSON.stringify({ outputs: [{ artifactId: "brief", body: "# Research brief\nBounded result" }, { artifactId: "sources", body: { sources: [] } }] }), usage: { inputTokens: 2000, outputTokens: 80 }, ...overrides };
}
function provider(result = generated(), observe?: (request: ProviderGenerateRequest) => void): ModelProvider {
  return { id: "test-cell", async generate(input) { observe?.(input); return result; } };
}

describe("served adapter contract, local unit fixtures only", () => {
  it("loads actual method context and contracts, keeps outputs distinct, and records observed identity", async () => {
    let sent: ProviderGenerateRequest | undefined;
    const sealed = request();
    const adapter = createServedJudgmentProvider(provider(generated(), (input) => { sent = input; }), model);
    const response = await adapter.execute(sealed, { signal: new AbortController().signal });
    expect(sent!.system).toContain("ideas");
    expect(sent!.system).toContain("<skill-method");
    expect(Buffer.byteLength(sent!.system!)).toBeLessThan(25_000);
    expect(JSON.parse(sent!.prompt).outputContract).toHaveLength(2);
    expect(response.outputs?.[0].body).toContain("# Research brief");
    expect(response.outputs?.[1].body).toEqual({ sources: [] });
    expect(response.executor.executionId).toBe("test-request-1");
    expect(response.model!.promptTemplateDigest).not.toBe(sealed.skill.packageDigest);
    expect(Date.parse(response.finishedAt)).toBeGreaterThanOrEqual(Date.parse(response.startedAt));
    expect(response.cost.actualMicros).toBeNull();
    validateJudgmentResponse(sealed, response);
  });
  it.each([
    generated({ text: "a generic paragraph" }),
    generated({ text: JSON.stringify({ outputs: [{ artifactId: "brief", body: "a" }, { artifactId: "brief", body: "b" }] }) }),
    generated({ text: JSON.stringify({ outputs: [{ artifactId: "brief", body: "a" }, { artifactId: "sources", body: "not JSON" }] }) }),
    generated({ providerRequestId: undefined }),
    generated({ usage: { inputTokens: 0, outputTokens: 0 } }),
  ])("rejects incomplete identity, missing usage, and malformed artifact output", async (result) => {
    await expect(createServedJudgmentProvider(provider(result), model).execute(request(), { signal: new AbortController().signal })).rejects.toThrow();
  });
  it("rejects oversized complete input before any provider dispatch", async () => {
    let called = false;
    const adapter = createServedJudgmentProvider(provider(generated(), () => { called = true; }), model);
    await expect(adapter.execute(request({ privateInput: "private-sentinel".repeat(3000) }), { signal: new AbortController().signal })).rejects.toThrow(/budget/);
    expect(called).toBe(false);
  });
  it("requires an explicit billing declaration before generation", async () => {
    let called = false;
    const adapter = createServedJudgmentProvider(provider(generated(), () => { called = true; }), { ...model, billingMode: undefined });
    await expect(adapter.execute(request(), { signal: new AbortController().signal })).rejects.toThrow(/billing/);
    expect(called).toBe(false);
  });
});
