import type {
  AdapterManifest,
  CapabilityRequest,
  Catalog,
  ConnectionReference,
  ExtensionCatalogReference,
  ExtensionManifest,
  ExtensionOperation,
  OperationContract,
  ObjectSchema,
  Sha256,
  SupportCell,
  SupportEvidence,
} from "./contracts.ts";

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const FORBIDDEN_INPUT_KEYS = new Set([
  "url",
  "method",
  "command",
  "shell",
  "mcp",
  "endpoint",
  "headers",
  "authorization",
  "credential",
  "token",
  "password",
  "secret",
]);
const SECRET_VALUE = /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|bearer\s+[A-Za-z0-9._-]{12,})/i;
const CREDENTIAL_KEY = /(?:authorization|credential|password|secret|token|api[-_]?key)/i;

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[tool-catalog] ${message}`);
}

export function requireSha256(value: unknown, label: string): asserts value is Sha256 {
  invariant(typeof value === "string" && SHA256.test(value), `${label} must be sha256:<64 lowercase hex>`);
}

function exactUtc(value: unknown, label: string): void {
  invariant(
    typeof value === "string" &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString() === value,
    `${label} must be an exact UTC ISO timestamp`,
  );
}

function unique(values: string[], label: string): void {
  invariant(new Set(values).size === values.length, `${label} must be unique`);
}

function sameStringSet(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function samePrincipal(left: ConnectionReference["principal"], right: ConnectionReference["principal"]): boolean {
  return left.accountId === right.accountId && left.workspaceId === right.workspaceId && left.displayName === right.displayName;
}

function sameStoragePolicy(left: ConnectionReference["storagePolicy"], right: ConnectionReference["storagePolicy"]): boolean {
  return left.referenceMetadata === right.referenceMetadata && left.secretStorage === right.secretStorage && left.export === right.export && left.recovery === right.recovery;
}

function exactKeys(value: object, allowed: string[], label: string): void {
  invariant(
    Object.keys(value).every((key) => allowed.includes(key)),
    `${label} includes undeclared fields`,
  );
}

function hasForbiddenInput(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenInput);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, child]) => FORBIDDEN_INPUT_KEYS.has(key.toLowerCase()) || hasForbiddenInput(child),
    );
  }
  return typeof value === "string" && SECRET_VALUE.test(value);
}

function hasCredentialMetadata(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasCredentialMetadata);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, child]) => (!["credentialCustody", "secretStorage"].includes(key) && CREDENTIAL_KEY.test(key)) || hasCredentialMetadata(child),
    );
  }
  return typeof value === "string" && (SECRET_VALUE.test(value) || /^(?:vault-ref|bearer):/i.test(value));
}

function matchesValueSchema(value: unknown, schema: ObjectSchema["properties"][string]): boolean {
  if (schema.type === "array") {
    return Array.isArray(value) && (!schema.items || value.every((entry) => matchesValueSchema(entry, schema.items!)));
  }
  if (schema.type === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (schema.type === "integer") return Number.isInteger(value);
  return typeof value === schema.type && (schema.type !== "number" || Number.isFinite(value));
}

function validateObjectSchema(
  schema: ObjectSchema,
  keys: string[],
  expectedRequired: string[] | undefined,
  label: string,
): void {
  invariant(schema?.type === "object" && schema.additionalProperties === false, `${label} must be a closed object schema`);
  invariant(Boolean(schema.properties) && typeof schema.properties === "object", `${label}.properties must be an object`);
  invariant(Array.isArray(schema.required), `${label}.required must be an array`);
  const propertyKeys = Object.keys(schema.properties).sort();
  invariant(JSON.stringify(propertyKeys) === JSON.stringify([...keys].sort()), `${label} properties differ from declared keys`);
  unique(schema.required, `${label}.required`);
  invariant(schema.required.every((key) => keys.includes(key)), `${label} requires undeclared fields`);
  if (expectedRequired) {
    invariant(JSON.stringify([...schema.required].sort()) === JSON.stringify([...expectedRequired].sort()), `${label} required fields differ`);
  }
  for (const [key, property] of Object.entries(schema.properties)) {
    invariant(["string", "number", "integer", "boolean", "array", "object"].includes(property.type), `${label}.${key} has unsupported type`);
    invariant(property.type !== "array" || Boolean(property.items), `${label}.${key} array items must be typed`);
    invariant(property.type === "array" || property.items === undefined, `${label}.${key} items are only valid for arrays`);
    invariant(!FORBIDDEN_INPUT_KEYS.has(key.toLowerCase()), `${label}.${key} exposes raw transport or credentials`);
  }
}

export function validateRecordShape(
  value: Record<string, unknown>,
  schema: ObjectSchema,
  label: string,
): void {
  invariant(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const keys = Object.keys(value);
  invariant(keys.every((key) => Object.hasOwn(schema.properties, key)), `${label} includes undeclared fields`);
  invariant(schema.required.every((key) => keys.includes(key)), `${label} omits required fields`);
  for (const [key, child] of Object.entries(value)) {
    invariant(matchesValueSchema(child, schema.properties[key]), `${label}.${key} has the wrong type`);
  }
}

function validateSupportEvidence(evidence: SupportEvidence, operation: OperationContract): void {
  exactKeys(
    evidence,
    ["id", "kind", "candidateBuildId", "providerVersion", "adapterVersion", "checkedAt", "digest", "terminalReceiptId", "humanAcceptanceId"],
    `${operation.id} support evidence`,
  );
  invariant(typeof evidence.id === "string" && evidence.id.trim().length > 0, `${operation.id} support evidence needs an ID`);
  invariant(["research", "fixture", "live", "release-matrix", "retirement"].includes(evidence.kind), `${evidence.id} has an invalid evidence kind`);
  invariant(typeof evidence.providerVersion === "string" && evidence.providerVersion.trim().length > 0, `${evidence.id} needs a provider version`);
  invariant(!/^(?:latest|default|auto)$/i.test(evidence.providerVersion), `${evidence.id} provider version must not float`);
  invariant(typeof evidence.adapterVersion === "string" && SEMVER.test(evidence.adapterVersion), `${evidence.id} adapter version must be exact semver`);
  exactUtc(evidence.checkedAt, `${evidence.id}.checkedAt`);
  requireSha256(evidence.digest, `${evidence.id}.digest`);
  if (evidence.kind === "live") {
    invariant(/^[0-9a-f]{64}$/.test(evidence.candidateBuildId ?? ""), `${evidence.id} live evidence needs an exact Candidate Build ID`);
    invariant(Boolean(evidence.terminalReceiptId?.trim()), `${evidence.id} live evidence needs a terminal receipt`);
  } else {
    invariant(evidence.candidateBuildId === undefined && evidence.terminalReceiptId === undefined, `${evidence.id} non-live evidence cannot claim a live run`);
  }
  if (evidence.kind === "retirement") {
    invariant(Boolean(evidence.humanAcceptanceId?.trim()), `${evidence.id} retirement needs human acceptance`);
  }
}

function validateSupportCell(cell: SupportCell, operation: OperationContract): void {
  exactKeys(cell, ["id", "platform", "architecture", "state", "evidence"], `${operation.id} support cell`);
  invariant(typeof cell.id === "string" && cell.id.trim().length > 0, `${operation.id} support cell needs an ID`);
  invariant(typeof cell.platform === "string" && cell.platform.trim().length > 0, `${cell.id} needs a platform`);
  invariant(typeof cell.architecture === "string" && cell.architecture.trim().length > 0, `${cell.id} needs an architecture`);
  invariant(
    ["unknown", "cataloged", "researched", "fixture-verified", "live-verified", "supported", "degraded", "retired"].includes(cell.state),
    `${cell.id} has an invalid verification state`,
  );
  invariant(Array.isArray(cell.evidence), `${cell.id}.evidence must be an array`);
  unique(cell.evidence.map((entry) => entry.id), `${cell.id} evidence IDs`);
  for (const evidence of cell.evidence) validateSupportEvidence(evidence, operation);
  const kinds = new Set(cell.evidence.map((entry) => entry.kind));
  const requiredKinds: Partial<Record<SupportCell["state"], SupportEvidence["kind"][]>> = {
    cataloged: ["research"],
    researched: ["research"],
    "fixture-verified": ["research", "fixture"],
    "live-verified": ["research", "fixture", "live"],
    supported: ["research", "fixture", "live", "release-matrix"],
    degraded: ["live"],
    retired: ["retirement"],
  };
  invariant(
    (requiredKinds[cell.state] ?? []).every((kind) => kinds.has(kind)),
    `${cell.id} evidence does not establish ${cell.state}`,
  );
  if (cell.state === "supported") {
    invariant(![cell.platform, cell.architecture].some((value) => value === "unbound" || value.includes("*")), `${cell.id} supported dimensions must be exact`);
  }
}

export function validateOperation(operation: OperationContract): void {
  exactKeys(
    operation,
    ["id", "capabilityId", "provider", "product", "category", "outcomes", "actionClass", "providerApiVersion", "authScopes", "dataClassification", "pii", "residency", "rateLimit", "quotaUnit", "monetaryUnit", "maximumUnitsPerRun", "maximumCostPerRun", "inputKeys", "requiredInputKeys", "outputKeys", "inputSchema", "outputSchema", "pagination", "retry", "idempotency", "officialSources", "provenance", "checkedAt", "knownGaps", "roadmapDestination", "supportCells"],
    "operation",
  );
  invariant(ID.test(operation.id), `invalid operation ID: ${operation.id}`);
  invariant(ID.test(operation.capabilityId), `${operation.id} has invalid capability ID`);
  invariant(ID.test(operation.provider), `${operation.id} has invalid provider ID`);
  invariant(!operation.id.includes("*"), `${operation.id} cannot be a wildcard`);
  invariant(["observe", "metered-observe", "draft", "consequential", "prohibited"].includes(operation.actionClass), `${operation.id} has an invalid action class`);
  invariant(["public", "internal", "confidential", "restricted"].includes(operation.dataClassification), `${operation.id} has an invalid data classification`);
  invariant(["none", "possible", "required"].includes(operation.pii), `${operation.id} has an invalid PII classification`);
  invariant(!/^(?:latest|default|auto)$/i.test(operation.providerApiVersion), `${operation.id} provider version must not float`);
  invariant(operation.officialSources.length > 0, `${operation.id} needs official sources`);
  invariant(operation.officialSources.every((source) => source.startsWith("https://")), `${operation.id} source must use HTTPS`);
  invariant(operation.provenance.trim().length > 0, `${operation.id} needs provenance`);
  for (const [label, value] of [
    ["product", operation.product],
    ["category", operation.category],
    ["residency", operation.residency],
    ["rateLimit", operation.rateLimit],
    ["quotaUnit", operation.quotaUnit],
    ["monetaryUnit", operation.monetaryUnit],
    ["pagination", operation.pagination],
    ["retry", operation.retry],
    ["roadmapDestination", operation.roadmapDestination],
  ] as const) invariant(typeof value === "string" && value.trim().length > 0, `${operation.id}.${label} is required`);
  exactUtc(operation.checkedAt, `${operation.id}.checkedAt`);
  unique(operation.authScopes, `${operation.id}.authScopes`);
  invariant(operation.authScopes.every((scope) => typeof scope === "string" && scope.trim().length > 0 && !scope.includes("*")), `${operation.id} scopes must be exact`);
  unique(operation.inputKeys, `${operation.id}.inputKeys`);
  unique(operation.requiredInputKeys, `${operation.id}.requiredInputKeys`);
  unique(operation.outputKeys, `${operation.id}.outputKeys`);
  invariant(
    operation.requiredInputKeys.every((key) => operation.inputKeys.includes(key)),
    `${operation.id} required inputs must be declared`,
  );
  invariant(
    operation.inputKeys.every((key) => !FORBIDDEN_INPUT_KEYS.has(key.toLowerCase())),
    `${operation.id} exposes raw transport or credential input`,
  );
  validateObjectSchema(operation.inputSchema, operation.inputKeys, operation.requiredInputKeys, `${operation.id}.inputSchema`);
  validateObjectSchema(operation.outputSchema, operation.outputKeys, undefined, `${operation.id}.outputSchema`);
  if (["metered-observe", "draft", "consequential"].includes(operation.actionClass)) {
    invariant(
      typeof operation.maximumUnitsPerRun === "number" &&
        operation.maximumUnitsPerRun > 0 &&
        Number.isFinite(operation.maximumUnitsPerRun),
      `${operation.id} needs a finite unit ceiling`,
    );
    invariant(
      typeof operation.maximumCostPerRun === "number" &&
        operation.maximumCostPerRun >= 0 &&
        Number.isFinite(operation.maximumCostPerRun),
      `${operation.id} needs a finite cost ceiling`,
    );
  }
  invariant(
    operation.actionClass !== "consequential" || operation.idempotency === "required",
    `${operation.id} consequential actions require idempotency`,
  );
  invariant(Array.isArray(operation.supportCells) && operation.supportCells.length > 0, `${operation.id} needs support cells`);
  unique(operation.supportCells.map((cell) => cell.id), `${operation.id} support cell IDs`);
  for (const cell of operation.supportCells) validateSupportCell(cell, operation);
}

export function validateCatalog(value: unknown): asserts value is Catalog {
  invariant(Boolean(value) && typeof value === "object", "catalog is required");
  const catalog = value as Catalog;
  exactKeys(catalog, ["schemaVersion", "productVersion", "status", "operations"], "catalog");
  invariant(catalog.schemaVersion === "conquistador.tool-catalog/v1", "catalog schema is not v1");
  invariant(catalog.productVersion === "1.0.0", "catalog product version must be 1.0.0");
  invariant(["candidate-operations-not-supported", "candidate-bound"].includes(catalog.status), "catalog status is invalid");
  invariant(Array.isArray(catalog.operations) && catalog.operations.length > 0, "catalog needs operations");
  unique(catalog.operations.map((operation) => operation.id), "operation IDs");
  for (const operation of catalog.operations) validateOperation(operation);
  if (catalog.status === "candidate-operations-not-supported") {
    invariant(catalog.operations.every((operation) => operation.supportCells.every((cell) => cell.state !== "supported")), "catalog status forbids support claims");
  }
}

export function validateAdapterManifest(manifest: AdapterManifest, catalog: Catalog): void {
  validateCatalog(catalog);
  exactKeys(manifest, ["schemaVersion", "id", "provider", "version", "sdkVersion", "operationIds", "capabilityIds", "credentialInjection", "transport"], "adapter manifest");
  invariant(manifest.schemaVersion === "conquistador.adapter-manifest/v1", "adapter schema is not v1");
  invariant(ID.test(manifest.id), "adapter ID is invalid");
  invariant(ID.test(manifest.provider), "adapter provider is invalid");
  invariant(SEMVER.test(manifest.version), "adapter version must be exact semver");
  invariant(manifest.sdkVersion === "1.0.0", "adapter SDK version must be 1.0.0");
  invariant(manifest.credentialInjection === "host-only", "credentials must be host-only");
  invariant(manifest.transport === "audited-adapter-only", "raw transport is forbidden");
  invariant(manifest.operationIds.length > 0, "adapter needs declared operations");
  unique(manifest.operationIds, "adapter operation IDs");
  unique(manifest.capabilityIds, "adapter capability IDs");
  const operations = manifest.operationIds.map((id) =>
    catalog.operations.find((operation) => operation.id === id),
  );
  invariant(operations.every(Boolean), "adapter declares an unknown operation");
  invariant(operations.every((operation) => operation!.provider === manifest.provider), "adapter mixes providers");
  invariant(operations.every((operation) => operation!.actionClass !== "prohibited"), "adapter cannot implement a prohibited operation");
  const capabilities = [...new Set(operations.map((operation) => operation!.capabilityId))].sort();
  invariant(
    JSON.stringify(capabilities) === JSON.stringify([...manifest.capabilityIds].sort()),
    "adapter capability inventory differs from its operations",
  );
}

const MATURITY_RANK: Record<ExtensionOperation["maturity"], number> = {
  unknown: 0,
  cataloged: 1,
  researched: 2,
  "fixture-verified": 3,
  "live-verified": 4,
  supported: 5,
};

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveExtensionReference(
  reference: ExtensionCatalogReference,
  catalog: Catalog,
  label: string,
): OperationContract {
  exactKeys(reference, ["provider", "capabilityId", "operationId"], label);
  invariant(ID.test(reference.provider) && ID.test(reference.capabilityId) && ID.test(reference.operationId), `${label} IDs must be exact`);
  invariant(![reference.provider, reference.capabilityId, reference.operationId].some((value) => value.includes("*")), `${label} cannot use wildcards`);
  const operation = catalog.operations.find((entry) => entry.id === reference.operationId);
  invariant(Boolean(operation), `${label} references an unknown catalog operation`);
  invariant(operation!.provider === reference.provider, `${label} crosses providers`);
  invariant(operation!.capabilityId === reference.capabilityId, `${label} capability differs from catalog`);
  return operation!;
}

function validateExtensionOperation(
  operation: ExtensionOperation,
  manifest: ExtensionManifest,
  catalog: Catalog,
): void {
  exactKeys(operation, ["id", "capabilityId", "catalog", "inputSchema", "outputSchema", "actionClass", "budget", "connection", "maturity", "dependencies", "failure"], `${operation.id || "extension operation"}`);
  invariant(ID.test(operation.id) && ID.test(operation.capabilityId), "extension operation IDs must be exact");
  invariant(!operation.id.includes("*") && !operation.capabilityId.includes("*"), `${operation.id} cannot use wildcards`);
  invariant(["observe", "metered-observe", "draft", "consequential", "prohibited"].includes(operation.actionClass), `${operation.id} has an invalid action class`);
  invariant(Object.hasOwn(MATURITY_RANK, operation.maturity), `${operation.id} has invalid maturity`);
  validateObjectSchema(operation.inputSchema, Object.keys(operation.inputSchema?.properties ?? {}), operation.inputSchema?.required, `${operation.id}.inputSchema`);
  validateObjectSchema(operation.outputSchema, Object.keys(operation.outputSchema?.properties ?? {}), operation.outputSchema?.required, `${operation.id}.outputSchema`);

  exactKeys(operation.budget, ["rateLimit", "quotaUnit", "monetaryUnit", "maximumUnitsPerRun", "maximumCostPerRun"], `${operation.id}.budget`);
  invariant(typeof operation.budget.rateLimit === "string" && operation.budget.rateLimit.length > 0, `${operation.id} needs a rate limit`);
  invariant(typeof operation.budget.quotaUnit === "string" && operation.budget.quotaUnit.length > 0, `${operation.id} needs a quota unit`);
  invariant(typeof operation.budget.monetaryUnit === "string" && operation.budget.monetaryUnit.length > 0, `${operation.id} needs a monetary unit`);
  if (operation.budget.maximumUnitsPerRun !== undefined) {
    invariant(typeof operation.budget.maximumUnitsPerRun === "number" && operation.budget.maximumUnitsPerRun > 0 && Number.isFinite(operation.budget.maximumUnitsPerRun), `${operation.id} unit ceiling must be finite and positive`);
  }
  if (operation.budget.maximumCostPerRun !== undefined) {
    invariant(typeof operation.budget.maximumCostPerRun === "number" && operation.budget.maximumCostPerRun >= 0 && Number.isFinite(operation.budget.maximumCostPerRun), `${operation.id} cost ceiling must be finite and non-negative`);
  }
  if (["metered-observe", "draft", "consequential"].includes(operation.actionClass)) {
    invariant(typeof operation.budget.maximumUnitsPerRun === "number" && operation.budget.maximumUnitsPerRun > 0 && Number.isFinite(operation.budget.maximumUnitsPerRun), `${operation.id} needs a finite unit ceiling`);
    invariant(typeof operation.budget.maximumCostPerRun === "number" && operation.budget.maximumCostPerRun >= 0 && Number.isFinite(operation.budget.maximumCostPerRun), `${operation.id} needs a finite cost ceiling`);
  }

  exactKeys(operation.connection, ["required", "provider", "scopes", "credentialCustody"], `${operation.id}.connection`);
  invariant(typeof operation.connection.required === "boolean", `${operation.id} connection requirement must be explicit`);
  invariant(operation.connection.credentialCustody === "host-only", `${operation.id} credentials must remain host-only`);
  invariant(ID.test(operation.connection.provider), `${operation.id} connection provider must be exact`);
  invariant(Array.isArray(operation.connection.scopes), `${operation.id} connection scopes must be an array`);
  unique(operation.connection.scopes, `${operation.id} connection scopes`);
  invariant(operation.connection.scopes.every((scope) => typeof scope === "string" && scope.length > 0 && !scope.includes("*")), `${operation.id} connection scopes must be exact`);

  invariant(Array.isArray(operation.dependencies), `${operation.id}.dependencies must be an array`);
  unique(operation.dependencies.map((dependency) => dependency.operationId), `${operation.id} dependency operation IDs`);
  for (const dependency of operation.dependencies) {
    const dependencyOperation = resolveExtensionReference(dependency, catalog, `${operation.id} dependency`);
    invariant(dependencyOperation.actionClass !== "prohibited", `${operation.id} cannot depend on a prohibited operation`);
  }

  exactKeys(operation.failure, ["unavailable", "degraded", "retry", "recovery"], `${operation.id}.failure`);
  invariant(["fail-closed", "omit-optional-dependency"].includes(operation.failure.unavailable), `${operation.id} has invalid unavailable behavior`);
  invariant(["fail-closed", "return-degraded-result"].includes(operation.failure.degraded), `${operation.id} has invalid degraded behavior`);
  exactKeys(operation.failure.retry, ["strategy", "maximumAttempts", "backoff"], `${operation.id}.failure.retry`);
  invariant(["none", "bounded"].includes(operation.failure.retry.strategy), `${operation.id} has invalid retry strategy`);
  invariant(Number.isInteger(operation.failure.retry.maximumAttempts) && operation.failure.retry.maximumAttempts >= 0 && operation.failure.retry.maximumAttempts <= 5, `${operation.id} retry attempts must be bounded from 0 to 5`);
  invariant(["none", "fixed", "exponential"].includes(operation.failure.retry.backoff), `${operation.id} has invalid retry backoff`);
  invariant(operation.failure.retry.strategy !== "none" || (operation.failure.retry.maximumAttempts === 0 && operation.failure.retry.backoff === "none"), `${operation.id} no-retry policy must have zero attempts and no backoff`);
  invariant(operation.failure.retry.strategy !== "bounded" || operation.failure.retry.maximumAttempts > 0, `${operation.id} bounded retry needs at least one attempt`);
  invariant(["manual-reconnect", "resume-from-artifact", "not-applicable"].includes(operation.failure.recovery), `${operation.id} has invalid recovery behavior`);

  if (manifest.kind === "outcome-skill") {
    invariant(operation.catalog === undefined, `${operation.id} outcome-skill operation must be skill-owned`);
    invariant(operation.actionClass === "observe", `${operation.id} skill-owned operation must be observe-only`);
    invariant(operation.connection.required === false && operation.connection.provider === "none" && operation.connection.scopes.length === 0, `${operation.id} skill-owned operation cannot claim a direct connection`);
    invariant(MATURITY_RANK[operation.maturity] <= MATURITY_RANK.cataloged, `${operation.id} skill-owned maturity lacks catalog evidence`);
    return;
  }

  invariant(Boolean(operation.catalog), `${operation.id} must reference an exact catalog operation`);
  invariant(operation.dependencies.length === 0, `${operation.id} catalog-backed operation cannot add hidden dependencies`);
  const catalogOperation = resolveExtensionReference(operation.catalog!, catalog, `${operation.id}.catalog`);
  invariant(operation.id === catalogOperation.id && operation.capabilityId === catalogOperation.capabilityId, `${operation.id} identity differs from catalog`);
  invariant(operation.actionClass === catalogOperation.actionClass, `${operation.id} authority differs from catalog`);
  invariant(catalogOperation.actionClass !== "prohibited", `${operation.id} cannot expose a prohibited catalog operation`);
  invariant(sameJson(operation.inputSchema, catalogOperation.inputSchema), `${operation.id} input schema differs from catalog`);
  invariant(sameJson(operation.outputSchema, catalogOperation.outputSchema), `${operation.id} output schema differs from catalog`);
  invariant(operation.budget.rateLimit === catalogOperation.rateLimit && operation.budget.quotaUnit === catalogOperation.quotaUnit && operation.budget.monetaryUnit === catalogOperation.monetaryUnit, `${operation.id} budget units differ from catalog`);
  if (catalogOperation.maximumUnitsPerRun !== undefined) invariant(operation.budget.maximumUnitsPerRun! <= catalogOperation.maximumUnitsPerRun, `${operation.id} unit ceiling exceeds catalog`);
  if (catalogOperation.maximumCostPerRun !== undefined) invariant(operation.budget.maximumCostPerRun! <= catalogOperation.maximumCostPerRun, `${operation.id} cost ceiling exceeds catalog`);
  invariant(operation.connection.required === (catalogOperation.authScopes.length > 0), `${operation.id} connection requirement differs from catalog`);
  invariant(operation.connection.provider === catalogOperation.provider, `${operation.id} connection provider differs from catalog`);
  invariant(sameJson([...operation.connection.scopes].sort(), [...catalogOperation.authScopes].sort()), `${operation.id} connection scopes differ from catalog`);
  if (/no automatic retry/i.test(catalogOperation.retry)) {
    invariant(operation.failure.retry.strategy === "none", `${operation.id} retry policy exceeds catalog authority`);
  }
  const established = Math.max(...catalogOperation.supportCells.map((cell) => MATURITY_RANK[cell.state as ExtensionOperation["maturity"]] ?? -1));
  invariant(MATURITY_RANK[operation.maturity] <= established, `${operation.id} maturity is not established by catalog evidence`);
}

export function validateExtensionManifest(manifest: ExtensionManifest, catalog: Catalog): void {
  validateCatalog(catalog);
  invariant(Boolean(manifest) && typeof manifest === "object" && !Array.isArray(manifest), "extension manifest is required");
  invariant(!hasCredentialMetadata(manifest), "extension metadata contains credential-shaped material");
  exactKeys(manifest, ["schemaVersion", "id", "version", "kind", "activation", "transport", "provenance", "operations"], "extension manifest");
  invariant(manifest.schemaVersion === "conquistador.extension-manifest/v1", "extension schema is not v1");
  invariant(ID.test(manifest.id) && !manifest.id.includes("*"), "extension ID must be exact");
  invariant(SEMVER.test(manifest.version) && !/^(?:0\.0\.0|.*(?:latest|default|auto).*)$/i.test(manifest.version), "extension version must be exact semver");
  invariant(["outcome-skill", "host-tool", "provider-adapter"].includes(manifest.kind), "extension kind is invalid");
  const boundaries = {
    "outcome-skill": { activation: "on-demand-skill", transports: ["none"] },
    "host-tool": { activation: "host-mediated", transports: ["host-connector", "host-mcp"] },
    "provider-adapter": { activation: "typed-adapter", transports: ["audited-adapter-only"] },
  } as const;
  const boundary = boundaries[manifest.kind];
  invariant(manifest.activation === boundary.activation && (boundary.transports as readonly string[]).includes(manifest.transport), "extension activation or transport contradicts its kind");
  exactKeys(manifest.provenance, ["sourceId", "sourceVersion", "digest"], "extension provenance");
  invariant(ID.test(manifest.provenance.sourceId) && !manifest.provenance.sourceId.includes("*") && !/^(?:latest|default|auto)$/i.test(manifest.provenance.sourceId), "extension source identity must be stable and non-floating");
  invariant(SEMVER.test(manifest.provenance.sourceVersion) && !/(?:latest|default|auto)/i.test(manifest.provenance.sourceVersion), "extension source version must be exact semver");
  requireSha256(manifest.provenance.digest, "extension provenance digest");
  invariant(Array.isArray(manifest.operations) && manifest.operations.length > 0, "extension needs operations");
  unique(manifest.operations.map((operation) => operation.id), "extension operation IDs");
  for (const operation of manifest.operations) validateExtensionOperation(operation, manifest, catalog);
}

export function validateConnectionReference(connection: ConnectionReference): void {
  invariant(Boolean(connection) && typeof connection === "object" && !Array.isArray(connection), "connection reference is required");
  invariant(!hasCredentialMetadata(connection), "connection reference contains credential-shaped material");
  exactKeys(connection, ["schemaVersion", "id", "provider", "principal", "allowedOperationIds", "scopes", "environment", "usage", "revision", "state", "rotatedFrom", "verifiedAt", "expiresAt", "invalidatedAt", "storagePolicy"], "connection reference");
  invariant(connection.schemaVersion === "conquistador.connection-reference/v1", "connection schema is not v1");
  invariant(ID.test(connection.id) && connection.id.length >= 8 && connection.id.length <= 128 && !connection.id.includes("*"), "connection reference ID must be opaque and bounded");
  invariant(ID.test(connection.provider), "connection provider is invalid");
  invariant(Boolean(connection.principal) && typeof connection.principal === "object" && !Array.isArray(connection.principal), "connection principal is required");
  exactKeys(connection.principal, ["accountId", "workspaceId", "displayName"], "connection principal");
  invariant([connection.principal.accountId, connection.principal.workspaceId, connection.principal.displayName].every((item) => typeof item === "string" && item.trim().length > 0 && !item.includes("*")), "connection principal must bind exact account, workspace, and display name");
  invariant(!SECRET_VALUE.test(JSON.stringify(connection.principal)), "connection principal contains credential-shaped content");
  invariant(Array.isArray(connection.allowedOperationIds) && connection.allowedOperationIds.length > 0, "connection allowed operations are required");
  invariant(connection.allowedOperationIds.every((id) => typeof id === "string" && ID.test(id) && !id.includes("*")), "connection allowed operations must be exact");
  unique(connection.allowedOperationIds, "connection allowed operations");
  invariant(Array.isArray(connection.scopes) && connection.scopes.length > 0, "connection scopes are required");
  invariant(connection.scopes.every((scope) => typeof scope === "string" && scope.trim().length > 0 && !scope.includes("*")), "connection scopes must be exact");
  unique(connection.scopes, "connection scopes");
  invariant(["sandbox", "production"].includes(connection.environment), "connection environment is invalid");
  invariant(["ephemeral-test", "user-production"].includes(connection.usage), "connection usage is invalid");
  invariant((connection.environment === "sandbox" && connection.usage === "ephemeral-test") || (connection.environment === "production" && connection.usage === "user-production"), "connection environment and usage pairing is invalid");
  invariant(Number.isInteger(connection.revision) && connection.revision > 0, "connection revision must be a positive integer");
  invariant(["active", "revoked", "expired"].includes(connection.state), "connection state is invalid");
  invariant(connection.rotatedFrom === undefined || (ID.test(connection.rotatedFrom) && connection.rotatedFrom !== connection.id), "connection rotation predecessor is invalid");
  invariant((connection.revision === 1 && connection.rotatedFrom === undefined) || (connection.revision > 1 && connection.rotatedFrom !== undefined), "connection revision and rotation predecessor differ");
  exactUtc(connection.verifiedAt, "connection.verifiedAt");
  if (connection.expiresAt !== undefined) exactUtc(connection.expiresAt, "connection.expiresAt");
  if (connection.invalidatedAt !== undefined) exactUtc(connection.invalidatedAt, "connection.invalidatedAt");
  const verified = Date.parse(connection.verifiedAt);
  const expires = connection.expiresAt === undefined ? undefined : Date.parse(connection.expiresAt);
  const invalidated = connection.invalidatedAt === undefined ? undefined : Date.parse(connection.invalidatedAt);
  invariant(expires === undefined || expires > verified, "connection expiry must follow verification");
  invariant(invalidated === undefined || invalidated >= verified, "connection invalidation must not precede verification");
  invariant(connection.state === "active" ? invalidated === undefined : invalidated !== undefined, "connection lifecycle state and invalidation timestamp differ");
  invariant(connection.state !== "expired" || (expires !== undefined && invalidated === expires), "expired connection must invalidate exactly at expiry");
  invariant(connection.state !== "revoked" || invalidated !== undefined, "revoked connection needs invalidation time");
  invariant(connection.state !== "revoked" || expires === undefined || invalidated! < expires, "revoked connection cannot invalidate at or after expiry");
  invariant(Boolean(connection.storagePolicy) && typeof connection.storagePolicy === "object" && !Array.isArray(connection.storagePolicy), "connection storage policy is required");
  exactKeys(connection.storagePolicy, ["referenceMetadata", "secretStorage", "export", "recovery"], "connection storage policy");
  invariant(connection.storagePolicy.referenceMetadata === "conquistador-local" && connection.storagePolicy.secretStorage === "host-secure-store-only" && connection.storagePolicy.export === "forbidden" && connection.storagePolicy.recovery === "reauthenticate-only", "connection storage policy is closed");
}

export function validateConnectionRotation(previous: ConnectionReference, next: ConnectionReference): void {
  validateConnectionReference(previous);
  validateConnectionReference(next);
  invariant(previous.state === "revoked" || previous.state === "expired", "rotation predecessor must be revoked or expired");
  invariant(next.state === "active", "rotated connection must be active");
  invariant(next.id !== previous.id && next.rotatedFrom === previous.id, "rotation must use a new reference and exact predecessor");
  invariant(next.revision === previous.revision + 1, "rotation must increment revision exactly once");
  invariant(previous.provider === next.provider, "rotation cannot change provider");
  invariant(samePrincipal(previous.principal, next.principal), "rotation cannot change principal");
  invariant(sameStringSet(previous.allowedOperationIds, next.allowedOperationIds), "rotation cannot change allowed operations");
  invariant(sameStringSet(previous.scopes, next.scopes), "rotation cannot change scopes");
  invariant(previous.environment === next.environment, "rotation cannot change environment");
  invariant(previous.usage === next.usage, "rotation cannot change usage");
  invariant(sameStoragePolicy(previous.storagePolicy, next.storagePolicy), "rotation cannot change storage policy");
  invariant(Date.parse(next.verifiedAt) >= Date.parse(previous.invalidatedAt!), "rotation verification cannot precede predecessor invalidation");
}

export function validateCapabilityRequest(
  request: CapabilityRequest,
  operation: OperationContract,
): void {
  exactKeys(request, ["schemaVersion", "id", "candidateBuildId", "capabilityId", "operationId", "connectionRef", "expectedPrincipal", "connectionEnvironment", "connectionRevision", "input", "deadlineAt", "idempotencyKey", "maxUnits", "maxCost"], "request");
  invariant(request.schemaVersion === "conquistador.capability-request/v1", "request schema is not v1");
  invariant(ID.test(request.id), "request ID is invalid");
  invariant(/^[0-9a-f]{64}$/.test(request.candidateBuildId), "request needs an exact Candidate Build ID");
  invariant(request.operationId === operation.id, "request operation differs from selected operation");
  invariant(request.capabilityId === operation.capabilityId, "request capability differs from catalog");
  invariant(ID.test(request.connectionRef), "request connection reference is invalid");
  invariant(Boolean(request.expectedPrincipal) && typeof request.expectedPrincipal === "object" && !Array.isArray(request.expectedPrincipal), "request expected principal is required");
  exactKeys(request.expectedPrincipal, ["accountId", "workspaceId", "displayName"], "request expected principal");
  invariant([request.expectedPrincipal.accountId, request.expectedPrincipal.workspaceId, request.expectedPrincipal.displayName].every((value) => typeof value === "string" && value.trim().length > 0 && !value.includes("*")), "request principal must be exact");
  invariant(["sandbox", "production"].includes(request.connectionEnvironment), "request connection environment is invalid");
  invariant(Number.isInteger(request.connectionRevision) && request.connectionRevision > 0, "request connection revision must be positive");
  exactUtc(request.deadlineAt, "request.deadlineAt");
  const keys = Object.keys(request.input);
  validateRecordShape(request.input, operation.inputSchema, "request.input");
  invariant(keys.every((key) => !FORBIDDEN_INPUT_KEYS.has(key.toLowerCase())), "request exposes raw transport or credentials");
  invariant(!hasForbiddenInput(request.input), "request contains nested raw transport or credential material");
  invariant(
    operation.idempotency !== "required" || Boolean(request.idempotencyKey?.trim()),
    "operation requires an idempotency key",
  );
  if (request.idempotencyKey) {
    invariant(/^[a-zA-Z0-9._:-]{8,128}$/.test(request.idempotencyKey), "idempotency key is not a bounded opaque identifier");
    invariant(!SECRET_VALUE.test(request.idempotencyKey), "idempotency key contains credential-shaped content");
  }
}
