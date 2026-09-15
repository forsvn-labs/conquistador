import type { CapabilityRequest, ConnectionPrincipal, ExtensionManifest, GatewayOutcome, Sha256 } from './contracts.ts';
import { Gateway, type GatewayConfig } from './gateway.ts';
import { deepFreeze, sha256 } from './canonical.ts';
import { supportIsFresh } from './lifecycle.ts';
import { invariant, validateExtensionManifest } from './validate.ts';

export type StackRoute = {
  id: string;
  kind: 'cli' | 'mcp' | 'warehouse' | 'executor';
  extension: ExtensionManifest;
  adapterId: string;
  connectionRef: string;
};
export type StackDemand = {
  capabilityId: string;
  operationId: string;
  principal: ConnectionPrincipal;
  environment: 'sandbox' | 'production';
  maxUnits: number;
  maxCost: number;
};
export type StackSelection = {
  status: 'ready' | 'verification-only' | 'unsupported' | 'connection-required' | 'policy-denied' | 'human-action-required';
  operationId: string;
  routeId: string | null;
  reason: string;
};
export type StackReceipt = {
  schemaVersion: 'conquistador.stack-receipt/v1';
  operationId: string;
  routeId: string | null;
  selection: StackSelection['status'];
  principalDigest: Sha256;
  connectionDigest: Sha256 | null;
  catalogReceiptDigest: Sha256 | null;
  status: string;
  liveSupportPromoted: false;
};
export type StackConfig = GatewayConfig & {
  candidateBuildId: string;
  routes: StackRoute[];
  policy: {
    executorOnly: boolean;
    allowedOperationIds: string[];
    allowedDataClasses: Array<'public' | 'internal' | 'confidential' | 'restricted'>;
    maximumUnits: number;
    maximumCost: number;
  };
};

/** Discovery consumes host inventory. It never searches for credentials, runs a shell, or installs a vendor. */
export function createStackSession(input: StackConfig) {
  invariant(/^[a-f0-9]{64}$/.test(input.candidateBuildId), 'stack requires an exact build identity');
  const catalog = deepFreeze(structuredClone(input.catalog));
  const connections = deepFreeze(structuredClone(input.connections));
  const routes = deepFreeze(structuredClone(input.routes));
  const policy = deepFreeze(structuredClone(input.policy));
  const adapters = Object.fromEntries(Object.entries(input.adapters).map(([id, adapter]) => [id, {
    manifest: structuredClone(adapter.manifest), handlers: { ...adapter.handlers },
  }]));
  const now = input.now ?? (() => new Date());
  const build = input.candidateBuildId;
  const verification = input.candidateVerification && structuredClone(input.candidateVerification);
  const age = input.maximumSupportAgeDays ?? 30;
  invariant(Number.isFinite(policy.maximumUnits) && policy.maximumUnits > 0 && Number.isFinite(policy.maximumCost) && policy.maximumCost >= 0, 'stack requires finite ceilings');
  invariant(new Set(routes.map(r => r.id)).size === routes.length, 'stack route ids must be unique');
  for (const route of routes) {
    invariant(/^[a-z][a-z0-9.-]+$/.test(route.id) && ['cli', 'mcp', 'warehouse', 'executor'].includes(route.kind), 'invalid logical stack route');
    validateExtensionManifest(route.extension, catalog);
    invariant(['host-tool', 'provider-adapter'].includes(route.extension.kind), 'stack route needs a tool extension');
    const adapter = adapters[route.adapterId];
    invariant(adapter && adapter.manifest.id === route.adapterId, 'stack route needs an exact adapter');
    for (const op of route.extension.operations) {
      invariant(op.catalog && adapter.manifest.operationIds.includes(op.catalog.operationId), 'route extension has no matching adapter operation');
    }
  }
  // A selected Executor route must never execute another adapter for the same operation.
  const gateways = new Map(routes.map(route => {
    const adapter = adapters[route.adapterId];
    const operationIds = verification?.operationIds.filter(id => adapter.manifest.operationIds.includes(id)) ?? [];
    return [route.id, new Gateway({ ...input, catalog, connections, adapters: { [route.adapterId]: adapter },
      candidateVerification: operationIds.length ? { candidateBuildId: verification!.candidateBuildId, operationIds } : undefined })];
  }));
  let sequence = 0;
  let unitsReserved = 0;
  let costReserved = 0;

  function inspect(demand: StackDemand): StackSelection {
    const selection = (status: StackSelection['status'], reason: string, routeId: string | null = null): StackSelection => ({ status, operationId: demand.operationId, routeId, reason });
    const operation = catalog.operations.find(op => op.id === demand.operationId && op.capabilityId === demand.capabilityId);
    if (!operation) return selection('unsupported', 'No exact catalog operation. Supply an audited extension before connecting this system.');
    if (!['observe', 'metered-observe'].includes(operation.actionClass)) return selection('human-action-required', 'Stack setup only executes bounded reads. Prepare a separate human action handoff.');
    if (!policy.allowedOperationIds.includes(operation.id) || !policy.allowedDataClasses.includes(operation.dataClassification) ||
        !Number.isFinite(demand.maxUnits) || demand.maxUnits <= 0 || demand.maxUnits > policy.maximumUnits - unitsReserved ||
        !Number.isFinite(demand.maxCost) || demand.maxCost < 0 || demand.maxCost > policy.maximumCost - costReserved ||
        (operation.maximumUnitsPerRun !== undefined && demand.maxUnits > operation.maximumUnitsPerRun) ||
        (operation.maximumCostPerRun !== undefined && demand.maxCost > operation.maximumCostPerRun)) {
      return selection('policy-denied', 'Operation, data class, or remaining budget is outside the host policy.');
    }
    let missingConnection = false;
    let unsupported = false;
    for (const route of routes) {
      if (policy.executorOnly && route.kind !== 'executor') continue;
      const extensionOperation = route.extension.operations.find(op => op.catalog?.operationId === operation.id && op.capabilityId === demand.capabilityId);
      if (!extensionOperation) continue;
      if (extensionOperation.dependencies.length ||
          (extensionOperation.budget.maximumUnitsPerRun !== undefined && demand.maxUnits > extensionOperation.budget.maximumUnitsPerRun) ||
          (extensionOperation.budget.maximumCostPerRun !== undefined && demand.maxCost > extensionOperation.budget.maximumCostPerRun)) continue;
      const connection = connections[route.connectionRef];
      if (!connection || connection.state !== 'active' || connection.provider !== operation.provider ||
          !connection.allowedOperationIds.includes(operation.id) || sha256(connection.principal) !== sha256(demand.principal) ||
          connection.environment !== demand.environment ||
          (connection.expiresAt && Date.parse(connection.expiresAt) <= now().getTime())) {
        missingConnection = true; continue;
      }
      const version = adapters[route.adapterId].manifest.version;
      if (operation.supportCells.some(cell => supportIsFresh(cell, now(), age, operation.providerApiVersion, version))) {
        return selection('ready', 'Exact supported read route is available; the gateway rechecks identity and authority at dispatch.', route.id);
      }
      if (verification?.candidateBuildId === build && verification.operationIds.includes(operation.id)) {
        return selection('verification-only', 'Explicit candidate verification only. This does not establish supported operation.', route.id);
      }
      unsupported = true;
    }
    return missingConnection ? selection('connection-required', 'The host must connect the exact identity, environment, operation and scopes.')
      : selection('unsupported', unsupported ? 'Exact route has no fresh supported operation evidence.' : 'No permitted route implements this exact operation.');
  }

  async function read(demandInput: StackDemand, request: { input: Record<string, unknown>; timeoutSeconds: number; signal?: AbortSignal }) {
    const demand = structuredClone(demandInput);
    const selection = inspect(demand);
    const route = routes.find(r => r.id === selection.routeId);
    const connection = route && connections[route.connectionRef];
    const receipt = (outcome?: GatewayOutcome): StackReceipt => ({
      schemaVersion: 'conquistador.stack-receipt/v1', operationId: demand.operationId, routeId: selection.routeId,
      selection: selection.status, principalDigest: sha256(demand.principal), connectionDigest: connection ? sha256(connection) : null,
      catalogReceiptDigest: outcome?.receipt.receiptDigest ?? null, status: outcome?.receipt.status ?? 'blocked', liveSupportPromoted: false,
    });
    if (!connection || !['ready', 'verification-only'].includes(selection.status)) return { selection, receipt: receipt(), outcome: null };
    invariant(Number.isInteger(request.timeoutSeconds) && request.timeoutSeconds > 0 && request.timeoutSeconds <= 300, 'stack read timeout must be 1..300 seconds');
    request.signal?.throwIfAborted();
    // Reserve synchronously before awaiting. Unknown provider outcomes keep their reservation.
    unitsReserved += demand.maxUnits; costReserved += demand.maxCost;
    const signal = AbortSignal.any([AbortSignal.timeout(request.timeoutSeconds * 1000), ...(request.signal ? [request.signal] : [])]);
    const capability: CapabilityRequest = {
      schemaVersion: 'conquistador.capability-request/v1', id: `stack-read-${++sequence}`, candidateBuildId: build,
      capabilityId: demand.capabilityId, operationId: demand.operationId, connectionRef: connection.id,
      expectedPrincipal: demand.principal, connectionEnvironment: demand.environment, connectionRevision: connection.revision,
      input: structuredClone(request.input), maxUnits: demand.maxUnits, maxCost: demand.maxCost,
      deadlineAt: new Date(now().getTime() + request.timeoutSeconds * 1000).toISOString(),
    };
    // A host resolver may ignore cancellation. Bound our wait without inventing a terminal
    // catalog receipt or releasing the reservation for a read whose outcome is unknown.
    const outcome = await new Promise<GatewayOutcome | null>((resolve, reject) => {
      const abort = () => resolve(null);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { signal.removeEventListener('abort', abort); resolve(null); return; }
      gateways.get(route!.id)!.execute(capability, { signal }).then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', abort));
    });
    return { selection, receipt: outcome ? receipt(outcome) : { ...receipt(), status: 'unknown' }, outcome };
  }
  return Object.freeze({ inspect, read });
}
