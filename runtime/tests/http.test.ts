import { DEFAULT_SKILLS_ROOT } from "../src/skill-assets.ts";
import { request as httpRequest } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";

import { ApiV1 } from "../src/api.ts";
import { parseConfigYaml } from "../src/config.ts";
import { loadRuntimeCorpus } from "../src/corpus.ts";
import { createHttpServer } from "../src/http.ts";
import { InMemoryRuntime } from "../src/runtime.ts";
import { createOidcVerifier } from "../src/oidc.ts";
import {
  canonicalOidcPrincipalId,
  canonicalOidcSubjectBinding,
} from "../src/principal.ts";
import type { HumanAuthenticationChallenge } from "../src/review-contract.ts";

const servers: Array<ReturnType<typeof createHttpServer>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))));
});

function localConfig() {
  return parseConfigYaml(`
schemaVersion: "conquistador.config/v1"
instance:
  id: "http-test"
models:
  primary:
    provider: "openai"
    model: "gpt-test"
    credentialEnv: "OPENAI_API_KEY"
server:
  profile: "local"
  bind: "127.0.0.1"
  port: 4317
  auth:
    mode: "local"
  allowedOrigins: []
  trustedProxies: []
data:
  dir: "./data"
  sessionRetentionDays: 1
  traceRetentionDays: 1
  artifactPolicy: "accepted-only"
  backupPolicy: "operator"
memory:
  mode: "off"
  scopePolicy: "instance-workspace-project"
sandbox:
  mode: "disabled"
  projectRoots: []
limits:
  activeSessions: 1
  internalSpecialists: 0
  tokensPerRun: 1000
  timeoutSeconds: 30
  queuedMessages: 2
  bodyBytes: 2048
tools:
  actionPolicy: "human-bound"
`);
}

function api() {
  return new ApiV1(new InMemoryRuntime({
    provider: {
      id: "openai.responses.direct",
      generate: async () => ({
        provider: "openai",
        providerCellId: "openai.responses.direct",
        text: "done",
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    },
    corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
  }));
}

describe("local and authenticated HTTP boundary", () => {
  it("serves minimal health and derives local principal from loopback transport", async () => {
    const server = createHttpServer({ api: api(), config: localConfig(), env: {} });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    expect(await (await fetch(`http://127.0.0.1:${address.port}/health`)).json()).toEqual({ status: "ok", version: "1.0.0" });
    const rebound = await new Promise<number | undefined>((done, reject) => {
      const request = httpRequest(`http://127.0.0.1:${address.port}/api/v1/sessions`, { method: "POST", headers: { host: "attacker.example", "content-type": "application/json" } }, (response) => {
        response.resume(); done(response.statusCode);
      });
      request.on("error", reject); request.end("{}");
    });
    expect(rebound).toBe(403);
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(201);
    expect((await response.json()).principalId).toBe("local-operator");
  });

  it("enforces the configured active-session ceiling over HTTP", async () => {
    const config = localConfig();
    const runtime = new InMemoryRuntime({
      provider: {
        id: "openai.responses.direct",
        generate: async () => ({
          provider: "openai",
          providerCellId: "openai.responses.direct",
          text: "done",
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      },
      corpus: loadRuntimeCorpus(DEFAULT_SKILLS_ROOT),
      maximumSessions: config.limits.activeSessions,
      maximumQueuedMessages: config.limits.queuedMessages,
    });
    const server = createHttpServer({ api: new ApiV1(runtime), config, env: {} });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    const url = `http://127.0.0.1:${address.port}/api/v1/sessions`;
    const first = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const second = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: "conflict" } });
  });

  it("refuses bearer startup without a host secret and never trusts body identity", async () => {
    const config = localConfig();
    config.server.profile = "single-node";
    config.server.bind = "0.0.0.0";
    config.server.publicUrl = "https://agent.example.com";
    config.server.allowedOrigins = ["https://app.example.com"];
    config.server.trustedProxies = ["127.0.0.1"];
    config.server.auth = { mode: "bearer", tokenEnv: "CONQUISTADOR_TOKEN" };
    expect(() => createHttpServer({ api: api(), config, env: {} })).toThrow(/CONQUISTADOR_TOKEN/);
  });

  it("enforces exact bearer auth and origins while deriving identity from transport", async () => {
    const config = localConfig();
    config.server.profile = "single-node";
    config.server.bind = "0.0.0.0";
    config.server.publicUrl = "https://agent.example.com";
    config.server.allowedOrigins = ["https://app.example.com"];
    config.server.trustedProxies = ["127.0.0.1"];
    config.server.auth = { mode: "bearer", tokenEnv: "CONQUISTADOR_TOKEN" };
    const server = createHttpServer({ api: api(), config, env: { CONQUISTADOR_TOKEN: "exact-host-secret" } });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    const url = `http://127.0.0.1:${address.port}/api/v1/sessions`;
    expect((await fetch(url, { method: "POST", body: "{}" })).status).toBe(403);
    const missingAuth = await fetch(url, {
      method: "POST",
      headers: { origin: "https://app.example.com", "x-forwarded-proto": "https" },
      body: "{}",
    });
    expect(missingAuth.status).toBe(401);
    expect(missingAuth.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect((await fetch(url, {
      method: "POST",
      headers: { authorization: "Bearer exact-host-secret", origin: "https://evil.example.com", "x-forwarded-proto": "https" },
      body: "{}",
    })).status).toBe(403);
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: "Bearer exact-host-secret", origin: "https://app.example.com", "x-forwarded-proto": "https" },
      body: JSON.stringify({ principalId: "forged" }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect((await response.json()).principalId).toBe("bearer-operator");
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: { origin: "https://app.example.com", "access-control-request-method": "POST", "x-forwarded-proto": "https" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, POST");
  });

  it("rejects request bodies above the configured byte ceiling", async () => {
    const config = localConfig();
    config.limits.bodyBytes = 8;
    const server = createHttpServer({ api: api(), config, env: {} });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/sessions`, {
      method: "POST",
      body: JSON.stringify({ tooLarge: true }),
    });
    expect(response.status).toBe(413);
  });

  it("derives OIDC identity and maps verifier failures to unauthenticated", async () => {
    const config = localConfig();
    config.server.profile = "single-node";
    config.server.auth = {
      mode: "oidc",
      issuer: "https://issuer.example.com",
      audience: "conquistador",
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
    };
    expect(() => createHttpServer({ api: api(), config, env: {} })).toThrow(/host verifier/);
    const server = createHttpServer({
      api: api(),
      config,
      env: {},
      verifyOidc: async (token) => {
        if (token === "valid") {
          return {
            issuer: "https://issuer.example.com",
            subject: " operator-oidc ",
          };
        }
        if (token === "blank") {
          return { issuer: "https://issuer.example.com", subject: " " };
        }
        throw new Error("signature detail must not escape");
      },
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    const url = `http://127.0.0.1:${address.port}/api/v1/sessions`;
    const valid = await fetch(url, { method: "POST", headers: { authorization: "Bearer valid" }, body: "{}" });
    expect(valid.status).toBe(201);
    const validBody = await valid.json() as { principalId: string };
    expect(validBody.principalId).toBe(canonicalOidcPrincipalId(
      "https://issuer.example.com",
      " operator-oidc ",
    ));
    expect(validBody.principalId).not.toBe(canonicalOidcPrincipalId(
      "https://issuer.example.com",
      "operator-oidc",
    ));
    for (const token of ["invalid", "blank"]) {
      const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{}" });
      expect(response.status).toBe(401);
      expect(JSON.stringify(await response.json())).not.toContain("signature detail");
    }
  });

  it("canonicalizes a signed OIDC issuer and case-sensitive subject", async () => {
    const config = localConfig();
    config.server.profile = "single-node";
    config.server.auth = {
      mode: "oidc",
      issuer: "https://issuer.example.com",
      audience: "conquistador",
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
    };
    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
    });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "http-test-key";
    publicJwk.alg = "RS256";
    const keySet = createLocalJWKSet({ keys: [publicJwk] });
    const subject = "Auth0|Valid-Subject";
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "http-test-key" })
      .setIssuer(config.server.auth.issuer)
      .setAudience(config.server.auth.audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    let observedChallenge: HumanAuthenticationChallenge | undefined;
    const server = createHttpServer({
      api: api(),
      config,
      env: {},
      verifyOidc: createOidcVerifier(config.server.auth, { keySet }),
      authenticateHumanReview: async (challenge) => {
        observedChallenge = challenge;
        throw new Error("stop before creating a verdict");
      },
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("missing test address");
    }
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/sessions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: "{}",
      },
    );
    expect(response.status).toBe(201);
    const body = await response.json() as { id: string; principalId: string };
    expect(body.principalId).toBe(
      canonicalOidcPrincipalId(config.server.auth.issuer, subject),
    );
    expect(body.principalId).toMatch(/^oidc:[a-f0-9]{64}$/);
    expect(body.principalId).not.toBe(
      canonicalOidcPrincipalId(config.server.auth.issuer, subject.toLowerCase()),
    );
    const messageResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/sessions/${body.id}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: "oidc-message", content: "Review this." }),
      },
    );
    expect(messageResponse.status).toBe(202);
    const messageBody = await messageResponse.json() as {
      reviewPacket: { packetId: string; digest: string };
    };
    const decisionResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/sessions/${body.id}/reviews/${messageBody.reviewPacket.packetId}/decision`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          outcome: "accept",
          packetDigest: messageBody.reviewPacket.digest,
        }),
      },
    );
    expect(decisionResponse.status).toBe(403);
    expect(observedChallenge?.transport).toMatchObject({
      principalId: canonicalOidcPrincipalId(config.server.auth.issuer, subject),
      method: "oidc",
      verifier: "conquistador-http-oidc",
      subjectBinding: canonicalOidcSubjectBinding(
        config.server.auth.issuer,
        subject,
      ),
    });
  });
});
