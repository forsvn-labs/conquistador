import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { invokeDurableOperation, type OperationBridge, type OperationBridgeRequest, type OperationTerminalReceipt } from "../src/operation-bridge.ts";
import { defaultOperationCatalog } from "../src/operations.ts";
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function setup(bridge: OperationBridge) {
  const directory = mkdtempSync(join(tmpdir(), "operation-bridge-")); roots.push(directory);
  const request: Omit<OperationBridgeRequest, "idempotencyKey" | "actionClass"> = { operationId: "signals.pull-bounded", runId: "test-run", stepId: "test-step", remainingCost: 0, unitsUsedForOperation: 0, inputs: {}, values: {}, artifactBodies: {}, signal: new AbortController().signal, deadlineAt: new Date(Date.now() + 60000).toISOString() };
  return { bridge, directory, request, catalog: defaultOperationCatalog() };
}
const receipt: OperationTerminalReceipt = { schemaVersion: "conquistador.operation-terminal-receipt/v1", catalogReceiptDigest: `sha256:${"a".repeat(64)}`, requestDigest: `sha256:${"b".repeat(64)}`, terminalRecord: true, usageKnown: true, accepted: true, unitsUsed: 1, costUsed: 0, status: "succeeded", data: { testOnly: true } };
it("persists intent before host preparation and never repeats a completed dispatch after restart", async () => {
  let calls = 0;
  const input = setup({ invoke: async () => {
    calls++;
    const files = readdirSync(join(input.directory, "operation-dispatch"));
    expect(readFileSync(join(input.directory, "operation-dispatch", files[0]), "utf8")).toContain("dispatch-intent");
    return { kind: "receipt", receipt };
  } });
  expect((await invokeDurableOperation(input)).kind).toBe("gateway-receipt");
  const restarted = { ...input, bridge: { invoke: async () => { throw Error("must not dispatch"); } } };
  expect((await invokeDurableOperation(restarted)).kind).toBe("gateway-receipt"); expect(calls).toBe(1);
  await expect(invokeDurableOperation({ ...restarted, request: { ...input.request, inputs: { changed: true } } })).rejects.toThrow("reconciliation");
});
it("leaves ambiguous dispatch reserved and blocks retry after a simulated host interruption", async () => {
  let calls = 0; const input = setup({ invoke: async () => { calls++; throw Error("test-only interrupted host"); } });
  await expect(invokeDurableOperation(input)).rejects.toThrow("reconciliation");
  await expect(invokeDurableOperation(input)).rejects.toThrow("reconciliation"); expect(calls).toBe(1);
});
it("never dispatches consequential operations or pre-cancelled requests", async () => {
  let calls = 0; const input = setup({ invoke: async () => { calls++; return { kind: "handoff" }; } });
  input.catalog = structuredClone(input.catalog); input.catalog.records[0].actionClass = "consequential";
  expect((await invokeDurableOperation(input)).kind).toBe("human-action-manifest");
  input.catalog.records[0].actionClass = "observe"; input.request.signal = AbortSignal.abort();
  await expect(invokeDurableOperation(input)).rejects.toThrow(); expect(calls).toBe(0);
});
it("retains pending receipts but refuses automatic replay", async () => {
  let calls = 0; const input = setup({ invoke: async () => { calls++; return { kind: "receipt", receipt: { ...receipt, status: "pending" } }; } });
  await expect(invokeDurableOperation(input)).rejects.toThrow("reconciliation");
  await expect(invokeDurableOperation(input)).rejects.toThrow("reconciliation"); expect(calls).toBe(1);
});
it("runner persists projected receipt and binds it to the output envelope", async () => {
  const { startPlaybookRun } = await import("../src/runner.ts");
  const playbook = JSON.parse(readFileSync(new URL("../fixtures/playbooks/content-intelligence-loop.json", import.meta.url), "utf8"));
  const root = mkdtempSync(join(tmpdir(), "bridge-runner-")); roots.push(root); let calls = 0;
  const snapshot = await startPlaybookRun({ playbook, runsDir: root, inputs: { product: "P", audience: "A", channel: "C", goals: "G" }, operationBridge: { invoke: async () => { calls++; return { kind: "receipt", receipt }; } } });
  expect(calls).toBe(1); expect(snapshot.status).toBe("awaiting-judgment");
  const artifacts = readdirSync(join(snapshot.directory, "artifacts"));
  const bodies = artifacts.map((path) => readFileSync(join(snapshot.directory, "artifacts", path), "utf8")).join("\n");
  expect(bodies).toContain(receipt.catalogReceiptDigest);
  expect(bodies).toContain("catalogReceiptDigest");
});
it("runner pauses unresolved dispatch and still refuses it after resume", async () => {
  const { startPlaybookRun, resumePlaybookRun } = await import("../src/runner.ts");
  const playbook = JSON.parse(readFileSync(new URL("../fixtures/playbooks/content-intelligence-loop.json", import.meta.url), "utf8"));
  const root = mkdtempSync(join(tmpdir(), "bridge-runner-")); roots.push(root); let calls = 0;
  const operationBridge: OperationBridge = { invoke: async () => { calls++; throw Error("test interruption"); } };
  const snapshot = await startPlaybookRun({ playbook, runsDir: root, inputs: { product: "P", audience: "A", channel: "C", goals: "G" }, operationBridge });
  expect(snapshot.status).toBe("awaiting-operation-reconciliation");
  const resumed = await resumePlaybookRun({ runsDir: root, runId: snapshot.runId });
  expect(resumed.status).toBe("awaiting-operation-reconciliation"); expect(calls).toBe(1);
});
it("runner charges a measured overage once and never re-dispatches it", async () => {
  const { startPlaybookRun, resumePlaybookRun } = await import("../src/runner.ts");
  const playbook = JSON.parse(readFileSync(new URL("../fixtures/playbooks/content-intelligence-loop.json", import.meta.url), "utf8"));
  const root = mkdtempSync(join(tmpdir(), "bridge-cost-")); roots.push(root); let calls = 0;
  const operationBridge: OperationBridge = { invoke: async (request) => { calls++; expect(request.remainingCost).toBe(0); return { kind: "receipt", receipt: { ...receipt, accepted: false, costUsed: 1 } }; } };
  const snapshot = await startPlaybookRun({ playbook, runsDir: root, inputs: { product: "P", audience: "A", channel: "C", goals: "G" }, operationBridge });
  expect(snapshot.status).toBe("failed"); expect(snapshot.state.cost).toBe(1);
  // Simulate the durable cut after accounting, before marking the step failed/completed.
  const accounted = structuredClone(snapshot.state); accounted.status = "running";
  const chargedStep = Object.keys(accounted.operationUsage!)[0]; accounted.steps[chargedStep].status = "running";
  writeFileSync(join(snapshot.directory, "state.json"), JSON.stringify(accounted));
  const resumed = await resumePlaybookRun({ runsDir: root, runId: snapshot.runId, operationBridge });
  expect(resumed.status).toBe("failed"); expect(resumed.state.cost).toBe(1); expect(calls).toBe(1);
});
it("runner pauses and marks unknown cost after an ambiguous provider result", async () => {
  const { startPlaybookRun } = await import("../src/runner.ts");
  const playbook = JSON.parse(readFileSync(new URL("../fixtures/playbooks/content-intelligence-loop.json", import.meta.url), "utf8"));
  const root = mkdtempSync(join(tmpdir(), "bridge-cost-")); roots.push(root);
  const snapshot = await startPlaybookRun({ playbook, runsDir: root, inputs: { product: "P", audience: "A", channel: "C", goals: "G" }, operationBridge: { invoke: async () => ({ kind: "receipt", receipt: { ...receipt, status: "failed", accepted: false, usageKnown: false, unitsUsed: null, costUsed: null } }) } });
  expect(snapshot.status).toBe("awaiting-operation-reconciliation"); expect(snapshot.state.costStatus).toBe("incomplete");
});
it.each([[0.4000001, 599999], [1, 0]])("judgment reserves remaining cost after operation charge %s", async (costUsed, maximumChargeMicros) => {
  const { startPlaybookRun, resumePlaybookRun } = await import("../src/runner.ts");
  const playbook = JSON.parse(readFileSync(new URL("../fixtures/playbooks/content-intelligence-loop.json", import.meta.url), "utf8"));
  playbook.budgets.maximumCostPerRun = 1;
  const root = mkdtempSync(join(tmpdir(), "mixed-cost-")); roots.push(root);
  const snapshot = await startPlaybookRun({ playbook, runsDir: root, inputs: { product: "P", audience: "A", channel: "C", goals: "G" }, operationBridge: { invoke: async () => ({ kind: "receipt", receipt: { ...receipt, costUsed } }) } });
  expect(snapshot.status).toBe("awaiting-judgment");
  const pending = Object.values(snapshot.state.judgments!)[0];
  const request = JSON.parse(readFileSync(join(snapshot.directory, pending.requestPath), "utf8"));
  expect(request.budget.maximumChargeMicros).toBe(maximumChargeMicros);
  const incomplete = structuredClone(snapshot.state); incomplete.costStatus = "incomplete";
  writeFileSync(join(snapshot.directory, "state.json"), JSON.stringify(incomplete));
  await expect(resumePlaybookRun({ runsDir: root, runId: snapshot.runId })).rejects.toThrow("reconciled run cost");
});
