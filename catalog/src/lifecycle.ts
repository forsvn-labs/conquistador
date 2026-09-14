import type { SupportCell, SupportEvidence, VerificationState } from "./contracts.ts";
import { deepFreeze } from "./canonical.ts";
import { invariant, requireSha256 } from "./validate.ts";

const NEXT: Partial<Record<VerificationState, VerificationState>> = {
  unknown: "cataloged",
  cataloged: "researched",
  researched: "fixture-verified",
  "fixture-verified": "live-verified",
  "live-verified": "supported",
};

function validateEvidence(evidence: SupportEvidence): void {
  invariant(evidence.id.trim().length > 0, "support evidence ID is required");
  requireSha256(evidence.digest, "support evidence digest");
  invariant(!Number.isNaN(Date.parse(evidence.checkedAt)), "support evidence checkedAt is invalid");
  invariant(evidence.providerVersion.trim().length > 0, "support evidence providerVersion is required");
  invariant(evidence.adapterVersion.trim().length > 0, "support evidence adapterVersion is required");
}

export function advanceSupportCell(
  cell: SupportCell,
  target: VerificationState,
  evidence: SupportEvidence,
): Readonly<SupportCell> {
  validateEvidence(evidence);
  if (target === "degraded") {
    invariant(["live-verified", "supported"].includes(cell.state), "only live or supported cells can degrade");
  } else if (target === "retired") {
    invariant(evidence.kind === "retirement", "retirement requires retirement evidence");
    invariant(Boolean(evidence.humanAcceptanceId), "retirement requires human acceptance");
  } else {
    invariant(NEXT[cell.state] === target, `support transition ${cell.state} → ${target} is not allowed`);
    if (target === "fixture-verified") invariant(evidence.kind === "fixture", "fixture verification needs fixture evidence");
    if (target === "live-verified") {
      invariant(evidence.kind === "live", "live verification needs live evidence");
      invariant(/^[0-9a-f]{64}$/.test(evidence.candidateBuildId ?? ""), "live evidence needs exact Candidate Build ID");
      invariant(Boolean(evidence.terminalReceiptId), "live evidence needs a terminal receipt");
    }
    if (target === "supported") {
      invariant(evidence.kind === "release-matrix", "supported needs release-matrix evidence");
      invariant(cell.evidence.some((entry) => entry.kind === "live"), "supported needs prior live evidence");
    }
  }
  return deepFreeze({ ...cell, state: target, evidence: [...cell.evidence, evidence] });
}

export function supportIsFresh(
  cell: SupportCell,
  now: Date,
  maximumAgeDays: number,
  providerVersion: string,
  adapterVersion: string,
): boolean {
  if (cell.state !== "supported") return false;
  const latest = [...cell.evidence].reverse().find((entry) => entry.kind === "release-matrix");
  const live = [...cell.evidence].reverse().find((entry) => entry.kind === "live");
  if (!latest || !live || !live.candidateBuildId || !live.terminalReceiptId) return false;
  const age = now.getTime() - Date.parse(latest.checkedAt);
  return (
    age >= 0 &&
    age <= maximumAgeDays * 86_400_000 &&
    latest.providerVersion === providerVersion &&
    latest.adapterVersion === adapterVersion
  );
}
