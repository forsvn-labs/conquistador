import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  AdapterManifest,
  CapabilityRequest,
  CapabilityResult,
  Catalog,
  ConnectionReference,
  HumanApproval,
  HostConnectionResolution,
  OperationContract,
  Sha256,
  SupportEvidence,
} from "../src/contracts.ts";

export const root = resolve(import.meta.dirname, "..");
export const candidateBuildId = "c".repeat(64);
export const sha = (character: string): Sha256 => `sha256:${character.repeat(64)}` as Sha256;
export const now = new Date("2026-08-11T00:00:00.000Z");

export function catalog(): Catalog {
  return JSON.parse(readFileSync(resolve(root, "operations/v1.json"), "utf8")) as Catalog;
}

export function operation(id: string): OperationContract {
  const value = catalog().operations.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing test operation ${id}`);
  return value;
}

export function supportedCatalog(operationIds: string[]): Catalog {
  const value = catalog();
  value.status = "candidate-bound";
  for (const item of value.operations) {
    if (!operationIds.includes(item.id)) continue;
    item.supportCells = [
      {
        id: `${item.id}.test-cell`,
        platform: "darwin",
        architecture: "arm64",
        state: "supported",
        evidence: [
          evidence("research", item, "0"),
          evidence("fixture", item, "f"),
          evidence("live", item, "1"),
          evidence("release-matrix", item, "2"),
        ],
      },
    ];
  }
  return value;
}

export function evidence(
  kind: SupportEvidence["kind"],
  item: OperationContract,
  digit: string,
): SupportEvidence {
  return {
    id: `${item.id}.${kind}`,
    kind,
    ...(kind === "live" ? { candidateBuildId, terminalReceiptId: `${item.id}.receipt` } : {}),
    providerVersion: item.providerApiVersion,
    adapterVersion: "1.0.0",
    checkedAt: "2026-08-10T00:00:00.000Z",
    digest: sha(digit),
  };
}

export function manifest(provider: string, operationIds: string[], value = catalog()): AdapterManifest {
  const operations = value.operations.filter((item) => operationIds.includes(item.id));
  return {
    schemaVersion: "conquistador.adapter-manifest/v1",
    id: `${provider}.adapter`,
    provider,
    version: "1.0.0",
    sdkVersion: "1.0.0",
    operationIds,
    capabilityIds: [...new Set(operations.map((item) => item.capabilityId))],
    credentialInjection: "host-only",
    transport: "audited-adapter-only",
  };
}

export function connection(provider: string, scopes: string[]): ConnectionReference {
  const allowedOperationIds = catalog().operations
    .filter((item) => item.provider === provider && item.actionClass !== "prohibited" && JSON.stringify([...item.authScopes].sort()) === JSON.stringify([...scopes].sort()))
    .map((item) => item.id);
  return {
    schemaVersion: "conquistador.connection-reference/v1",
    id: `${provider}.primary`,
    provider,
    principal: { accountId: "account-1", workspaceId: "workspace-1", displayName: "Test account" },
    allowedOperationIds,
    scopes,
    environment: "sandbox",
    usage: "ephemeral-test",
    revision: 1,
    state: "active",
    verifiedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2026-08-12T00:00:00.000Z",
    storagePolicy: {
      referenceMetadata: "conquistador-local",
      secretStorage: "host-secure-store-only",
      export: "forbidden",
      recovery: "reauthenticate-only",
    },
  };
}

export function resolution(reference: ConnectionReference, credential: unknown = "synthetic-test-material"): HostConnectionResolution {
  return {
    schemaVersion: "conquistador.host-connection-resolution/v1",
    connectionRef: reference.id,
    provider: reference.provider,
    principal: structuredClone(reference.principal),
    allowedOperationIds: [...reference.allowedOperationIds],
    scopes: [...reference.scopes],
    environment: reference.environment,
    usage: reference.usage,
    revision: reference.revision,
    state: reference.state,
    resolvedAt: now.toISOString(),
    credential,
  };
}

export function request(item: OperationContract, input: Record<string, unknown>): CapabilityRequest {
  return {
    schemaVersion: "conquistador.capability-request/v1",
    id: `request.${item.id.replaceAll(".", "-")}`,
    candidateBuildId,
    capabilityId: item.capabilityId,
    operationId: item.id,
    connectionRef: `${item.provider}.primary`,
    expectedPrincipal: { accountId: "account-1", workspaceId: "workspace-1", displayName: "Test account" },
    connectionEnvironment: "sandbox",
    connectionRevision: 1,
    input,
    deadlineAt: "2026-08-12T00:00:00.000Z",
    ...(item.idempotency === "required" ? { idempotencyKey: `idempotency.${item.id}` } : {}),
    ...(["metered-observe", "draft", "consequential"].includes(item.actionClass)
      ? { maxUnits: item.maximumUnitsPerRun ?? 1, maxCost: item.maximumCostPerRun ?? 0 }
      : {}),
  };
}

export function result(
  requestValue: CapabilityRequest,
  data: Record<string, unknown>,
): CapabilityResult {
  return {
    schemaVersion: "conquistador.capability-result/v1",
    requestId: requestValue.id,
    operationId: requestValue.operationId,
    providerRequestId: "provider-request-1",
    providerCorrelationId: "correlation-1",
    data,
    sourceUrls: ["https://example.com/source"],
    freshnessAt: "2026-08-11T00:00:00.000Z",
    pagination: { complete: true, truncated: false },
    unitsUsed: 1,
    costUsed: 0,
    providerStatus: "succeeded",
  };
}

export function approval(manifestDigest: Sha256): HumanApproval {
  return {
    schemaVersion: "conquistador.human-approval/v1",
    id: "approval-1",
    manifestDigest,
    approverId: "human-operator-1",
    authenticationMethod: "webauthn",
    authenticatedHuman: true,
    approvedAt: "2026-08-11T00:00:00.000Z",
    expiresAt: "2026-08-11T01:00:00.000Z",
    singleUse: true,
  };
}
