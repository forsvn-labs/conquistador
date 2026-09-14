import { describe, expect, it, vi } from "vitest";

import { createProvider, providerCells, type ProviderTransport } from "../src/providers.ts";
import type { ModelConfig } from "../src/contracts.ts";

const deadlineAt = "2026-08-11T01:00:00.000Z";
const now = () => new Date("2026-08-11T00:00:00.000Z");

describe("exact provider core", () => {
  it("keeps all v1 cells fixture-only until candidate-bound live proof", () => {
    expect(providerCells.map((cell) => cell.id)).toEqual([
      "anthropic.messages.direct",
      "openai.responses.direct",
      "vercel-ai-gateway.responses",
    ]);
    expect(providerCells.every((cell) => cell.state === "fixture-verified")).toBe(true);
    expect(providerCells.every((cell) => cell.credentialEnv && cell.officialSources.length > 0)).toBe(true);
  });

  it("maps direct OpenAI without exposing the host credential", async () => {
    const transport = vi.fn<ProviderTransport>(async (request) => {
      expect(request.url).toBe("https://api.openai.com/v1/responses");
      expect(request.headers.authorization).toBe("Bearer opaque-openai-key");
      expect(request.body).toMatchObject({ model: "gpt-test", input: "hello", store: false });
      return { status: 200, json: { id: "resp-1", output_text: "finished" } };
    });
    const provider = createProvider(
      { provider: "openai", model: "gpt-test", credentialEnv: "OPENAI_API_KEY" },
      { env: { OPENAI_API_KEY: "opaque-openai-key" }, transport, now },
    );
    const result = await provider.generate({ prompt: "hello", maxOutputTokens: 200, deadlineAt });
    expect(result).toMatchObject({ provider: "openai", text: "finished", providerRequestId: "resp-1" });
    expect(JSON.stringify(result)).not.toContain("opaque-openai-key");
  });

  it("maps direct Anthropic and optional Vercel AI Gateway through distinct exact cells", async () => {
    const anthropicTransport = vi.fn<ProviderTransport>(async (request) => {
      expect(request.url).toBe("https://api.anthropic.com/v1/messages");
      expect(request.headers["x-api-key"]).toBe("opaque-anthropic-key");
      expect(request.headers["anthropic-version"]).toBe("2023-06-01");
      return { status: 200, json: { id: "msg-1", content: [{ type: "text", text: "anthropic result" }] } };
    });
    const anthropic = createProvider(
      { provider: "anthropic", model: "claude-test", credentialEnv: "ANTHROPIC_API_KEY" },
      { env: { ANTHROPIC_API_KEY: "opaque-anthropic-key" }, transport: anthropicTransport, now },
    );
    expect((await anthropic.generate({ prompt: "hello", maxOutputTokens: 200, deadlineAt })).text).toBe("anthropic result");

    const gatewayTransport = vi.fn<ProviderTransport>(async (request) => {
      expect(request.url).toBe("https://ai-gateway.vercel.sh/v1/responses");
      expect(request.headers.authorization).toBe("Bearer opaque-gateway-key");
      return { status: 200, json: { id: "gateway-1", output_text: "gateway result" } };
    });
    const gateway = createProvider(
      { provider: "vercel-ai-gateway", model: "openai/gpt-test", credentialEnv: "AI_GATEWAY_API_KEY" },
      { env: { AI_GATEWAY_API_KEY: "opaque-gateway-key" }, transport: gatewayTransport, now },
    );
    expect((await gateway.generate({ prompt: "hello", maxOutputTokens: 200, deadlineAt })).text).toBe("gateway result");
  });

  it("retries bounded transient failures and redacts terminal provider errors", async () => {
    const transport = vi.fn<ProviderTransport>()
      .mockResolvedValueOnce({ status: 429, json: { error: { message: "retry opaque-openai-key" } } })
      .mockResolvedValueOnce({ status: 200, json: { id: "resp-2", output_text: "recovered" } });
    const sleep = vi.fn(async () => undefined);
    const provider = createProvider(
      { provider: "openai", model: "gpt-test", credentialEnv: "OPENAI_API_KEY" },
      { env: { OPENAI_API_KEY: "opaque-openai-key" }, transport, sleep, now },
    );
    expect((await provider.generate({ prompt: "hello", maxOutputTokens: 200, deadlineAt })).text).toBe("recovered");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();

    const failing = createProvider(
      { provider: "openai", model: "gpt-test", credentialEnv: "OPENAI_API_KEY" },
      { env: { OPENAI_API_KEY: "opaque-openai-key" }, transport: async () => ({ status: 400, json: { error: "opaque-openai-key" } }), now },
    );
    await expect(failing.generate({ prompt: "hello", maxOutputTokens: 200, deadlineAt })).rejects.toMatchObject({ code: "provider-failure" });
    await expect(failing.generate({ prompt: "hello", maxOutputTokens: 200, deadlineAt })).rejects.not.toThrow(/opaque-openai-key/);
  });

  it("fails closed for missing credentials, unsupported cells, expiry, and cancellation", async () => {
    expect(() => createProvider(
      { provider: "openai", model: "gpt-test", credentialEnv: "OPENAI_API_KEY" },
      { env: {}, transport: async () => ({ status: 200, json: {} }), now },
    )).toThrow(/credential/i);
    expect(() => createProvider(
      { provider: "unsupported", model: "x", credentialEnv: "X_KEY" } as unknown as ModelConfig,
      { env: { X_KEY: "x" }, transport: async () => ({ status: 200, json: {} }), now },
    )).toThrow(/unsupported provider/);

    const transport = vi.fn<ProviderTransport>(async () => ({ status: 200, json: { output_text: "no" } }));
    const provider = createProvider(
      { provider: "openai", model: "gpt-test", credentialEnv: "OPENAI_API_KEY" },
      { env: { OPENAI_API_KEY: "opaque" }, transport, now },
    );
    await expect(provider.generate({ prompt: "x", maxOutputTokens: 1, deadlineAt: "2026-08-10T00:00:00.000Z" })).rejects.toMatchObject({ code: "deadline-exceeded" });
    const controller = new AbortController();
    controller.abort();
    await expect(provider.generate({ prompt: "x", maxOutputTokens: 1, deadlineAt, signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("aborts an in-flight transport at the request deadline", async () => {
    vi.useFakeTimers();
    try {
      const start = new Date("2026-08-11T00:00:00.000Z");
      vi.setSystemTime(start);
      const transport = vi.fn<ProviderTransport>((request) => new Promise((_resolve, reject) => {
        request.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      }));
      const provider = createProvider(
        { provider: "openai", model: "gpt-test", credentialEnv: "OPENAI_API_KEY" },
        { env: { OPENAI_API_KEY: "opaque" }, transport },
      );
      const generation = provider.generate({
        prompt: "x",
        maxOutputTokens: 1,
        deadlineAt: new Date(start.getTime() + 10).toISOString(),
      });
      const deadlineRejection = expect(generation).rejects.toMatchObject({ code: "deadline-exceeded" });
      await vi.advanceTimersByTimeAsync(10);
      await deadlineRejection;
      expect(transport).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
