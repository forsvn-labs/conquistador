import { describe, expect, it } from "vitest";

import { defineAdapter } from "../src/adapter.ts";
import { createToolCandidate } from "../src/candidate.ts";
import { createLiveEvidence, createLiveVerificationGateway } from "../src/live.ts";
import type { CapabilityRequest } from "../src/contracts.ts";
import {
  catalog,
  connection,
  manifest,
  operation,
  request,
  resolution,
  result,
} from "./helpers.ts";

function candidateFor(item: ReturnType<typeof operation>) {
  return createToolCandidate({
    schemaVersion: "conquistador.tool-candidate/v1",
    productVersion: "1.0.0",
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    catalogDigest: `sha256:${"c".repeat(64)}`,
    moduleSourceDigest: `sha256:${"d".repeat(64)}`,
    fixtureDigest: `sha256:${"e".repeat(64)}`,
    adapterVersion: "1.0.0",
    operations: [{ id: item.id, provider: item.provider, providerApiVersion: item.providerApiVersion }],
  });
}

describe("candidate-bound live evidence", () => {
  it("executes only through an exact fixture-proved verification gateway", async () => {
    const value = catalog();
    const item = operation("github.repository.get");
    const handler = async (requestValue: CapabilityRequest) =>
      result(requestValue, { repository: {}, visibility: "private", topics: [], timestamps: {} });
    const adapter = defineAdapter(manifest("github", [item.id], value), { [item.id]: handler }, value);
    const reference = connection("github", item.authScopes);
    const candidate = candidateFor(item);
    const gateway = createLiveVerificationGateway({
      candidate,
      operationIds: [item.id],
      catalog: value,
      adapters: { [adapter.manifest.id]: adapter },
      connections: { [reference.id]: reference },
      resolveConnection: async () => resolution(reference, "synthetic-live-test-material"),
      now: () => new Date("2026-08-11T00:00:00.000Z"),
    });
    const requestValue = request(item, { owner: "a", repository: "b" });
    requestValue.candidateBuildId = candidate.candidateBuildId;
    const outcome = await gateway.execute(requestValue);
    expect(outcome.ok).toBe(true);
    const evidence = createLiveEvidence(candidate, item, adapter.manifest, outcome.receipt, "2026-08-11T00:01:00.000Z");
    expect(evidence).toMatchObject({
      kind: "live",
      candidateBuildId: candidate.candidateBuildId,
      providerVersion: item.providerApiVersion,
      adapterVersion: "1.0.0",
      terminalReceiptId: outcome.receipt.id,
    });
  });

  it("rejects pending, mismatched, failed, and unapproved consequential receipts", () => {
    const item = operation("typefully.post.publish");
    const adapterManifest = manifest("typefully", [item.id], catalog());
    const candidate = candidateFor(item);
    const receipt = {
      schemaVersion: "conquistador.receipt/v1" as const,
      id: "receipt-1",
      candidateBuildId: candidate.candidateBuildId,
      requestId: "request-1",
      capabilityId: item.capabilityId,
      operationId: item.id,
      adapterId: adapterManifest.id,
      adapterVersion: adapterManifest.version,
      provider: item.provider,
      actionClass: item.actionClass,
      requestDigest: "sha256:" + "a".repeat(64) as `sha256:${string}`,
      destinationDigests: [],
      startedAt: "2026-08-11T00:00:00.000Z",
      finishedAt: "2026-08-11T00:00:01.000Z",
      status: "pending" as const,
      unitsUsed: 1,
      costUsed: 0,
      sourceUrls: ["https://api.typefully.com/v2/social-sets/1/drafts/2"],
      retryCount: 0,
      redactionApplied: true as const,
      terminalRecord: true as const,
      receiptDigest: `sha256:${"b".repeat(64)}` as const,
    };
    expect(() => createLiveEvidence(candidate, item, adapterManifest, receipt, "2026-08-11T00:01:00.000Z")).toThrow(/succeeded terminal receipt/);
    expect(() => createLiveEvidence(candidate, item, adapterManifest, { ...receipt, status: "succeeded" }, "2026-08-11T00:01:00.000Z")).toThrow(/authenticated approval/);
    expect(() => createLiveEvidence(candidate, item, adapterManifest, {
      ...receipt,
      status: "succeeded",
      approvalId: "approval-1",
      manifestDigest: `sha256:${"c".repeat(64)}`,
      payloadDigest: `sha256:${"d".repeat(64)}`,
      adapterVersion: "9.9.9",
    }, "2026-08-11T00:01:00.000Z")).toThrow(/exact adapter/);

    expect(() => createLiveVerificationGateway({
      candidate: { ...candidate, candidateBuildId: "f".repeat(64) },
      operationIds: [item.id],
      catalog: catalog(),
      adapters: {},
      connections: {},
      resolveConnection: async () => { throw new Error("unused"); },
    })).toThrow(/build ID differs/);
  });
});
