import type {
  Adapter,
  CapabilityError,
  CapabilityRequest,
  CapabilityResult,
  Catalog,
  ConnectionReference,
  ConsequentialManifest,
  GatewayOutcome,
  HumanApproval,
  HostConnectionResolution,
  OperationContract,
  Receipt,
  Sha256,
} from "./contracts.ts";
import { deepFreeze, sha256 } from "./canonical.ts";
import { supportIsFresh } from "./lifecycle.ts";
import { createReceipt, ReceiptStore, redact, sensitiveStrings } from "./receipt.ts";
import {
  invariant,
  requireSha256,
  validateAdapterManifest,
  validateCapabilityRequest,
  validateCatalog,
  validateConnectionReference,
  validateRecordShape,
} from "./validate.ts";

type SelectedOperation = {
  operation: OperationContract;
  adapter: Adapter;
  connection: ConnectionReference;
};

export type GatewayConfig = {
  catalog: Catalog;
  adapters: Record<string, Adapter>;
  connections: Record<string, ConnectionReference>;
  resolveConnection: (reference: Readonly<ConnectionReference>) => Promise<HostConnectionResolution>;
  receipts?: ReceiptStore;
  now?: () => Date;
  maximumSupportAgeDays?: number;
  verifyHumanApproval?: (approval: HumanApproval, manifest: ConsequentialManifest) => boolean;
  candidateVerification?: {
    candidateBuildId: string;
    operationIds: string[];
  };
};

export type ConsequentialProposal = {
  proposalId: string;
  runId: string;
  reviewId: string;
  destinations: string[];
  platforms: string[];
  mediaDigests: Sha256[];
  scheduleAt?: string;
  timezone?: string;
  maximumUnits: number;
  maximumCost: number;
  disclosures: string[];
  preconditionDigests: Sha256[];
  previewDigest: Sha256;
  notBefore: string;
  expiresAt: string;
  reversibility: string;
  expectedOutcome: string;
  approverPolicy: string;
};

export type ExecuteOptions = {
  manifest?: ConsequentialManifest;
  approval?: HumanApproval;
  signal?: AbortSignal;
};

function capabilityError(
  requestId: string,
  code: CapabilityError["code"],
  message: string,
  retryable = false,
): CapabilityError {
  return {
    schemaVersion: "conquistador.capability-error/v1",
    requestId,
    code,
    message,
    retryable,
  };
}

function terminalStatus(result: CapabilityResult): Receipt["status"] {
  return result.providerStatus;
}

export class Gateway {
  readonly #catalog: Catalog;
  readonly #adapters: Record<string, Adapter>;
  readonly #connections: Record<string, ConnectionReference>;
  readonly #resolveConnection: GatewayConfig["resolveConnection"];
  readonly #receipts: ReceiptStore;
  readonly #now: () => Date;
  readonly #maximumSupportAgeDays: number;
  readonly #verifyHumanApproval?: GatewayConfig["verifyHumanApproval"];
  readonly #candidateVerification?: GatewayConfig["candidateVerification"];
  readonly #usedApprovalIds = new Set<string>();
  readonly #usedManifestDigests = new Set<string>();
  readonly #usedIdempotencyKeys = new Set<string>();
  #receiptSequence = 0;

  constructor(config: GatewayConfig) {
    const catalog = deepFreeze(structuredClone(config.catalog)) as Catalog;
    validateCatalog(catalog);
    const adapters = Object.fromEntries(
      Object.entries(config.adapters).map(([key, adapter]) => [
        key,
        deepFreeze({ manifest: structuredClone(adapter.manifest), handlers: { ...adapter.handlers } }) as Adapter,
      ]),
    );
    for (const adapter of Object.values(adapters)) {
      validateAdapterManifest(adapter.manifest, catalog);
    }
    if (config.candidateVerification) {
      invariant(
        /^[0-9a-f]{64}$/.test(config.candidateVerification.candidateBuildId),
        "candidate verification needs an exact Candidate Build ID",
      );
      invariant(config.candidateVerification.operationIds.length > 0, "candidate verification needs exact operations");
      invariant(
        new Set(config.candidateVerification.operationIds).size === config.candidateVerification.operationIds.length,
        "candidate verification operations must be unique",
      );
      for (const operationId of config.candidateVerification.operationIds) {
        const operation = catalog.operations.find((item) => item.id === operationId);
        invariant(operation && operation.actionClass !== "prohibited", "candidate verification operation is unavailable");
        const adapter = Object.values(adapters).find((item) => item.manifest.operationIds.includes(operationId));
        invariant(adapter, "candidate verification operation has no audited adapter");
        invariant(
          operation.supportCells.some((cell) =>
            cell.state !== "retired" && cell.evidence.some((evidence) =>
              evidence.kind === "fixture" &&
              evidence.providerVersion === operation.providerApiVersion &&
              evidence.adapterVersion === adapter.manifest.version,
            ),
          ),
          "candidate verification requires exact fixture evidence",
        );
      }
    }
    invariant(typeof config.resolveConnection === "function", "gateway needs one host connection resolver");
    const connections = Object.fromEntries(
      Object.entries(config.connections).map(([key, connection]) => [key, deepFreeze(structuredClone(connection)) as ConnectionReference]),
    );
    for (const [key, connection] of Object.entries(connections)) {
      validateConnectionReference(connection);
      invariant(key === connection.id, "connection map key must equal its opaque reference ID");
      const scopes = new Set<string>();
      for (const operationId of connection.allowedOperationIds) {
        const operation = catalog.operations.find((item) => item.id === operationId);
        invariant(operation && operation.actionClass !== "prohibited", "connection allowed operation is unavailable");
        invariant(operation.provider === connection.provider, "connection allowed operation crosses providers");
        operation.authScopes.forEach((scope) => scopes.add(scope));
      }
      invariant(JSON.stringify([...scopes].sort()) === JSON.stringify([...connection.scopes].sort()), "connection scopes must exactly equal allowed operation scopes");
    }
    this.#catalog = catalog;
    this.#adapters = deepFreeze(adapters) as Record<string, Adapter>;
    this.#connections = deepFreeze(connections) as Record<string, ConnectionReference>;
    this.#resolveConnection = config.resolveConnection;
    this.#receipts = config.receipts ?? new ReceiptStore();
    for (const receipt of this.#receipts.list()) {
      if (receipt.approvalId) this.#usedApprovalIds.add(receipt.approvalId);
      if (receipt.manifestDigest) this.#usedManifestDigests.add(receipt.manifestDigest);
      if (receipt.idempotencyKey) this.#usedIdempotencyKeys.add(receipt.idempotencyKey);
    }
    this.#now = config.now ?? (() => new Date());
    this.#maximumSupportAgeDays = config.maximumSupportAgeDays ?? 30;
    this.#verifyHumanApproval = config.verifyHumanApproval;
    this.#candidateVerification = config.candidateVerification
      ? deepFreeze(structuredClone(config.candidateVerification))
      : undefined;
  }

  get receipts(): ReceiptStore {
    return this.#receipts;
  }

  prepareConsequential(
    request: CapabilityRequest,
    proposal: ConsequentialProposal,
  ): Readonly<ConsequentialManifest> {
    const selected = this.#select(request);
    const localAuthorityError = this.#localAuthorityError(request, selected);
    invariant(!localAuthorityError, localAuthorityError?.message ?? "connection authority denied");
    invariant(selected.operation.actionClass === "consequential", "only consequential operations use a manifest");
    invariant(Boolean(request.idempotencyKey), "consequential manifest needs idempotency");
    invariant([proposal.proposalId, proposal.runId, proposal.reviewId].every((value) => /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)), "manifest IDs must be stable exact IDs");
    invariant(proposal.destinations.length > 0 && proposal.destinations.every((value) => value.trim() && !value.includes("*")), "consequential manifest needs exact destinations");
    invariant(proposal.platforms.length > 0 && proposal.platforms.every((value) => value.trim() && !value.includes("*")), "consequential manifest needs exact platforms");
    invariant([proposal.reversibility, proposal.expectedOutcome, proposal.approverPolicy].every((value) => value.trim().length > 0), "manifest outcome, reversal, and approver policy are required");
    invariant(proposal.maximumUnits >= 0 && Number.isFinite(proposal.maximumUnits), "manifest units must be finite");
    invariant(proposal.maximumCost >= 0 && Number.isFinite(proposal.maximumCost), "manifest cost must be finite");
    invariant(!this.#budgetError(request, selected.operation), "request budget is outside the catalog contract");
    invariant(proposal.maximumUnits === request.maxUnits, "manifest units must equal the request ceiling");
    invariant(proposal.maximumCost === request.maxCost, "manifest cost must equal the request ceiling");
    requireSha256(proposal.previewDigest, "manifest previewDigest");
    proposal.mediaDigests.forEach((digest, index) => requireSha256(digest, `manifest mediaDigests[${index}]`));
    proposal.preconditionDigests.forEach((digest, index) => requireSha256(digest, `manifest preconditionDigests[${index}]`));
    const basis = {
      schemaVersion: "conquistador.consequential-manifest/v1" as const,
      id: `${proposal.proposalId}.manifest`,
      proposalId: proposal.proposalId,
      runId: proposal.runId,
      reviewId: proposal.reviewId,
      candidateBuildId: request.candidateBuildId,
      requestId: request.id,
      capabilityId: request.capabilityId,
      operationId: request.operationId,
      adapterId: selected.adapter.manifest.id,
      adapterVersion: selected.adapter.manifest.version,
      connectionRef: selected.connection.id,
      principal: structuredClone(selected.connection.principal),
      connectionEnvironment: selected.connection.environment,
      connectionRevision: selected.connection.revision,
      actionClass: "consequential" as const,
      destinations: [...proposal.destinations],
      platforms: [...proposal.platforms],
      payloadDigest: sha256(request.input),
      mediaDigests: [...proposal.mediaDigests],
      scheduleAt: proposal.scheduleAt,
      timezone: proposal.timezone,
      maximumUnits: proposal.maximumUnits,
      maximumCost: proposal.maximumCost,
      dataClassification: selected.operation.dataClassification,
      disclosures: [...proposal.disclosures],
      preconditionDigests: [...proposal.preconditionDigests],
      previewDigest: proposal.previewDigest,
      idempotencyKey: request.idempotencyKey!,
      notBefore: proposal.notBefore,
      expiresAt: proposal.expiresAt,
      reversibility: proposal.reversibility,
      expectedOutcome: proposal.expectedOutcome,
      approverPolicy: proposal.approverPolicy,
    };
    const notBefore = Date.parse(basis.notBefore);
    const expiresAt = Date.parse(basis.expiresAt);
    invariant(
      Number.isFinite(notBefore) &&
        Number.isFinite(expiresAt) &&
        new Date(notBefore).toISOString() === basis.notBefore &&
        new Date(expiresAt).toISOString() === basis.expiresAt &&
        notBefore < expiresAt,
      "manifest expiry must follow exact not-before",
    );
    if (typeof request.input.destination === "string") {
      invariant(
        proposal.destinations.length === 1 && proposal.destinations[0] === request.input.destination,
        "manifest destination differs from the exact request",
      );
    }
    if (typeof request.input.scheduleAt === "string") {
      invariant(proposal.scheduleAt === request.input.scheduleAt, "manifest schedule differs from the exact request");
    }
    if (typeof request.input.timezone === "string") {
      invariant(proposal.timezone === request.input.timezone, "manifest timezone differs from the exact request");
    }
    return deepFreeze({ ...basis, digest: sha256(basis) });
  }

  async execute(request: CapabilityRequest, options: ExecuteOptions = {}): Promise<GatewayOutcome> {
    request = deepFreeze(structuredClone(request)) as CapabilityRequest;
    options = {
      ...options,
      manifest: options.manifest
        ? (deepFreeze(structuredClone(options.manifest)) as ConsequentialManifest)
        : undefined,
      approval: options.approval
        ? (deepFreeze(structuredClone(options.approval)) as HumanApproval)
        : undefined,
    };
    const startedAt = this.#now().toISOString();
    const declaredOperation = this.#catalog.operations.find((entry) => entry.id === request.operationId);
    if (declaredOperation?.actionClass === "prohibited") {
      try {
        validateCapabilityRequest(request, declaredOperation);
      } catch (error) {
        const message = error instanceof Error ? error.message.replace(/^\[tool-catalog\]\s*/, "") : "invalid request";
        return this.#blocked(request, undefined, capabilityError(request.id, "invalid-request", message), startedAt, 0, 0, declaredOperation);
      }
      return this.#blocked(
        request,
        undefined,
        capabilityError(request.id, "prohibited", "operation is prohibited in Conquistador 1.0.0"),
        startedAt,
        0,
        0,
        declaredOperation,
      );
    }
    let selected: SelectedOperation;
    try {
      selected = this.#select(request);
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^\[tool-catalog\]\s*/, "") : "invalid request";
      const code = message.includes("unknown operation") ? "unknown-operation" : "invalid-request";
      return this.#blocked(request, undefined, capabilityError(request.id, code, message), startedAt);
    }
    const { operation, adapter, connection } = selected;
    const candidateVerification =
      this.#candidateVerification?.candidateBuildId === request.candidateBuildId &&
      this.#candidateVerification.operationIds.includes(operation.id);
    if (!candidateVerification && !operation.supportCells.some((cell) => cell.state === "supported")) {
      return this.#blocked(request, selected, capabilityError(request.id, "unsupported", "operation has no supported cell"), startedAt);
    }
    if (
      !candidateVerification &&
      !operation.supportCells.some((cell) =>
        supportIsFresh(
          cell,
          this.#now(),
          this.#maximumSupportAgeDays,
          operation.providerApiVersion,
          adapter.manifest.version,
        ),
      )
    ) {
      return this.#blocked(request, selected, capabilityError(request.id, "stale-support", "operation support is stale or version-drifted"), startedAt);
    }
    const localAuthorityError = this.#localAuthorityError(request, selected);
    if (localAuthorityError) return this.#blocked(request, selected, localAuthorityError, startedAt);
    const budgetError = this.#budgetError(request, operation);
    if (budgetError) return this.#blocked(request, selected, budgetError, startedAt);
    if (options.signal?.aborted || this.#now().getTime() >= Date.parse(request.deadlineAt)) {
      return this.#blocked(request, selected, capabilityError(request.id, "cancelled", "request was cancelled or expired"), startedAt);
    }
    let authorityError: CapabilityError | undefined;
    try {
      authorityError = this.#authorityError(request, selected, options);
    } catch {
      authorityError = capabilityError(request.id, "approval-denied", "approval or manifest is malformed");
    }
    if (authorityError) return this.#blocked(request, selected, authorityError, startedAt);

    if (request.idempotencyKey && this.#usedIdempotencyKeys.has(request.idempotencyKey)) {
      return this.#blocked(request, selected, capabilityError(request.id, "replay-denied", "idempotency key was already used"), startedAt);
    }
    let resolution: HostConnectionResolution;
    try {
      resolution = await this.#resolveConnection(connection);
    } catch {
      return this.#blocked(request, selected, capabilityError(request.id, "connection-denied", "host connection resolution failed"), startedAt);
    }
    let resolutionError: CapabilityError | undefined;
    try {
      resolutionError = this.#resolutionError(request, selected, resolution);
    } catch {
      resolutionError = capabilityError(request.id, "connection-denied", "host connection resolution failed");
    }
    if (resolutionError) return this.#blocked(request, selected, resolutionError, startedAt);

    // Resolution yields control. Recheck time-sensitive authority and replay state,
    // then reserve synchronously before the next await can dispatch a competing call.
    const currentLocalError = this.#localAuthorityError(request, selected);
    if (currentLocalError) return this.#blocked(request, selected, currentLocalError, startedAt);
    if (options.signal?.aborted || this.#now().getTime() >= Date.parse(request.deadlineAt)) {
      return this.#blocked(request, selected, capabilityError(request.id, "cancelled", "request was cancelled or expired during connection resolution"), startedAt);
    }
    if (!candidateVerification && !operation.supportCells.some((cell) =>
      supportIsFresh(cell, this.#now(), this.#maximumSupportAgeDays, operation.providerApiVersion, adapter.manifest.version),
    )) {
      return this.#blocked(request, selected, capabilityError(request.id, "stale-support", "operation support expired during connection resolution"), startedAt);
    }
    try {
      authorityError = this.#authorityError(request, selected, options);
    } catch {
      authorityError = capabilityError(request.id, "approval-denied", "approval or manifest is malformed");
    }
    if (authorityError) return this.#blocked(request, selected, authorityError, startedAt);
    if (request.idempotencyKey && this.#usedIdempotencyKeys.has(request.idempotencyKey)) {
      return this.#blocked(request, selected, capabilityError(request.id, "replay-denied", "idempotency key was already used"), startedAt);
    }

    if (operation.actionClass === "consequential") {
      this.#usedApprovalIds.add(options.approval!.id);
      this.#usedManifestDigests.add(options.manifest!.digest);
    }
    if (request.idempotencyKey) this.#usedIdempotencyKeys.add(request.idempotencyKey);

    try {
      const rawResult = await adapter.handlers[operation.id](request, {
        connection,
        credential: resolution.credential,
        deadlineAt: request.deadlineAt,
        signal: options.signal,
      });
      if (options.signal?.aborted || this.#now().getTime() >= Date.parse(request.deadlineAt)) {
        const error = capabilityError(request.id, "cancelled", "request was cancelled after dispatch; provider outcome is unknown");
        const receipt = this.#receipt({
          request,
          selected,
          startedAt,
          status: "unknown",
          error,
          manifest: options.manifest,
          approval: options.approval,
        });
        return { ok: false, error, receipt };
      }
      const result = this.#sanitizeResult(rawResult, request, operation, resolution.credential);
      const postBudgetError = this.#resultBudgetError(request, operation, result);
      if (postBudgetError) {
        const receipt = this.#receipt({
          request,
          selected,
          startedAt,
          status: terminalStatus(result),
          result,
          error: postBudgetError,
          manifest: options.manifest,
          approval: options.approval,
        });
        return { ok: false, error: postBudgetError, result, receipt };
      }
      const receipt = this.#receipt({
        request,
        selected,
        startedAt,
        status: terminalStatus(result),
        result,
        manifest: options.manifest,
        approval: options.approval,
      });
      return { ok: ["succeeded", "partial", "pending", "unknown"].includes(result.providerStatus), result, receipt };
    } catch {
      const error = capabilityError(request.id, "provider-failure", "adapter failed without exposing provider or credential detail", true);
      const receipt = this.#receipt({
        request,
        selected,
        startedAt,
        status: "failed",
        error,
        manifest: options.manifest,
        approval: options.approval,
      });
      return { ok: false, error, receipt };
    }
  }

  #select(request: CapabilityRequest): SelectedOperation {
    const operation = this.#catalog.operations.find((entry) => entry.id === request.operationId);
    invariant(operation, `unknown operation: ${request.operationId}`);
    validateCapabilityRequest(request, operation);
    const adapter = Object.values(this.#adapters).find(
      (entry) => entry.manifest.provider === operation.provider && entry.manifest.operationIds.includes(operation.id),
    );
    invariant(adapter, `no audited adapter for ${operation.id}`);
    invariant(typeof adapter.handlers[operation.id] === "function", `adapter has no handler for ${operation.id}`);
    const connection = this.#connections[request.connectionRef];
    invariant(connection, `unknown connection reference: ${request.connectionRef}`);
    invariant(connection.provider === operation.provider, "connection provider differs from operation");
    return { operation, adapter, connection };
  }

  #resolutionError(
    request: CapabilityRequest,
    selected: SelectedOperation,
    resolution: HostConnectionResolution,
  ): CapabilityError | undefined {
    const reference = selected.connection;
    if (!resolution || typeof resolution !== "object" || Array.isArray(resolution)) {
      return capabilityError(request.id, "connection-denied", "host connection resolution failed");
    }
    const keys = Object.keys(resolution);
    if (!keys.every((key) => ["schemaVersion", "connectionRef", "provider", "principal", "allowedOperationIds", "scopes", "environment", "usage", "revision", "state", "resolvedAt", "credential"].includes(key)) ||
      !["schemaVersion", "connectionRef", "provider", "principal", "allowedOperationIds", "scopes", "environment", "usage", "revision", "state", "resolvedAt", "credential"].every((key) => keys.includes(key))) {
      return capabilityError(request.id, "connection-denied", "host connection resolution failed");
    }
    if (sha256(resolution.principal) !== sha256(reference.principal)) {
      return capabilityError(request.id, "principal-denied", "host resolved a different account or workspace");
    }
    const sameSet = (left: string[], right: string[]) => left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
    if (!sameSet(resolution.allowedOperationIds, reference.allowedOperationIds) || !sameSet(resolution.scopes, reference.scopes)) {
      return capabilityError(request.id, "scope-denied", "host resolution authority differs from the connection");
    }
    const resolvedAt = Date.parse(resolution.resolvedAt);
    const currentTime = this.#now().getTime();
    if (resolution.schemaVersion !== "conquistador.host-connection-resolution/v1" ||
      resolution.connectionRef !== reference.id || resolution.provider !== reference.provider ||
      resolution.environment !== reference.environment || resolution.usage !== reference.usage ||
      resolution.revision !== reference.revision || resolution.state !== "active" ||
      resolution.credential === undefined || resolution.credential === null ||
      !Number.isFinite(resolvedAt) || new Date(resolvedAt).toISOString() !== resolution.resolvedAt ||
      resolvedAt > currentTime || currentTime - resolvedAt > 5 * 60 * 1000) {
      return capabilityError(request.id, "connection-denied", "host connection resolution is stale or mismatched");
    }
  }

  #budgetError(request: CapabilityRequest, operation: OperationContract): CapabilityError | undefined {
    if (!["metered-observe", "draft", "consequential"].includes(operation.actionClass)) return;
    if (
      typeof request.maxUnits !== "number" ||
      typeof request.maxCost !== "number" ||
      !Number.isFinite(request.maxUnits) ||
      !Number.isFinite(request.maxCost) ||
      request.maxUnits < 0 ||
      request.maxCost < 0
    ) {
      return capabilityError(request.id, "budget-denied", "metered, draft, or consequential operation needs finite ceilings");
    }
    if (
      (operation.maximumUnitsPerRun !== undefined && request.maxUnits > operation.maximumUnitsPerRun) ||
      (operation.maximumCostPerRun !== undefined && request.maxCost > operation.maximumCostPerRun)
    ) {
      return capabilityError(request.id, "budget-denied", "requested ceiling exceeds the catalog maximum");
    }
  }

  #localAuthorityError(
    request: CapabilityRequest,
    selected: SelectedOperation,
  ): CapabilityError | undefined {
    const connection = selected.connection;
    if (sha256(request.expectedPrincipal) !== sha256(connection.principal)) {
      return capabilityError(request.id, "principal-denied", "request principal differs from the confirmed connection");
    }
    if (request.connectionEnvironment !== connection.environment || request.connectionRevision !== connection.revision) {
      return capabilityError(request.id, "connection-denied", "request connection environment or revision differs");
    }
    if (connection.state !== "active" || (connection.expiresAt && this.#now().getTime() >= Date.parse(connection.expiresAt))) {
      return capabilityError(request.id, "connection-denied", "connection is not active");
    }
    if (!connection.allowedOperationIds.includes(selected.operation.id)) {
      return capabilityError(request.id, "scope-denied", "operation is not allowed by the connection");
    }
  }

  #resultBudgetError(
    request: CapabilityRequest,
    operation: OperationContract,
    result: CapabilityResult,
  ): CapabilityError | undefined {
    if (
      result.unitsUsed < 0 ||
      result.costUsed < 0 ||
      (request.maxUnits !== undefined && result.unitsUsed > request.maxUnits) ||
      (request.maxCost !== undefined && result.costUsed > request.maxCost) ||
      (operation.maximumUnitsPerRun !== undefined && result.unitsUsed > operation.maximumUnitsPerRun) ||
      (operation.maximumCostPerRun !== undefined && result.costUsed > operation.maximumCostPerRun)
    ) {
      return capabilityError(request.id, "budget-denied", "adapter exceeded a declared ceiling");
    }
  }

  #authorityError(
    request: CapabilityRequest,
    selected: SelectedOperation,
    options: ExecuteOptions,
  ): CapabilityError | undefined {
    if (selected.operation.actionClass !== "consequential") {
      if (options.manifest || options.approval) {
        return capabilityError(request.id, "approval-denied", "approval cannot widen a non-consequential operation");
      }
      return;
    }
    const manifest = options.manifest;
    const approval = options.approval;
    if (!manifest || !approval) return capabilityError(request.id, "approval-denied", "exact manifest and human approval are required");
    const { digest, ...manifestBasis } = manifest;
    if (
      sha256(manifestBasis) !== digest ||
      manifest.schemaVersion !== "conquistador.consequential-manifest/v1" ||
      manifest.actionClass !== "consequential" ||
      manifest.candidateBuildId !== request.candidateBuildId ||
      manifest.requestId !== request.id ||
      manifest.capabilityId !== request.capabilityId ||
      manifest.operationId !== request.operationId ||
      manifest.adapterId !== selected.adapter.manifest.id ||
      manifest.adapterVersion !== selected.adapter.manifest.version ||
      manifest.connectionRef !== selected.connection.id ||
      sha256(manifest.principal) !== sha256(selected.connection.principal) ||
      manifest.connectionEnvironment !== selected.connection.environment ||
      manifest.connectionRevision !== selected.connection.revision ||
      manifest.payloadDigest !== sha256(request.input) ||
      manifest.idempotencyKey !== request.idempotencyKey ||
      manifest.maximumUnits !== request.maxUnits ||
      manifest.maximumCost !== request.maxCost ||
      manifest.dataClassification !== selected.operation.dataClassification
    ) {
      return capabilityError(request.id, "approval-denied", "manifest differs from the exact request or adapter");
    }
    const approvedAt = Date.parse(approval.approvedAt);
    const approvalExpiresAt = Date.parse(approval.expiresAt);
    const manifestNotBefore = Date.parse(manifest.notBefore);
    const manifestExpiresAt = Date.parse(manifest.expiresAt);
    const currentTime = this.#now().getTime();
    if (
      approval.schemaVersion !== "conquistador.human-approval/v1" ||
      typeof approval.id !== "string" ||
      !approval.id.trim() ||
      approval.id.includes("*") ||
      approval.authenticatedHuman !== true ||
      approval.singleUse !== true ||
      approval.manifestDigest !== manifest.digest ||
      !this.#verifyHumanApproval?.(approval, manifest) ||
      typeof approval.approverId !== "string" ||
      !approval.approverId.trim() ||
      approval.approverId.includes("*") ||
      /(?:^|[-.:])(?:model|assistant|agent)(?:$|[-.:])/i.test(approval.approverId) ||
      typeof approval.authenticationMethod !== "string" ||
      /(?:^|[-.:])(?:none|model|assistant|agent)(?:$|[-.:])/i.test(approval.authenticationMethod) ||
      approval.authenticationMethod.includes("*") ||
      ![approvedAt, approvalExpiresAt, manifestNotBefore, manifestExpiresAt].every(Number.isFinite) ||
      new Date(approvedAt).toISOString() !== approval.approvedAt ||
      new Date(approvalExpiresAt).toISOString() !== approval.expiresAt ||
      new Date(manifestNotBefore).toISOString() !== manifest.notBefore ||
      new Date(manifestExpiresAt).toISOString() !== manifest.expiresAt ||
      approvedAt < manifestNotBefore ||
      approvedAt > currentTime ||
      approvalExpiresAt > manifestExpiresAt ||
      currentTime < manifestNotBefore ||
      currentTime >= approvalExpiresAt
    ) {
      return capabilityError(request.id, "approval-denied", "approval is unauthenticated, stale, wildcard, model-issued, or mismatched");
    }
    const requestedDestination = request.input.destination;
    if (
      !Array.isArray(manifest.destinations) ||
      manifest.destinations.length === 0 ||
      manifest.destinations.some((value) => typeof value !== "string" || !value.trim() || value.includes("*")) ||
      !Array.isArray(manifest.platforms) ||
      manifest.platforms.length === 0 ||
      manifest.platforms.some((value) => typeof value !== "string" || !value.trim() || value.includes("*")) ||
      (typeof requestedDestination === "string" &&
        (manifest.destinations.length !== 1 || manifest.destinations[0] !== requestedDestination)) ||
      (request.input.scheduleAt !== undefined && manifest.scheduleAt !== request.input.scheduleAt) ||
      (request.input.timezone !== undefined && manifest.timezone !== request.input.timezone)
    ) {
      return capabilityError(request.id, "approval-denied", "manifest destination, platform, or schedule is not exact");
    }
    if (this.#usedApprovalIds.has(approval.id) || this.#usedManifestDigests.has(manifest.digest)) {
      return capabilityError(request.id, "replay-denied", "approval or manifest was already used");
    }
  }

  #sanitizeResult(
    result: CapabilityResult,
    request: CapabilityRequest,
    operation: OperationContract,
    credential: unknown,
  ): CapabilityResult {
    invariant(Boolean(result) && typeof result === "object" && !Array.isArray(result), "adapter result must be an object");
    invariant(
      Object.keys(result).every((key) =>
        ["schemaVersion", "requestId", "operationId", "providerRequestId", "providerCorrelationId", "providerResourceId", "data", "sourceUrls", "freshnessAt", "pagination", "unitsUsed", "costUsed", "providerStatus"].includes(key),
      ),
      "adapter result includes undeclared fields",
    );
    invariant(result.schemaVersion === "conquistador.capability-result/v1", "adapter result schema is not v1");
    invariant(result.requestId === request.id && result.operationId === operation.id, "adapter result identity mismatch");
    validateRecordShape(result.data, operation.outputSchema, "adapter result.data");
    invariant(Number.isFinite(result.unitsUsed) && Number.isFinite(result.costUsed), "adapter usage must be finite");
    invariant(["succeeded", "partial", "pending", "unknown"].includes(result.providerStatus), "adapter provider status is invalid");
    invariant(
      typeof result.freshnessAt === "string" &&
        !Number.isNaN(Date.parse(result.freshnessAt)) &&
        new Date(result.freshnessAt).toISOString() === result.freshnessAt,
      "adapter freshnessAt must be an exact UTC ISO timestamp",
    );
    invariant(Boolean(result.pagination) && typeof result.pagination === "object" && !Array.isArray(result.pagination), "adapter pagination is required");
    invariant(Object.keys(result.pagination).every((key) => ["complete", "cursor", "truncated"].includes(key)), "adapter pagination includes undeclared fields");
    invariant(typeof result.pagination.complete === "boolean" && typeof result.pagination.truncated === "boolean", "adapter pagination flags must be boolean");
    invariant(result.pagination.cursor === undefined || typeof result.pagination.cursor === "string", "adapter pagination cursor must be a string");
    invariant(Array.isArray(result.sourceUrls) && result.sourceUrls.every((source) => typeof source === "string"), "adapter source URLs must be strings");
    invariant(
      [result.providerRequestId, result.providerCorrelationId, result.providerResourceId].every((value) => value === undefined || typeof value === "string"),
      "adapter provider identifiers must be strings",
    );
    const credentialValues = sensitiveStrings(credential);
    const data = redact(result.data, credentialValues) as Record<string, unknown>;
    const sourceUrls = result.sourceUrls.map((source) => {
      const parsed = new URL(source);
      invariant(parsed.protocol === "https:" && !parsed.username && !parsed.password, "adapter source URL is unsafe");
      if (redact(parsed.hostname, credentialValues) === "[REDACTED]") parsed.hostname = "redacted.invalid";
      if (redact(parsed.pathname, credentialValues) === "[REDACTED]") parsed.pathname = "/redacted";
      for (const [key, value] of [...parsed.searchParams.entries()]) {
        if (
          /(?:token|key|secret|auth|signature)/i.test(key) ||
          redact(value, credentialValues) === "[REDACTED]"
        ) parsed.searchParams.set(key, "[REDACTED]");
      }
      parsed.hash = "";
      return parsed.toString();
    });
    return deepFreeze(redact({ ...result, data: structuredClone(data), sourceUrls }, credentialValues) as CapabilityResult);
  }

  #blocked(
    request: CapabilityRequest,
    selected: SelectedOperation | undefined,
    error: CapabilityError,
    startedAt: string,
    unitsUsed = 0,
    costUsed = 0,
    operationOverride?: OperationContract,
  ): GatewayOutcome {
    const receipt = this.#receipt({
      request,
      selected,
      startedAt,
      status: error.code === "provider-failure" ? "failed" : "blocked",
      error,
      unitsUsed,
      costUsed,
      operationOverride,
    });
    return { ok: false, error, receipt };
  }

  #receipt(input: {
    request: CapabilityRequest;
    selected?: SelectedOperation;
    startedAt: string;
    status: Receipt["status"];
    result?: CapabilityResult;
    error?: CapabilityError;
    manifest?: ConsequentialManifest;
    approval?: HumanApproval;
    unitsUsed?: number;
    costUsed?: number;
    operationOverride?: OperationContract;
  }): Readonly<Receipt> {
    let receiptId: string;
    do {
      this.#receiptSequence += 1;
      receiptId = `${input.request.id}.receipt.${this.#receiptSequence}`;
    } while (this.#receipts.get(receiptId));
    const operation = input.selected?.operation ?? input.operationOverride;
    const result = input.result;
    const receipt = createReceipt({
      schemaVersion: "conquistador.receipt/v1",
      id: receiptId,
      candidateBuildId: input.request.candidateBuildId,
      requestId: input.request.id,
      proposalId: input.manifest?.proposalId,
      manifestDigest: input.manifest?.digest,
      approvalId: input.approval?.id,
      runId: input.manifest?.runId,
      reviewId: input.manifest?.reviewId,
      capabilityId: input.request.capabilityId,
      operationId: input.request.operationId,
      adapterId: input.selected?.adapter.manifest.id,
      adapterVersion: input.selected?.adapter.manifest.version,
      provider: operation?.provider ?? "unknown",
      connectionRef: input.selected?.connection.id,
      connectionRevision: input.selected?.connection.revision,
      connectionEnvironment: input.selected?.connection.environment,
      connectionPrincipal: input.selected
        ? structuredClone(input.selected.connection.principal)
        : undefined,
      actionClass: operation?.actionClass ?? "prohibited",
      requestDigest: sha256(input.request),
      payloadDigest: sha256(input.request.input),
      destinationDigests: (input.manifest?.destinations ?? []).map((destination) => sha256(destination)),
      startedAt: input.startedAt,
      finishedAt: this.#now().toISOString(),
      status: input.status,
      providerStatus: result?.providerStatus,
      providerRequestId: result?.providerRequestId,
      providerCorrelationId: result?.providerCorrelationId,
      providerResourceId: result?.providerResourceId,
      unitsUsed: result?.unitsUsed ?? input.unitsUsed ?? 0,
      costUsed: result?.costUsed ?? input.costUsed ?? 0,
      pagination: result?.pagination,
      sourceUrls: result?.sourceUrls ?? [],
      error: input.error,
      retryCount: 0,
      idempotencyKey: input.request.idempotencyKey,
      reversalGuidance: input.manifest?.reversibility,
      safeResponse: result?.data,
    });
    this.#receipts.append(receipt);
    return receipt;
  }
}
