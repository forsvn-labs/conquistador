import type {
  ConnectionEnvironment,
  ConnectionPrincipal,
  ConnectionUsage,
  Receipt,
  Sha256,
} from "./contracts.ts";
import { deepFreeze, sha256 } from "./canonical.ts";
import { verifyReceipt } from "./receipt.ts";
import { invariant, requireSha256 } from "./validate.ts";

export const G4_PROVIDER_FAMILY = "openseo";
export const G4_OWNER_ISSUE = "EXTS-149";
export const G4_SCOPE_DECISION_ISSUE = "EXTS-182";
// Historical authority identifier: keep exact for existing identity validation.
export const G4_HISTORICAL_LEDGER_OWNER = "FOR-145";

export const G4_OPERATION_IDS = [
  "openseo.get-serp-results",
  "openseo.get-search-console-performance",
  "openseo.get-google-analytics-organic-landing-pages",
] as const;

export type G4OperationId = (typeof G4_OPERATION_IDS)[number];

export const G4_PROVIDER_TOOL_NAMES: Record<G4OperationId, string> = {
  "openseo.get-serp-results": "get_serp_results",
  "openseo.get-search-console-performance": "get_search_console_performance",
  "openseo.get-google-analytics-organic-landing-pages": "get_google_analytics_organic_landing_pages",
};

export const G4_CAPABILITY_IDS: Record<G4OperationId, string> = {
  "openseo.get-serp-results": "openseo.serp.results.read",
  "openseo.get-search-console-performance": "openseo.search.performance.read",
  "openseo.get-google-analytics-organic-landing-pages": "openseo.analytics.landing.pages.read",
};

export const G4_AUTH_SCOPES: Record<G4OperationId, readonly string[]> = {
  "openseo.get-serp-results": ["openseo:project", "openseo:serp"],
  "openseo.get-search-console-performance": ["openseo:project", "openseo:search-console"],
  "openseo.get-google-analytics-organic-landing-pages": ["openseo:project", "openseo:analytics"],
};

export const G4_METERED_OPERATION_ID: G4OperationId = "openseo.get-serp-results";
export const G4_ZERO_CREDIT_OPERATION_IDS = [
  "openseo.get-search-console-performance",
  "openseo.get-google-analytics-organic-landing-pages",
] as const;
export const G4_ANALYTICS_OPERATION_ID: G4OperationId = "openseo.get-google-analytics-organic-landing-pages";
export const G4_TYPED_UNKNOWN_CODES = ["ga4_not_connected"] as const;

export const G4_STAGES = [
  "unknown",
  "cataloged",
  "researched",
  "fixture-verified",
  "live-verified",
  "supported",
] as const;

export type G4Stage = (typeof G4_STAGES)[number];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const CANDIDATE_BUILD_ID = /^[0-9a-f]{64}$/;
const CONNECTION_REF = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const NON_FLOATING = /^(?!latest$|default$|auto$)/i;
const SECRET_VALUE = /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|bearer\s+[A-Za-z0-9._-]{12,})/i;
const SECRET_KEY = /(?:authorization|api[-_]?key|token|password|secret|cookie|credential)/i;

function assertNoSecretMaterial(record: G4OperationEvidence): void {
  const serialized = JSON.stringify(record);
  invariant(!SECRET_VALUE.test(serialized), "g4 evidence contains credential-shaped content");
  const visit = (value: unknown, parentKey: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, parentKey));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      invariant(!SECRET_KEY.test(key) || ["redaction"].includes(parentKey), `g4 evidence exposes credential-shaped field ${key}`);
      visit(child, key);
    }
  };
  visit(record, "");
}

export type G4OperationIdentity = {
  operationId: G4OperationId;
  providerToolName: string;
  providerFamily: typeof G4_PROVIDER_FAMILY;
  capabilityId: string;
  ownerIssue: typeof G4_OWNER_ISSUE;
  scopeDecisionIssue: typeof G4_SCOPE_DECISION_ISSUE;
  historicalLedgerOwner: typeof G4_HISTORICAL_LEDGER_OWNER;
};

export type G4CatalogBinding = {
  catalogDigest: Sha256;
  operationRevision: number;
  providerApiVersion: string;
  adapterId?: string;
  adapterVersion?: string;
  candidateBuildId?: string;
  inputSchemaDigest: Sha256;
  outputSchemaDigest: Sha256;
};

export type G4ConnectionBinding = {
  connectionRef: string;
  connectionRevision: number;
  lifecycleState: "active";
  environment: ConnectionEnvironment;
  usage: ConnectionUsage;
  principal: ConnectionPrincipal;
  projectId: string;
  siteOrProperty: string;
  scopes: string[];
};

export type G4ExactTarget = {
  target: string;
  marketLocationCode: number;
  languageCode: string;
};

export type G4RequestBinding = {
  inputDigest: Sha256;
  exactTarget?: G4ExactTarget;
};

export type G4Metering = {
  policy: "metered" | "zero-credit-read";
  requestedCreditCeiling: number;
  actualCreditsUsed: number | null;
  costCurrency: string | null;
  costUsed: number | null;
  timeoutSeconds: number;
  retryMaximumAttempts: number;
  cancellation: "deadline-enforced";
  retention: "digest-only-local";
  redaction: "applied-before-persist";
};

export type G4FixtureStage = {
  fixtureId: string;
  digest: Sha256;
  checkedAt: string;
};

export type G4HumanAcceptance = {
  authenticatedHuman: true;
  authenticationMethod: string;
  humanAcceptanceId: string;
  acceptedAt: string;
  bindsReceiptDigest: Sha256;
  bindsCandidateBuildId: string;
  bindsOperationId: string;
};

export type G4LiveStage = {
  receipt: Receipt;
  acceptance: G4HumanAcceptance;
};

export type G4SupportAcceptance = {
  authenticatedHuman: true;
  authenticationMethod: string;
  humanAcceptanceId: string;
  acceptedAt: string;
};

export type G4SupportStage = {
  releaseMatrixId: string;
  platform: string;
  architecture: string;
  digest: Sha256;
  checkedAt: string;
  acceptance: G4SupportAcceptance;
};

export type G4FailurePosture = {
  state: "none" | "blocked" | "degraded";
  reasonCodes: string[];
  retryOwner: string;
  supportOwner: string;
};

export type G4ChronologyEntry = {
  at: string;
  event: string;
};

export type G4OperationEvidence = {
  schemaVersion: "conquistador.g4-operation-evidence/v1";
  id: string;
  revision: number;
  stage: G4Stage;
  identity: G4OperationIdentity;
  catalog: G4CatalogBinding;
  connection: G4ConnectionBinding;
  request: G4RequestBinding;
  metering: G4Metering;
  fixture?: G4FixtureStage;
  live?: G4LiveStage;
  support?: G4SupportStage;
  failure: G4FailurePosture;
  chronology: G4ChronologyEntry[];
  recordDigest: Sha256;
};

export type G4AggregateOperationCell = {
  operationId: G4OperationId;
  stage: G4Stage;
  missingProofs: string[];
};

export type G4Aggregate = {
  schemaVersion: "conquistador.g4-aggregate/v1";
  gateStatus: "UNPASSED" | "PASSED";
  releaseStatus: "NO-GO";
  candidateStatus: "UNBOUND";
  sharedCandidateBuildId: string | null;
  operations: G4AggregateOperationCell[];
  violations: string[];
  digest: Sha256;
};

export type G4EvidencePack = {
  schemaVersion: "conquistador.g4-evidence-pack/v1";
  packId: string;
  revision: number;
  operations: G4OperationEvidence[];
  aggregate: G4Aggregate;
  packDigest: Sha256;
};

export type G4StatusRecord = {
  schemaVersion: "conquistador.g4-status/v1";
  statusId: string;
  generatedAt: string;
  gateStatus: "UNPASSED" | "PASSED";
  releaseStatus: "NO-GO";
  candidateStatus: "UNBOUND";
  evidencePackDigest: Sha256;
  operations: Array<{
    operationId: G4OperationId;
    providerToolName: string;
    stage: G4Stage;
    missingProofs: string[];
  }>;
  violations: string[];
  digest: Sha256;
};

function exactKeys(value: object, allowed: readonly string[], label: string): void {
  invariant(Object.keys(value).every((key) => allowed.includes(key)), `${label} includes undeclared fields`);
}

function text(value: unknown, label: string): asserts value is string {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required`);
  invariant(!value.includes("*"), `${label} cannot contain a wildcard`);
}

function exactUtc(value: unknown, label: string): void {
  invariant(
    typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
    `${label} must be an exact UTC ISO timestamp`,
  );
}

function unique(values: string[], label: string): void {
  invariant(new Set(values).size === values.length, `${label} must be unique`);
}

function isMetered(operationId: G4OperationId): boolean {
  return operationId === G4_METERED_OPERATION_ID;
}

function validateIdentity(identity: G4OperationIdentity): void {
  exactKeys(
    identity,
    ["operationId", "providerToolName", "providerFamily", "capabilityId", "ownerIssue", "scopeDecisionIssue", "historicalLedgerOwner"],
    "g4 identity",
  );
  invariant(G4_OPERATION_IDS.includes(identity.operationId), `g4 identity must bind exactly one approved operation, got ${String(identity.operationId)}`);
  invariant(identity.providerToolName === G4_PROVIDER_TOOL_NAMES[identity.operationId], "g4 provider tool name differs from the approved operation");
  invariant(identity.capabilityId === G4_CAPABILITY_IDS[identity.operationId], "g4 capability differs from the approved operation binding");
  invariant(identity.providerFamily === G4_PROVIDER_FAMILY, "g4 provider family must be openseo");
  text(identity.capabilityId, "identity.capabilityId");
  invariant(identity.ownerIssue === G4_OWNER_ISSUE, "g4 owner issue must be EXTS-149");
  invariant(identity.scopeDecisionIssue === G4_SCOPE_DECISION_ISSUE, "g4 scope decision issue must be EXTS-182");
  invariant(identity.historicalLedgerOwner === G4_HISTORICAL_LEDGER_OWNER, "g4 historical ledger owner must be FOR-145");
}

function validateCatalogBinding(binding: G4CatalogBinding, stage: G4Stage): void {
  exactKeys(
    binding,
    ["catalogDigest", "operationRevision", "providerApiVersion", "adapterId", "adapterVersion", "candidateBuildId", "inputSchemaDigest", "outputSchemaDigest"],
    "g4 catalog binding",
  );
  requireSha256(binding.catalogDigest, "catalog.catalogDigest");
  requireSha256(binding.inputSchemaDigest, "catalog.inputSchemaDigest");
  requireSha256(binding.outputSchemaDigest, "catalog.outputSchemaDigest");
  invariant(Number.isInteger(binding.operationRevision) && binding.operationRevision >= 1, "catalog.operationRevision must be a positive integer");
  text(binding.providerApiVersion, "catalog.providerApiVersion");
  invariant(NON_FLOATING.test(binding.providerApiVersion), "catalog.providerApiVersion must not float");
  const rank = G4_STAGES.indexOf(stage);
  if (rank >= 4) {
    text(binding.adapterId, "catalog.adapterId");
    invariant(typeof binding.adapterVersion === "string" && SEMVER.test(binding.adapterVersion), "catalog.adapterVersion must be exact semver at live verification");
    invariant(typeof binding.candidateBuildId === "string" && CANDIDATE_BUILD_ID.test(binding.candidateBuildId), "live or supported evidence needs an exact Candidate Build ID");
  } else if (binding.candidateBuildId !== undefined) {
    invariant(CANDIDATE_BUILD_ID.test(binding.candidateBuildId), "catalog.candidateBuildId must be an exact 64-hex build id");
  }
}

function validatePrincipal(principal: ConnectionPrincipal, label: string): void {
  exactKeys(principal, ["accountId", "workspaceId", "displayName"], label);
  [principal.accountId, principal.workspaceId, principal.displayName].forEach((value) => text(value, `${label} field`));
}

function validateConnectionBinding(connection: G4ConnectionBinding, operationId: G4OperationId): void {
  exactKeys(
    connection,
    ["connectionRef", "connectionRevision", "lifecycleState", "environment", "usage", "principal", "projectId", "siteOrProperty", "scopes"],
    "g4 connection binding",
  );
  invariant(typeof connection.connectionRef === "string" && CONNECTION_REF.test(connection.connectionRef) && connection.connectionRef.length >= 8 && connection.connectionRef.length <= 128, "connection.connectionRef must be an opaque bounded reference");
  invariant(Number.isInteger(connection.connectionRevision) && connection.connectionRevision >= 1, "connection.connectionRevision must be a positive integer");
  invariant(connection.lifecycleState === "active", "g4 evidence can only bind an active connection");
  invariant((connection.environment === "sandbox" && connection.usage === "ephemeral-test") || (connection.environment === "production" && connection.usage === "user-production"), "connection environment and usage pairing is invalid");
  validatePrincipal(connection.principal, "connection.principal");
  text(connection.projectId, "connection.projectId");
  text(connection.siteOrProperty, "connection.siteOrProperty");
  invariant(Array.isArray(connection.scopes) && connection.scopes.length > 0, "connection.scopes must be exact and non-empty");
  unique(connection.scopes, "connection.scopes");
  connection.scopes.forEach((scope) => text(scope, "connection scope"));
  invariant(
    JSON.stringify([...connection.scopes].sort()) === JSON.stringify([...G4_AUTH_SCOPES[operationId]].sort()),
    "connection.scopes must equal the exact approved catalog scope set for the bound operation",
  );
}

function validateRequest(request: G4RequestBinding, operationId: G4OperationId, stage: G4Stage): void {
  exactKeys(request, ["inputDigest", "exactTarget"], "g4 request binding");
  requireSha256(request.inputDigest, "request.inputDigest");
  if (operationId !== G4_METERED_OPERATION_ID) {
    invariant(request.exactTarget === undefined, "exact target binding is reserved for the metered SERP operation");
    return;
  }
  if (G4_STAGES.indexOf(stage) < 4) return;
  const target = request.exactTarget;
  invariant(Boolean(target) && typeof target === "object", "live SERP proof requires one exact target/market/language binding");
  exactKeys(target!, ["target", "marketLocationCode", "languageCode"], "request.exactTarget");
  text(target!.target, "request.exactTarget.target");
  invariant(Number.isInteger(target!.marketLocationCode) && target!.marketLocationCode > 0, "request.exactTarget.marketLocationCode must be a positive integer");
  text(target!.languageCode, "request.exactTarget.languageCode");
}

function validateMetering(metering: G4Metering, operationId: G4OperationId, stage: G4Stage): void {
  exactKeys(
    metering,
    ["policy", "requestedCreditCeiling", "actualCreditsUsed", "costCurrency", "costUsed", "timeoutSeconds", "retryMaximumAttempts", "cancellation", "retention", "redaction"],
    "g4 metering",
  );
  invariant(Number.isInteger(metering.timeoutSeconds) && metering.timeoutSeconds > 0, "metering.timeoutSeconds must be a positive integer");
  invariant(Number.isInteger(metering.retryMaximumAttempts) && metering.retryMaximumAttempts >= 0 && metering.retryMaximumAttempts <= 5, "metering.retryMaximumAttempts must be bounded from 0 to 5");
  invariant(metering.cancellation === "deadline-enforced", "metering.cancellation must enforce the deadline");
  invariant(metering.retention === "digest-only-local", "metering.retention must keep digests only");
  invariant(metering.redaction === "applied-before-persist", "metering.redaction must apply before persisting");
  invariant(metering.actualCreditsUsed === null || (Number.isFinite(metering.actualCreditsUsed) && metering.actualCreditsUsed >= 0), "metering.actualCreditsUsed must be null before a live run or finite and non-negative");
  invariant(metering.costUsed === null || (Number.isFinite(metering.costUsed) && metering.costUsed >= 0), "metering.costUsed must be null before a live run or finite and non-negative");
  if (metering.costCurrency !== null) text(metering.costCurrency, "metering.costCurrency");
  if (isMetered(operationId)) {
    invariant(metering.policy === "metered", "the SERP operation must declare the metered policy");
    invariant(typeof metering.requestedCreditCeiling === "number" && Number.isFinite(metering.requestedCreditCeiling) && metering.requestedCreditCeiling > 0, "SERP live proof requires an explicit finite positive OpenSEO credit ceiling");
  } else {
    invariant(metering.policy === "zero-credit-read", "owned-signal reads must declare the zero-credit-read policy");
    invariant(metering.requestedCreditCeiling === 0, "owned-signal reads must request exactly zero OpenSEO credits");
  }
  if (G4_STAGES.indexOf(stage) >= 4) {
    invariant(metering.actualCreditsUsed !== null, "live proof requires recorded actual credit usage");
    invariant(metering.actualCreditsUsed <= metering.requestedCreditCeiling, "actual OpenSEO credit usage exceeds the requested ceiling");
    if (!isMetered(operationId)) {
      invariant(metering.actualCreditsUsed === 0, "owned-signal reads must use exactly zero OpenSEO credits");
      invariant((metering.costUsed ?? 0) === 0, "owned-signal reads must not record cost");
    }
  }
}

function validateFixtureStage(fixture: G4FixtureStage): void {
  exactKeys(fixture, ["fixtureId", "digest", "checkedAt"], "g4 fixture stage");
  text(fixture.fixtureId, "fixture.fixtureId");
  requireSha256(fixture.digest, "fixture.digest");
  exactUtc(fixture.checkedAt, "fixture.checkedAt");
}

function validateAcceptance(acceptance: G4HumanAcceptance, receipt: Receipt, operationId: G4OperationId, label: string): void {
  exactKeys(
    acceptance,
    ["authenticatedHuman", "authenticationMethod", "humanAcceptanceId", "acceptedAt", "bindsReceiptDigest", "bindsCandidateBuildId", "bindsOperationId"],
    label,
  );
  invariant(acceptance.authenticatedHuman === true, "live-verification acceptance must come from an authenticated human");
  text(acceptance.authenticationMethod, `${label}.authenticationMethod`);
  text(acceptance.humanAcceptanceId, `${label}.humanAcceptanceId`);
  exactUtc(acceptance.acceptedAt, `${label}.acceptedAt`);
  requireSha256(acceptance.bindsReceiptDigest, `${label}.bindsReceiptDigest`);
  invariant(acceptance.bindsReceiptDigest === receipt.receiptDigest, "human acceptance does not bind the exact live receipt digest");
  invariant(CANDIDATE_BUILD_ID.test(acceptance.bindsCandidateBuildId) && acceptance.bindsCandidateBuildId === receipt.candidateBuildId, "human acceptance does not bind the exact candidate build");
  invariant(acceptance.bindsOperationId === operationId, "human acceptance does not bind the exact operation");
  invariant(Date.parse(acceptance.acceptedAt) >= Date.parse(receipt.finishedAt), "human acceptance cannot precede the live receipt finish");
}

function validateLiveStage(live: G4LiveStage, record: G4OperationEvidence): void {
  exactKeys(live, ["receipt", "acceptance"], "g4 live stage");
  const { receipt } = live;
  verifyReceipt(receipt);
  invariant(receipt.status === "succeeded" && receipt.providerStatus === "succeeded", "live proof requires one succeeded terminal provider receipt");
  invariant(receipt.redactionApplied === true && receipt.terminalRecord === true, "live proof receipt must be redacted and terminal");
  invariant(!receipt.error, "live proof cannot bind a failed receipt");
  invariant(receipt.provider === G4_PROVIDER_FAMILY, "live receipt provider differs from the g4 family");
  invariant(receipt.operationId === record.identity.operationId, "live receipt operation differs from the g4 identity");
  invariant(receipt.capabilityId === record.identity.capabilityId, "live receipt capability differs from the g4 identity");
  invariant(record.catalog.candidateBuildId !== undefined && receipt.candidateBuildId === record.catalog.candidateBuildId, "live receipt is not bound to the declared candidate build");
  invariant(record.catalog.adapterId !== undefined && receipt.adapterId === record.catalog.adapterId, "live receipt adapter differs from the catalog binding");
  invariant(record.catalog.adapterVersion !== undefined && receipt.adapterVersion === record.catalog.adapterVersion, "live receipt adapter version differs from the catalog binding");
  invariant(receipt.sourceUrls.length > 0, "live proof requires a provider source");
  if (isMetered(record.identity.operationId)) {
    invariant(receipt.unitsUsed <= record.metering.requestedCreditCeiling, "receipt units exceed the SERP credit ceiling");
  } else {
    invariant(receipt.unitsUsed === 0 && receipt.costUsed === 0, "owned-signal read receipts must record zero credits and cost");
  }
  if (record.identity.operationId === G4_ANALYTICS_OPERATION_ID) {
    const excerpt = receipt.safeExcerpt ?? "";
    invariant(!G4_TYPED_UNKNOWN_CODES.some((code) => excerpt.includes(code)), "a typed unknown such as ga4_not_connected is not success and cannot stand as GA live proof");
  }
  validateAcceptance(live.acceptance, receipt, record.identity.operationId, "live.acceptance");
}

function validateSupportStage(support: G4SupportStage, record: G4OperationEvidence): void {
  exactKeys(support, ["releaseMatrixId", "platform", "architecture", "digest", "checkedAt", "acceptance"], "g4 support stage");
  text(support.releaseMatrixId, "support.releaseMatrixId");
  text(support.platform, "support.platform");
  text(support.architecture, "support.architecture");
  invariant(support.platform !== "unbound" && support.architecture !== "unbound", "supported dimensions must be exact platform and architecture");
  requireSha256(support.digest, "support.digest");
  exactUtc(support.checkedAt, "support.checkedAt");
  const acceptance = support.acceptance;
  exactKeys(acceptance, ["authenticatedHuman", "authenticationMethod", "humanAcceptanceId", "acceptedAt"], "support.acceptance");
  invariant(acceptance.authenticatedHuman === true, "support acceptance must come from an authenticated human");
  text(acceptance.authenticationMethod, "support.acceptance.authenticationMethod");
  text(acceptance.humanAcceptanceId, "support.acceptance.humanAcceptanceId");
  exactUtc(acceptance.acceptedAt, "support.acceptance.acceptedAt");
  invariant(record.live !== undefined && Date.parse(support.checkedAt) >= Date.parse(record.live.acceptance.acceptedAt), "support evidence cannot precede live-verification acceptance");
  invariant(Date.parse(acceptance.acceptedAt) >= Date.parse(support.checkedAt), "support acceptance cannot precede its release-matrix evidence");
}

function validateFailure(failure: G4FailurePosture, stage: G4Stage): void {
  exactKeys(failure, ["state", "reasonCodes", "retryOwner", "supportOwner"], "g4 failure posture");
  invariant(["none", "blocked", "degraded"].includes(failure.state), "failure state is invalid");
  invariant(Array.isArray(failure.reasonCodes), "failure.reasonCodes must be an array");
  unique(failure.reasonCodes, "failure.reasonCodes");
  failure.reasonCodes.forEach((code) => text(code, "failure reason code"));
  text(failure.retryOwner, "failure.retryOwner");
  text(failure.supportOwner, "failure.supportOwner");
  if (failure.state === "none") invariant(failure.reasonCodes.length === 0, "clear failure state cannot assert reason codes");
  else invariant(failure.reasonCodes.length > 0, "asserted failure needs exact reason codes");
  if (stage === "supported") invariant(failure.state === "none", "blocked or degraded operations cannot be supported");
}

function validateChronology(chronology: G4ChronologyEntry[], stage: G4Stage): void {
  invariant(Array.isArray(chronology) && chronology.length > 0, "chronology must contain at least one entry");
  chronology.forEach((entry, index) => {
    exactKeys(entry, ["at", "event"], `chronology[${index}]`);
    exactUtc(entry.at, `chronology[${index}].at`);
    text(entry.event, `chronology[${index}].event`);
    if (index > 0) {
      invariant(Date.parse(chronology[index - 1].at) <= Date.parse(entry.at), "chronology entries must be ordered");
    }
  });
  const stageEvents = chronology.filter((entry) => entry.event.startsWith("stage:")).map((entry) => entry.event.slice("stage:".length));
  const expectedStages = G4_STAGES.slice(1, G4_STAGES.indexOf(stage) + 1);
  invariant(
    JSON.stringify(stageEvents) === JSON.stringify(expectedStages),
    `chronology stage events ${JSON.stringify(stageEvents)} do not trace the exact ladder to ${stage}`,
  );
  invariant(chronology[chronology.length - 1].event === `stage:${stage}`, "chronology must end at the current stage");
}

export function validateG4OperationEvidence(record: G4OperationEvidence): void {
  invariant(Boolean(record) && typeof record === "object" && !Array.isArray(record), "g4 operation evidence must be an object");
  exactKeys(
    record,
    ["schemaVersion", "id", "revision", "stage", "identity", "catalog", "connection", "request", "metering", "fixture", "live", "support", "failure", "chronology", "recordDigest"],
    "g4 operation evidence",
  );
  invariant(record.schemaVersion === "conquistador.g4-operation-evidence/v1", "g4 evidence schema is not v1");
  text(record.id, "evidence id");
  invariant(Number.isInteger(record.revision) && record.revision >= 1, "evidence revision must be a positive integer");
  invariant(G4_STAGES.includes(record.stage), "evidence stage is invalid");
  validateIdentity(record.identity);
  validateCatalogBinding(record.catalog, record.stage);
  validateConnectionBinding(record.connection, record.identity.operationId);
  validateRequest(record.request, record.identity.operationId, record.stage);
  validateMetering(record.metering, record.identity.operationId, record.stage);

  const rank = G4_STAGES.indexOf(record.stage);
  if (rank >= 3) {
    invariant(record.fixture !== undefined, "fixture-verified and above require distinct earlier fixture proof");
    validateFixtureStage(record.fixture!);
  } else {
    invariant(record.fixture === undefined, "fixture proof may appear only at fixture-verified and above");
  }
  if (rank >= 4) {
    invariant(record.live !== undefined, "live-verified and above require candidate-bound live proof");
    validateLiveStage(record.live!, record);
    invariant(Date.parse(record.fixture!.checkedAt) < Date.parse(record.live!.receipt.finishedAt), "fixture proof must be a distinct earlier stage before the live run");
  } else {
    invariant(record.live === undefined, "live proof may appear only at live-verified and above");
  }
  if (rank >= 5) {
    invariant(record.support !== undefined, "supported requires an exact release-matrix cell and human support acceptance");
    validateSupportStage(record.support!, record);
  } else {
    invariant(record.support === undefined, "support proof may appear only at supported");
  }

  validateFailure(record.failure, record.stage);
  validateChronology(record.chronology, record.stage);
  assertNoSecretMaterial(record);
  requireSha256(record.recordDigest, "recordDigest");
  const { recordDigest, ...body } = record;
  invariant(sha256(body) === recordDigest, "g4 record digest mismatch");
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function bindsOnce(previous: unknown, proposed: unknown): boolean {
  return previous === undefined || sameValue(previous, proposed);
}

export function promoteG4Operation(previous: G4OperationEvidence, proposed: G4OperationEvidence): Readonly<G4OperationEvidence> {
  validateG4OperationEvidence(previous);
  validateG4OperationEvidence(proposed);
  invariant(previous.id === proposed.id, "promotion cannot change the evidence record id");
  invariant(previous.identity.operationId === proposed.identity.operationId, "promotion cannot change the operation");
  const previousRank = G4_STAGES.indexOf(previous.stage);
  invariant(G4_STAGES[previousRank + 1] === proposed.stage, `g4 transition ${previous.stage} → ${proposed.stage} is not allowed; stages advance exactly one step`);
  invariant(proposed.revision === previous.revision + 1, "promotion must increment the immutable revision exactly once");
  for (const field of ["identity", "connection", "request", "failure"] as const) {
    invariant(sameValue(previous[field], proposed[field]), `${field} cannot drift during promotion`);
  }
  for (const field of ["catalogDigest", "operationRevision", "providerApiVersion", "inputSchemaDigest", "outputSchemaDigest"] as const) {
    invariant(sameValue(previous.catalog[field], proposed.catalog[field]), `catalog.${field} cannot drift during promotion`);
  }
  for (const field of ["adapterId", "adapterVersion", "candidateBuildId"] as const) {
    invariant(bindsOnce(previous.catalog[field], proposed.catalog[field]), `catalog.${field} may bind once at live verification and can never change or disappear afterwards`);
  }
  for (const field of ["actualCreditsUsed", "costCurrency", "costUsed"] as const) {
    const previousValue = previous.metering[field];
    invariant(previousValue === null || sameValue(previousValue, proposed.metering[field]), `metering.${field} may be recorded once at live verification and can never change afterwards`);
  }
  for (const field of ["policy", "requestedCreditCeiling", "timeoutSeconds", "retryMaximumAttempts", "cancellation", "retention", "redaction"] as const) {
    invariant(sameValue(previous.metering[field], proposed.metering[field]), `metering.${field} cannot drift during promotion`);
  }
  for (const field of ["fixture", "live", "support"] as const) {
    if (previous[field] !== undefined) invariant(sameValue(previous[field], proposed[field]), `${field} cannot disappear or mutate during promotion`);
  }
  invariant(
    proposed.chronology.length > previous.chronology.length &&
      JSON.stringify(proposed.chronology.slice(0, previous.chronology.length)) === JSON.stringify(previous.chronology),
    "chronology is append-only; prior entries cannot mutate",
  );
  return deepFreeze(structuredClone(proposed));
}

const FAILURE_TRANSITIONS = new Set(["none->blocked", "none->degraded", "blocked->none", "degraded->none"]);

export function transitionG4Failure(previous: G4OperationEvidence, proposed: G4OperationEvidence): Readonly<G4OperationEvidence> {
  validateG4OperationEvidence(previous);
  validateG4OperationEvidence(proposed);
  const { failure: previousFailure, recordDigest: _previousDigest, ...previousBody } = previous;
  const { failure: proposedFailure, recordDigest: _proposedDigest, ...proposedBody } = proposed;
  invariant(sameValue(previousBody, proposedBody), "failure transition cannot drift identity, stage, bindings, proofs, or chronology");
  invariant(FAILURE_TRANSITIONS.has(`${previousFailure.state}->${proposedFailure.state}`), `failure transition ${previousFailure.state} -> ${proposedFailure.state} is not allowed`);
  return deepFreeze(structuredClone(proposed));
}

export function nextProofs(record: Pick<G4OperationEvidence, "identity" | "stage">): string[] {
  const rank = G4_STAGES.indexOf(record.stage);
  if (record.stage === "unknown") return ["bind the exact cataloged operation contract"];
  if (record.stage === "cataloged") return ["bind digest-bound official research and declare the exact connection, request, and metering posture"];
  const fixtureProof = "reproducible fixture verification as a distinct earlier stage";
  const supportProof = "exact platform/architecture release-matrix cell plus authenticated human support acceptance";
  if (record.identity.operationId === G4_METERED_OPERATION_ID) {
    const liveProof = "credentialed candidate-bound live SERP proof bound to one exact target/market/language with an explicit finite positive OpenSEO credit ceiling, actual usage at or below the ceiling, and one succeeded terminal redacted receipt; requires the operator's explicit provider/spend approval";
    if (rank < 3) return [fixtureProof, liveProof, "authenticated human live-verification acceptance", supportProof];
    if (rank < 4) return [liveProof, "authenticated human live-verification acceptance", supportProof];
    if (rank < 5) return [supportProof];
    return [];
  }
  const analyticsNote = record.identity.operationId === G4_ANALYTICS_OPERATION_ID
    ? " (a ga4_not_connected typed unknown is not success)"
    : "";
  const liveProof = `candidate-bound read-only live proof on the owned ${record.identity.operationId === G4_ZERO_CREDIT_OPERATION_IDS[0] ? "site" : "property"} scope with exactly zero requested and actual OpenSEO credits and one succeeded terminal redacted receipt${analyticsNote}`;
  if (rank < 3) return [fixtureProof, liveProof, "authenticated human live-verification acceptance", supportProof];
  if (rank < 4) return [liveProof, "authenticated human live-verification acceptance", supportProof];
  if (rank < 5) return [supportProof];
  return [];
}

function computeViolations(records: readonly G4OperationEvidence[]): string[] {
  const violations: string[] = [];
  const equalityDomain: Array<{ field: string; read: (record: G4OperationEvidence) => unknown }> = [
    { field: "candidateBuildId", read: (record) => record.catalog.candidateBuildId ?? null },
    { field: "adapterId", read: (record) => record.catalog.adapterId ?? null },
    { field: "adapterVersion", read: (record) => record.catalog.adapterVersion ?? null },
    { field: "connectionRef", read: (record) => record.connection.connectionRef },
    { field: "connectionRevision", read: (record) => record.connection.connectionRevision },
    { field: "principal", read: (record) => record.connection.principal },
    { field: "environment", read: (record) => record.connection.environment },
    { field: "usage", read: (record) => record.connection.usage },
    { field: "projectId", read: (record) => record.connection.projectId },
    { field: "platform", read: (record) => record.support?.platform ?? null },
    { field: "architecture", read: (record) => record.support?.architecture ?? null },
  ];
  for (const { field, read } of equalityDomain) {
    const values = records.map(read);
    const defined = values.filter((value) => value !== null);
    if (defined.length === 0) continue;
    if (defined.length !== values.length) {
      violations.push(`mixed evidence pack: ${field} is present on some cells and absent on others`);
      continue;
    }
    if (defined.some((value) => sameValue(value, defined[0]) === false)) {
      violations.push(`mixed evidence pack: ${field} differs across the three blocking cells where authority requires equality`);
    }
  }
  return violations;
}

export function computeAggregate(records: readonly G4OperationEvidence[]): G4Aggregate {
  for (const record of records) validateG4OperationEvidence(record);
  const violations = computeViolations(records);
  const cells: G4AggregateOperationCell[] = records.map((record) => ({
    operationId: record.identity.operationId,
    stage: record.stage,
    missingProofs: nextProofs(record),
  }));
  const candidates = records.map((record) => record.catalog.candidateBuildId ?? null);
  const sharedCandidate = candidates.every((value) => value === candidates[0]) ? candidates[0] : null;
  const passed = records.length === G4_OPERATION_IDS.length && records.every((record) => record.stage === "supported") && violations.length === 0;
  const body = {
    schemaVersion: "conquistador.g4-aggregate/v1" as const,
    gateStatus: passed ? "PASSED" as const : "UNPASSED" as const,
    releaseStatus: "NO-GO" as const,
    candidateStatus: "UNBOUND" as const,
    sharedCandidateBuildId: sharedCandidate,
    operations: cells,
    violations,
  };
  return { ...body, digest: sha256(body) };
}

export function validateG4EvidencePack(pack: G4EvidencePack): void {
  invariant(Boolean(pack) && typeof pack === "object" && !Array.isArray(pack), "g4 evidence pack must be an object");
  exactKeys(pack, ["schemaVersion", "packId", "revision", "operations", "aggregate", "packDigest"], "g4 evidence pack");
  invariant(pack.schemaVersion === "conquistador.g4-evidence-pack/v1", "g4 pack schema is not v1");
  text(pack.packId, "pack.packId");
  invariant(Number.isInteger(pack.revision) && pack.revision >= 1, "pack revision must be a positive integer");
  invariant(Array.isArray(pack.operations), "pack operations must be an array");
  invariant(pack.operations.length === G4_OPERATION_IDS.length, `the g4 family is exactly ${G4_OPERATION_IDS.length} operations; found ${pack.operations.length}`);
  const ids = pack.operations.map((record) => record.identity.operationId);
  unique(ids, "pack operation ids");
  invariant(
    JSON.stringify([...ids].sort()) === JSON.stringify([...G4_OPERATION_IDS].sort()),
    "pack must contain exactly the three approved g4 operation ids and no fourth operation",
  );
  const ordered = [...pack.operations].sort(
    (left, right) => G4_OPERATION_IDS.indexOf(left.identity.operationId) - G4_OPERATION_IDS.indexOf(right.identity.operationId),
  );
  for (const record of ordered) validateG4OperationEvidence(record);
  const aggregate = computeAggregate(ordered);
  invariant(sameValue(pack.aggregate, aggregate), "declared aggregate differs from the computed 3/3 gate state");
  requireSha256(pack.packDigest, "pack.packDigest");
  const { packDigest, ...body } = pack;
  invariant(sha256({ ...body, aggregate: pack.aggregate }) === packDigest, "g4 pack digest mismatch");
}

export function buildG4StatusRecord(pack: G4EvidencePack): Readonly<G4StatusRecord> {
  validateG4EvidencePack(pack);
  const timestamps = pack.operations.flatMap((record) => record.chronology.map((entry) => entry.at)).sort();
  const body = {
    schemaVersion: "conquistador.g4-status/v1" as const,
    statusId: "local:g4:gate-status:v1",
    generatedAt: timestamps[timestamps.length - 1],
    gateStatus: pack.aggregate.gateStatus,
    releaseStatus: pack.aggregate.releaseStatus,
    candidateStatus: pack.aggregate.candidateStatus,
    evidencePackDigest: pack.packDigest,
    operations: pack.aggregate.operations.map((cell) => ({
      operationId: cell.operationId,
      providerToolName: G4_PROVIDER_TOOL_NAMES[cell.operationId],
      stage: cell.stage,
      missingProofs: cell.missingProofs,
    })),
    violations: pack.aggregate.violations,
  };
  return deepFreeze({ ...body, digest: sha256(body) });
}
