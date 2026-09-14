import { describe, expect, it, vi } from "vitest";

import { defineAdapter } from "../src/adapter.ts";
import { sha256 } from "../src/canonical.ts";
import { Gateway } from "../src/gateway.ts";
import type { CapabilityRequest, ConsequentialManifest, HostConnectionResolution, HumanApproval, OperationContract } from "../src/contracts.ts";
import {
  approval,
  candidateBuildId,
  catalog,
  connection,
  manifest,
  now,
  operation,
  request,
  resolution,
  result,
  sha,
  supportedCatalog,
} from "./helpers.ts";

const secretFixture = ["s", "k-super-secret-value-that-must-never-appear"].join("");

function setup(
  item: OperationContract,
  handler: (requestValue: CapabilityRequest, context: any) => Promise<any>,
  options: { stale?: boolean; scopes?: string[]; credential?: unknown; mutateReference?: (value: ReturnType<typeof connection>) => void; mutateResolution?: (value: HostConnectionResolution) => void; resolverError?: Error } = {},
) {
  const value = supportedCatalog([item.id]);
  const selected = value.operations.find((entry) => entry.id === item.id)!;
  if (options.stale) {
    selected.supportCells[0].evidence.at(-1)!.checkedAt = "2025-01-01T00:00:00.000Z";
  }
  const adapter = defineAdapter(manifest(item.provider, [item.id], value), { [item.id]: handler }, value);
  const reference = connection(item.provider, options.scopes ?? item.authScopes);
  options.mutateReference?.(reference);
  const resolver = vi.fn(async () => {
    if (options.resolverError) throw options.resolverError;
    const value = resolution(reference, options.credential ?? secretFixture);
    options.mutateResolution?.(value);
    return value;
  });
  const gateway = new Gateway({
    catalog: value,
    adapters: { [adapter.manifest.id]: adapter },
    connections: { [reference.id]: reference },
    resolveConnection: resolver,
    now: () => new Date(now),
    verifyHumanApproval: (approvalValue, manifestValue) =>
      approvalValue.manifestDigest === manifestValue.digest,
  });
  return { gateway, operation: selected, reference, adapter, catalog: value, resolver };
}

describe("deny-by-default gateway", () => {
  it("permits only explicit candidate-bound live verification after fixture proof", async () => {
    const value = catalog();
    const item = value.operations.find((entry) => entry.id === "github.repository.get")!;
    const handler = vi.fn(async (requestValue: CapabilityRequest) =>
      result(requestValue, { repository: {}, visibility: "private", topics: [], timestamps: {} }),
    );
    const adapter = defineAdapter(manifest("github", [item.id], value), { [item.id]: handler }, value);
    const reference = connection("github", item.authScopes);
    const base = {
      catalog: value,
      adapters: { [adapter.manifest.id]: adapter },
      connections: { [reference.id]: reference },
      resolveConnection: async () => resolution(reference, "opaque-live-credential"),
      now: () => new Date(now),
    };
    const ordinary = new Gateway(base);
    const ordinaryOutcome = await ordinary.execute(request(item, { owner: "a", repository: "b" }));
    expect(ordinaryOutcome).toMatchObject({
      ok: false,
      error: { code: "unsupported" },
    });

    const exact = new Gateway({
      ...base,
      candidateVerification: { candidateBuildId, operationIds: [item.id] },
    });
    expect((await exact.execute(request(item, { owner: "a", repository: "b" }))).ok).toBe(true);

    const mismatchRequest = request(item, { owner: "a", repository: "b" });
    mismatchRequest.candidateBuildId = "d".repeat(64);
    const mismatch = await new Gateway({
      ...base,
      candidateVerification: { candidateBuildId, operationIds: [item.id] },
    }).execute(mismatchRequest);
    expect(mismatch).toMatchObject({ ok: false, error: { code: "unsupported" } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("executes a declared read and returns an immutable redacted receipt", async () => {
    const item = operation("github.repository.get");
    const handler = vi.fn(async (requestValue: CapabilityRequest, context: any) => {
      expect(context.credential).toContain("super-secret");
      expect(Object.isFrozen(requestValue)).toBe(true);
      expect(Object.isFrozen(requestValue.input)).toBe(true);
      return result(requestValue, {
        repository: { name: "repo", token: secretFixture },
        visibility: "private",
        topics: [],
        timestamps: {},
      });
    });
    const { gateway, operation: selected } = setup(item, handler);
    const outcome = await gateway.execute(request(selected, { owner: "forsvn-labs", repository: "conquistador" }));
    expect(outcome.ok).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(JSON.stringify(outcome.result)).not.toContain("super-secret");
    expect(JSON.stringify(outcome.receipt)).not.toContain("super-secret");
    expect(outcome.receipt).toMatchObject({
      status: "succeeded",
      connectionRef: "github.primary",
      connectionRevision: 1,
      connectionEnvironment: "sandbox",
      connectionPrincipal: { accountId: "account-1", workspaceId: "workspace-1", displayName: "Test account" },
      redactionApplied: true,
      terminalRecord: true,
    });
    expect(Object.isFrozen(outcome.receipt)).toBe(true);
  });

  it("rejects adapter output outside the closed typed result contract", async () => {
    const item = operation("github.repository.get");
    const { gateway, operation: selected } = setup(item, async (requestValue) =>
      result(requestValue, {
        repository: "not-an-object",
        visibility: "private",
        topics: [],
        timestamps: {},
      }),
    );
    const outcome = await gateway.execute(request(selected, { owner: "a", repository: "b" }));
    expect(outcome.error?.code).toBe("provider-failure");
    expect(outcome.receipt.status).toBe("failed");
  });

  it("redacts provider metadata and secret-shaped source URL parameters", async () => {
    const item = operation("github.repository.get");
    const { gateway, operation: selected } = setup(item, async (requestValue) => {
      const value = result(requestValue, {
        repository: {},
        visibility: "private",
        topics: [],
        timestamps: {},
      });
      value.providerRequestId = secretFixture;
      value.sourceUrls = [`https://example.com/source?api_key=${secretFixture}&view=summary`];
      return value;
    });
    const outcome = await gateway.execute(request(selected, { owner: "a", repository: "b" }));
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain("super-secret");
    expect(outcome.result?.providerRequestId).toBe("[REDACTED]");
  });

  it("redacts an exact opaque host credential that matches no token pattern", async () => {
    const item = operation("github.repository.get");
    const opaqueCredential = "opaque-provider-material-7f4d";
    const { gateway, operation: selected } = setup(
      item,
      async (requestValue) =>
        result(requestValue, {
          repository: { accidentalEcho: `prefix-${opaqueCredential}-suffix` },
          visibility: "private",
          topics: [],
          timestamps: {},
        }),
      { credential: opaqueCredential },
    );
    const outcome = await gateway.execute(request(selected, { owner: "a", repository: "b" }));
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain(opaqueCredential);
  });

  it("permits an external draft but does not convert it to publish", async () => {
    const item = operation("typefully.draft.create");
    const { gateway, operation: selected } = setup(item, async (requestValue) =>
      result(requestValue, { draftId: "draft-1", status: "draft", previewUrl: "https://typefully.com/draft/1" }),
    );
    const outcome = await gateway.execute(
      request(selected, { socialSetId: "set-1", content: "Review me before publishing." }),
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.receipt.actionClass).toBe("draft");
    expect(outcome.receipt.approvalId).toBeUndefined();
  });

  it("cannot be widened by mutating catalog configuration after construction", async () => {
    const value = catalog();
    const item = value.operations.find((entry) => entry.id === "github.repository.get")!;
    const handler = vi.fn(async (requestValue: CapabilityRequest) =>
      result(requestValue, { repository: {}, visibility: "private", topics: [], timestamps: {} }),
    );
    const adapter = defineAdapter(manifest("github", [item.id], value), { [item.id]: handler }, value);
    const reference = connection("github", item.authScopes);
    const gateway = new Gateway({
      catalog: value,
      adapters: { [adapter.manifest.id]: adapter },
      connections: { [reference.id]: reference },
      resolveConnection: async () => resolution(reference, "opaque"),
      now: () => new Date(now),
    });
    value.status = "candidate-bound";
    item.supportCells = supportedCatalog([item.id]).operations.find((entry) => entry.id === item.id)!.supportCells;
    const outcome = await gateway.execute(request(item, { owner: "a", repository: "b" }));
    expect(outcome.error?.code).toBe("unsupported");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks unknown operations, undeclared raw inputs, missing scope, stale support, and cancellation", async () => {
    const item = operation("github.repository.get");
    const handler = vi.fn(async (requestValue: CapabilityRequest) => result(requestValue, {}));
    const active = setup(item, handler);
    const unknown = request(active.operation, { owner: "a", repository: "b" });
    unknown.operationId = "github.raw.run";
    unknown.capabilityId = "transport.raw.invoke";
    expect((await active.gateway.execute(unknown)).error?.code).toBe("unknown-operation");

    const raw = request(active.operation, { owner: "a", repository: "b", url: "https://evil.example" });
    expect((await active.gateway.execute(raw)).error?.code).toBe("invalid-request");
    const nestedSecret = request(active.operation, {
      owner: { token: secretFixture },
      repository: "b",
    });
    expect((await active.gateway.execute(nestedSecret)).error?.code).toBe("invalid-request");

    expect(() => setup(item, handler, { scopes: ["metadata:other"] })).toThrow(/allowed operations|exactly equal/);
    expect(() => setup(item, handler, { scopes: [], mutateReference: (value) => { value.allowedOperationIds = [item.id]; } })).toThrow(/scopes are required/);
    expect(() => setup(item, handler, { scopes: ["metadata:read", "surplus:read"], mutateReference: (value) => { value.allowedOperationIds = [item.id]; } })).toThrow(/exactly equal/);

    const stale = setup(item, handler, { stale: true });
    expect((await stale.gateway.execute(request(stale.operation, { owner: "a", repository: "b" }))).error?.code).toBe("stale-support");

    const controller = new AbortController();
    controller.abort();
    expect((await active.gateway.execute(request(active.operation, { owner: "a", repository: "b" }), { signal: controller.signal })).error?.code).toBe("cancelled");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks an operation outside the connection allowlist before resolution", async () => {
    const item = operation("github.repository.get");
    const configured = setup(item, vi.fn(), { mutateReference: (value) => { value.allowedOperationIds = ["github.signal.aggregate"]; } });
    const outcome = await configured.gateway.execute(request(configured.operation, { owner: "a", repository: "b" }));
    expect(outcome.error?.code).toBe("scope-denied");
    expect(configured.resolver).not.toHaveBeenCalled();
  });

  it("blocks metered work before dispatch when a ceiling is missing or too high", async () => {
    const item = operation("semrush.report.query");
    const handler = vi.fn(async (requestValue: CapabilityRequest) => result(requestValue, { rows: [], unitsUsed: 0, nextOffset: 0 }));
    const { gateway, operation: selected } = setup(item, handler);
    const tooHigh = request(selected, { report: "domain", database: "us" });
    tooHigh.maxUnits = 1001;
    expect((await gateway.execute(tooHigh)).error?.code).toBe("budget-denied");
    const missing = request(selected, { report: "domain", database: "us" });
    delete missing.maxCost;
    expect((await gateway.execute(missing)).error?.code).toBe("budget-denied");
    expect(handler).not.toHaveBeenCalled();
  });

  it("records the real provider outcome when an adapter reports usage above budget", async () => {
    const item = operation("semrush.report.query");
    const { gateway, operation: selected } = setup(item, async (requestValue) => {
      const value = result(requestValue, { rows: [], unitsUsed: 11, nextOffset: 0 });
      value.unitsUsed = 11;
      return value;
    });
    const requestValue = request(selected, { report: "domain", database: "us" });
    requestValue.maxUnits = 10;
    const outcome = await gateway.execute(requestValue);
    expect(outcome.error?.code).toBe("budget-denied");
    expect(outcome.receipt).toMatchObject({ status: "succeeded", providerStatus: "succeeded", unitsUsed: 11 });
    expect(outcome.result?.unitsUsed).toBe(11);
  });

  it("records an unknown provider outcome when cancellation arrives after dispatch", async () => {
    const item = operation("github.repository.get");
    const controller = new AbortController();
    const handler = vi.fn(async (requestValue: CapabilityRequest) => {
      controller.abort();
      return result(requestValue, { repository: {}, visibility: "private", topics: [], timestamps: {} });
    });
    const { gateway, operation: selected } = setup(item, handler);
    const outcome = await gateway.execute(
      request(selected, { owner: "a", repository: "b" }),
      { signal: controller.signal },
    );
    expect(outcome.error?.code).toBe("cancelled");
    expect(outcome.receipt.status).toBe("unknown");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("binds request and host resolution to the exact principal, environment, revision, lifecycle, and authority", async () => {
    const item = operation("github.repository.get");
    const handler = vi.fn(async (requestValue: CapabilityRequest) =>
      result(requestValue, { repository: {}, visibility: "private", topics: [], timestamps: {} }),
    );
    const cases: Array<[string, (requestValue: CapabilityRequest) => void, ((value: HostConnectionResolution) => void) | undefined, string]> = [
      ["request account", (value) => { value.expectedPrincipal.accountId = "other"; }, undefined, "principal-denied"],
      ["request workspace", (value) => { value.expectedPrincipal.workspaceId = "other"; }, undefined, "principal-denied"],
      ["request environment", (value) => { value.connectionEnvironment = "production"; }, undefined, "connection-denied"],
      ["request revision", (value) => { value.connectionRevision = 2; }, undefined, "connection-denied"],
      ["resolved account", () => {}, (value) => { value.principal.accountId = "other"; }, "principal-denied"],
      ["resolved workspace", () => {}, (value) => { value.principal.workspaceId = "other"; }, "principal-denied"],
      ["resolved environment", () => {}, (value) => { value.environment = "production"; }, "connection-denied"],
      ["resolved revision", () => {}, (value) => { value.revision = 2; }, "connection-denied"],
      ["resolved state", () => {}, (value) => { value.state = "revoked"; }, "connection-denied"],
      ["resolved operations", () => {}, (value) => { value.allowedOperationIds = ["github.release.list"]; }, "scope-denied"],
      ["resolved scopes", () => {}, (value) => { value.scopes = ["contents:read"]; }, "scope-denied"],
      ["stale resolution", () => {}, (value) => { value.resolvedAt = "2026-08-10T00:00:00.000Z"; }, "connection-denied"],
    ];
    for (const [, mutateRequest, mutateResolution, code] of cases) {
      const configured = setup(item, handler, { mutateResolution });
      const requestValue = request(configured.operation, { owner: "a", repository: "b" });
      mutateRequest(requestValue);
      const outcome = await configured.gateway.execute(requestValue);
      expect(outcome.error?.code).toBe(code);
      expect(JSON.stringify(outcome.receipt)).not.toContain("super-secret");
      expect(configured.resolver).toHaveBeenCalledTimes(mutateResolution ? 1 : 0);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("collapses resolver failures and redacts adapter echoes without retaining transient credentials", async () => {
    const item = operation("github.repository.get");
    const opaque = "opaque-frame-only-material-92";
    const failed = setup(item, vi.fn(), { resolverError: new Error(`host detail ${opaque}`) });
    const failure = await failed.gateway.execute(request(failed.operation, { owner: "a", repository: "b" }));
    expect(failure).toMatchObject({ ok: false, error: { code: "connection-denied", retryable: false, message: "host connection resolution failed" } });
    expect(JSON.stringify(failure)).not.toContain(opaque);

    const handler = vi.fn(async (requestValue: CapabilityRequest) => {
      const value = result(requestValue, { repository: { echo: opaque }, visibility: "private", topics: [], timestamps: {} });
      value.providerCorrelationId = opaque;
      return value;
    });
    const configured = setup(item, handler, { credential: opaque });
    const outcome = await configured.gateway.execute(request(configured.operation, { owner: "a", repository: "b" }));
    expect(outcome.ok).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(JSON.stringify(outcome)).not.toContain(opaque);
    expect(JSON.stringify(configured.reference)).not.toContain(opaque);
  });

  it("accepts semantic host authority when operation and scope order differs", async () => {
    const item = operation("github.repository.get");
    const handler = vi.fn(async (value: CapabilityRequest) => result(value, { repository: {}, visibility: "private", topics: [], timestamps: {} }));
    const configured = setup(item, handler, { mutateResolution: (value) => {
      value.allowedOperationIds.reverse();
      value.scopes.reverse();
    } });
    expect((await configured.gateway.execute(request(configured.operation, { owner: "a", repository: "b" }))).ok).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("blocks revoked and expired references before host resolution", async () => {
    const item = operation("github.repository.get");
    const revoked = setup(item, vi.fn(), { mutateReference: (value) => { value.state = "revoked"; value.invalidatedAt = now.toISOString(); } });
    expect((await revoked.gateway.execute(request(revoked.operation, { owner: "a", repository: "b" }))).error?.code).toBe("connection-denied");
    const expired = setup(item, vi.fn(), { mutateReference: (value) => { value.state = "expired"; value.invalidatedAt = value.expiresAt; } });
    expect((await expired.gateway.execute(request(expired.operation, { owner: "a", repository: "b" }))).error?.code).toBe("connection-denied");
    expect(revoked.resolver).not.toHaveBeenCalled();
    expect(expired.resolver).not.toHaveBeenCalled();
  });

  it("never resolves malformed, unsupported, stale, cancelled, over-budget, or unapproved work", async () => {
    const read = operation("github.repository.get");
    const unsupportedValue = catalog();
    const unsupportedItem = unsupportedValue.operations.find((entry) => entry.id === read.id)!;
    const unsupportedHandler = vi.fn(async (value: CapabilityRequest) => result(value, {}));
    const unsupportedAdapter = defineAdapter(manifest(read.provider, [read.id], unsupportedValue), { [read.id]: unsupportedHandler }, unsupportedValue);
    const unsupportedReference = connection(read.provider, read.authScopes);
    const unsupportedResolver = vi.fn(async () => resolution(unsupportedReference));
    const unsupported = new Gateway({ catalog: unsupportedValue, adapters: { [unsupportedAdapter.manifest.id]: unsupportedAdapter }, connections: { [unsupportedReference.id]: unsupportedReference }, resolveConnection: unsupportedResolver, now: () => new Date(now) });
    expect((await unsupported.execute(request(unsupportedItem, { owner: "a", repository: "b" }))).error?.code).toBe("unsupported");

    const stale = setup(read, vi.fn(), { stale: true });
    await stale.gateway.execute(request(stale.operation, { owner: "a", repository: "b" }));
    const cancelled = setup(read, vi.fn());
    const controller = new AbortController(); controller.abort();
    await cancelled.gateway.execute(request(cancelled.operation, { owner: "a", repository: "b" }), { signal: controller.signal });
    const malformed = setup(read, vi.fn());
    await malformed.gateway.execute(request(malformed.operation, { owner: "a", repository: "b", url: "https://invalid.example" }));
    const metered = setup(operation("semrush.report.query"), vi.fn());
    const over = request(metered.operation, { report: "domain", database: "us" }); over.maxUnits = 1001;
    await metered.gateway.execute(over);
    const consequential = setup(operation("typefully.post.publish"), vi.fn());
    await consequential.gateway.execute(request(consequential.operation, { socialSetId: "set", content: "x", destination: "typefully:workspace-1" }));
    for (const resolver of [unsupportedResolver, stale.resolver, cancelled.resolver, malformed.resolver, metered.resolver, consequential.resolver]) expect(resolver).not.toHaveBeenCalled();
  });

  it("cannot prepare consequential authority for request, lifecycle, or operation drift", () => {
    const item = operation("typefully.post.publish");
    const proposal = {
      proposalId: "proposal-prepare", runId: "run-prepare", reviewId: "review-prepare",
      destinations: ["typefully:workspace-1"], platforms: ["x"], mediaDigests: [],
      maximumUnits: 1, maximumCost: 0, disclosures: [], preconditionDigests: [], previewDigest: sha("9"),
      notBefore: "2026-08-11T00:00:00.000Z", expiresAt: "2026-08-11T01:00:00.000Z",
      reversibility: "Provider follow-up", expectedOutcome: "One post", approverPolicy: "Exact operator",
    };
    const prepare = (configured: ReturnType<typeof setup>, mutate?: (value: CapabilityRequest) => void) => {
      const value = request(configured.operation, { socialSetId: "set", content: "x", destination: "typefully:workspace-1" });
      mutate?.(value);
      expect(() => configured.gateway.prepareConsequential(value, proposal)).toThrow();
      expect(configured.resolver).not.toHaveBeenCalled();
    };
    prepare(setup(item, vi.fn()), (value) => { value.expectedPrincipal.accountId = "other"; });
    prepare(setup(item, vi.fn()), (value) => { value.expectedPrincipal.workspaceId = "other"; });
    prepare(setup(item, vi.fn()), (value) => { value.connectionEnvironment = "production"; });
    prepare(setup(item, vi.fn()), (value) => { value.connectionRevision = 2; });
    prepare(setup(item, vi.fn(), { mutateReference: (value) => { value.state = "revoked"; value.invalidatedAt = now.toISOString(); } }));
    prepare(setup(item, vi.fn(), { mutateReference: (value) => { value.state = "expired"; value.expiresAt = now.toISOString(); value.invalidatedAt = value.expiresAt; } }));
    prepare(setup(item, vi.fn(), { mutateReference: (value) => { value.verifiedAt = "2026-08-09T00:00:00.000Z"; value.expiresAt = "2026-08-10T00:00:00.000Z"; } }));
    prepare(setup(item, vi.fn(), { mutateReference: (value) => { value.allowedOperationIds = ["typefully.post.schedule"]; } }));
  });

  it("converts exact consequential payloads only after authenticated, digest-bound approval", async () => {
    const item = operation("typefully.post.schedule");
    const handler = vi.fn(async (requestValue: CapabilityRequest) =>
      result(requestValue, {
        postId: "post-1",
        status: "scheduled",
        scheduledAt: "2026-08-12T09:00:00.000Z",
        previewUrl: "https://typefully.com/post/1",
      }),
    );
    const configured = setup(item, handler);
    const { gateway, operation: selected } = configured;
    const requestValue = request(selected, {
      socialSetId: "set-1",
      content: "Exact approved content",
      scheduleAt: "2026-08-12T09:00:00.000Z",
      timezone: "Asia/Ho_Chi_Minh",
      destination: "typefully:workspace-1",
    });
    const proposal = gateway.prepareConsequential(requestValue, {
      proposalId: "proposal-1",
      runId: "run-1",
      reviewId: "review-1",
      destinations: ["typefully:workspace-1"],
      platforms: ["x"],
      mediaDigests: [],
      scheduleAt: "2026-08-12T09:00:00.000Z",
      timezone: "Asia/Ho_Chi_Minh",
      maximumUnits: 1,
      maximumCost: 0,
      disclosures: ["Public post after schedule"],
      preconditionDigests: [sha("3")],
      previewDigest: sha("4"),
      notBefore: "2026-08-11T00:00:00.000Z",
      expiresAt: "2026-08-11T01:00:00.000Z",
      reversibility: "Cancel before provider publishes; published post requires separate handling.",
      expectedOutcome: "One scheduled post",
      approverPolicy: "Authenticated operator for exact Typefully workspace",
    });
    const humanApproval = approval(proposal.digest);
    const outcome = await gateway.execute(requestValue, { manifest: proposal, approval: humanApproval });
    expect(outcome.ok).toBe(true);
    expect(outcome.receipt).toMatchObject({
      manifestDigest: proposal.digest,
      approvalId: humanApproval.id,
      actionClass: "consequential",
      status: "succeeded",
    });
    expect(handler).toHaveBeenCalledOnce();

    const replay = await gateway.execute(requestValue, { manifest: proposal, approval: humanApproval });
    expect(replay.error?.code).toBe("replay-denied");
    expect(handler).toHaveBeenCalledOnce();

    const withoutHostVerifier = new Gateway({
      catalog: configured.catalog,
      adapters: { [configured.adapter.manifest.id]: configured.adapter },
      connections: { [configured.reference.id]: configured.reference },
      resolveConnection: async () => resolution(configured.reference, secretFixture),
      now: () => new Date(now),
    });
    expect(
      (await withoutHostVerifier.execute(requestValue, { manifest: proposal, approval: humanApproval })).error?.code,
    ).toBe("approval-denied");
    expect(handler).toHaveBeenCalledOnce();

    const restarted = new Gateway({
      catalog: configured.catalog,
      adapters: { [configured.adapter.manifest.id]: configured.adapter },
      connections: { [configured.reference.id]: configured.reference },
      resolveConnection: async () => resolution(configured.reference, secretFixture),
      receipts: gateway.receipts,
      now: () => new Date(now),
      verifyHumanApproval: (approvalValue, manifestValue) =>
        approvalValue.manifestDigest === manifestValue.digest,
    });
    expect((await restarted.execute(requestValue, { manifest: proposal, approval: humanApproval })).error?.code).toBe("replay-denied");
  });

  it("rejects missing, changed, expired, wildcard, and model-issued approvals", async () => {
    const item = operation("typefully.post.publish");
    const handler = vi.fn(async (requestValue: CapabilityRequest) =>
      result(requestValue, { postId: "post-1", status: "published", publishedAt: now.toISOString(), publicUrl: "https://example.com/post" }),
    );
    const create = () => {
      const configured = setup(item, handler);
      const requestValue = request(configured.operation, {
        socialSetId: "set-1",
        content: "Approved payload",
        destination: "typefully:workspace-1",
      });
      const proposal = configured.gateway.prepareConsequential(requestValue, {
        proposalId: "proposal-2",
        runId: "run-2",
        reviewId: "review-2",
        destinations: ["typefully:workspace-1"],
        platforms: ["x"],
        mediaDigests: [],
        maximumUnits: requestValue.maxUnits!,
        maximumCost: 0,
        disclosures: [],
        preconditionDigests: [],
        previewDigest: sha("5"),
        notBefore: "2026-08-11T00:00:00.000Z",
        expiresAt: "2026-08-11T01:00:00.000Z",
        reversibility: "Provider-specific follow-up only",
        expectedOutcome: "One published post",
        approverPolicy: "Exact authenticated operator",
      });
      return { ...configured, requestValue, proposal };
    };

    const missing = create();
    expect((await missing.gateway.execute(missing.requestValue)).error?.code).toBe("approval-denied");

    const changed = create();
    changed.requestValue.input.content = "Changed byte";
    expect((await changed.gateway.execute(changed.requestValue, { manifest: changed.proposal, approval: approval(changed.proposal.digest) })).error?.code).toBe("approval-denied");

    const wrongPrincipal = create();
    const changedManifest = structuredClone(wrongPrincipal.proposal) as ConsequentialManifest;
    changedManifest.principal.accountId = "different-account";
    const { digest: _oldDigest, ...changedBasis } = changedManifest;
    changedManifest.digest = sha256(changedBasis);
    expect(
      (await wrongPrincipal.gateway.execute(wrongPrincipal.requestValue, {
        manifest: changedManifest,
        approval: approval(changedManifest.digest),
      })).error?.code,
    ).toBe("approval-denied");

    const wrongRevision = create();
    const rotatedManifest = structuredClone(wrongRevision.proposal) as ConsequentialManifest;
    rotatedManifest.connectionRevision += 1;
    const { digest: _revisionDigest, ...rotatedBasis } = rotatedManifest;
    rotatedManifest.digest = sha256(rotatedBasis);
    expect((await wrongRevision.gateway.execute(wrongRevision.requestValue, {
      manifest: rotatedManifest,
      approval: approval(rotatedManifest.digest),
    })).error?.code).toBe("approval-denied");

    const model = create();
    const modelApproval = approval(model.proposal.digest);
    modelApproval.approverId = "model:gpt";
    expect((await model.gateway.execute(model.requestValue, { manifest: model.proposal, approval: modelApproval })).error?.code).toBe("approval-denied");

    const wildcard = create();
    const wildcardApproval = approval(wildcard.proposal.digest);
    wildcardApproval.authenticationMethod = "none";
    expect((await wildcard.gateway.execute(wildcard.requestValue, { manifest: wildcard.proposal, approval: wildcardApproval })).error?.code).toBe("approval-denied");

    const expired = create();
    const expiredApproval = approval(expired.proposal.digest);
    expiredApproval.expiresAt = "2026-08-10T23:59:59.000Z";
    expect((await expired.gateway.execute(expired.requestValue, { manifest: expired.proposal, approval: expiredApproval })).error?.code).toBe("approval-denied");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks cataloged prohibited deletes before adapter selection", async () => {
    const value = catalog();
    const item = value.operations.find((entry) => entry.id === "typefully.post.delete")!;
    const gateway = new Gateway({ catalog: value, adapters: {}, connections: {}, resolveConnection: async () => { throw new Error("unused"); }, now: () => new Date(now) });
    const requestValue = request(item, { postId: "post-1" });
    const outcome = await gateway.execute(requestValue);
    expect(outcome.error?.code).toBe("prohibited");
    expect(outcome.receipt).toMatchObject({ provider: "typefully", actionClass: "prohibited", status: "blocked" });
  });

  it("turns provider failure into a redacted terminal failure", async () => {
    const item = operation("github.repository.get");
    const { gateway, operation: selected } = setup(item, async () => {
      throw new Error(`provider leaked ${secretFixture}`);
    });
    const outcome = await gateway.execute(request(selected, { owner: "a", repository: "b" }));
    expect(outcome.error?.code).toBe("provider-failure");
    expect(outcome.receipt.status).toBe("failed");
    expect(JSON.stringify(outcome)).not.toContain("super-secret");
  });
});
