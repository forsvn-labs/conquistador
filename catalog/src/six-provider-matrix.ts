import type { ActionClass, Catalog, OperationContract, VerificationState } from "./contracts.ts";
import { invariant } from "./validate.ts";

export const FOR_149_PROVIDER_IDS = [
  "github",
  "google-analytics",
  "search-console",
  "posthog",
  "semrush",
  "typefully",
] as const;

export type For149ProviderId = (typeof FOR_149_PROVIDER_IDS)[number];

export const FOR_149_PROHIBITED_OPERATION_ID = "typefully.post.delete";

// Legacy identifier retained for schema and stored-record compatibility, not issue-tracker authority.
export const FOR_149_MATRIX_SCHEMA = "conquistador.for-149-six-provider-matrix/v1";

export const FOR_149_OPERATION_COUNT = 14;

export const FOR_149_LIVE_REOPEN =
  "Live verification requires operator-supplied opaque Connection references, exact provider targets, authenticated human review, and applicable provider/spend authorization. Each live or support claim needs its own observed evidence. Missing credentials or approval for another provider never authorize fabricated cells.";

export type SixProviderCatalogStage = "researched" | "fixture-verified";

export type SixProviderLiveProof = "not-run";

export type SixProviderSupportClaim = "forbidden";

export type SixProviderGatewayAvailability = "unsupported" | "prohibited";

export type SixProviderCell = {
  operationId: string;
  provider: For149ProviderId;
  actionClass: ActionClass;
  catalogStage: SixProviderCatalogStage;
  liveProof: SixProviderLiveProof;
  supportClaim: SixProviderSupportClaim;
  ordinaryGatewayAvailability: SixProviderGatewayAvailability;
  reopenLiveWhen: string;
};

export type SixProviderMatrix = {
  schemaVersion: typeof FOR_149_MATRIX_SCHEMA;
  issue: "FOR-149";
  catalogStatus: Catalog["status"];
  liveProofStatus: "deferred-missing-hung-credentials";
  supportClaimStatus: "none-claimed";
  reopenLiveWhen: string;
  operations: SixProviderCell[];
};

export function isFor149ProviderId(provider: string): provider is For149ProviderId {
  for (const id of FOR_149_PROVIDER_IDS) {
    if (provider === id) return true;
  }

  return false;
}

export function sixProviderOperations(operations: readonly OperationContract[]): OperationContract[] {
  const selected: OperationContract[] = [];

  for (const operation of operations) {
    if (isFor149ProviderId(operation.provider)) selected.push(operation);
  }

  selected.sort((left, right) => left.id.localeCompare(right.id));

  return selected;
}

function uniqueStrings(values: readonly string[], label: string): void {
  invariant(new Set(values).size === values.length, `${label} must be unique`);
}

function catalogStage(operation: OperationContract): SixProviderCatalogStage {
  if (operation.actionClass === "prohibited") {
    invariant(operation.id === FOR_149_PROHIBITED_OPERATION_ID, `${operation.id} is not the frozen prohibited Typefully delete`);
    invariant(
      operation.supportCells.every((cell) => cell.state === "researched"),
      `${operation.id} must remain researched with no adapter or promotion path`,
    );

    return "researched";
  }

  invariant(operation.supportCells.length > 0, `${operation.id} needs a support cell`);

  for (const cell of operation.supportCells) {
    invariant(cell.state === "fixture-verified", `${operation.id} overclaims ${cell.state}; live and support remain unproved`);
    invariant(
      cell.evidence.some((entry) => entry.kind === "fixture"),
      `${operation.id} fixture-verified cell is missing fixture evidence`,
    );
    invariant(
      cell.evidence.every((entry) => entry.kind !== "live" && entry.kind !== "release-matrix"),
      `${operation.id} must not bind live or release-matrix evidence without authorized observed proof`,
    );
  }

  return "fixture-verified";
}

function cellFor(operation: OperationContract): SixProviderCell {
  invariant(isFor149ProviderId(operation.provider), `${operation.id} is outside the FOR-149 six-provider set`);
  invariant(operation.roadmapDestination === "FOR-149", `${operation.id} roadmap destination must remain FOR-149`);
  invariant(
    operation.knownGaps.some((gap) => gap === "support claim forbidden"),
    `${operation.id} must keep an explicit support-claim forbidden gap`,
  );

  const prohibited = operation.actionClass === "prohibited";
  const stage = catalogStage(operation);

  return {
    operationId: operation.id,
    provider: operation.provider,
    actionClass: operation.actionClass,
    catalogStage: stage,
    liveProof: "not-run",
    supportClaim: "forbidden",
    ordinaryGatewayAvailability: prohibited ? "prohibited" : "unsupported",
    reopenLiveWhen: FOR_149_LIVE_REOPEN,
  };
}

export function buildSixProviderMatrix(catalog: Catalog): SixProviderMatrix {
  invariant(catalog.schemaVersion === "conquistador.tool-catalog/v1", "catalog schema is not v1");
  invariant(
    catalog.status === "candidate-operations-not-supported",
    "six-provider catalog must not claim candidate-bound support",
  );

  const operations = sixProviderOperations(catalog.operations);

  invariant(
    operations.length === FOR_149_OPERATION_COUNT,
    `FOR-149 frozen set is ${FOR_149_OPERATION_COUNT} operations (13 fixture-verified plus one prohibited delete); found ${operations.length}`,
  );
  uniqueStrings(
    operations.map((operation) => operation.id),
    "FOR-149 operation ids",
  );

  const providers = new Set(operations.map((operation) => operation.provider));

  invariant(providers.size === FOR_149_PROVIDER_IDS.length, "FOR-149 must cover exactly the six frozen providers");

  for (const provider of FOR_149_PROVIDER_IDS) {
    invariant(providers.has(provider), `FOR-149 is missing provider ${provider}`);
  }

  const prohibited = operations.filter((operation) => operation.actionClass === "prohibited");

  invariant(prohibited.length === 1 && prohibited[0].id === FOR_149_PROHIBITED_OPERATION_ID, "exactly one prohibited Typefully delete is allowed");

  return {
    schemaVersion: FOR_149_MATRIX_SCHEMA,
    issue: "FOR-149",
    catalogStatus: catalog.status,
    liveProofStatus: "deferred-missing-hung-credentials",
    supportClaimStatus: "none-claimed",
    reopenLiveWhen: FOR_149_LIVE_REOPEN,
    operations: operations.map(cellFor),
  };
}

export function assertNoLiveOrSupportPromotion(operations: readonly OperationContract[]): void {
  for (const operation of sixProviderOperations(operations)) {
    for (const cell of operation.supportCells) {
      const forbidden: VerificationState[] = ["live-verified", "supported"];

      invariant(!forbidden.includes(cell.state), `${operation.id} must not promote to ${cell.state} without authorized observed live proof`);
    }
  }
}
