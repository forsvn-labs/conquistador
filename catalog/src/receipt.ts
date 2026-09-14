import type { CapabilityError, CapabilityResult, Receipt } from "./contracts.ts";
import { deepFreeze, sha256 } from "./canonical.ts";
import { invariant, requireSha256 } from "./validate.ts";

const SECRET_KEY = /(?:authorization|api[-_]?key|token|password|secret|cookie|credential)/i;
const SECRET_VALUE = /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|bearer\s+[A-Za-z0-9._-]{12,})/i;

export function sensitiveStrings(value: unknown): string[] {
  const found = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (entry: unknown): void => {
    if (typeof entry === "string" && entry.length > 0) {
      found.add(entry);
      return;
    }
    if (!entry || typeof entry !== "object" || seen.has(entry)) return;
    seen.add(entry);
    for (const child of Array.isArray(entry) ? entry : Object.values(entry as Record<string, unknown>)) {
      visit(child);
    }
  };
  visit(value);
  return [...found];
}

export function redact(value: unknown, sensitiveValues: readonly string[] = []): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry, sensitiveValues));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redact(child, sensitiveValues),
      ]),
    );
  }
  if (
    typeof value === "string" &&
    (SECRET_VALUE.test(value) || sensitiveValues.some((secret) => value.includes(secret)))
  ) return "[REDACTED]";
  return value;
}

export type ReceiptInput = Omit<Receipt, "receiptDigest" | "redactionApplied" | "terminalRecord"> & {
  safeResponse?: unknown;
};

export function createReceipt(input: ReceiptInput): Readonly<Receipt> {
  requireSha256(input.requestDigest, "receipt requestDigest");
  if (input.payloadDigest) requireSha256(input.payloadDigest, "receipt payloadDigest");
  const { safeResponse, ...base } = input;
  const redacted = safeResponse === undefined ? undefined : redact(safeResponse);
  const safeExcerpt = redacted === undefined ? base.safeExcerpt : JSON.stringify(redacted).slice(0, 2_000);
  const unredactedReceipt = {
    ...base,
    safeExcerpt,
    safeResponseDigest: redacted === undefined ? base.safeResponseDigest : sha256(redacted),
    redactionApplied: true as const,
    terminalRecord: true as const,
  };
  const receiptWithoutDigest = redact(unredactedReceipt) as Omit<Receipt, "receiptDigest">;
  const receipt = {
    ...receiptWithoutDigest,
    receiptDigest: sha256(receiptWithoutDigest),
  };
  invariant(!SECRET_VALUE.test(JSON.stringify(receipt)), "receipt contains credential-shaped content");
  verifyReceipt(receipt as Receipt);
  return deepFreeze(receipt);
}

export function verifyReceipt(receipt: Receipt): void {
  invariant(Boolean(receipt) && typeof receipt === "object" && !Array.isArray(receipt), "receipt must be an object");
  invariant(
    Object.keys(receipt).every((key) =>
      [
        "schemaVersion", "id", "candidateBuildId", "requestId", "proposalId", "manifestDigest", "approvalId",
        "runId", "reviewId", "capabilityId", "operationId", "adapterId", "adapterVersion", "provider",
        "connectionRef", "connectionRevision", "connectionEnvironment", "connectionPrincipal", "actionClass", "requestDigest", "payloadDigest", "destinationDigests", "startedAt",
        "finishedAt", "status", "providerStatus", "providerRequestId", "providerCorrelationId", "providerResourceId",
        "unitsUsed", "costUsed", "pagination", "sourceUrls", "safeResponseDigest", "safeExcerpt", "error",
        "retryCount", "idempotencyKey", "reversalGuidance", "redactionApplied", "terminalRecord", "receiptDigest",
      ].includes(key),
    ),
    "receipt includes undeclared fields",
  );
  invariant(receipt.schemaVersion === "conquistador.receipt/v1", "receipt schema is not v1");
  invariant(/^[0-9a-f]{64}$/.test(receipt.candidateBuildId), "receipt needs an exact Candidate Build ID");
  invariant(
    [receipt.id, receipt.requestId, receipt.capabilityId, receipt.operationId, receipt.provider].every(
      (value) => typeof value === "string" && value.trim().length > 0,
    ),
    "receipt identity fields are required",
  );
  requireSha256(receipt.receiptDigest, "receiptDigest");
  requireSha256(receipt.requestDigest, "requestDigest");
  if (receipt.payloadDigest) requireSha256(receipt.payloadDigest, "payloadDigest");
  if (receipt.manifestDigest) requireSha256(receipt.manifestDigest, "manifestDigest");
  if (receipt.safeResponseDigest) requireSha256(receipt.safeResponseDigest, "safeResponseDigest");
  invariant(Array.isArray(receipt.destinationDigests), "receipt destination digests must be an array");
  receipt.destinationDigests.forEach((digest, index) => requireSha256(digest, `destinationDigests[${index}]`));
  invariant(
    ["observe", "metered-observe", "draft", "consequential", "prohibited"].includes(receipt.actionClass),
    "receipt action class is invalid",
  );
  invariant(
    ["succeeded", "partial", "failed", "pending", "unknown", "rejected", "expired", "blocked"].includes(receipt.status),
    "receipt status is invalid",
  );
  invariant(
    receipt.providerStatus === undefined || ["succeeded", "partial", "pending", "unknown"].includes(receipt.providerStatus),
    "receipt provider status is invalid",
  );
  const startedAt = Date.parse(receipt.startedAt);
  const finishedAt = Date.parse(receipt.finishedAt);
  invariant(
    Number.isFinite(startedAt) &&
      Number.isFinite(finishedAt) &&
      new Date(startedAt).toISOString() === receipt.startedAt &&
      new Date(finishedAt).toISOString() === receipt.finishedAt &&
      startedAt <= finishedAt,
    "receipt timestamps must be exact and ordered",
  );
  invariant(Number.isFinite(receipt.unitsUsed) && receipt.unitsUsed >= 0, "receipt units must be finite and non-negative");
  invariant(Number.isFinite(receipt.costUsed) && receipt.costUsed >= 0, "receipt cost must be finite and non-negative");
  invariant(Number.isInteger(receipt.retryCount) && receipt.retryCount >= 0, "receipt retry count is invalid");
  const connectionSnapshot = [receipt.connectionRef, receipt.connectionRevision, receipt.connectionEnvironment, receipt.connectionPrincipal];
  invariant(connectionSnapshot.every((value) => value === undefined) || connectionSnapshot.every((value) => value !== undefined), "receipt connection snapshot must be wholly present or absent");
  if (receipt.connectionRef !== undefined) {
    invariant(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(receipt.connectionRef) && receipt.connectionRef.length >= 8 && receipt.connectionRef.length <= 128 && !receipt.connectionRef.includes("*"), "receipt connection reference is invalid");
    invariant(Number.isInteger(receipt.connectionRevision) && receipt.connectionRevision! > 0, "receipt connection revision is invalid");
    invariant(["sandbox", "production"].includes(receipt.connectionEnvironment!), "receipt connection environment is invalid");
    invariant(Boolean(receipt.connectionPrincipal) && typeof receipt.connectionPrincipal === "object" && !Array.isArray(receipt.connectionPrincipal), "receipt connection principal is invalid");
    invariant(Object.keys(receipt.connectionPrincipal!).every((key) => ["accountId", "workspaceId", "displayName"].includes(key)) && Object.keys(receipt.connectionPrincipal!).length === 3, "receipt connection principal is not closed");
    invariant([receipt.connectionPrincipal!.accountId, receipt.connectionPrincipal!.workspaceId, receipt.connectionPrincipal!.displayName].every((value) => typeof value === "string" && value.trim().length > 0 && !value.includes("*")), "receipt connection principal must be exact");
  }
  invariant(Array.isArray(receipt.sourceUrls), "receipt source URLs must be an array");
  invariant(
    receipt.sourceUrls.every((source) => {
      try {
        const parsed = new URL(source);
        return parsed.protocol === "https:" && !parsed.username && !parsed.password;
      } catch {
        return false;
      }
    }),
    "receipt source URL is unsafe",
  );
  if (receipt.status === "succeeded" && receipt.actionClass === "consequential") {
    invariant(Boolean(receipt.manifestDigest && receipt.approvalId), "successful consequential receipt needs approval evidence");
  }
  const { receiptDigest, ...body } = receipt;
  invariant(sha256(body) === receiptDigest, "receipt digest mismatch");
  invariant(receipt.redactionApplied === true && receipt.terminalRecord === true, "receipt must be redacted and terminal");
  invariant(!SECRET_VALUE.test(JSON.stringify(receipt)), "receipt contains credential-shaped content");
}

export class ReceiptStore {
  readonly #records = new Map<string, Readonly<Receipt>>();

  append(receipt: Readonly<Receipt>): void {
    verifyReceipt(receipt as Receipt);
    invariant(!this.#records.has(receipt.id), `receipt ${receipt.id} already exists`);
    this.#records.set(receipt.id, receipt);
  }

  get(id: string): Readonly<Receipt> | undefined {
    return this.#records.get(id);
  }

  list(): ReadonlyArray<Readonly<Receipt>> {
    return deepFreeze([...this.#records.values()]);
  }
}

export function mapProviderStatus(result?: CapabilityResult, error?: CapabilityError): Receipt["status"] {
  if (error) return error.code === "provider-failure" ? "failed" : "blocked";
  if (!result) return "unknown";
  return result.providerStatus;
}
