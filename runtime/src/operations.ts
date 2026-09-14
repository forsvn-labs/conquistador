import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { deepFreeze } from "./canonical.ts";

export const OPERATION_VERIFICATION_STATUSES = [
  "unknown",
  "cataloged",
  "researched",
  "fixture-verified",
  "live-verified",
  "supported",
  "unsupported",
  "unverified",
] as const;

export type OperationVerificationStatus = (typeof OPERATION_VERIFICATION_STATUSES)[number];

export type OperationActionClass = "observe" | "draft" | "consequential";

export type VerifiedOperation = {
  id: string;
  provider: string;
  capabilityId: string;
  verificationStatus: OperationVerificationStatus;
  actionClass: OperationActionClass;
};

export type OperationCatalog = {
  schemaVersion: "conquistador.verified-operations/v1";
  records: VerifiedOperation[];
};

export type HumanActionManifestReason = "unsupported" | "unverified" | "unknown-operation";

export type HumanActionManifest = {
  schemaVersion: "conquistador.artifact.human-action-manifest/v1";
  operationId: string;
  provider: string;
  capabilityId: string;
  verificationStatus: OperationVerificationStatus;
  executed: false;
  liveCall: false;
  credentialsUsed: false;
  fallback: "human-action-manifest";
  reason: HumanActionManifestReason;
  summary: string;
  [extra: string]: unknown;
};

export type RecordedOperationStub = {
  schemaVersion: "conquistador.artifact.provider-draft-stub/v1";
  operationId: string;
  provider: string;
  capabilityId: string;
  verificationStatus: OperationVerificationStatus;
  stubbed: true;
  executed: false;
  liveCall: false;
  credentialsUsed: false;
  summary: string;
  [extra: string]: unknown;
};

export type OperationInvocation = {
  operationId: string;
  catalog: OperationCatalog;
  runId: string;
  stepId: string;
  summary?: string;
  extra?: Record<string, unknown>;
};

export type OperationResult =
  | { kind: "gateway-receipt"; operation: VerifiedOperation; receipt: import("./operation-bridge.ts").OperationTerminalReceipt }
  | {
      kind: "human-action-manifest";
      operation: VerifiedOperation;
      executed: false;
      liveCall: false;
      credentialsUsed: false;
      manifest: HumanActionManifest;
    }
  | {
      kind: "recorded-stub";
      operation: VerifiedOperation;
      executed: false;
      liveCall: false;
      credentialsUsed: false;
      stub: RecordedOperationStub;
    };

const PREFIX = "conquistador.operations";
const DEFAULT_CATALOG_PATH = resolve(import.meta.dirname, "../fixtures/operations/v1.json");
const OPERATION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const CAPABILITY_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const OPERATION_KEYS = ["id", "provider", "capabilityId", "verificationStatus", "actionClass"];
const MANIFEST_STATUSES = new Set<OperationVerificationStatus>(["unknown", "unverified", "unsupported"]);

function fail(message: string): never {
  throw new Error(`[${PREFIX}] ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: object, allowed: string[], label: string): void {
  const keys = Object.keys(value);
  if (!keys.every((key) => allowed.includes(key))) fail(`${label} contains an undeclared field`);
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) fail(`${label} is required`);
}

export function validateVerifiedOperation(value: unknown): asserts value is VerifiedOperation {
  if (!isObject(value)) fail("operation must be an object");
  exactKeys(value, OPERATION_KEYS, "operation");
  if (typeof value.id !== "string" || !OPERATION_ID.test(value.id)) fail("operation.id is invalid");
  nonEmpty(value.provider, "operation.provider");
  if (typeof value.capabilityId !== "string" || !CAPABILITY_ID.test(value.capabilityId)) {
    fail("operation.capabilityId is invalid");
  }
  if (!OPERATION_VERIFICATION_STATUSES.includes(value.verificationStatus as OperationVerificationStatus)) {
    fail("operation.verificationStatus is invalid");
  }
  if (!["observe", "draft", "consequential"].includes(value.actionClass as string)) {
    fail("operation.actionClass is invalid");
  }
}

export function validateOperationCatalog(value: unknown): asserts value is OperationCatalog {
  if (!isObject(value)) fail("operation catalog must be an object");
  exactKeys(value, ["schemaVersion", "records"], "operation catalog");
  if (value.schemaVersion !== "conquistador.verified-operations/v1") {
    fail("schemaVersion must be conquistador.verified-operations/v1");
  }
  if (!Array.isArray(value.records) || value.records.length === 0) fail("records are required");
  const ids: string[] = [];
  for (const record of value.records) {
    validateVerifiedOperation(record);
    ids.push(record.id);
  }
  if (new Set(ids).size !== ids.length) fail("operation ids must be unique");
}

export function loadOperationCatalog(path = DEFAULT_CATALOG_PATH): OperationCatalog {
  const catalog = JSON.parse(readFileSync(path, "utf8")) as unknown;
  validateOperationCatalog(catalog);
  return deepFreeze(structuredClone(catalog)) as OperationCatalog;
}

export function resolveOperation(operationId: string, catalog: OperationCatalog): VerifiedOperation {
  validateOperationCatalog(catalog);
  const found = catalog.records.find((record) => record.id === operationId);
  if (found) return found;
  return {
    id: operationId,
    provider: "unknown",
    capabilityId: "unknown.operation",
    verificationStatus: "unsupported",
    actionClass: "observe",
  };
}

function manifestReason(operation: VerifiedOperation, known: boolean): HumanActionManifestReason {
  if (!known) return "unknown-operation";
  if (operation.verificationStatus === "unsupported") return "unsupported";
  return "unverified";
}

export function buildHumanActionManifest(input: {
  operation: VerifiedOperation;
  known: boolean;
  summary: string;
  extra?: Record<string, unknown>;
}): HumanActionManifest {
  const manifest: HumanActionManifest = {
    ...input.extra,
    schemaVersion: "conquistador.artifact.human-action-manifest/v1",
    operationId: input.operation.id,
    provider: input.operation.provider,
    capabilityId: input.operation.capabilityId,
    verificationStatus: input.operation.verificationStatus,
    executed: false,
    liveCall: false,
    credentialsUsed: false,
    fallback: "human-action-manifest",
    reason: manifestReason(input.operation, input.known),
    summary: input.summary,
  };
  if (manifest.executed !== false || manifest.liveCall !== false || manifest.credentialsUsed !== false) {
    fail("a human action manifest cannot claim execution");
  }
  return manifest;
}

export function renderManifestMarkdown(manifest: HumanActionManifest): string {
  const extraLines = Object.entries(manifest)
    .filter(([key]) =>
      ![
        "schemaVersion",
        "operationId",
        "provider",
        "capabilityId",
        "verificationStatus",
        "executed",
        "liveCall",
        "credentialsUsed",
        "fallback",
        "reason",
        "summary",
      ].includes(key),
    )
    .filter(([, value]) => typeof value === "string" || typeof value === "boolean" || typeof value === "number")
    .map(([key, value]) => `${key}: ${String(value)}`);
  return [
    "# Human action manifest",
    "",
    `Operation: \`${manifest.operationId}\``,
    `Provider: ${manifest.provider}`,
    `Capability: ${manifest.capabilityId}`,
    `Verification: ${manifest.verificationStatus}`,
    `Reason: ${manifest.reason}`,
    "Executed: no",
    "Live call: no",
    "Credentials used: no",
    "",
    manifest.summary,
    "",
    "The runner does not perform external actions. Exact human approval is required before any draft, publish, spend, or account change.",
    ...(extraLines.length ? ["", ...extraLines] : []),
  ].join("\n");
}

export function renderStubMarkdown(stub: RecordedOperationStub): string {
  return [
    "# Provider draft stub",
    "",
    `Operation: \`${stub.operationId}\``,
    `Provider: ${stub.provider}`,
    `Capability: ${stub.capabilityId}`,
    `Verification: ${stub.verificationStatus}`,
    "Stubbed: yes",
    "Executed: no",
    "Live call: no",
    "Credentials used: no",
    "",
    stub.summary,
    "",
    "This ticket has no live credentials. The would-be provider call is recorded and was not executed.",
  ].join("\n");
}

export function invokeVerifiedOperation(input: OperationInvocation): OperationResult {
  validateOperationCatalog(input.catalog);
  if (!OPERATION_ID.test(input.operationId)) fail("operationId is invalid");
  const known = input.catalog.records.some((record) => record.id === input.operationId);
  const operation = resolveOperation(input.operationId, input.catalog);
  const summary = input.summary
    ?? (known
      ? `Recorded invocation of ${operation.id} through the verified-operation interface.`
      : `Unknown operation ${input.operationId} cannot execute.`);
  if (!known || MANIFEST_STATUSES.has(operation.verificationStatus)) {
    return {
      kind: "human-action-manifest",
      operation,
      executed: false,
      liveCall: false,
      credentialsUsed: false,
      manifest: buildHumanActionManifest({ operation, known, summary, extra: input.extra }),
    };
  }
  const stub: RecordedOperationStub = {
    ...input.extra,
    schemaVersion: "conquistador.artifact.provider-draft-stub/v1",
    operationId: operation.id,
    provider: operation.provider,
    capabilityId: operation.capabilityId,
    verificationStatus: operation.verificationStatus,
    stubbed: true,
    executed: false,
    liveCall: false,
    credentialsUsed: false,
    summary,
  };
  return {
    kind: "recorded-stub",
    operation,
    executed: false,
    liveCall: false,
    credentialsUsed: false,
    stub,
  };
}

export function defaultOperationCatalog(): OperationCatalog {
  return loadOperationCatalog();
}
