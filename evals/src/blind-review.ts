import { createHash } from "node:crypto";

import type { BlindPair, HumanVerdict, Sha256 } from "./contracts.ts";
import { invariant, requireSha256 } from "./validate.ts";

function digest(value: string): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export type BlindAssignment = {
  pairId: string;
  armAIdentity: string;
  armBIdentity: string;
  nonce: string;
};

export function createBlindPair(input: {
  id: string;
  caseId: string;
  left: { identity: string; artifactDigest: Sha256 };
  right: { identity: string; artifactDigest: Sha256 };
  nonce: string;
  presentedAt: string;
}): { pair: BlindPair; assignment: BlindAssignment } {
  requireSha256(input.left.artifactDigest, "left.artifactDigest");
  requireSha256(input.right.artifactDigest, "right.artifactDigest");
  invariant(input.left.identity !== input.right.identity, "blind arms must have distinct identities");
  invariant(input.nonce.length >= 32, "blind assignment nonce must have at least 32 characters");
  const swap = Number.parseInt(digest(`${input.nonce}\0${input.id}`).slice(-2), 16) % 2 === 1;
  const ordered = swap ? [input.right, input.left] : [input.left, input.right];
  const assignment: BlindAssignment = {
    pairId: input.id,
    armAIdentity: ordered[0].identity,
    armBIdentity: ordered[1].identity,
    nonce: input.nonce,
  };
  const assignmentDigest = digest(JSON.stringify(assignment));
  return {
    pair: {
      schemaVersion: "conquistador.blind-pair/v1",
      id: input.id,
      caseId: input.caseId,
      armA: { label: "A", artifactDigest: ordered[0].artifactDigest },
      armB: { label: "B", artifactDigest: ordered[1].artifactDigest },
      assignmentDigest,
      presentedAt: input.presentedAt,
    },
    assignment,
  };
}

export function revealBlindAssignment(
  pair: BlindPair,
  verdict: HumanVerdict,
  assignment: BlindAssignment,
): BlindAssignment {
  invariant(verdict.blindPairId === pair.id, "human verdict belongs to another blind pair");
  invariant(verdict.assignmentDigest === pair.assignmentDigest, "human verdict was not sealed to this assignment");
  invariant(digest(JSON.stringify(assignment)) === pair.assignmentDigest, "blind assignment digest mismatch");
  invariant(verdict.artifactDigests.includes(pair.armA.artifactDigest), "human verdict omits arm A artifact");
  invariant(verdict.artifactDigests.includes(pair.armB.artifactDigest), "human verdict omits arm B artifact");
  invariant(verdict.reviewer.trim().length > 0 && verdict.reviewerRevision.trim().length > 0, "durable reviewer identity and revision are required");
  invariant(verdict.rationale.trim().length > 0, "human verdict rationale is required");
  return assignment;
}
