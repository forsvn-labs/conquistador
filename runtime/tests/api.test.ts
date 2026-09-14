import { DEFAULT_SKILLS_ROOT } from "../src/skill-assets.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";

import { ApiV1 } from "../src/api.ts";
import { loadRuntimeCorpus } from "../src/corpus.ts";
import { InMemoryRuntime } from "../src/runtime.ts";
import {
  TEST_TRANSPORT as authentication,
  testHostAuthenticationVerifier as verifyAuthentication,
  testHumanAuthenticator as authenticateHuman,
} from "./auth-fixture.ts";

const provider = {
  id: "openai.responses.direct",
  generate: async () => ({
    provider: "openai" as const,
    providerCellId: "openai.responses.direct",
    text: "ready work",
    usage: { inputTokens: 1, outputTokens: 1 },
  }),
};

describe("/api/v1 compatibility surface", () => {
  it("keeps health minimal and requires transport-authenticated principals for runtime routes", async () => {
    const runtime = new InMemoryRuntime({
      provider,
      corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
      verifyAuthentication,
    });
    const api = new ApiV1(runtime);
    expect(await api.handle({ method: "GET", path: "/health" })).toEqual({
      status: 200,
      body: { status: "ok", version: "1.0.0" },
    });
    expect((await api.handle({ method: "POST", path: "/api/v1/sessions", body: { principalId: "forged" } })).status).toBe(401);

    const created = await api.handle({ method: "POST", path: "/api/v1/sessions", authentication, body: {} });
    expect(created.status).toBe(201);
    const createdBody = created.body as Record<string, unknown>;
    expect(typeof createdBody.id).toBe("string");
    const sessionId = String(createdBody.id);
    const sent = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/messages`,
      authentication,
      body: { id: "message-1", content: "Create launch copy" },
    });
    expect(sent.status).toBe(202);
    const sentBody = sent.body as Record<string, unknown>;
    const review = sentBody.reviewPacket as Record<string, unknown>;
    expect(review.schemaVersion).toBe("conquistador.review-contract/v1");
    expect(typeof review.packetId).toBe("string");
    expect(typeof review.digest).toBe("string");
    const ajv = new Ajv2020({
      strict: false,
      formats: { "date-time": true, uri: true },
    });
    for (const file of [
      "credential-detector.schema.json",
      "review-contract.schema.json",
    ]) {
      ajv.addSchema(JSON.parse(readFileSync(resolve(import.meta.dirname, `../schemas/${file}`), "utf8")));
    }
    const validateProtocol = ajv.compile(JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/protocol.schema.json"), "utf8")));
    expect(
      validateProtocol(sent.body),
      JSON.stringify(validateProtocol.errors),
    ).toBe(true);
    const authorityMissing = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/reviews/${String(review.packetId)}/decision`,
      authentication,
      body: { outcome: "accept", packetDigest: String(review.digest) },
    });
    expect(authorityMissing).toMatchObject({
      status: 403,
      body: { error: { code: "forbidden" } },
    });
    const invalidAuthority = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/reviews/${String(review.packetId)}/decision`,
      authentication,
      authenticateHumanReview: async (challenge) => ({
        ...(await authenticateHuman(challenge)),
        principalId: "different-reviewer",
      }),
      body: { outcome: "accept", packetDigest: String(review.digest) },
    });
    expect(invalidAuthority).toMatchObject({
      status: 403,
      body: { error: { code: "forbidden" } },
    });
    const decided = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/reviews/${String(review.packetId)}/decision`,
      authentication,
      authenticateHumanReview: authenticateHuman,
      body: { outcome: "accept", packetDigest: String(review.digest) },
    });
    expect(decided).toMatchObject({
      status: 200,
      body: {
        schemaVersion: "conquistador.review-contract/v1",
        kind: "review-verdict",
        outcome: "accept",
        packetId: review.packetId,
        authentication: {
          principalId: "operator-1",
          role: "reviewer",
          method: "test-human-presence",
          verifier: "test-human-verifier",
          authority: "content-review",
        },
      },
    });
    const events = await api.handle({ method: "GET", path: `/api/v1/sessions/${sessionId}/events?after=0`, authentication });
    const eventBody = events.body as { events: Array<{ type: string }> };
    expect(eventBody.events.at(-1)?.type).toBe("final.result");
  });

  it("rejects legacy, extra, and wrongly bound review decision fields", async () => {
    const runtime = new InMemoryRuntime({
      provider,
      corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
    });
    const api = new ApiV1(runtime);
    const created = await api.handle({
      method: "POST",
      path: "/api/v1/sessions",
      authentication,
      body: {},
    });
    const sessionId = String((created.body as Record<string, unknown>).id);
    const sent = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/messages`,
      authentication,
      body: { id: "message-1", content: "Create launch copy" },
    });
    const packet = (sent.body as { reviewPacket: Record<string, unknown> })
      .reviewPacket;
    const path = `/api/v1/sessions/${sessionId}/reviews/${String(packet.packetId)}/decision`;
    expect((await api.handle({
      method: "POST",
      path,
      authentication,
      body: { decision: "accept", reviewDigest: packet.digest },
    })).status).toBe(400);
    expect((await api.handle({
      method: "POST",
      path,
      authentication,
      body: { outcome: "accept", packetDigest: packet.digest, accept: true },
    })).status).toBe(400);
    expect((await api.handle({
      method: "POST",
      path,
      authentication,
      body: { outcome: "accept", packetDigest: "sha256:" + "0".repeat(64) },
    })).status).toBe(403);
  });

  it("rejects reserved and credential-shaped transport principals at session creation", async () => {
    const api = new ApiV1(new InMemoryRuntime({
      provider,
      corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
    }));
    for (const principalId of [
      "user@example.com",
      "latest",
      "default",
      "sk-abcdefghijklmnop",
    ]) {
      const response = await api.handle({
        method: "POST",
        path: "/api/v1/sessions",
        authentication: { ...authentication, principalId },
        body: {},
      });
      expect(response, principalId).toMatchObject({
        status: 400,
        body: { error: { code: "invalid" } },
      });
    }
  });

  it("does not expose raw framework, workflow, specialist, or tool routes", async () => {
    const api = new ApiV1(new InMemoryRuntime({
      provider,
      corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
    }));
    for (const path of ["/api/v1/tools/run", "/api/v1/workflows", "/api/v1/specialists", "/eve/sessions"]) {
      expect((await api.handle({ method: "POST", path, authentication, body: {} })).status).toBe(404);
    }
  });

  it("maps deadline expiry distinctly through the API and failure event", async () => {
    const runtime = new InMemoryRuntime({
      provider: {
        id: "openai.responses.direct",
        generate: async () => {
          throw Object.assign(new Error("expired detail"), { code: "deadline-exceeded" });
        },
      },
      corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
    });
    const api = new ApiV1(runtime);
    const created = await api.handle({ method: "POST", path: "/api/v1/sessions", authentication, body: {} });
    const sessionId = String((created.body as Record<string, unknown>).id);
    const sent = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/messages`,
      authentication,
      body: { id: "message-1", content: "Create launch copy" },
    });
    expect(sent).toMatchObject({ status: 504, body: { error: { code: "deadline-exceeded" } } });
    expect(JSON.stringify(sent)).not.toContain("expired detail");
    const failure = runtime.events(sessionId, 0, "operator-1").at(-1);
    expect(failure).toMatchObject({
      type: "failure",
      payload: { code: "deadline-exceeded", retryable: true },
    });
  });
});
