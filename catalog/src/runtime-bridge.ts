import type { OperationBridge, OperationBridgeRequest } from "../../runtime/src/operation-bridge.ts";
import { Gateway, type GatewayConfig } from "./gateway.ts";
import type { CapabilityRequest } from "./contracts.ts";
import { deepFreeze, sha256 } from "./canonical.ts";

export type RuntimeOperationBinding = {
  runtimeOperationId: string;
  operationId: string;
  connectionRef: string;
  maxUnits: number;
  maxCost: number;
  /** Host-authored typed mapping. Never supplied by a model or HTTP caller. */
  input(context: Readonly<OperationBridgeRequest>): Record<string, unknown> | Promise<Record<string, unknown>>;
};
export type RuntimeGatewayConfig = Omit<GatewayConfig, "candidateVerification" | "verifyHumanApproval"> & {
  candidateBuildId: string;
  bindings: RuntimeOperationBinding[];
};

/** No candidate verification bypass, raw remote method, or approval surface. */
export function createRuntimeOperationBridge(config: RuntimeGatewayConfig): OperationBridge {
  if (!/^[a-f0-9]{64}$/.test(config.candidateBuildId)) throw new Error("Exact candidate build ID required.");
  const candidateBuildId = config.candidateBuildId;
  const catalog = deepFreeze(structuredClone(config.catalog));
  const connections = deepFreeze(structuredClone(config.connections));
  const now = config.now ?? (() => new Date());
  const bindings = new Map(config.bindings.map((binding) => [binding.runtimeOperationId, Object.freeze({ ...binding })]));
  if (bindings.size !== config.bindings.length) throw new Error("Duplicate runtime operation binding.");
  for (const binding of bindings.values()) {
    if (!/^[a-z][a-z0-9.-]+$/.test(binding.runtimeOperationId) || !catalog.operations.some((op) => op.id === binding.operationId) ||
        !connections[binding.connectionRef] || !Number.isFinite(binding.maxUnits) || binding.maxUnits < 0 ||
        !Number.isFinite(binding.maxCost) || binding.maxCost < 0) throw new Error("Invalid explicit runtime binding.");
  }
  const gateway = new Gateway({ catalog, connections, adapters: config.adapters,
    resolveConnection: config.resolveConnection, receipts: config.receipts, now,
    maximumSupportAgeDays: config.maximumSupportAgeDays });
  return Object.freeze({
    async invoke(context: OperationBridgeRequest) {
      const binding = bindings.get(context.operationId);
      if (!binding) return { kind: "handoff" as const };
      const operation = catalog.operations.find((op) => op.id === binding.operationId)!;
      if (["consequential", "prohibited"].includes(operation.actionClass) ||
          (operation.actionClass === "draft" ? context.actionClass !== "draft" : context.actionClass !== "observe")) return { kind: "handoff" as const };
      if (!Number.isFinite(context.remainingCost) || context.remainingCost < 0 ||
          !Number.isFinite(context.unitsUsedForOperation) || context.unitsUsedForOperation < 0) throw new Error("Invalid runtime remaining budget.");
      if (binding.maxCost > context.remainingCost || binding.maxUnits <= context.unitsUsedForOperation) return { kind: "handoff" as const };
      const remaining = Date.parse(context.deadlineAt) - now().getTime();
      if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 3_600_000) throw new Error("Operation deadline expired or invalid.");
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(Math.ceil(remaining))]);
      signal.throwIfAborted();
      // The adapter only sees this explicit connection. No credential enters the runtime request.
      const connection = connections[binding.connectionRef];
      let abort!: () => void;
      const interrupted = new Promise<never>((_resolve, reject) => {
        abort = () => reject(new Error("Operation interrupted; reconcile before replay."));
        signal.addEventListener("abort", abort, { once: true });
      });
      try {
        const input = await Promise.race([Promise.resolve().then(() => binding.input({ ...context, signal })), interrupted]);
        signal.throwIfAborted();
        if (now().getTime() >= Date.parse(context.deadlineAt)) throw new Error("Operation deadline expired.");
        const request: CapabilityRequest = {
          schemaVersion: "conquistador.capability-request/v1", id: `runtime-${sha256([context.runId, context.stepId]).slice(7)}`,
          candidateBuildId, operationId: operation.id, capabilityId: operation.capabilityId,
          connectionRef: connection.id, expectedPrincipal: connection.principal,
          connectionEnvironment: connection.environment, connectionRevision: connection.revision,
          input, idempotencyKey: context.idempotencyKey, deadlineAt: context.deadlineAt,
          maxUnits: Math.max(0, binding.maxUnits - context.unitsUsedForOperation), maxCost: Math.min(binding.maxCost, context.remainingCost),
        };
        const outcome = await Promise.race([gateway.execute(request, { signal }), interrupted]);
        const usageKnown = Boolean(outcome.result) || outcome.receipt.status === "blocked";
        return { kind: "receipt" as const, receipt: {
          schemaVersion: "conquistador.operation-terminal-receipt/v1" as const,
          catalogReceiptDigest: outcome.receipt.receiptDigest, requestDigest: outcome.receipt.requestDigest,
          status: outcome.receipt.status, terminalRecord: true as const,
          usageKnown, accepted: outcome.ok,
          unitsUsed: usageKnown ? outcome.receipt.unitsUsed : null, costUsed: usageKnown ? outcome.receipt.costUsed : null,
          data: outcome.ok && outcome.result ? outcome.result.data : {},
        } };
      } finally { signal.removeEventListener("abort", abort); }
    },
  });
}
