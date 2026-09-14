import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { sha256 } from "../src/canonical.ts";
import {
  type AuthenticationProof,
  authorizationSubjectDigest,
  REVIEW_CONTRACT_VERSION,
  type ReviewOutcome,
  type ReviewPacketV1,
  seal,
  verdictSubjectDigest,
} from "../src/review-contract.ts";

export function canonicalReviewFixture(
  runsDir: string,
  runId: string,
  outcome: ReviewOutcome,
  options: {
    verdictId?: string;
    authorizationId?: string;
    now?: string;
    omitReceipt?: boolean;
    receiptStatus?: "succeeded" | "failed" | "cancelled";
  } = {},
) {
  const packet = JSON.parse(
    readFileSync(
      resolve(runsDir, runId, "canonical-review-packet.json"),
      "utf8",
    ),
  ) as ReviewPacketV1;
  const decidedAt = new Date(Date.parse(packet.createdAt) + 1).toISOString();
  const expiresAt = new Date(Date.parse(decidedAt) + 3_600_000).toISOString();
  const proof = (
    role: "reviewer" | "operator",
    authority: string,
    subjectDigest: `sha256:${string}`,
  ): AuthenticationProof => {
    const basis = {
      principalId: `fixture-${role}`,
      role,
      method: "deterministic-fixture",
      verifier: "implementation-test-only",
      verifiedAt: decidedAt,
      authority,
      subjectDigest,
    };
    return { ...basis, proofDigest: sha256(basis) };
  };
  const verdictBasis = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "review-verdict" as const,
    verdictId: options.verdictId ?? `fixture-verdict-${outcome}`,
    outcome,
    packetId: packet.packetId,
    packetDigest: packet.digest,
    artifactId: packet.artifact.artifactId,
    artifactRevision: packet.artifact.revision,
    artifactDigest: packet.artifact.digest,
    actionPayloadDigest: packet.actionProposal?.payloadDigest ?? null,
    sessionId: packet.identity.sessionId,
    runId: packet.identity.runId,
    candidateId: packet.identity.candidateId,
    evidenceId: packet.identity.evidenceId,
    decidedAt,
    expiryPolicy: "expires" as const,
    expiresAt,
    singleUse: true as const,
  };
  const verdict = seal({
    ...verdictBasis,
    authentication: proof(
      "reviewer",
      "content-review",
      verdictSubjectDigest(packet, verdictBasis),
    ),
  });
  const authorizationBasis = packet.actionProposal && outcome === "accept"
    ? {
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "action-authorization" as const,
      authorizationId: options.authorizationId ?? "fixture-authorization",
      verdictId: verdict.verdictId,
      verdictDigest: verdict.digest,
      packetId: packet.packetId,
      packetDigest: packet.digest,
      sessionId: packet.identity.sessionId,
      runId: packet.identity.runId,
      candidateId: packet.identity.candidateId,
      artifact: packet.artifact,
      allowed: {
        authority: packet.actionProposal.authority,
        operation: packet.actionProposal.operation,
        connectionRef: packet.actionProposal.connectionRef,
        payloadDigest: packet.actionProposal.payloadDigest,
      },
      authorizedAt: decidedAt,
      expiresAt,
      singleUse: true as const,
    }
    : null;
  const actionAuthorization = authorizationBasis
    ? seal({
      ...authorizationBasis,
      authentication: proof(
        "operator",
        "consequential-action",
        authorizationSubjectDigest(authorizationBasis),
      ),
    })
    : undefined;
  const actionReceipt = actionAuthorization && !options.omitReceipt
    ? seal({
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "action-receipt" as const,
      receiptId: "fixture-terminal-receipt",
      authorizationId: actionAuthorization.authorizationId,
      authorizationDigest: actionAuthorization.digest,
      sessionId: packet.identity.sessionId,
      runId: packet.identity.runId,
      candidateId: packet.identity.candidateId,
      artifact: packet.artifact,
      authority: actionAuthorization.allowed.authority,
      operation: actionAuthorization.allowed.operation,
      connectionRef: actionAuthorization.allowed.connectionRef,
      payloadDigest: actionAuthorization.allowed.payloadDigest,
      status: options.receiptStatus ?? "succeeded",
      startedAt: decidedAt,
      finishedAt: decidedAt,
      redactionApplied: true as const,
      terminal: true as const,
    })
    : undefined;
  const verification = {
    now: options.now ?? decidedAt,
    verifyAuthentication: (
      candidate: AuthenticationProof,
      context: { authority: string; role: string; subjectDigest: string },
    ) =>
      candidate.verifier === "implementation-test-only" &&
      candidate.principalId === `fixture-${context.role}` &&
      candidate.authority === context.authority &&
      candidate.subjectDigest === context.subjectDigest &&
      candidate.proofDigest === sha256({
          principalId: candidate.principalId,
          role: candidate.role,
          method: candidate.method,
          verifier: candidate.verifier,
          verifiedAt: candidate.verifiedAt,
          authority: candidate.authority,
          subjectDigest: candidate.subjectDigest,
        }),
  };
  return {
    verdict,
    verification,
    ...(actionAuthorization ? { actionAuthorization } : {}),
    ...(actionReceipt ? { actionReceipt } : {}),
    now: () => new Date(decidedAt),
  };
}
