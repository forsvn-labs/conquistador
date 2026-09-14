import { describe, expect, it } from "vitest";
import {
  type AuthenticationProof,
  type QualifiedReviewVerdictV1,
  qualifyReviewVerdict,
  renderReviewPacketText,
  REVIEW_CONTRACT_VERSION,
  type ReviewPacketV1,
  seal,
  validateReviewPacket,
  validateVerdict,
  verdictSubjectDigest,
} from "../../runtime/src/review-contract.ts";
import { sha256 } from "../../runtime/src/canonical.ts";
describe("Eval Lab canonical authority adapter", () => {
  it("renders text but cannot self-attest a verdict", () => {
    const at = "2026-08-21T00:00:00.000Z",
      later = "2026-08-21T00:01:00.000Z",
      artifact = {
        artifactId: "eval-output",
        revision: 1,
        digest: sha256("fixture"),
        state: "finished" as const,
      },
      packet = seal({
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "review-packet",
        packetId: "eval-packet",
        revisionId: "eval-packet.r1",
        revision: 1,
        producer: {
          module: "eval-lab",
          sourceId: "deep-review.fixture",
          capabilityId: "actual-output-review",
          playbookId: null,
          playbookVersion: null,
        },
        identity: {
          sessionId: "eval-session",
          runId: "eval-run",
          candidateId: null,
          evidenceId: "fixture-evidence",
        },
        artifact,
        strategicBet: "Review informs but cannot decide.",
        work: {
          state: "finished",
          summary: "Fixture only.",
          partialReason: null,
        },
        materialTactics: ["Preserve text."],
        evidence: [],
        unresolvedLimitations: ["No candidate."],
        proposedNextAction: "Await host-verified human.",
        actionProposal: null,
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
        createdAt: at,
      });
    validateReviewPacket(packet);
    expect(renderReviewPacketText(packet)).toContain("pending");
    const verdictBasis = {
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "review-verdict" as const,
        verdictId: "bad",
        outcome: "accept" as const,
        packetId: packet.packetId,
        packetDigest: packet.digest,
        artifactId: artifact.artifactId,
        artifactRevision: 1,
        artifactDigest: artifact.digest,
        actionPayloadDigest: null,
        sessionId: "eval-session",
        runId: "eval-run",
        candidateId: null,
        evidenceId: "fixture-evidence",
        decidedAt: later,
        expiryPolicy: "expires" as const,
        expiresAt: "2026-08-21T01:00:00.000Z",
        singleUse: true as const,
      },
      b = {
        principalId: "friendly-reviewer",
        role: "reviewer" as const,
        method: "self-asserted",
        verifier: "companion",
        verifiedAt: later,
        authority: "content-review",
        subjectDigest: verdictSubjectDigest(packet, verdictBasis),
      },
      authentication: AuthenticationProof = { ...b, proofDigest: sha256(b) },
      v = seal({
        ...verdictBasis,
        authentication,
      });
    expect(() =>
      validateVerdict(v, packet, {
        now: later,
        verifyAuthentication: () => false,
      })
    ).toThrow(/host authentication/);
  });

  it("qualifies a host-verified pair through the canonical gate and rejects the same tampering", () => {
    const at = "2026-08-21T00:00:00.000Z",
      later = "2026-08-21T00:01:00.000Z",
      artifact = {
        artifactId: "eval-output",
        revision: 1,
        digest: sha256("fixture"),
        state: "finished" as const,
      },
      packet = seal(({
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "review-packet",
        packetId: "eval-packet",
        revisionId: "eval-packet.r1",
        revision: 1,
        producer: {
          module: "eval-lab" as const,
          sourceId: "deep-review.fixture",
          capabilityId: "actual-output-review",
          playbookId: null,
          playbookVersion: null,
        },
        identity: {
          sessionId: "eval-session",
          runId: "eval-run",
          candidateId: null,
          evidenceId: "fixture-evidence",
        },
        artifact,
        strategicBet: "Review informs but cannot decide.",
        work: { state: "finished" as const, summary: "Fixture only.", partialReason: null },
        materialTactics: ["Preserve text."],
        evidence: [],
        unresolvedLimitations: ["No candidate."],
        proposedNextAction: "Await host-verified human.",
        actionProposal: null,
        redaction: { classification: "internal" as const, secretFields: [], applied: true as const },
        reviewBoundary: {
          humanRequired: true,
          modelCannotDecide: true,
          oneFinalVerdict: true,
          outcomes: ["accept", "revise", "reject", "cancel"],
        },
        createdAt: at,
      } as Omit<ReviewPacketV1, "digest">)) as ReviewPacketV1;
    const basis = {
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "review-verdict" as const,
        verdictId: "verdict-fixture",
        outcome: "accept" as const,
        packetId: packet.packetId,
        packetDigest: packet.digest,
        artifactId: artifact.artifactId,
        artifactRevision: 1,
        artifactDigest: artifact.digest,
        actionPayloadDigest: null,
        sessionId: "eval-session",
        runId: "eval-run",
        candidateId: null,
        evidenceId: "fixture-evidence",
        decidedAt: later,
        expiryPolicy: "expires" as const,
        expiresAt: "2026-08-21T01:00:00.000Z",
        singleUse: true as const,
      },
      proof = {
        principalId: "fixture-reviewer",
        role: "reviewer" as const,
        method: "deterministic-fixture",
        verifier: "implementation-test-only",
        verifiedAt: later,
        authority: "content-review",
        subjectDigest: verdictSubjectDigest(packet, basis),
      },
      authentication: AuthenticationProof = { ...proof, proofDigest: sha256(proof) },
      v = seal({ ...basis, authentication }),
      ctx = {
        now: later,
        verifyAuthentication: (p: AuthenticationProof, c: any) =>
          p.verifier === "implementation-test-only" &&
          p.principalId === "fixture-reviewer" &&
          p.role === c.role &&
          p.authority === c.authority &&
          p.subjectDigest === c.subjectDigest &&
          p.proofDigest ===
            sha256({
              principalId: p.principalId,
              role: p.role,
              method: p.method,
              verifier: p.verifier,
              verifiedAt: p.verifiedAt,
              authority: p.authority,
              subjectDigest: p.subjectDigest,
            }),
      };
    validateVerdict(v, packet, ctx);
    const expected: QualifiedReviewVerdictV1 = {
      schemaVersion: REVIEW_CONTRACT_VERSION,
      verdictId: v.verdictId,
      verdictDigest: v.digest,
      packetId: packet.packetId,
      packetDigest: packet.digest,
      artifactDigest: packet.artifact.digest,
      reviewerPrincipalId: "fixture-reviewer",
      reviewerAuthSubjectDigest: v.authentication.subjectDigest,
      candidateId: null,
      evidenceId: "fixture-evidence",
      outcome: "accept",
      decidedAt: later,
      expiresAt: basis.expiresAt,
      unresolvedLimitations: ["No candidate."],
    };
    expect(qualifyReviewVerdict(v, packet, ctx)).toEqual(expected);
    const stale: any = structuredClone(v);
    delete stale.digest;
    stale.outcome = "reject";
    expect(() => validateVerdict(seal(stale), packet, ctx)).toThrow(
      /subject mismatch/,
    );
    const resealed = seal(stale);
    const tamperedPacket: any = structuredClone(packet);
    delete tamperedPacket.digest;
    tamperedPacket.unresolvedLimitations = [];
    expect(() => validateVerdict(resealed, seal(tamperedPacket), ctx)).toThrow(
      /packet mismatch/,
    );
    expect(() => qualifyReviewVerdict(resealed, seal(tamperedPacket), ctx)).toThrow(
      /packet mismatch/,
    );
  });
});
