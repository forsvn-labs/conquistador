import { describe, expect, it } from "vitest";

import { sha256 } from "../src/canonical.ts";
import { createReceipt, ReceiptStore, verifyReceipt } from "../src/receipt.ts";
import { candidateBuildId, sha } from "./helpers.ts";

const secretFixture = ["s", "k-super-secret-value-that-must-never-appear"].join("");
const bearerFixture = ["Bearer ", "secret-value"].join("");

function receipt() {
  return createReceipt({
    schemaVersion: "conquistador.receipt/v1",
    id: "receipt-1",
    candidateBuildId,
    requestId: "request-1",
    capabilityId: "source.repository.read",
    operationId: "github.repository.get",
    provider: "github",
    actionClass: "observe",
    requestDigest: sha("1"),
    payloadDigest: sha("2"),
    destinationDigests: [],
    startedAt: "2026-08-11T00:00:00.000Z",
    finishedAt: "2026-08-11T00:00:01.000Z",
    status: "succeeded",
    unitsUsed: 1,
    costUsed: 0,
    sourceUrls: [],
    retryCount: 0,
    safeResponse: {
      result: "ok",
      apiKey: secretFixture,
      nested: { authorization: bearerFixture },
    },
  });
}

describe("immutable redacted receipts", () => {
  it("redacts, hashes, freezes, and independently verifies", () => {
    const value = receipt();
    expect(value.safeExcerpt).toContain("[REDACTED]");
    expect(JSON.stringify(value)).not.toContain("super-secret");
    expect(Object.isFrozen(value)).toBe(true);
    expect(() => verifyReceipt(value as any)).not.toThrow();
  });

  it("rejects mutation and append-overwrite", () => {
    const value = receipt();
    const changed = structuredClone(value) as any;
    changed.status = "failed";
    expect(() => verifyReceipt(changed)).toThrow(/digest mismatch/);
    const store = new ReceiptStore();
    store.append(value);
    expect(() => store.append(value)).toThrow(/already exists/);
    expect(store.list()).toHaveLength(1);
  });

  it("rejects a semantically invalid receipt even when its digest is recomputed", () => {
    const changed = structuredClone(receipt()) as any;
    changed.status = "invented";
    const { receiptDigest: _oldDigest, ...body } = changed;
    changed.receiptDigest = sha256(body);
    expect(() => verifyReceipt(changed)).toThrow(/status is invalid/);
  });

  it("requires a complete and exact selected-connection snapshot", () => {
    const selected = createReceipt({
      schemaVersion: "conquistador.receipt/v1", id: "receipt-selected", candidateBuildId,
      requestId: "request-selected", capabilityId: "source.repository.read", operationId: "github.repository.get",
      provider: "github", connectionRef: "github.primary", connectionRevision: 1, connectionEnvironment: "sandbox",
      connectionPrincipal: { accountId: "account-1", workspaceId: "workspace-1", displayName: "Test account" },
      actionClass: "observe", requestDigest: sha("1"), destinationDigests: [],
      startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:00:01.000Z",
      status: "succeeded", unitsUsed: 0, costUsed: 0, sourceUrls: [], retryCount: 0,
    });
    expect(() => verifyReceipt(selected as any)).not.toThrow();
    const invalid: Array<(value: any) => void> = [
      (value) => { delete value.connectionRevision; },
      (value) => { value.connectionRef = "*"; },
      (value) => { value.connectionRevision = 0; },
      (value) => { value.connectionEnvironment = "staging"; },
      (value) => { value.connectionPrincipal.accountId = ""; },
      (value) => { value.connectionPrincipal.workspaceId = "*"; },
      (value) => { delete value.connectionPrincipal.displayName; },
      (value) => { value.connectionPrincipal.extra = "undeclared"; },
    ];
    for (const mutate of invalid) {
      const changed: any = structuredClone(selected);
      mutate(changed);
      const { receiptDigest: _old, ...body } = changed;
      changed.receiptDigest = sha256(body);
      expect(() => verifyReceipt(changed)).toThrow();
    }
  });
});
