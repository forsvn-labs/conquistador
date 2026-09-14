import { sha256 } from "./canonical.ts";
import { verifyToolCandidate, type ToolCandidateBuild } from "./candidate.ts";
import type {
  AdapterManifest,
  OperationContract,
  Receipt,
  SupportEvidence,
} from "./contracts.ts";
import { Gateway, type GatewayConfig } from "./gateway.ts";
import { invariant } from "./validate.ts";

export type LiveVerificationGatewayConfig = Omit<GatewayConfig, "candidateVerification"> & {
  candidate: ToolCandidateBuild;
  operationIds: string[];
};

export function createLiveVerificationGateway(config: LiveVerificationGatewayConfig): Gateway {
  const { candidate, operationIds, ...gateway } = config;
  const verified = verifyToolCandidate(candidate);
  invariant(
    operationIds.every((operationId) => verified.operations.some((operation) => operation.id === operationId)),
    "live verification operation is absent from the exact candidate",
  );
  return new Gateway({
    ...gateway,
    candidateVerification: { candidateBuildId: verified.candidateBuildId, operationIds },
  });
}

export function createLiveEvidence(
  candidate: ToolCandidateBuild,
  operation: OperationContract,
  adapter: AdapterManifest,
  receipt: Receipt,
  checkedAt: string,
): SupportEvidence {
  const verified = verifyToolCandidate(candidate);
  invariant(
    !Number.isNaN(Date.parse(checkedAt)) && new Date(checkedAt).toISOString() === checkedAt,
    "live evidence checkedAt must be an exact UTC timestamp",
  );
  invariant(receipt.status === "succeeded" && receipt.terminalRecord, "live evidence requires a succeeded terminal receipt");
  invariant(!receipt.error, "live evidence cannot bind a failed receipt");
  invariant(/^[0-9a-f]{64}$/.test(receipt.candidateBuildId), "live evidence requires an exact Candidate Build ID");
  invariant(
    receipt.candidateBuildId === verified.candidateBuildId &&
      verified.operations.some((candidateOperation) =>
        candidateOperation.id === operation.id &&
        candidateOperation.provider === operation.provider &&
        candidateOperation.providerApiVersion === operation.providerApiVersion,
      ),
    "live receipt differs from the exact candidate",
  );
  invariant(
    receipt.operationId === operation.id &&
      receipt.capabilityId === operation.capabilityId &&
      receipt.provider === operation.provider,
    "live receipt differs from the exact operation",
  );
  invariant(
    receipt.adapterId === adapter.id &&
      receipt.adapterVersion === adapter.version &&
      adapter.operationIds.includes(operation.id),
    "live receipt differs from the exact adapter",
  );
  invariant(adapter.provider === operation.provider, "live adapter provider differs from the operation");
  invariant(receipt.redactionApplied === true, "live evidence requires redaction");
  invariant(receipt.sourceUrls.length > 0, "live evidence requires a provider source");
  if (operation.actionClass === "consequential") {
    invariant(
      Boolean(receipt.approvalId && receipt.manifestDigest && receipt.payloadDigest),
      "consequential live evidence requires authenticated approval and digest binding",
    );
  }
  return {
    id: `${operation.id}.live.${receipt.id}`,
    kind: "live",
    candidateBuildId: receipt.candidateBuildId,
    providerVersion: operation.providerApiVersion,
    adapterVersion: adapter.version,
    checkedAt,
    digest: sha256({
      operationId: operation.id,
      providerVersion: operation.providerApiVersion,
      adapterId: adapter.id,
      adapterVersion: adapter.version,
      candidateBuildId: receipt.candidateBuildId,
      terminalReceiptId: receipt.id,
      terminalReceiptDigest: receipt.receiptDigest,
    }),
    terminalReceiptId: receipt.id,
  };
}
