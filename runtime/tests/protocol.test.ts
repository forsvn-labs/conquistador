import { DEFAULT_SKILLS_ROOT } from "../src/skill-assets.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";

import { loadCorpusDescriptor, loadRuntimeCorpus } from "../src/corpus.ts";
import { InMemoryRuntime } from "../src/runtime.ts";
import type { ModelProvider } from "../src/providers.ts";
import {
  TEST_TRANSPORT,
  testHostAuthenticationVerifier,
  testHumanAuthenticator,
} from "./auth-fixture.ts";

const skillsRoot = DEFAULT_SKILLS_ROOT;

function provider(generate?: ModelProvider["generate"]): ModelProvider {
  return {
    id: "openai.responses.direct",
    generate: generate ?? (async () => ({
      provider: "openai",
      providerCellId: "openai.responses.direct",
      providerRequestId: "provider-1",
      text: "Finished channel-native work",
      usage: { inputTokens: 10, outputTokens: 20 },
    })),
  };
}

describe("Conquistador-owned protocol and authored corpus", () => {
  it("rejects reserved and credential-shaped principals directly", () => {
    const runtime = new InMemoryRuntime({
      provider: provider(),
      corpus: loadRuntimeCorpus(skillsRoot),
    });
    for (const principalId of [
      "latest",
      "default",
      "sk-abcdefghijklmnop",
    ]) {
      expect(() => runtime.createSession({ principalId }), principalId).toThrow(
        /canonical principal/,
      );
    }
  });

  it("uses the same default agent, capability roots, and three compatible parent jobs as the plugin", () => {
    const corpus = loadCorpusDescriptor(skillsRoot);
    expect(corpus.defaultAgent).toBe("conquistador");
    expect(corpus.jobs).toEqual([
      "launch-or-grow",
      "create-or-improve",
      "learn-from-results",
    ]);
    expect(corpus.skillIds).toContain("conquistador");
    expect(corpus.skillIds).toContain("position");
    expect(corpus.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const runtimeCorpus = loadRuntimeCorpus(skillsRoot);
    expect(runtimeCorpus.descriptor).toEqual(corpus);
    const selection = runtimeCorpus.resolve("Launch this on Product Hunt with finished social copy");
    expect(selection.fileIds).toEqual(expect.arrayContaining([
      "conquistador/SKILL.md",
      "conquistador/standards/quality.md",
      "conquistador/standards/safety.md",
      "conquistador/plays/launch.md",
      "conquistador/channels/product-hunt.md",
    ]));
    expect(selection.systemInstructions).toContain(readFileSync(resolve(skillsRoot, "conquistador/SKILL.md"), "utf8"));
    expect(selection.fileIds.filter((fileId) => fileId === "conquistador/SKILL.md" || fileId.endsWith("/COMMAND.md")).length)
      .toBeLessThan(runtimeCorpus.descriptor.skillIds.length);

    for (const [prompt, outcome] of [
      ["Map the onboarding user flow", "flow"],
      ["Specify the product UI", "ui"],
      ["Architect the software system", "architect"],
      ["Build an iOS app", "build"],
      ["Build a web app", "build"],
      ["Write the technical documentation", "docs"],
    ]) {
      const engineering = runtimeCorpus.resolve(prompt);
      expect(engineering.job, prompt).toBe("create-or-improve");
      expect(engineering.fileIds, prompt).not.toContain("conquistador/plays/spec.md");
      expect(engineering.fileIds.filter((fileId) => fileId === "conquistador/SKILL.md" || fileId.endsWith("/COMMAND.md")), prompt)
        .toEqual([`conquistador/commands/${outcome}/COMMAND.md`, "conquistador/SKILL.md"]);
    }
  });

  it("emits ordered stable events, one final Review Packet, and a digest-bound terminal result", async () => {
    const runtime = new InMemoryRuntime({
      provider: provider(),
      corpus: loadRuntimeCorpus(skillsRoot),
      verifyAuthentication: testHostAuthenticationVerifier,
    });
    const session = runtime.createSession({ principalId: "operator-1" });
    const review = await runtime.sendMessage(session.id, {
      id: "message-1",
      content: "Launch this product",
      principalId: "operator-1",
    });
    expect(review.schemaVersion).toBe("conquistador.review-contract/v1");
    expect(review.kind).toBe("review-packet");
    expect(review.work.summary).toContain("Finished");
    const events = runtime.events(session.id, 0, "operator-1");
    expect(events.map((event) => event.type)).toEqual([
      "input.accepted",
      "progress",
      "evidence",
      "review.packet",
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(events)).not.toMatch(/skillIds|workflow|specialist|chain.of.thought/i);
    expect(events.at(-1)?.payload).toMatchObject({
      presentationEvent: {
        schemaVersion: "conquistador.review-event/v1",
        eventType: "packet.presented",
        authority: {
          accept: false,
          rewrite: false,
          delete: false,
          authorizeAction: false,
          approveRelease: false,
        },
      },
    });

    const terminal = await runtime.decideReview(session.id, review.packetId, {
      transport: TEST_TRANSPORT,
      authenticateHuman: testHumanAuthenticator,
      outcome: "accept",
      packetDigest: review.digest,
    });
    expect(terminal).toMatchObject({
      schemaVersion: "conquistador.review-contract/v1",
      kind: "review-verdict",
      outcome: "accept",
      packetId: review.packetId,
    });
    const schema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/protocol.schema.json"), "utf8"));
    const reviewSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/review-contract.schema.json"), "utf8"));
    const credentialSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/credential-detector.schema.json"), "utf8"));
    const ajv = new Ajv2020({ strict: false, formats: { "date-time": true, uri: true } });
    ajv.addSchema(credentialSchema);
    ajv.addSchema(reviewSchema);
    const validate = ajv.compile(schema);
    for (const value of [session, ...events, review, { outcome: "accept", packetDigest: review.digest }, terminal]) {
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    }
    await expect(runtime.decideReview(session.id, review.packetId, {
      transport: TEST_TRANSPORT,
      authenticateHuman: testHumanAuthenticator,
      outcome: "accept",
      packetDigest: review.digest,
    })).rejects.toThrow(/already decided/);
  });

  it("keeps one active turn, preserves FIFO, and cancels without a forged review", async () => {
    const calls: string[] = [];
    const controlled = provider(async ({ prompt, signal }) => {
      calls.push(prompt);
      if (prompt === "first") {
        await new Promise<void>((resolvePromise, reject) => {
          signal?.addEventListener("abort", () => reject(Object.assign(new Error("cancelled"), { code: "cancelled" })), { once: true });
        });
      }
      return {
        provider: "openai",
        providerCellId: "openai.responses.direct",
        text: prompt,
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    });
    const runtime = new InMemoryRuntime({ provider: controlled, corpus: loadRuntimeCorpus(skillsRoot) });
    const session = runtime.createSession({ principalId: "operator-1" });
    const first = runtime.sendMessage(session.id, { id: "m1", content: "first", principalId: "operator-1" });
    const second = runtime.sendMessage(session.id, { id: "m2", content: "second", principalId: "operator-1" });
    while (calls.length === 0) {
      await new Promise((resolveTick) => setTimeout(resolveTick, 1));
    }
    expect(calls).toEqual(["first"]);
    runtime.cancel(session.id, "operator-1");
    await expect(first).rejects.toMatchObject({ code: "cancelled" });
    await expect(second).resolves.toMatchObject({ schemaVersion: "conquistador.review-contract/v1" });
    expect(calls).toEqual(["first", "second"]);
    expect(runtime.events(session.id, 0, "operator-1").some((event) => event.type === "failure")).toBe(true);
  });

  it("pauses queued work at review and keeps a terminal session immutable", async () => {
    const calls: string[] = [];
    const runtime = new InMemoryRuntime({
      provider: provider(async ({ prompt }) => {
        calls.push(prompt);
        return {
          provider: "openai",
          providerCellId: "openai.responses.direct",
          text: prompt,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      }),
      corpus: loadRuntimeCorpus(skillsRoot),
      verifyAuthentication: testHostAuthenticationVerifier,
    });
    const session = runtime.createSession({ principalId: "operator-1" });
    const first = runtime.sendMessage(session.id, { id: "m1", content: "first", principalId: "operator-1" });
    const queued = runtime.sendMessage(session.id, { id: "m2", content: "second", principalId: "operator-1" });
    expect(() => runtime.sendMessage(session.id, { id: "m2", content: "duplicate", principalId: "operator-1" })).toThrow(/already used/);
    const review = await first;
    expect(calls).toEqual(["first"]);
    await runtime.decideReview(session.id, review.packetId, {
      transport: TEST_TRANSPORT,
      authenticateHuman: testHumanAuthenticator,
      outcome: "accept",
      packetDigest: review.digest,
    });
    await expect(queued).rejects.toMatchObject({ code: "conflict" });
    expect(() => runtime.sendMessage(session.id, {
      id: "m3",
      content: "after terminal",
      principalId: "operator-1",
    })).toThrow(/terminal/);
    expect(calls).toEqual(["first"]);
  });

  it("binds each turn to the exact authored corpus and configured token ceiling", async () => {
    const corpus = loadRuntimeCorpus(skillsRoot);
    let observed: { system?: string; maxOutputTokens: number } | undefined;
    const runtime = new InMemoryRuntime({
      provider: provider(async (request) => {
        observed = { system: request.system, maxOutputTokens: request.maxOutputTokens };
        return {
          provider: "openai",
          providerCellId: "openai.responses.direct",
          text: "done",
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      }),
      corpus,
      maximumTokensPerRun: 321,
    });
    const session = runtime.createSession({ principalId: "operator-1" });
    await runtime.sendMessage(session.id, { id: "m1", content: "work", principalId: "operator-1" });
    expect(observed?.maxOutputTokens).toBe(321);
    expect(observed?.system).toContain(corpus.descriptor.digest);
    expect(observed?.system).toContain(corpus.resolve("work").systemInstructions);
  });
});
