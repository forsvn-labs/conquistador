import { DEFAULT_SKILLS_ROOT } from "../src/skill-assets.ts";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ModelProvider } from "../src/providers.ts";
import type { ProviderGenerateRequest } from "../src/contracts.ts";
import { loadRuntimeCorpus } from "../src/corpus.ts";
import { InMemoryRuntime, RuntimeFailure } from "../src/runtime.ts";

const corpus = loadRuntimeCorpus(DEFAULT_SKILLS_ROOT);
const principalId = "local-operator";

function gatedProvider(): {
  provider: ModelProvider;
  release: () => void;
  started: () => number;
} {
  let release = () => {};
  const gate = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });
  let started = 0;
  const provider: ModelProvider = {
    id: "openai.responses.direct",
    async generate(request: ProviderGenerateRequest) {
      started += 1;
      await new Promise<void>((resolvePromise, reject) => {
        const fail = () =>
          reject(Object.assign(new Error("cancelled"), { code: "cancelled" }));
        if (request.signal?.aborted) {
          fail();
          return;
        }
        const onAbort = () => fail();
        request.signal?.addEventListener("abort", onAbort, { once: true });
        void gate.then(() => {
          request.signal?.removeEventListener("abort", onAbort);
          if (request.signal?.aborted) {
            fail();
            return;
          }
          resolvePromise();
        });
      });
      return {
        provider: "openai",
        providerCellId: "openai.responses.direct",
        text: "queued work",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };
  return { provider, release: () => release(), started: () => started };
}

describe("session concurrency and ceilings", () => {
  it("rejects a second active session and extra queued messages", async () => {
    const gated = gatedProvider();
    const runtime = new InMemoryRuntime({
      provider: gated.provider,
      corpus,
      maximumSessions: 1,
      maximumQueuedMessages: 1,
    });
    const first = runtime.createSession({ principalId });
    expect(() => runtime.createSession({ principalId })).toThrow(RuntimeFailure);
    expect(() => runtime.createSession({ principalId })).toThrow(/active session ceiling/);

    const firstTurn = runtime.sendMessage(first.id, {
      id: "message-1",
      content: "Create launch copy",
      principalId,
    });
    for (let i = 0; i < 50 && gated.started() === 0; i += 1) {
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
    }
    expect(gated.started()).toBe(1);

    const queued = runtime.sendMessage(first.id, {
      id: "message-2",
      content: "Create paid campaign copy",
      principalId,
    });
    expect(() =>
      runtime.sendMessage(first.id, {
        id: "message-3",
        content: "Write outreach",
        principalId,
      }),
    ).toThrow(/session queue ceiling/);

    gated.release();
    await expect(firstTurn).resolves.toMatchObject({ kind: "review-packet" });
    await expect(queued).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringMatching(/final review decision/),
    });
    expect(runtime.getSession(first.id, principalId).state).toBe("awaiting-review");
  });

  it("runs the next queued message after cancel, in arrival order", async () => {
    const firstGate = new Promise<void>(() => {
      /* held open until cancel aborts the first turn */
    });
    let started: string[] = [];
    const provider: ModelProvider = {
      id: "openai.responses.direct",
      async generate(request: ProviderGenerateRequest) {
        started.push(request.prompt);
        if (started.length === 1) {
          await new Promise<void>((resolvePromise, reject) => {
            const fail = () =>
              reject(Object.assign(new Error("cancelled"), { code: "cancelled" }));
            if (request.signal?.aborted) {
              fail();
              return;
            }
            request.signal?.addEventListener("abort", fail, { once: true });
            void firstGate.then(() => {
              if (request.signal?.aborted) {
                fail();
                return;
              }
              resolvePromise();
            });
          });
        }
        return {
          provider: "openai",
          providerCellId: "openai.responses.direct",
          text: "later work",
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const runtime = new InMemoryRuntime({
      provider,
      corpus,
      maximumQueuedMessages: 4,
    });
    const session = runtime.createSession({ principalId });
    const firstTurn = runtime.sendMessage(session.id, {
      id: "message-1",
      content: "Create launch copy",
      principalId,
    });
    for (let i = 0; i < 50 && started.length === 0; i += 1) {
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
    }
    expect(started).toEqual(["Create launch copy"]);
    const secondTurn = runtime.sendMessage(session.id, {
      id: "message-2",
      content: "Create paid campaign copy",
      principalId,
    });
    runtime.cancel(session.id, principalId);
    await expect(firstTurn).rejects.toMatchObject({ code: "cancelled" });
    const packet = await secondTurn;
    expect(packet.kind).toBe("review-packet");
    expect(started).toEqual([
      "Create launch copy",
      "Create paid campaign copy",
    ]);
    expect(runtime.getSession(session.id, principalId).state).toBe("awaiting-review");
  });
});
