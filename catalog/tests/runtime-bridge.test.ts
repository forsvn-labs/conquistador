import { expect, it, vi } from "vitest";
import { createRuntimeOperationBridge } from "../src/runtime-bridge.ts";
import { defineAdapter } from "../src/adapter.ts";
import { connection, manifest, now, operation, resolution, result, supportedCatalog, candidateBuildId, catalog as unverifiedCatalog } from "./helpers.ts";
import type { OperationBridgeRequest } from "../../runtime/src/operation-bridge.ts";
function setup(supported = true) {
  const item = operation("typefully.draft.create");
  const catalog = supported ? supportedCatalog([item.id]) : unverifiedCatalog();
  const handler = vi.fn(async (request) => result(request, { draftId: "LOCAL-TEST", status: "draft", previewUrl: "https://typefully.com/test" }));
  const adapter = defineAdapter(manifest(item.provider, [item.id], catalog), { [item.id]: handler }, catalog);
  const reference = connection(item.provider, item.authScopes);
  const resolveConnection = vi.fn(async () => resolution(reference));
  const config = { catalog, candidateBuildId, adapters: { [adapter.manifest.id]: adapter }, connections: { [reference.id]: reference }, resolveConnection, now: () => now,
    bindings: [{ runtimeOperationId: "distribution.create-draft", operationId: item.id, connectionRef: reference.id, maxUnits: 1, maxCost: 0,
      input: async () => ({ socialSetId: "test", content: "SYNTHETIC GATING TEST ONLY" }) }] };
  const request: OperationBridgeRequest = { operationId: "distribution.create-draft", actionClass: "draft", runId: "test-run", stepId: "test-step", idempotencyKey: "test-key", remainingCost: 0, unitsUsedForOperation: 0, inputs: {}, values: {}, artifactBodies: {}, signal: new AbortController().signal, deadlineAt: new Date(now.getTime() + 60000).toISOString() };
  return { config, request, handler, reference, resolveConnection };
}
it("uses real Gateway validation and dispatches a synthetic supported connection once", async () => {
  const t = setup(); const bridge = createRuntimeOperationBridge(t.config);
  const first = await bridge.invoke(t.request);
  expect(first.kind).toBe("receipt"); if (first.kind !== "receipt") throw Error("missing receipt");
  expect(first.receipt.status).toBe("succeeded"); expect(first.receipt.catalogReceiptDigest).toMatch(/^sha256:/);
  const second = await bridge.invoke(t.request); expect(second.kind === "receipt" && second.receipt.status).toBe("blocked");
  expect(t.handler).toHaveBeenCalledTimes(1);
});
it("will not bypass missing support evidence even if candidateVerification is supplied at runtime", async () => {
  const t = setup(false); const bridge = createRuntimeOperationBridge({ ...t.config, ...{ candidateVerification: { candidateBuildId, operationIds: [t.config.bindings[0].operationId] } } });
  const outcome = await bridge.invoke(t.request); expect(outcome.kind === "receipt" && outcome.receipt.status).toBe("blocked");
  expect(t.handler).not.toHaveBeenCalled(); expect(t.resolveConnection).not.toHaveBeenCalled();
});
it("checks resolved connection authority and never exposes its credential in the projection", async () => {
  const t = setup(); t.config.resolveConnection = vi.fn(async () => ({ ...resolution(t.reference), credential: "secret-only-test", state: "revoked" as const }));
  const outcome = await createRuntimeOperationBridge(t.config).invoke(t.request);
  expect(outcome.kind === "receipt" && outcome.receipt.status).toBe("blocked"); expect(t.handler).not.toHaveBeenCalled(); expect(JSON.stringify(outcome)).not.toContain("secret-only-test");
});
it("rechecks cancellation after asynchronous host input preparation", async () => {
  const t = setup(); const controller = new AbortController(); t.request.signal = controller.signal;
  t.config.bindings[0].input = async () => { controller.abort(); return { socialSetId: "test", content: "test" }; };
  await expect(createRuntimeOperationBridge(t.config).invoke(t.request)).rejects.toThrow();
  expect(t.handler).not.toHaveBeenCalled(); expect(t.resolveConnection).not.toHaveBeenCalled();
});
it("unknown runtime bindings produce handoffs without resolution", async () => {
  const t = setup(); t.request.operationId = "arbitrary.remote-method";
  expect(await createRuntimeOperationBridge(t.config).invoke(t.request)).toEqual({ kind: "handoff" }); expect(t.resolveConnection).not.toHaveBeenCalled();
});

it("will not map an observe runtime step to a draft operation", async () => {
  const t = setup(); t.request.actionClass = "observe";
  expect(await createRuntimeOperationBridge(t.config).invoke(t.request)).toEqual({ kind: "handoff" });
  expect(t.handler).not.toHaveBeenCalled();
});
it("consequential catalog operations stay handoffs even with an explicit binding", async () => {
  const t = setup();
  const consequential = t.config.catalog.operations.find((op) => op.provider === "typefully" && op.actionClass === "consequential")!;
  t.config.bindings[0].operationId = consequential.id;
  expect(await createRuntimeOperationBridge(t.config).invoke(t.request)).toEqual({ kind: "handoff" });
  expect(t.handler).not.toHaveBeenCalled(); expect(t.resolveConnection).not.toHaveBeenCalled();
});
it("caps host cost ceiling by runtime remaining cost and retains measured overage", async () => {
  const t = setup();
  t.handler.mockImplementation(async (request) => { expect(request.maxCost).toBe(0); return { ...result(request, { draftId: "test", status: "draft", previewUrl: "https://typefully.com/test" }), costUsed: 1 }; });
  const outcome = await createRuntimeOperationBridge(t.config).invoke(t.request);
  expect(outcome.kind).toBe("receipt"); if (outcome.kind !== "receipt") throw Error("receipt missing");
  expect(outcome.receipt).toMatchObject({ accepted: false, usageKnown: true, costUsed: 1 });
});
it("post-dispatch exception reports unknown cost instead of measured zero", async () => {
  const t = setup(); t.handler.mockImplementation(async () => { throw Error("synthetic interrupted provider"); });
  const outcome = await createRuntimeOperationBridge(t.config).invoke(t.request);
  expect(outcome.kind === "receipt" && outcome.receipt).toMatchObject({ accepted: false, usageKnown: false, costUsed: null, unitsUsed: null });
});
it("exhausted per-operation units block another dispatch", async () => {
  const t = setup(); t.request.unitsUsedForOperation = 1;
  const outcome = await createRuntimeOperationBridge(t.config).invoke(t.request);
  expect(outcome.kind).toBe("handoff"); expect(t.handler).not.toHaveBeenCalled();
});

it("refuses host paid ceiling above remaining run budget before resolution", async () => {
  const t = setup(); t.config.bindings[0].maxCost = 1;
  expect(await createRuntimeOperationBridge(t.config).invoke(t.request)).toEqual({ kind: "handoff" });
  expect(t.handler).not.toHaveBeenCalled(); expect(t.resolveConnection).not.toHaveBeenCalled();
});
