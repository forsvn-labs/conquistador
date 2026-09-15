import { seal, REVIEW_CONTRACT_VERSION, type ActionAuthorizationV1 } from "../src/review-contract.ts";
import {
  existsSync,
  symlinkSync,
  unlinkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ApiV1 } from "../src/api.ts";
import { createHostJudgmentProvider } from "../src/judgment.ts";
import { RuntimeFailure } from "../src/runtime.ts";
import { parseConfigYaml } from "../src/config.ts";
import { buildService } from "../src/service.ts";
import {
  DurableServedRuntime,
  parseServedPlaybookRequest,
} from "../src/served-runtime.ts";
import { testResponseFor } from "./judgment-fixture.ts";
import {
  TEST_TRANSPORT as authentication,
  testHostAuthenticationVerifier as verifyAuthentication,
  testHumanAuthenticator as authenticateHuman,
} from "./auth-fixture.ts";

const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function dataDir(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "conquistador-served-"));
  temporary.push(directory);

  return directory;
}

function isStatusRecord(value: unknown): value is { status: string } {
  return value !== null &&
    typeof value === "object" &&
    "status" in value &&
    typeof value.status === "string";
}

function isIdentified(value: unknown): value is { id: string } {
  return value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string";
}

function isPacketBody(
  value: unknown,
): value is { reviewPacket: { packetId: string } } {
  if (value === null || typeof value !== "object" || !("reviewPacket" in value)) {
    return false;
  }

  const packet = value.reviewPacket;

  return packet !== null &&
    typeof packet === "object" &&
    "packetId" in packet &&
    typeof packet.packetId === "string";
}

function runStatus(path: string): string {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

  if (!isStatusRecord(parsed)) {
    throw new Error("run state status missing");
  }

  return parsed.status;
}

function playbookMessage(): string {
  return JSON.stringify({
    playbook: "content-intelligence-loop",
    product: "Conquistador",
    audience: "operators",
    channel: "linkedin",
    goals: "one reviewed artifact",
  });
}

function cancelledReceipt(authorization: ActionAuthorizationV1) {
  // Local contract fixture, not a provider execution receipt or live evidence.
  return seal({ schemaVersion: REVIEW_CONTRACT_VERSION, kind: "action-receipt" as const,
    receiptId: "test-cancelled-receipt", authorizationId: authorization.authorizationId,
    authorizationDigest: authorization.digest, sessionId: authorization.sessionId,
    runId: authorization.runId, candidateId: authorization.candidateId,
    artifact: authorization.artifact, authority: authorization.allowed.authority,
    operation: authorization.allowed.operation, connectionRef: authorization.allowed.connectionRef,
    payloadDigest: authorization.allowed.payloadDigest, status: "cancelled" as const,
    startedAt: authorization.authorizedAt, finishedAt: authorization.authorizedAt,
    redactionApplied: true as const, terminal: true as const,
  });
}

function judgment() {
  const steps: string[] = [];

  const provider = createHostJudgmentProvider(
    {
      hostId: "conquistador-self-hosted",
      adapterId: "served-http",
      adapterVersion: "1.0.0",
    },
    async (request) => {
      steps.push(request.identity.stepId);

      return testResponseFor(request, {
        executor: {
          hostId: "conquistador-self-hosted",
          adapterId: "served-http",
          adapterVersion: "1.0.0",
          executionId: `served-${request.identity.stepId}`,
          loadedAssetManifestDigest: request.skill.packageDigest,
        },
      });
    },
    { testOnly: true },
  );

  return { provider, steps };
}

describe("served playbook request parsing", () => {
  it("accepts JSON playbook input and rejects free-form or skill routes", () => {
    expect(parseServedPlaybookRequest(playbookMessage())).toEqual({
      playbookId: "content-intelligence-loop",
      inputs: {
        product: "Conquistador",
        audience: "operators",
        channel: "linkedin",
        goals: "one reviewed artifact",
      },
    });
    expect(() => parseServedPlaybookRequest("Create launch copy")).toThrow(
      /JSON playbook input/,
    );
    expect(() =>
      parseServedPlaybookRequest(JSON.stringify({
        intent: "write copy",
        product: "Conquistador",
        audience: "operators",
        channel: "linkedin",
        goals: "one reviewed artifact",
      }))
    ).toThrow(/playbooks only/);
  });
});

describe("durable served runtime", () => {
  it("serves bounded owned artifact bodies and rejects tampering, symlinks, authority IDs, and other owners", async () => {
    const root = dataDir();
    const runtime = new DurableServedRuntime({ dataDir: root, instanceId: "artifact-test", judgment: judgment().provider, verifyAuthentication });
    const session = runtime.createSession({ principalId: "operator-1" });
    await runtime.sendMessage(session.id, { id: "artifact-message", content: playbookMessage(), principalId: "operator-1" });
    const listed = runtime.listArtifacts(session.id, "operator-1");
    expect(listed.artifactIds).toContain("created-artifact");
    expect(listed.artifactIds).not.toContain("approved-action");
    const artifact = runtime.readArtifact(session.id, "created-artifact", "operator-1");
    expect(artifact.body).toBeTruthy();
    expect(artifact.digest).toMatch(/^sha256:/);
    expect(() => runtime.readArtifact(session.id, "created-artifact", "intruder")).toThrow();
    expect(() => runtime.readArtifact(session.id, "../state", "operator-1")).toThrow();
    expect(() => runtime.readArtifact(session.id, "approved-action", "operator-1")).toThrow();
    const api = new ApiV1(runtime);
    const response = await api.handle({ method: "GET", path: `/api/v1/sessions/${session.id}/artifacts/created-artifact`, authentication });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(artifact);
    const dirs = readdirSync(resolve(root, "sessions"));
    const runDir = dirs.map(id => resolve(root, "sessions", id)).find(dir => existsSync(resolve(dir, "artifacts/created-artifact.md")))!;
    const path = resolve(runDir, "artifacts/created-artifact.md");
    const original = readFileSync(path, "utf8");
    writeFileSync(path, "private tampered body");
    expect(() => runtime.readArtifact(session.id, "created-artifact", "operator-1")).toThrow(/integrity/);
    writeFileSync(path, "x".repeat(524289));
    expect(() => runtime.readArtifact(session.id, "created-artifact", "operator-1")).toThrow(/integrity/);
    const other = resolve(root, "outside.md"); writeFileSync(other, original); unlinkSync(path); symlinkSync(other, path);
    expect(() => runtime.readArtifact(session.id, "created-artifact", "operator-1")).toThrow(/integrity/);
  });

  it("runs the playbook through the judgment seam, persists across restart, and does not call generate", async () => {
    const root = dataDir();
    const first = judgment();

    const runtime = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-test",
      judgment: first.provider,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });
    expect(session.state).toBe("idle");

    const packet = await runtime.sendMessage(session.id, {
      id: "message-1",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    expect(packet.schemaVersion).toBe("conquistador.review-contract/v1");
    expect(
      runtime.events(session.id, 0, "operator-1").some((event) =>
        event.type === "review.packet"
      ),
    ).toBe(true);
    expect(first.steps).toEqual([
      "rank-opportunities",
      "create-artifact",
      "specialist-review",
    ]);
    const runStatePath = resolve(root, "sessions", session.id, "state.json");
    expect(existsSync(runStatePath)).toBe(true);
    expect(existsSync(resolve(root, "sessions", session.id, "session.json"))).toBe(
      true,
    );

    expect(runStatus(runStatePath)).toBe("awaiting-review");

    const restored = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-test",
      judgment: judgment().provider,
      verifyAuthentication,
    });

    const restoredEvents = restored.events(session.id, 0, "operator-1");
    expect(restoredEvents.some((event) => event.type === "review.packet")).toBe(
      true,
    );

    const verdict = await restored.decideReview(session.id, packet.packetId, {
      transport: authentication,
      authenticateHuman,
      outcome: "reject",
      packetDigest: packet.digest,
    });

    expect(verdict.outcome).toBe("reject");
    expect(restored.reviewVerdict(session.id, "operator-1")?.outcome).toBe(
      "reject",
    );
  });

  it("skips a corrupt session sidecar and still loads neighbors", () => {
    const root = dataDir();

    const runtime = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-corrupt",
      judgment: judgment().provider,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });

    mkdirSync(resolve(root, "sessions", "session-corrupt"), { recursive: true });
    writeFileSync(
      resolve(root, "sessions", "session-corrupt", "session.json"),
      "{not-json",
    );

    const restored = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-corrupt",
      judgment: judgment().provider,
      verifyAuthentication,
    });

    expect(restored.events(session.id, 0, "operator-1")).toEqual([]);
  });

  it("rebuilds a missing review packet from runner state after restart", async () => {
    const root = dataDir();

    const runtime = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-rebuild",
      judgment: judgment().provider,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });

    const packet = await runtime.sendMessage(session.id, {
      id: "message-1",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    const sessionPath = resolve(root, "sessions", session.id, "session.json");

    writeFileSync(
      sessionPath,
      `${JSON.stringify({
        schemaVersion: "conquistador.served-session/v1",
        view: {
          schemaVersion: session.schemaVersion,
          id: session.id,
          principalId: session.principalId,
          state: "idle",
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        events: [],
        usedMessageIds: ["message-1"],
        runId: session.id,
        playbookId: "content-intelligence-loop",
      }, null, 2)}\n`,
    );

    const restored = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-rebuild",
      judgment: judgment().provider,
      verifyAuthentication,
    });

    const verdict = await restored.decideReview(session.id, packet.packetId, {
      transport: authentication,
      authenticateHuman,
      outcome: "reject",
      packetDigest: packet.digest,
    });

    expect(verdict.outcome).toBe("reject");
  });

  it("cancels the active turn, rejects queued work, and releases the session slot", async () => {
    let release = () => {};

    const gate = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });

    let started = 0;

    const provider = createHostJudgmentProvider(
      {
        hostId: "conquistador-self-hosted",
        adapterId: "served-http",
        adapterVersion: "1.0.0",
      },
      async (request, execution) => {
        started += 1;
        await new Promise<void>((resolvePromise, reject) => {
          const onAbort = () => reject(new Error("aborted"));

          if (execution.signal.aborted) {
            onAbort();

            return;
          }

          execution.signal.addEventListener("abort", onAbort, { once: true });
          void gate.then(() => {
            execution.signal.removeEventListener("abort", onAbort);
            resolvePromise();
          });
        });

        return testResponseFor(request, {
          executor: {
            hostId: "conquistador-self-hosted",
            adapterId: "served-http",
            adapterVersion: "1.0.0",
            executionId: `served-${request.identity.stepId}`,
            loadedAssetManifestDigest: request.skill.packageDigest,
          },
        });
      },
      { testOnly: true },
    );

    const cancelRoot = dataDir();
    const runtime = new DurableServedRuntime({
      dataDir: cancelRoot,
      instanceId: "served-cancel",
      judgment: provider,
      maximumSessions: 1,
      maximumQueuedMessages: 2,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });

    const first = runtime.sendMessage(session.id, {
      id: "message-1",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    for (let i = 0; i < 50 && started === 0; i += 1) {
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
    }

    expect(started).toBe(1);
    const sidecar = JSON.parse(readFileSync(resolve(cancelRoot, "sessions", session.id, "session.json"), "utf8"));
    expect(sidecar.runId).toBe(session.id);

    const second = runtime.sendMessage(session.id, {
      id: "message-2",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    runtime.cancel(session.id, "operator-1");
    await expect(first).rejects.toThrow(/cancelled/);
    await expect(second).rejects.toThrow(/cancelled/);
    expect(() => runtime.createSession({ principalId: "operator-1" })).not.toThrow();
    release();
  });

  it("accepts content separately, binds authorization, imports an owned receipt, and rejects replay", async () => {
    const root = dataDir();

    const runtime = new DurableServedRuntime({
      dataDir: root,
      instanceId: "served-accept",
      judgment: judgment().provider,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });

    const packet = await runtime.sendMessage(session.id, {
      id: "message-1",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    expect(packet.actionProposal).not.toBeNull();

    const verdict = await runtime.decideReview(session.id, packet.packetId, {
      transport: authentication,
      authenticateHuman,
      outcome: "accept",
      packetDigest: packet.digest,
    });

    expect(verdict.outcome).toBe("accept");
    expect(runtime.reviewVerdict(session.id, "operator-1")?.outcome).toBe(
      "accept",
    );

    expect(
      runStatus(resolve(root, "sessions", session.id, "state.json")),
    ).toBe("awaiting-action-authorization");
    expect(runtime.actionState(session.id, "operator-1").authorization).toBeNull();
    await expect(runtime.authorizeAction(session.id, packet.packetId, { transport: { ...authentication, principalId: "operator-2" }, authenticateHuman, packetDigest: packet.digest })).rejects.toThrow(/principal/);
    await expect(runtime.authorizeAction(session.id, packet.packetId, { transport: authentication, authenticateHuman, packetDigest: `sha256:${"f".repeat(64)}` })).rejects.toThrow(/exact/);
    let release = () => {};
    const gate = new Promise<void>((done) => { release = done; });
    const authorizing = runtime.authorizeAction(session.id, packet.packetId, { transport: authentication, packetDigest: packet.digest, authenticateHuman: async (challenge) => { await gate; return authenticateHuman(challenge); } });
    await expect(runtime.authorizeAction(session.id, packet.packetId, { transport: authentication, authenticateHuman, packetDigest: packet.digest })).rejects.toThrow(/unavailable/);
    release();
    const authorization = await authorizing;
    expect(runtime.actionState(session.id, "operator-1").status).toBe("awaiting-action-receipt");
    await expect(runtime.authorizeAction(session.id, packet.packetId, { transport: authentication, authenticateHuman, packetDigest: packet.digest })).rejects.toThrow(/not awaiting/);
    const receipt = cancelledReceipt(authorization);
    const { digest: _receiptDigest, ...receiptBasis } = receipt;
    await expect(runtime.importActionReceipt(session.id, seal({ ...receiptBasis, payloadDigest: `sha256:${"f".repeat(64)}` }), { transport: authentication, authenticateHuman })).rejects.toThrow(/does not match/);
    await expect(runtime.importActionReceipt(session.id, receipt, { transport: { ...authentication, principalId: "operator-2" }, authenticateHuman })).rejects.toThrow(/principal/);
    expect((await runtime.importActionReceipt(session.id, receipt, { transport: authentication, authenticateHuman })).status).toBe("cancelled");
    await expect(runtime.importActionReceipt(session.id, receipt, { transport: authentication, authenticateHuman })).rejects.toThrow(/not awaiting/);
    const restored = new DurableServedRuntime({ dataDir: root, instanceId: "served-accept", judgment: judgment().provider, verifyAuthentication });
    expect(restored.actionState(session.id, "operator-1").status).toBe("cancelled");
  });

  it("enforces session and queue ceilings and rejects work after review", async () => {
    let release = () => {};

    const gate = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });

    let started = 0;

    const provider = createHostJudgmentProvider(
      {
        hostId: "conquistador-self-hosted",
        adapterId: "served-http",
        adapterVersion: "1.0.0",
      },
      async (request) => {
        started += 1;
        await gate;

        return testResponseFor(request, {
          executor: {
            hostId: "conquistador-self-hosted",
            adapterId: "served-http",
            adapterVersion: "1.0.0",
            executionId: `served-${request.identity.stepId}`,
            loadedAssetManifestDigest: request.skill.packageDigest,
          },
        });
      },
      { testOnly: true },
    );

    const runtime = new DurableServedRuntime({
      dataDir: dataDir(),
      instanceId: "served-ceilings",
      judgment: provider,
      maximumSessions: 1,
      maximumQueuedMessages: 1,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });
    expect(() => runtime.createSession({ principalId: "operator-1" })).toThrow(
      RuntimeFailure,
    );

    const first = runtime.sendMessage(session.id, {
      id: "message-1",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    for (let i = 0; i < 50 && started === 0; i += 1) {
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
    }

    expect(started).toBe(1);

    const second = runtime.sendMessage(session.id, {
      id: "message-2",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    expect(() =>
      runtime.sendMessage(session.id, {
        id: "message-3",
        content: playbookMessage(),
        principalId: "operator-1",
      })
    ).toThrow(/queue ceiling/);
    release();
    await first;
    await expect(second).rejects.toThrow(/final review decision/);
  });

  it("rejects queued work when the service shuts down", async () => {
    let release = () => {};

    const gate = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });

    let started = 0;

    const provider = createHostJudgmentProvider(
      {
        hostId: "conquistador-self-hosted",
        adapterId: "served-http",
        adapterVersion: "1.0.0",
      },
      async (request) => {
        started += 1;
        await gate;

        return testResponseFor(request, {
          executor: {
            hostId: "conquistador-self-hosted",
            adapterId: "served-http",
            adapterVersion: "1.0.0",
            executionId: `served-${request.identity.stepId}`,
            loadedAssetManifestDigest: request.skill.packageDigest,
          },
        });
      },
      { testOnly: true },
    );

    const runtime = new DurableServedRuntime({
      dataDir: dataDir(),
      instanceId: "served-shutdown-queue",
      judgment: provider,
      maximumSessions: 1,
      maximumQueuedMessages: 2,
      verifyAuthentication,
    });

    const session = runtime.createSession({ principalId: "operator-1" });

    const first = runtime.sendMessage(session.id, {
      id: "message-1",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    for (let i = 0; i < 50 && started === 0; i += 1) {
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
    }

    expect(started).toBe(1);

    const queued = runtime.sendMessage(session.id, {
      id: "message-2",
      content: playbookMessage(),
      principalId: "operator-1",
    });

    await runtime.shutdown();
    await expect(queued).rejects.toThrow(/shutting down/);
    release();
    await Promise.allSettled([first]);
    expect(runtime.ready()).toBe(false);
    expect(() => runtime.createSession({ principalId: "operator-1" })).toThrow(
      /shutting down/,
    );
  });

  it("marks the service not-ready after shutdown", async () => {
    const runtime = new DurableServedRuntime({
      dataDir: dataDir(),
      instanceId: "served-stop",
      judgment: judgment().provider,
    });

    expect(runtime.ready()).toBe(true);
    await runtime.shutdown();
    expect(runtime.ready()).toBe(false);
    expect(() => runtime.createSession({ principalId: "operator-1" })).toThrow(
      /shutting down/,
    );
  });
});

describe("learning persistence consent", () => {
  it.each(["off", "review-promoted"] as const)("does not write learning after accepted completion or restart with memory.mode=%s", async (mode) => {
    const root = dataDir();
    const config = parseConfigYaml(readFileSync(new URL("../config/conquistador.config.example.yaml", import.meta.url), "utf8"));
    config.data.dir = root;
    config.memory.mode = mode;
    const service = buildService({ config, env: { OPENAI_API_KEY: "synthetic-unused-credential" }, judgment: judgment().provider, verifyAuthentication });
    const runtime = service.runtime;
    const session = runtime.createSession({ principalId: "operator-1" });
    const packet = await runtime.sendMessage(session.id, {
      id: "learning-consent-message", content: playbookMessage(), principalId: "operator-1",
    });
    await runtime.decideReview(session.id, packet.packetId, {
      transport: authentication, authenticateHuman, outcome: "accept", packetDigest: packet.digest,
    });
    const authorization = await runtime.authorizeAction(session.id, packet.packetId, {
      transport: authentication, authenticateHuman, packetDigest: packet.digest,
    });
    const { digest: _digest, ...basis } = cancelledReceipt(authorization);
    // Synthetic successful receipt exercises completion, not a live external action.
    await runtime.importActionReceipt(session.id, seal({ ...basis, status: "succeeded" as const }), {
      transport: authentication, authenticateHuman,
    });
    const runDirectory = resolve(root, "sessions", session.id);
    expect(runStatus(resolve(runDirectory, "state.json"))).toBe("completed");
    expect(existsSync(resolve(root, "sessions/learning.jsonl"))).toBe(false);
    expect(readdirSync(resolve(root, "memory"))).toEqual([]);
    expect(readFileSync(resolve(runDirectory, "artifacts/learning-record.md"), "utf8"))
      .toContain("Run artifact only; not approved reusable learning");
    await service.shutdown();
    const restored = buildService({ config, env: { OPENAI_API_KEY: "synthetic-unused-credential" }, judgment: judgment().provider, verifyAuthentication });
    expect(restored.runtime.actionState(session.id, "operator-1").status).toBe("completed");
    expect(existsSync(resolve(root, "sessions/learning.jsonl"))).toBe(false);
    await restored.shutdown();
  });
});

describe("served HTTP service", () => {
  it("returns stopping on /ready after shutdown and keeps generate off the HTTP path", async () => {
    const root = dataDir();

    const config = parseConfigYaml(`
schemaVersion: "conquistador.config/v1"
instance:
  id: "served-http"
models:
  primary:
    provider: "openai"
    model: "gpt-test"
    credentialEnv: "OPENAI_API_KEY"
  fast:
    provider: "openai"
    model: "gpt-test"
    credentialEnv: "OPENAI_API_KEY"
  judge:
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
  dir: ${JSON.stringify(root)}
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
  activeSessions: 2
  internalSpecialists: 0
  tokensPerRun: 50000
  timeoutSeconds: 30
  queuedMessages: 2
  bodyBytes: 8192
tools:
  actionPolicy: "human-bound"
`);

    const service = buildService({
      config,
      env: {
        OPENAI_API_KEY: "sk-test-not-used",
        CONQUISTADOR_HUMAN_REVIEW_TOKEN: "local-review-fixture-secret-1234567890",
        CONQUISTADOR_HUMAN_ACTION_TOKEN: "local-action-fixture-secret-1234567890",
      },
      judgment: judgment().provider,
    });

    const api = new ApiV1(service.runtime);
    const ready = await api.handle({ method: "GET", path: "/ready" });
    expect(ready).toEqual({
      status: 200,
      body: { status: "ready", protocol: "v1" },
    });

    const created = await api.handle({
      method: "POST",
      path: "/api/v1/sessions",
      authentication,
      body: {},
    });

    expect(created.status).toBe(201);

    if (!isIdentified(created.body)) {
      throw new Error("session id missing");
    }

    const sessionId = created.body.id;

    const sent = await api.handle({
      method: "POST",
      path: `/api/v1/sessions/${sessionId}/messages`,
      authentication,
      body: { id: "message-1", content: playbookMessage() },
    });

    expect(sent.status).toBe(202);

    if (!isPacketBody(sent.body)) {
      throw new Error("review packet id missing");
    }

    expect(sent.body.reviewPacket.packetId).toMatch(/canonical/);
    await new Promise<void>((done) => service.server.listen(0, "127.0.0.1", done));
    const address = service.server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    const base = `http://127.0.0.1:${address.port}`;
    const localSession = await (await fetch(`${base}/api/v1/sessions`, { method: "POST" })).json();
    const produced = await (await fetch(`${base}/api/v1/sessions/${localSession.id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "human-review-message", content: playbookMessage() }),
    })).json();
    const packet = produced.reviewPacket;
    const decisionUrl = `${base}/api/v1/sessions/${localSession.id}/reviews/${packet.packetId}/decision`;
    const decisionBody = JSON.stringify({ outcome: "accept", packetDigest: packet.digest });
    expect((await fetch(decisionUrl, { method: "POST", body: decisionBody })).status).toBe(403);
    const decided = await fetch(decisionUrl, {
      method: "POST", headers: { "content-type": "application/json", "x-conquistador-human-review-token": "local-review-fixture-secret-1234567890" }, body: decisionBody,
    });
    expect(decided.status).toBe(200);
    expect((await decided.json()).outcome).toBe("accept");
    expect((await (await fetch(`${base}/api/v1/sessions/${localSession.id}/result`)).json()).outcome).toBe("accept");
    expect((await (await fetch(`${base}/api/v1/sessions/${localSession.id}/actions`)).json()).status).toBe("awaiting-action-authorization");
    const authorizeUrl = `${base}/api/v1/sessions/${localSession.id}/reviews/${packet.packetId}/authorize-action`;
    const actionBody = JSON.stringify({ packetDigest: packet.digest });
    expect((await fetch(authorizeUrl, { method: "POST", body: actionBody })).status).toBe(403);
    const actionHeaders = { "content-type": "application/json", "x-conquistador-human-action-token": "local-action-fixture-secret-1234567890", "x-conquistador-action-payload-digest": packet.actionProposal.payloadDigest };
    const approved = await fetch(authorizeUrl, { method: "POST", headers: actionHeaders, body: actionBody });
    expect(approved.status).toBe(200);
    const authorization = await approved.json();
    const receiptUrl = `${base}/api/v1/sessions/${localSession.id}/actions/receipt`;
    const receiptBody = JSON.stringify({ receipt: cancelledReceipt(authorization) });
    expect((await fetch(receiptUrl, { method: "POST", body: receiptBody })).status).toBe(403);
    const imported = await fetch(receiptUrl, { method: "POST", headers: actionHeaders, body: receiptBody });
    expect(imported.status).toBe(200);
    expect((await imported.json()).status).toBe("cancelled");
    expect((await fetch(receiptUrl, { method: "POST", headers: actionHeaders, body: receiptBody })).status).toBe(409);
    await service.shutdown();
    expect(await api.handle({ method: "GET", path: "/ready" })).toEqual({
      status: 503,
      body: { status: "stopping", protocol: "v1" },
    });
  });
});
it("restart recovery retains the host bridge before the next operation dispatch", async () => {
  const { startPlaybookRun } = await import("../src/runner.ts");
  const root = dataDir();
  const first = new DurableServedRuntime({ dataDir: root, instanceId: "recovery-bridge" });
  const session = first.createSession({ principalId: "operator-1" });
  await first.shutdown();
  const playbook = JSON.parse(readFileSync(new URL("../fixtures/playbooks/content-intelligence-loop.json", import.meta.url), "utf8"));
  const interrupted = await startPlaybookRun({ playbook, runsDir: resolve(root, "sessions"), runId: session.id,
    inputs: { product: "P", audience: "A", channel: "C", goals: "G" }, interruptAfter: "load-context" });
  // Construct a crash snapshot just after the first local step, before dispatch.
  const statePath = resolve(interrupted.directory, "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8")); state.status = "running";
  writeFileSync(statePath, JSON.stringify(state));
  const sessionPath = resolve(interrupted.directory, "session.json");
  const saved = JSON.parse(readFileSync(sessionPath, "utf8")); saved.runId = session.id; saved.playbookId = playbook.id; saved.view.state = "running";
  writeFileSync(sessionPath, JSON.stringify(saved));
  let calls = 0;
  const restored = new DurableServedRuntime({ dataDir: root, instanceId: "recovery-bridge", judgment: judgment().provider,
    operationBridge: { invoke: async () => { calls++; return { kind: "handoff" }; } } });
  await expect.poll(() => calls).toBe(1);
  await expect.poll(() => restored.events(session.id, 0, "operator-1").some((event) => event.type === "review.packet")).toBe(true);
  await restored.shutdown();
});
