import { createHash } from "node:crypto";

import { qualifyReviewVerdict, type ValidationContext } from "../../runtime/src/review-contract.ts";
import type { CaseResult } from "./run-aggregation.ts";
import { invariant } from "./validate.ts";
import type { ClaimVerdictRefV1, ReleaseClaim, Sha256 } from "./contracts.ts";

const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function digest(value: unknown): Sha256 {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== "object") return entry;
    const record = entry as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, normalize(record[key])]));
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex")}`;
}

export function assembleReleaseClaim(input: {
  id: string;
  candidateBuildId: string;
  requiredCellIds: string[];
  results: Array<CaseResult & { cellId: string }>;
  humanVerdicts: ReadonlyArray<{ readonly packet: unknown; readonly verdict: unknown }>;
  requiredHumanVerdicts: number;
  generatedAt: string;
  validationContext: ValidationContext;
}): ReleaseClaim {
  invariant(input.requiredCellIds.length > 0, "Release Claim requires a frozen cell inventory");
  invariant(new Set(input.requiredCellIds).size === input.requiredCellIds.length, "required cells must be unique");
  invariant(input.results.every((result) => result.candidateBuildId === input.candidateBuildId), "Release Claim mixes Candidate Builds");
  invariant(Number.isInteger(input.requiredHumanVerdicts) && input.requiredHumanVerdicts >= 0, "required human verdicts must be a non-negative integer");
  invariant(typeof input.generatedAt === "string" && UTC.test(input.generatedAt) && !Number.isNaN(Date.parse(input.generatedAt)), "generatedAt must be exact UTC");
  invariant(typeof input.validationContext.now === "string" && UTC.test(input.validationContext.now), "validationContext.now must be exact UTC");
  invariant(input.generatedAt === input.validationContext.now, "Release Claim must bind one trusted clock: generatedAt and validationContext.now must match exactly");
  const observed = new Set(input.results.map((result) => result.cellId));
  const incompleteCells = input.requiredCellIds.filter((id) => !observed.has(id));
  const brokenRunIds = input.results
    .filter((result) => result.brokenRuns > 0)
    .map((result) => result.cellId);
  const failed = input.results.some((result) => result.status === "fail");
  const unstable = input.results.some((result) => !result.releaseEligible);

  const seen = new Set<string>();
  const seenPackets = new Set<string>();
  const refs: ClaimVerdictRefV1[] = [];
  let rejected = false;
  let unaccepted = false;
  for (const entry of input.humanVerdicts) {
    invariant(entry !== null && typeof entry === "object", "each human verdict must pair a canonical packet and verdict");
    const qualified = qualifyReviewVerdict(entry.verdict, entry.packet, input.validationContext);
    invariant(!seen.has(qualified.verdictId), `human verdict ${qualified.verdictId} is duplicated or replayed`);
    seen.add(qualified.verdictId);
    const packetKey = `${qualified.packetId}:${qualified.packetDigest}`;
    invariant(!seenPackets.has(packetKey), `packet ${qualified.packetId} already carries a final verdict`);
    seenPackets.add(packetKey);
    const candidate = qualified.candidateId;
    invariant(candidate !== null && candidate === input.candidateBuildId, `human verdict ${qualified.verdictId} reviews a different Candidate Build`);
    const cell = qualified.evidenceId;
    invariant(
      cell !== null && input.requiredCellIds.includes(cell) && observed.has(cell),
      `human verdict ${qualified.verdictId} is not bound to observed required evidence`,
    );
    const generated = Date.parse(input.generatedAt);
    invariant(
      generated >= Date.parse(qualified.decidedAt) && generated <= Date.parse(qualified.expiresAt),
      `human verdict ${qualified.verdictId} is not valid at claim generation time`,
    );
    refs.push({
      schemaVersion: "conquistador.claim-verdict-ref/v1",
      verdictId: qualified.verdictId,
      verdictDigest: qualified.verdictDigest,
      packetId: qualified.packetId,
      packetDigest: qualified.packetDigest,
      artifactDigest: qualified.artifactDigest,
      reviewerPrincipalId: qualified.reviewerPrincipalId,
      reviewerAuthSubjectDigest: qualified.reviewerAuthSubjectDigest,
      candidateBuildId: candidate,
      evidenceCellId: cell,
      outcome: qualified.outcome,
      decidedAt: qualified.decidedAt,
      expiresAt: qualified.expiresAt,
      unresolvedLimitations: [...qualified.unresolvedLimitations],
    });
    if (qualified.outcome === "accept") continue;
    unaccepted = true;
    if (qualified.outcome === "reject") rejected = true;
  }
  if (refs.filter((ref) => ref.outcome === "accept").length < input.requiredHumanVerdicts || unaccepted) {
    incompleteCells.push("human-verdicts");
  }
  const status = failed || rejected
    ? "no-go"
    : incompleteCells.length || brokenRunIds.length || unstable
      ? "incomplete"
      : "evidence-complete";
  const humanVerdicts = [...refs].sort((left, right) => left.verdictId.localeCompare(right.verdictId));
  const evidence = {
    candidateBuildId: input.candidateBuildId,
    requiredCellIds: [...input.requiredCellIds].sort(),
    results: [...input.results].sort((left, right) => left.cellId.localeCompare(right.cellId)),
    humanVerdicts,
  };
  return {
    schemaVersion: "conquistador.release-claim/v1",
    id: input.id,
    candidateBuildId: input.candidateBuildId,
    evidenceDigest: digest(evidence),
    status,
    incompleteCells: [...new Set(incompleteCells)].sort(),
    brokenRunIds: [...brokenRunIds].sort(),
    humanVerdicts,
    authority: "none",
    generatedAt: input.generatedAt,
  };
}
