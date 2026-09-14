import type {
  Catalog,
  OnboardingDemand,
  OnboardingMaturity,
  OperationContract,
  ProviderOnboardingRecord,
} from "./contracts.ts";
import { canonicalJson, deepFreeze, sha256 } from "./canonical.ts";
import { verifyReceipt } from "./receipt.ts";
import { invariant, requireSha256, validateCatalog } from "./validate.ts";

const ID = /^[a-z0-9]+(?:[.:-][a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const FLOATING = /(?:^|[._-])(?:latest|default|auto|current|any)(?:$|[._-])/i;
const MATURITY: OnboardingMaturity[] = [
  "unknown", "cataloged", "researched", "fixture-verified", "live-verified", "supported",
];

function exactKeys(value: object, allowed: string[], label: string): void {
  invariant(Object.keys(value).every((key) => allowed.includes(key)), `${label} includes undeclared fields`);
}

function text(value: unknown, label: string): asserts value is string {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required`);
  invariant(!value.includes("*"), `${label} cannot contain a wildcard`);
}

function exactVersion(value: unknown, label: string, semver = false): asserts value is string {
  text(value, label);
  invariant(!FLOATING.test(value), `${label} must not float`);
  if (semver) invariant(SEMVER.test(value), `${label} must be exact semver`);
}

function timestamp(value: unknown, label: string): void {
  invariant(
    typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
    `${label} must be an exact UTC ISO timestamp`,
  );
}

function unique(values: string[], label: string): void {
  invariant(new Set(values).size === values.length, `${label} must be unique`);
}

const SET_ARRAY_FIELDS = new Set(["authScopes", "apiSources", "termsSources", "authSources", "reasonCodes"]);

function semanticValue(value: unknown, parentKey = ""): unknown {
  if (Array.isArray(value)) {
    const entries = value.map((entry) => semanticValue(entry));
    return SET_ARRAY_FIELDS.has(parentKey)
      ? entries.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)))
      : entries;
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, semanticValue(child, key)]),
  );
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJson(semanticValue(left)) === canonicalJson(semanticValue(right));
}

export function onboardingDemandBinding(
  demand: Omit<OnboardingDemand, "digest">,
  operation: ProviderOnboardingRecord["operation"],
): object {
  return semanticValue({ ...demand, operation }) as object;
}

export function onboardingDemandDigest(
  demand: Omit<OnboardingDemand, "digest">,
  operation: ProviderOnboardingRecord["operation"],
): ProviderOnboardingRecord["demand"]["digest"] {
  return sha256(onboardingDemandBinding(demand, operation));
}

export function onboardingResearchDigest(
  research: Omit<NonNullable<ProviderOnboardingRecord["research"]>, "digest">,
  operation: ProviderOnboardingRecord["operation"],
): ProviderOnboardingRecord["demand"]["digest"] {
  return sha256(semanticValue({ ...research, provider: operation.provider, operationId: operation.operationId }));
}

function validateDemand(record: ProviderOnboardingRecord): void {
  const demand = record.demand;
  exactKeys(demand, ["playbookId", "playbookVersion", "stepId", "requestedOutcome", "requestedCapability", "recordedAt", "ownerRef", "digest"], "onboarding demand");
  text(demand.playbookId, "demand.playbookId");
  invariant(demand.playbookId.startsWith("playbook:"), "demand.playbookId must identify an exact playbook");
  exactVersion(demand.playbookVersion, "demand.playbookVersion", true);
  text(demand.stepId, "demand.stepId");
  text(demand.requestedOutcome, "demand.requestedOutcome");
  text(demand.requestedCapability, "demand.requestedCapability");
  text(demand.ownerRef, "demand.ownerRef");
  timestamp(demand.recordedAt, "demand.recordedAt");
  requireSha256(demand.digest, "demand.digest");
  const { digest, ...fields } = demand;
  invariant(onboardingDemandDigest(fields, record.operation) === digest, "demand digest does not bind the declared demand and exact operation");
}

function validateOperationSnapshot(record: ProviderOnboardingRecord): void {
  const operation = record.operation;
  exactKeys(operation, ["provider", "operationId", "capabilityId", "actionClass", "providerApiVersion", "authScopes", "rateLimit", "quotaUnit", "monetaryUnit", "budget"], "onboarding operation");
  [operation.provider, operation.operationId, operation.capabilityId].forEach((value, index) => {
    text(value, ["operation.provider", "operation.operationId", "operation.capabilityId"][index]);
    invariant(ID.test(value), "operation identity must be exact and normalized");
  });
  invariant(["observe", "metered-observe", "draft", "consequential", "prohibited"].includes(operation.actionClass), "operation.actionClass is invalid");
  exactVersion(operation.providerApiVersion, "operation.providerApiVersion");
  invariant(Array.isArray(operation.authScopes), "operation.authScopes must be an array");
  unique(operation.authScopes, "operation.authScopes");
  operation.authScopes.forEach((scope) => text(scope, "operation auth scope"));
  [operation.rateLimit, operation.quotaUnit, operation.monetaryUnit].forEach((value, index) => text(value, ["operation.rateLimit", "operation.quotaUnit", "operation.monetaryUnit"][index]));
  exactKeys(operation.budget, ["mode", "maximumUnitsPerRun", "maximumCostPerRun"], "operation budget");
  invariant(["metered", "non-metered"].includes(operation.budget.mode), "operation budget mode is invalid");
  if (operation.budget.mode === "metered") {
    invariant(typeof operation.budget.maximumUnitsPerRun === "number" && Number.isFinite(operation.budget.maximumUnitsPerRun) && operation.budget.maximumUnitsPerRun > 0, "metered budget needs a finite positive unit ceiling");
    invariant(typeof operation.budget.maximumCostPerRun === "number" && Number.isFinite(operation.budget.maximumCostPerRun) && operation.budget.maximumCostPerRun >= 0, "metered budget needs a finite cost ceiling");
  } else {
    invariant(operation.budget.maximumUnitsPerRun === null && operation.budget.maximumCostPerRun === null, "non-metered budget must explicitly use null ceilings");
  }
}

function catalogSnapshot(operation: OperationContract): ProviderOnboardingRecord["operation"] {
  const metered = operation.maximumUnitsPerRun !== undefined || operation.maximumCostPerRun !== undefined;
  return {
    provider: operation.provider,
    operationId: operation.id,
    capabilityId: operation.capabilityId,
    actionClass: operation.actionClass,
    providerApiVersion: operation.providerApiVersion,
    authScopes: operation.authScopes,
    rateLimit: operation.rateLimit,
    quotaUnit: operation.quotaUnit,
    monetaryUnit: operation.monetaryUnit,
    budget: {
      mode: metered ? "metered" : "non-metered",
      maximumUnitsPerRun: operation.maximumUnitsPerRun ?? null,
      maximumCostPerRun: operation.maximumCostPerRun ?? null,
    },
  };
}

function urls(values: string[], label: string): void {
  invariant(Array.isArray(values) && values.length > 0, `${label} needs at least one official source`);
  unique(values, label);
  invariant(values.every((value) => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }), `${label} must contain non-secret HTTPS URLs`);
}

export function validateProviderOnboardingRecord(record: ProviderOnboardingRecord, catalog: Catalog): void {
  validateCatalog(catalog);
  invariant(Boolean(record) && typeof record === "object" && !Array.isArray(record), "onboarding record must be an object");
  exactKeys(record, ["schemaVersion", "id", "maturity", "supportCellId", "demand", "operation", "supportOwner", "nextProofOwner", "failure", "research", "fixtureProof", "liveProof", "supportProof"], "onboarding record");
  invariant(record.schemaVersion === "conquistador.provider-onboarding/v1", "onboarding schema is not v1");
  text(record.id, "onboarding record ID");
  invariant(ID.test(record.id), "onboarding record ID is invalid");
  invariant(MATURITY.includes(record.maturity), "onboarding maturity is invalid");
  text(record.supportCellId, "supportCellId");
  text(record.supportOwner, "supportOwner");
  text(record.nextProofOwner, "nextProofOwner");
  validateOperationSnapshot(record);
  validateDemand(record);
  invariant(record.demand.requestedCapability === record.operation.capabilityId, "demand requested capability differs from the exact operation");

  const failure = record.failure;
  exactKeys(failure, ["state", "reasonCodes", "fallback", "retry", "evidence", "assertedAt"], "failure posture");
  invariant(["none", "blocked", "degraded"].includes(failure.state), "failure state is invalid");
  invariant(Array.isArray(failure.reasonCodes), "failure.reasonCodes must be an array");
  unique(failure.reasonCodes, "failure.reasonCodes");
  failure.reasonCodes.forEach((code) => text(code, "failure reason code"));
  invariant(["human-action-manifest", "fail-closed"].includes(failure.fallback), "failure fallback must fail closed");
  exactKeys(failure.retry, ["strategy", "maximumAttempts", "backoff"], "failure retry policy");
  invariant(["none", "bounded"].includes(failure.retry.strategy), "failure retry strategy is invalid");
  invariant(Number.isInteger(failure.retry.maximumAttempts) && failure.retry.maximumAttempts >= 0 && failure.retry.maximumAttempts <= 5, "failure retry attempts must be bounded from 0 to 5");
  invariant(["none", "fixed", "exponential"].includes(failure.retry.backoff), "failure retry backoff is invalid");
  invariant(failure.retry.strategy === "bounded" || (failure.retry.maximumAttempts === 0 && failure.retry.backoff === "none"), "no-retry policy cannot declare attempts or backoff");
  invariant(failure.retry.strategy === "none" || (failure.retry.maximumAttempts > 0 && failure.retry.backoff !== "none"), "bounded retry policy needs positive attempts and backoff");
  if (failure.state === "none") {
    invariant(failure.reasonCodes.length === 0 && failure.evidence === undefined && failure.assertedAt === undefined, "clear failure state cannot assert failure evidence");
  } else {
    invariant(failure.reasonCodes.length > 0, "asserted failure needs exact reason codes");
    text(failure.evidence, "failure.evidence");
    timestamp(failure.assertedAt, "failure.assertedAt");
  }

  const rank = MATURITY.indexOf(record.maturity);
  const operation = catalog.operations.find((entry) => entry.id === record.operation.operationId);
  if (rank >= 1) {
    invariant(Boolean(operation), "cataloged onboarding needs one exact catalog operation");
    invariant(same(record.operation, catalogSnapshot(operation!)), "onboarding operation snapshot differs from the exact catalog operation");
    invariant(operation!.supportCells.some((cell) => cell.id === record.supportCellId), "onboarding support cell is not declared by the exact catalog operation");
  }

  const proofRules = [
    ["research", 2], ["fixtureProof", 3], ["liveProof", 4], ["supportProof", 5],
  ] as const;
  for (const [field, proofRank] of proofRules) {
    if (rank >= proofRank) {
      invariant(record[field] !== undefined, `${field} is required at ${MATURITY[proofRank]} and above`);
    } else {
      invariant(record[field] === undefined, `${field} may appear only at ${MATURITY[proofRank]} and above`);
    }
  }

  if (record.research) {
    exactKeys(record.research, ["apiSources", "termsSources", "authSources", "checkedAt", "providerApiVersion", "digest"], "onboarding research");
    urls(record.research.apiSources, "research.apiSources");
    urls(record.research.termsSources, "research.termsSources");
    urls(record.research.authSources, "research.authSources");
    unique([...record.research.apiSources, ...record.research.termsSources, ...record.research.authSources], "all research sources");
    timestamp(record.research.checkedAt, "research.checkedAt");
    exactVersion(record.research.providerApiVersion, "research.providerApiVersion");
    invariant(record.research.providerApiVersion === record.operation.providerApiVersion, "research provider API version differs from operation");
    requireSha256(record.research.digest, "research.digest");
    const { digest, ...researchFields } = record.research;
    invariant(onboardingResearchDigest(researchFields, record.operation) === digest, "research digest does not bind the official research and exact operation");
  }
  const cell = operation?.supportCells.find((entry) => entry.id === record.supportCellId);
  if (record.fixtureProof) {
    exactKeys(record.fixtureProof, ["fixtureId", "digest", "adapterVersion", "providerVersion", "checkedAt"], "fixture proof");
    text(record.fixtureProof.fixtureId, "fixtureProof.fixtureId");
    requireSha256(record.fixtureProof.digest, "fixtureProof.digest");
    exactVersion(record.fixtureProof.adapterVersion, "fixtureProof.adapterVersion", true);
    exactVersion(record.fixtureProof.providerVersion, "fixtureProof.providerVersion");
    timestamp(record.fixtureProof.checkedAt, "fixtureProof.checkedAt");
    invariant(record.fixtureProof.providerVersion === record.operation.providerApiVersion, "fixture provider version differs from operation");
    invariant(cell?.evidence.some((evidence) => evidence.kind === "fixture" && evidence.id === record.fixtureProof!.fixtureId && evidence.digest === record.fixtureProof!.digest && evidence.adapterVersion === record.fixtureProof!.adapterVersion && evidence.providerVersion === record.fixtureProof!.providerVersion && evidence.checkedAt === record.fixtureProof!.checkedAt), "fixture proof does not match exact catalog support evidence");
  }
  if (record.liveProof) {
    exactKeys(record.liveProof, ["candidateBuildId", "adapterId", "adapterVersion", "receipt", "supervisorId", "authenticatedHuman", "authenticationMethod", "acceptedAt", "humanAcceptanceId"], "live proof");
    invariant(/^[0-9a-f]{64}$/.test(record.liveProof.candidateBuildId), "live proof needs an exact Candidate Build ID");
    text(record.liveProof.adapterId, "liveProof.adapterId");
    exactVersion(record.liveProof.adapterVersion, "liveProof.adapterVersion", true);
    text(record.liveProof.supervisorId, "liveProof.supervisorId");
    invariant(record.liveProof.authenticatedHuman === true, "live proof supervisor must be an authenticated human");
    text(record.liveProof.authenticationMethod, "liveProof.authenticationMethod");
    text(record.liveProof.humanAcceptanceId, "liveProof.humanAcceptanceId");
    timestamp(record.liveProof.acceptedAt, "liveProof.acceptedAt");
    verifyReceipt(record.liveProof.receipt);
    const receipt = record.liveProof.receipt;
    invariant(receipt.status === "succeeded" && receipt.providerStatus === "succeeded", "live proof receipt must be succeeded");
    invariant(receipt.redactionApplied === true && receipt.terminalRecord === true, "live proof receipt must be redacted and terminal");
    invariant(receipt.candidateBuildId === record.liveProof.candidateBuildId && receipt.operationId === record.operation.operationId && receipt.capabilityId === record.operation.capabilityId && receipt.provider === record.operation.provider && receipt.actionClass === record.operation.actionClass && receipt.adapterId === record.liveProof.adapterId && receipt.adapterVersion === record.liveProof.adapterVersion, "live receipt differs from the exact operation/provider/adapter/candidate");
    invariant(cell?.evidence.some((evidence) => evidence.kind === "live" && evidence.candidateBuildId === receipt.candidateBuildId && evidence.terminalReceiptId === receipt.id && evidence.adapterVersion === record.liveProof!.adapterVersion && evidence.providerVersion === record.operation.providerApiVersion), "live proof does not match exact catalog support evidence");
  }
  if (record.supportProof) {
    exactKeys(record.supportProof, ["releaseMatrixId", "digest", "platform", "architecture", "checkedAt", "acceptedBy", "authenticatedHuman", "authenticationMethod", "acceptedAt", "humanAcceptanceId"], "support proof");
    [record.supportProof.releaseMatrixId, record.supportProof.platform, record.supportProof.architecture, record.supportProof.acceptedBy, record.supportProof.humanAcceptanceId].forEach((value) => text(value, "support proof identity"));
    invariant(record.supportProof.authenticatedHuman === true, "support acceptor must be an authenticated human");
    text(record.supportProof.authenticationMethod, "supportProof.authenticationMethod");
    invariant(![record.supportProof.platform, record.supportProof.architecture].includes("unbound"), "supported dimensions must be exact");
    requireSha256(record.supportProof.digest, "supportProof.digest");
    timestamp(record.supportProof.checkedAt, "supportProof.checkedAt");
    timestamp(record.supportProof.acceptedAt, "supportProof.acceptedAt");
    invariant(failure.state === "none", "blocked or degraded onboarding cannot become supported");
    invariant(cell?.state === "supported" && cell.platform === record.supportProof.platform && cell.architecture === record.supportProof.architecture, "support proof dimensions do not match an exact supported cell");
    invariant(cell.evidence.some((evidence) => evidence.kind === "release-matrix" && evidence.id === record.supportProof!.releaseMatrixId && evidence.digest === record.supportProof!.digest && evidence.checkedAt === record.supportProof!.checkedAt && evidence.humanAcceptanceId === record.supportProof!.humanAcceptanceId && evidence.providerVersion === record.operation.providerApiVersion && evidence.adapterVersion === record.liveProof!.adapterVersion), "support proof does not match exact release-matrix evidence and human acceptance");
  }

  const chronological = [
    ["demand.recordedAt", record.demand.recordedAt],
    ...(record.research ? [["research.checkedAt", record.research.checkedAt]] : []),
    ...(record.fixtureProof ? [["fixtureProof.checkedAt", record.fixtureProof.checkedAt]] : []),
    ...(record.liveProof ? [["liveProof.receipt.finishedAt", record.liveProof.receipt.finishedAt], ["liveProof.acceptedAt", record.liveProof.acceptedAt]] : []),
    ...(record.supportProof ? [["supportProof.checkedAt", record.supportProof.checkedAt], ["supportProof.acceptedAt", record.supportProof.acceptedAt]] : []),
  ] as Array<[string, string]>;
  for (let index = 1; index < chronological.length; index += 1) {
    invariant(
      Date.parse(chronological[index - 1][1]) <= Date.parse(chronological[index][1]),
      `${chronological[index - 1][0]} must not be after ${chronological[index][0]}`,
    );
  }
}

export function promoteProviderOnboarding(
  previous: ProviderOnboardingRecord,
  proposed: ProviderOnboardingRecord,
  catalog: Catalog,
): Readonly<ProviderOnboardingRecord> {
  validateProviderOnboardingRecord(previous, catalog);
  validateProviderOnboardingRecord(proposed, catalog);
  invariant(previous.failure.state === "none" && proposed.failure.state === "none", "onboarding cannot promote while failure is asserted");
  const previousRank = MATURITY.indexOf(previous.maturity);
  invariant(MATURITY[previousRank + 1] === proposed.maturity, `onboarding transition ${previous.maturity} → ${proposed.maturity} is not allowed`);
  for (const field of ["schemaVersion", "id", "supportCellId", "demand", "operation", "supportOwner", "nextProofOwner", "failure"] as const) {
    invariant(same(previous[field], proposed[field]), `${field} cannot drift during promotion`);
  }
  for (const field of ["research", "fixtureProof", "liveProof", "supportProof"] as const) {
    if (previous[field] !== undefined) invariant(same(previous[field], proposed[field]), `${field} cannot disappear or mutate during promotion`);
  }
  return deepFreeze(structuredClone(proposed));
}

export function transitionProviderOnboardingFailure(
  previous: ProviderOnboardingRecord,
  proposed: ProviderOnboardingRecord,
  catalog: Catalog,
): Readonly<ProviderOnboardingRecord> {
  validateProviderOnboardingRecord(previous, catalog);
  validateProviderOnboardingRecord(proposed, catalog);
  const { failure: previousFailure, ...previousRecord } = previous;
  const { failure: proposedFailure, ...proposedRecord } = proposed;
  invariant(same(previousRecord, proposedRecord), "failure transition cannot drift identity, demand, operation, proof, owner, or maturity");
  invariant(same(previousFailure.fallback, proposedFailure.fallback), "failure fallback policy cannot drift");
  invariant(same(previousFailure.retry, proposedFailure.retry), "failure retry policy cannot drift");
  const transition = `${previousFailure.state}->${proposedFailure.state}`;
  invariant(
    ["none->blocked", "none->degraded", "blocked->none", "degraded->none"].includes(transition),
    `failure transition ${transition} is not allowed`,
  );
  return deepFreeze(structuredClone(proposed));
}
