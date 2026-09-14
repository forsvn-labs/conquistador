import { describe, expect, it } from "vitest";
import {
  type ActionAuthorizationV1,
  type ActionReceiptV1,
  type AuthenticationProof,
  authorizationSubjectDigest,
  REVIEW_CONTRACT_VERSION,
  type ReviewPacketV1,
  ReviewTransitionState,
  type ReviewVerdictV1,
  seal,
  verdictSubjectDigest,
} from "../../runtime/src/review-contract.ts";
import { sha256 } from "../../runtime/src/canonical.ts";

const t0 = "2026-08-21T00:00:00.000Z",
  t1 = "2026-08-21T00:01:00.000Z",
  t2 = "2026-08-21T00:02:00.000Z",
  t3 = "2026-08-21T00:03:00.000Z",
  expiry = "2026-08-21T01:00:00.000Z";
function proof(
  role: "reviewer" | "operator",
  authority: string,
  subjectDigest: `sha256:${string}`,
): AuthenticationProof {
  const body = {
    principalId: `fixture-${role}`,
    role,
    method: "deterministic-fixture",
    verifier: "implementation-test-only",
    verifiedAt: role === "reviewer" ? t1 : t2,
    authority,
    subjectDigest,
  };
  return { ...body, proofDigest: sha256(body) };
}
const verify = (
  p: AuthenticationProof,
  c: { role: string; authority: string; subjectDigest: string },
) =>
  p.principalId === `fixture-${c.role}` &&
  p.verifier === "implementation-test-only" && p.authority === c.authority &&
  p.subjectDigest === c.subjectDigest;

describe("Tool Module canonical authority adapter", () => {
  it("binds prepare, authorization, execution and receipt", () => {
    const payload = { title: "fixture" },
      artifact = {
        artifactId: "tool-artifact",
        revision: 1,
        digest: sha256("fixture"),
        state: "finished" as const,
      };
    const packet: ReviewPacketV1 = seal({
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "review-packet",
      packetId: "tool-packet",
      revisionId: "tool-packet.r1",
      revision: 1,
      producer: {
        module: "tool-module",
        sourceId: "catalog.fixture",
        capabilityId: "draft",
        playbookId: null,
        playbookVersion: null,
      },
      identity: {
        sessionId: "session",
        runId: "run",
        candidateId: null,
        evidenceId: null,
      },
      artifact,
      strategicBet: "Bind exact action.",
      work: {
        state: "finished",
        summary: "Fixture prepared.",
        partialReason: null,
      },
      materialTactics: ["Bind payload."],
      evidence: [],
      unresolvedLimitations: ["No provider call."],
      proposedNextAction: "Human review.",
      actionProposal: {
        authority: "provider.fixture",
        operation: "draft",
        connectionRef: "fixture.connection",
        payload,
        payloadDigest: sha256(payload),
      },
      redaction: {
        classification: "internal",
        secretFields: [],
        applied: true,
      },
      reviewBoundary: {
        humanRequired: true,
        modelCannotDecide: true,
        oneFinalVerdict: true,
        outcomes: ["accept", "revise", "reject", "cancel"],
      },
      createdAt: t0,
    });
    const verdictBasis = {
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "review-verdict",
      verdictId: "verdict",
      outcome: "accept",
      packetId: packet.packetId,
      packetDigest: packet.digest,
      artifactId: artifact.artifactId,
      artifactRevision: 1,
      artifactDigest: artifact.digest,
      actionPayloadDigest: packet.actionProposal!.payloadDigest,
      sessionId: "session",
      runId: "run",
      candidateId: null,
      evidenceId: null,
      decidedAt: t1,
      expiryPolicy: "expires",
      expiresAt: expiry,
      singleUse: true,
    } as const;
    const verdict: ReviewVerdictV1 = seal({
      ...verdictBasis,
      authentication: proof(
        "reviewer",
        "content-review",
        verdictSubjectDigest(packet, verdictBasis),
      ),
    });
    const authorizationBasis = {
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "action-authorization",
      authorizationId: "authorization",
      verdictId: verdict.verdictId,
      verdictDigest: verdict.digest,
      packetId: packet.packetId,
      packetDigest: packet.digest,
      sessionId: "session",
      runId: "run",
      candidateId: null,
      artifact,
      allowed: {
        authority: "provider.fixture",
        operation: "draft",
        connectionRef: "fixture.connection",
        payloadDigest: sha256(payload),
      },
      authorizedAt: t2,
      expiresAt: expiry,
      singleUse: true,
    } as const;
    const authorization: ActionAuthorizationV1 = seal({
      ...authorizationBasis,
      authentication: proof(
        "operator",
        "consequential-action",
        authorizationSubjectDigest(authorizationBasis),
      ),
    });
    const receipt: ActionReceiptV1 = seal({
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "action-receipt",
      receiptId: "receipt",
      authorizationId: authorization.authorizationId,
      authorizationDigest: authorization.digest,
      sessionId: "session",
      runId: "run",
      candidateId: null,
      artifact,
      authority: "provider.fixture",
      operation: "draft",
      connectionRef: "fixture.connection",
      payloadDigest: sha256(payload),
      status: "failed",
      startedAt: t3,
      finishedAt: t3,
      redactionApplied: true,
      terminal: true,
    });
    const state = new ReviewTransitionState(),
      context = { now: t2, verifyAuthentication: verify };
    expect(() => state.authorize(authorization, packet, verdict, context)).not
      .toThrow();
    expect(() => state.recordReceipt(receipt, authorization)).not.toThrow();
    const changed = structuredClone(receipt) as Record<string, unknown>;
    delete changed.digest;
    changed.payloadDigest = sha256("changed");
    expect(() => state.recordReceipt(seal(changed as never), authorization))
      .toThrow(/mismatch/);
  });
});
