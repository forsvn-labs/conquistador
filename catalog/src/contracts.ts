export type Sha256 = `sha256:${string}`;

export type VerificationState =
  | "unknown"
  | "cataloged"
  | "researched"
  | "fixture-verified"
  | "live-verified"
  | "supported"
  | "degraded"
  | "retired";

export type ActionClass =
  | "observe"
  | "metered-observe"
  | "draft"
  | "consequential"
  | "prohibited";

export type EvidenceKind = "research" | "fixture" | "live" | "release-matrix" | "retirement";

export type SupportEvidence = {
  id: string;
  kind: EvidenceKind;
  candidateBuildId?: string;
  providerVersion: string;
  adapterVersion: string;
  checkedAt: string;
  digest: Sha256;
  terminalReceiptId?: string;
  humanAcceptanceId?: string;
};

export type SupportCell = {
  id: string;
  platform: string;
  architecture: string;
  state: VerificationState;
  evidence: SupportEvidence[];
};

export type ValueSchema = {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  items?: ValueSchema;
};

export type ObjectSchema = {
  type: "object";
  additionalProperties: false;
  properties: Record<string, ValueSchema>;
  required: string[];
};

export type OperationContract = {
  id: string;
  capabilityId: string;
  provider: string;
  product: string;
  category: string;
  outcomes: string[];
  actionClass: ActionClass;
  providerApiVersion: string;
  authScopes: string[];
  dataClassification: "public" | "internal" | "confidential" | "restricted";
  pii: "none" | "possible" | "required";
  residency: string;
  rateLimit: string;
  quotaUnit: string;
  monetaryUnit: string;
  maximumUnitsPerRun?: number;
  maximumCostPerRun?: number;
  inputKeys: string[];
  requiredInputKeys: string[];
  outputKeys: string[];
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  pagination: string;
  retry: string;
  idempotency: "none" | "required";
  officialSources: string[];
  provenance: string;
  checkedAt: string;
  knownGaps: string[];
  roadmapDestination: string;
  supportCells: SupportCell[];
};

export type Catalog = {
  schemaVersion: "conquistador.tool-catalog/v1";
  productVersion: "1.0.0";
  status: "candidate-operations-not-supported" | "candidate-bound";
  operations: OperationContract[];
};

export type OnboardingMaturity =
  | "unknown"
  | "cataloged"
  | "researched"
  | "fixture-verified"
  | "live-verified"
  | "supported";

export type OnboardingDemand = {
  playbookId: string;
  playbookVersion: string;
  stepId: string;
  requestedOutcome: string;
  requestedCapability: string;
  recordedAt: string;
  ownerRef: string;
  digest: Sha256;
};

export type OnboardingOperationSnapshot = {
  provider: string;
  operationId: string;
  capabilityId: string;
  actionClass: ActionClass;
  providerApiVersion: string;
  authScopes: string[];
  rateLimit: string;
  quotaUnit: string;
  monetaryUnit: string;
  budget: {
    mode: "metered" | "non-metered";
    maximumUnitsPerRun: number | null;
    maximumCostPerRun: number | null;
  };
};

export type OnboardingResearch = {
  apiSources: string[];
  termsSources: string[];
  authSources: string[];
  checkedAt: string;
  providerApiVersion: string;
  digest: Sha256;
};

export type OnboardingFixtureProof = {
  fixtureId: string;
  digest: Sha256;
  adapterVersion: string;
  providerVersion: string;
  checkedAt: string;
};

export type OnboardingLiveProof = {
  candidateBuildId: string;
  adapterId: string;
  adapterVersion: string;
  receipt: Receipt;
  supervisorId: string;
  authenticatedHuman: true;
  authenticationMethod: string;
  acceptedAt: string;
  humanAcceptanceId: string;
};

export type OnboardingSupportProof = {
  releaseMatrixId: string;
  digest: Sha256;
  platform: string;
  architecture: string;
  checkedAt: string;
  acceptedBy: string;
  authenticatedHuman: true;
  authenticationMethod: string;
  acceptedAt: string;
  humanAcceptanceId: string;
};

export type OnboardingFailurePosture = {
  state: "none" | "blocked" | "degraded";
  reasonCodes: string[];
  fallback: "human-action-manifest" | "fail-closed";
  retry: {
    strategy: "none" | "bounded";
    maximumAttempts: number;
    backoff: "none" | "fixed" | "exponential";
  };
  evidence?: string;
  assertedAt?: string;
};

export type ProviderOnboardingRecord = {
  schemaVersion: "conquistador.provider-onboarding/v1";
  id: string;
  maturity: OnboardingMaturity;
  supportCellId: string;
  demand: OnboardingDemand;
  operation: OnboardingOperationSnapshot;
  supportOwner: string;
  nextProofOwner: string;
  failure: OnboardingFailurePosture;
  research?: OnboardingResearch;
  fixtureProof?: OnboardingFixtureProof;
  liveProof?: OnboardingLiveProof;
  supportProof?: OnboardingSupportProof;
};

export type CapabilityRequest = {
  schemaVersion: "conquistador.capability-request/v1";
  id: string;
  candidateBuildId: string;
  capabilityId: string;
  operationId: string;
  connectionRef: string;
  expectedPrincipal: ConnectionPrincipal;
  connectionEnvironment: ConnectionEnvironment;
  connectionRevision: number;
  input: Record<string, unknown>;
  deadlineAt: string;
  idempotencyKey?: string;
  maxUnits?: number;
  maxCost?: number;
};

export type CapabilityResult = {
  schemaVersion: "conquistador.capability-result/v1";
  requestId: string;
  operationId: string;
  providerRequestId?: string;
  providerCorrelationId?: string;
  providerResourceId?: string;
  data: Record<string, unknown>;
  sourceUrls: string[];
  freshnessAt: string;
  pagination: { complete: boolean; cursor?: string; truncated: boolean };
  unitsUsed: number;
  costUsed: number;
  providerStatus: "succeeded" | "partial" | "pending" | "unknown";
};

export const CAPABILITY_ERROR_CODES = [
  "unknown-operation",
  "unsupported",
  "stale-support",
  "scope-denied",
  "principal-denied",
  "connection-denied",
  "budget-denied",
  "approval-denied",
  "replay-denied",
  "cancelled",
  "provider-failure",
  "prohibited",
  "invalid-request",
] as const;

export type CapabilityError = {
  schemaVersion: "conquistador.capability-error/v1";
  requestId: string;
  code: (typeof CAPABILITY_ERROR_CODES)[number];
  message: string;
  retryable: boolean;
};

export type AdapterManifest = {
  schemaVersion: "conquistador.adapter-manifest/v1";
  id: string;
  provider: string;
  version: string;
  sdkVersion: "1.0.0";
  operationIds: string[];
  capabilityIds: string[];
  credentialInjection: "host-only";
  transport: "audited-adapter-only";
};

export type ExtensionKind = "outcome-skill" | "host-tool" | "provider-adapter";

export type ExtensionMaturity =
  | "unknown"
  | "cataloged"
  | "researched"
  | "fixture-verified"
  | "live-verified"
  | "supported";

export type ExtensionConnection = {
  required: boolean;
  provider: string;
  scopes: string[];
  credentialCustody: "host-only";
};

export type ExtensionBudget = {
  rateLimit: string;
  quotaUnit: string;
  monetaryUnit: string;
  maximumUnitsPerRun?: number;
  maximumCostPerRun?: number;
};

export type ExtensionFailure = {
  unavailable: "fail-closed" | "omit-optional-dependency";
  degraded: "fail-closed" | "return-degraded-result";
  retry: {
    strategy: "none" | "bounded";
    maximumAttempts: number;
    backoff: "none" | "fixed" | "exponential";
  };
  recovery: "manual-reconnect" | "resume-from-artifact" | "not-applicable";
};

export type ExtensionCatalogReference = {
  provider: string;
  capabilityId: string;
  operationId: string;
};

export type ExtensionOperation = {
  id: string;
  capabilityId: string;
  catalog?: ExtensionCatalogReference;
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  actionClass: ActionClass;
  budget: ExtensionBudget;
  connection: ExtensionConnection;
  maturity: ExtensionMaturity;
  dependencies: ExtensionCatalogReference[];
  failure: ExtensionFailure;
};

export type ExtensionManifest = {
  schemaVersion: "conquistador.extension-manifest/v1";
  id: string;
  version: string;
  kind: ExtensionKind;
  activation: "on-demand-skill" | "host-mediated" | "typed-adapter";
  transport: "none" | "host-connector" | "host-mcp" | "audited-adapter-only";
  provenance: {
    sourceId: string;
    sourceVersion: string;
    digest: Sha256;
  };
  operations: ExtensionOperation[];
};

export type ConnectionReference = {
  schemaVersion: "conquistador.connection-reference/v1";
  id: string;
  provider: string;
  principal: ConnectionPrincipal;
  allowedOperationIds: string[];
  scopes: string[];
  environment: ConnectionEnvironment;
  usage: ConnectionUsage;
  revision: number;
  state: ConnectionState;
  rotatedFrom?: string;
  verifiedAt: string;
  expiresAt?: string;
  invalidatedAt?: string;
  storagePolicy: ConnectionStoragePolicy;
};

export type ConnectionPrincipal = {
  accountId: string;
  workspaceId: string;
  displayName: string;
};

export type ConnectionEnvironment = "sandbox" | "production";
export type ConnectionUsage = "ephemeral-test" | "user-production";
export type ConnectionState = "active" | "revoked" | "expired";

export type ConnectionStoragePolicy = {
  referenceMetadata: "conquistador-local";
  secretStorage: "host-secure-store-only";
  export: "forbidden";
  recovery: "reauthenticate-only";
};

export type HostConnectionResolution = {
  schemaVersion: "conquistador.host-connection-resolution/v1";
  connectionRef: string;
  provider: string;
  principal: ConnectionPrincipal;
  allowedOperationIds: string[];
  scopes: string[];
  environment: ConnectionEnvironment;
  usage: ConnectionUsage;
  revision: number;
  state: ConnectionState;
  resolvedAt: string;
  credential: unknown;
};

export type AdapterContext = {
  connection: ConnectionReference;
  credential: unknown;
  deadlineAt: string;
  signal?: AbortSignal;
};

export type Adapter = {
  manifest: AdapterManifest;
  handlers: Record<
    string,
    (request: CapabilityRequest, context: AdapterContext) => Promise<CapabilityResult>
  >;
};

export type ConsequentialManifest = {
  schemaVersion: "conquistador.consequential-manifest/v1";
  id: string;
  proposalId: string;
  runId: string;
  reviewId: string;
  candidateBuildId: string;
  requestId: string;
  capabilityId: string;
  operationId: string;
  adapterId: string;
  adapterVersion: string;
  connectionRef: string;
  principal: ConnectionReference["principal"];
  connectionEnvironment: ConnectionEnvironment;
  connectionRevision: number;
  actionClass: "consequential";
  destinations: string[];
  platforms: string[];
  payloadDigest: Sha256;
  mediaDigests: Sha256[];
  scheduleAt?: string;
  timezone?: string;
  maximumUnits: number;
  maximumCost: number;
  dataClassification: OperationContract["dataClassification"];
  disclosures: string[];
  preconditionDigests: Sha256[];
  previewDigest: Sha256;
  idempotencyKey: string;
  notBefore: string;
  expiresAt: string;
  reversibility: string;
  expectedOutcome: string;
  approverPolicy: string;
  digest: Sha256;
};

export type HumanApproval = {
  schemaVersion: "conquistador.human-approval/v1";
  id: string;
  manifestDigest: Sha256;
  approverId: string;
  authenticationMethod: string;
  authenticatedHuman: true;
  approvedAt: string;
  expiresAt: string;
  singleUse: true;
};

export type ReceiptStatus =
  | "succeeded"
  | "partial"
  | "failed"
  | "pending"
  | "unknown"
  | "rejected"
  | "expired"
  | "blocked";

export type Receipt = {
  schemaVersion: "conquistador.receipt/v1";
  id: string;
  candidateBuildId: string;
  requestId: string;
  proposalId?: string;
  manifestDigest?: Sha256;
  approvalId?: string;
  runId?: string;
  reviewId?: string;
  capabilityId: string;
  operationId: string;
  adapterId?: string;
  adapterVersion?: string;
  provider: string;
  connectionRef?: string;
  connectionRevision?: number;
  connectionEnvironment?: ConnectionEnvironment;
  connectionPrincipal?: ConnectionReference["principal"];
  actionClass: ActionClass;
  requestDigest: Sha256;
  payloadDigest?: Sha256;
  destinationDigests: Sha256[];
  startedAt: string;
  finishedAt: string;
  status: ReceiptStatus;
  providerStatus?: CapabilityResult["providerStatus"];
  providerRequestId?: string;
  providerCorrelationId?: string;
  providerResourceId?: string;
  unitsUsed: number;
  costUsed: number;
  pagination?: CapabilityResult["pagination"];
  sourceUrls: string[];
  safeResponseDigest?: Sha256;
  safeExcerpt?: string;
  error?: CapabilityError;
  retryCount: number;
  idempotencyKey?: string;
  reversalGuidance?: string;
  redactionApplied: true;
  terminalRecord: true;
  receiptDigest: Sha256;
};

export type GatewayOutcome = {
  ok: boolean;
  result?: CapabilityResult;
  error?: CapabilityError;
  receipt: Receipt;
};
