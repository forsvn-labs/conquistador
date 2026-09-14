import type { Catalog, ConnectionReference, HostConnectionResolution } from "../src/contracts.ts";
import { createRuntimeOperationBridge } from "../src/runtime-bridge.ts";
import { createOpenseoAdapter } from "../src/providers/openseo.ts";
import type { ProviderTransport } from "../src/providers/transport.ts";
import { ReceiptStore } from "../src/receipt.ts";

/** Construct only. This module does not execute an operation when imported. */
export function createOpenseoRuntimeHost(options: {
  catalog: Catalog;
  candidateBuildId: string;
  connection: ConnectionReference;
  projectId: string;
  target: string;
  locationCode: number;
  languageCode: string;
  maximumCredits: number;
  maximumCost: number;
  /** The host's approved Executor transport, with its own credential custody. */
  transport: ProviderTransport;
  resolveConnection(reference: Readonly<ConnectionReference>): Promise<HostConnectionResolution>;
}) {
  const adapter = createOpenseoAdapter(options.catalog, options.transport);
  const receipts = new ReceiptStore();
  const operationBridge = createRuntimeOperationBridge({
    catalog: options.catalog,
    candidateBuildId: options.candidateBuildId,
    adapters: { [adapter.manifest.id]: adapter },
    connections: { [options.connection.id]: options.connection },
    resolveConnection: options.resolveConnection,
    receipts,
    bindings: [{
      runtimeOperationId: "signals.pull-bounded",
      operationId: "openseo.get-serp-results",
      connectionRef: options.connection.id,
      maxUnits: options.maximumCredits,
      maxCost: options.maximumCost,
      input() {
        return { projectId: options.projectId, target: options.target,
          locationCode: options.locationCode, languageCode: options.languageCode };
      },
    }],
  });
  return { operationBridge, receipts };
}
