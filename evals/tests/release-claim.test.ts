import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationProof,
  type ReviewOutcome,
  type ReviewPacketV1,
  type ReviewVerdictV1,
  REVIEW_CONTRACT_VERSION,
  seal,
  verdictSubjectDigest,
} from "../../runtime/src/review-contract.ts";
import { sha256 } from "../../runtime/src/canonical.ts";

import { assembleReleaseClaim } from "../src/release-claim";
import { aggregateCase, type CaseResult } from "../src/run-aggregation";
import { brokenRun, candidateId, dimension, root, run } from "./helpers";

const createdAt = "2026-08-11T02:00:00.000Z",
  decidedAt = "2026-08-11T02:30:00.000Z",
  generatedAt = "2026-08-11T03:00:00.000Z",
  expiresAt = "2026-08-11T04:00:00.000Z";

const trustedVerify = (proof: AuthenticationProof, context: any): boolean =>
  proof.verifier === "implementation-test-only" &&
  proof.method === "deterministic-fixture" &&
  proof.principalId === "fixture-reviewer" &&
  proof.role === context.role &&
  proof.authority === context.authority &&
  proof.subjectDigest === context.subjectDigest &&
  proof.proofDigest ===
    sha256({
      principalId: proof.principalId,
      role: proof.role,
      method: proof.method,
      verifier: proof.verifier,
      verifiedAt: proof.verifiedAt,
      authority: proof.authority,
      subjectDigest: proof.subjectDigest,
    });
const validationContext = (now = generatedAt) => ({
  now,
  verifyAuthentication: trustedVerify,
});

type PairOptions = {
  candidate?: string;
  cellId?: string;
  limitations?: string[];
  outcome?: ReviewOutcome;
  decided?: string;
  expires?: string;
  selfAttested?: boolean;
};

function pair(options: PairOptions = {}): {
  packet: ReviewPacketV1;
  verdict: ReviewVerdictV1;
} {
  const candidate = options.candidate ?? candidateId;
  const cellId = options.cellId ?? "cell-1";
  const decided = options.decided ?? decidedAt;
  const basis = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "review-verdict" as const,
    verdictId: `verdict-${options.outcome ?? "accept"}-${cellId}`,
    outcome: options.outcome ?? ("accept" as const),
    packetId: `packet-${cellId}`,
    packetDigest: "" as any,
    artifactId: "eval-output",
    artifactRevision: 1,
    artifactDigest: sha256("artifact"),
    actionPayloadDigest: null,
    sessionId: "eval-session",
    runId: `run-${cellId}`,
    candidateId: candidate,
    evidenceId: cellId,
    decidedAt: decided,
    expiryPolicy: "expires" as const,
    expiresAt: options.expires ?? expiresAt,
    singleUse: true as const,
  };
  const packetBody: Omit<ReviewPacketV1, "digest"> = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "review-packet",
    packetId: `packet-${cellId}`,
    revisionId: `packet-${cellId}.r1`,
    revision: 1,
    producer: {
      module: "eval-lab",
      sourceId: "release-claim.fixture",
      capabilityId: "actual-output-review",
      playbookId: null,
      playbookVersion: null,
    },
    identity: {
      sessionId: "eval-session",
      runId: `run-${cellId}`,
      candidateId: candidate,
      evidenceId: cellId,
    },
    artifact: {
      artifactId: "eval-output",
      revision: 1,
      digest: sha256("artifact"),
      state: "finished",
    },
    strategicBet: "Release claims bind canonical verdicts only.",
    work: { state: "finished", summary: "Fixture work.", partialReason: null },
    materialTactics: ["Bind exact provenance."],
    evidence: [],
    unresolvedLimitations: options.limitations ?? ["Fixture limitation."],
    proposedNextAction: "Await host-verified human.",
    actionProposal: null,
    redaction: { classification: "internal", secretFields: [], applied: true },
    reviewBoundary: {
      humanRequired: true,
      modelCannotDecide: true,
      oneFinalVerdict: true,
      outcomes: ["accept", "revise", "reject", "cancel"],
    },
    createdAt: createdAt,
  };
  const packet = seal(packetBody);
  (basis as any).packetId = packet.packetId;
  basis.packetDigest = packet.digest;
  const attested = options.selfAttested
    ? {
        principalId: "autonomous-model",
        role: "reviewer" as const,
        method: "self-asserted",
        verifier: "companion",
        verifiedAt: decided,
        authority: "content-review",
        subjectDigest: verdictSubjectDigest(packet, basis),
      }
    : {
        principalId: "fixture-reviewer",
        role: "reviewer" as const,
        method: "deterministic-fixture",
        verifier: "implementation-test-only",
        verifiedAt: decided,
        authority: "content-review",
        subjectDigest: verdictSubjectDigest(packet, basis),
      };
  const verdict = seal({
    ...basis,
    authentication: { ...attested, proofDigest: sha256(attested) },
  });
  return { packet, verdict };
}

const passingResult = (): CaseResult & { cellId: string } => ({
  ...aggregateCase([run(1), run(2), run(3)], [dimension]),
  cellId: "cell-1",
});

function claimInput(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-1",
    candidateBuildId: candidateId,
    requiredCellIds: ["cell-1"],
    results: [passingResult()],
    humanVerdicts: [] as Array<{ packet: unknown; verdict: unknown }>,
    requiredHumanVerdicts: 1,
    generatedAt,
    validationContext: validationContext(),
    ...overrides,
  };
}

describe("Release Claim", () => {
  it("binds a canonically validated human accept into evidence-complete without authority", () => {
    const { packet, verdict } = pair();
    const claim = assembleReleaseClaim(
      claimInput({ humanVerdicts: [{ packet, verdict }] }),
    );
    expect(claim.status).toBe("evidence-complete");
    expect(claim.incompleteCells).toEqual([]);
    expect(claim.authority).toBe("none");
    expect(claim.humanVerdicts).toHaveLength(1);
    expect(claim.humanVerdicts[0]).toEqual({
      schemaVersion: "conquistador.claim-verdict-ref/v1",
      verdictId: verdict.verdictId,
      verdictDigest: verdict.digest,
      packetId: packet.packetId,
      packetDigest: packet.digest,
      artifactDigest: packet.artifact.digest,
      reviewerPrincipalId: "fixture-reviewer",
      reviewerAuthSubjectDigest: verdict.authentication.subjectDigest,
      candidateBuildId: candidateId,
      evidenceCellId: "cell-1",
      outcome: "accept",
      decidedAt,
      expiresAt,
      unresolvedLimitations: ["Fixture limitation."],
    });
  });

  it("keeps broken, flaky, missing, and human-pending cells incomplete", () => {
    const result = aggregateCase([run(1), run(2), brokenRun(3)], [dimension]);
    const claim = assembleReleaseClaim(
      claimInput({
        id: "claim-2",
        candidateBuildId: candidateId,
        requiredCellIds: ["cell-1", "cell-2"],
        results: [{ ...result, cellId: "cell-1" }],
        requiredHumanVerdicts: 1,
      }),
    );
    expect(claim.status).toBe("incomplete");
    expect(claim.incompleteCells).toEqual(["cell-2", "human-verdicts"]);
    expect(claim.brokenRunIds).toEqual(["cell-1"]);
    expect(claim.humanVerdicts).toEqual([]);
    expect(claim.authority).toBe("none");
  });

  it("cannot be satisfied by an arbitrary verdict ID or fabricated shape", () => {
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: ["human-1"] as any })),
    ).toThrow();
    expect(() =>
      assembleReleaseClaim(
        claimInput({
          humanVerdicts: [
            { packet: {}, verdict: { verdictId: "totally-fake-verdict" } },
          ],
        }),
      ),
    ).toThrow();
    const forged = structuredClone(pair());
    (forged.verdict as any).outcome = "reject";
    expect(() =>
      assembleReleaseClaim(
        claimInput({ humanVerdicts: [{ ...forged }] }),
      ),
    ).toThrow(/subject mismatch|digest mismatch|fields are not closed/);
  });

  it("fails closed on duplicate or replayed verdict IDs", () => {
    const { packet, verdict } = pair();
    expect(() =>
      assembleReleaseClaim(
        claimInput({
          humanVerdicts: [{ packet, verdict }, { packet, verdict }],
          requiredHumanVerdicts: 2,
        }),
      ),
    ).toThrow(/duplicated|replayed/);
  });

  it("fails closed when the verdict reviews another Candidate Build", () => {
    const other = pair({ candidate: "a".repeat(64) });
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: [other] })),
    ).toThrow(/different Candidate Build/);
  });

  it("fails closed on wrong evidence pairing", () => {
    const unrequired = pair({ cellId: "cell-9" });
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: [unrequired] })),
    ).toThrow(/not bound to observed required evidence/);
    const unobserved = pair({ cellId: "cell-2" });
    expect(() =>
      assembleReleaseClaim(
        claimInput({
          humanVerdicts: [unobserved],
          requiredCellIds: ["cell-1", "cell-2"],
        }),
      ),
    ).toThrow(/not bound to observed required evidence/);
  });

  it("fails closed on model self-approval without host attestation", () => {
    const selfApproval = pair({ selfAttested: true });
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: [selfApproval] })),
    ).toThrow(/host authentication/);
  });

  it("fails closed on invalid decision chronology and expiry", () => {
    const futureDecision = pair({
      decided: "2026-08-11T03:45:00.000Z",
    });
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: [futureDecision] })),
    ).toThrow(/chronology/);
    const expired = pair({ expires: "2026-08-11T02:45:00.000Z" });
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: [expired] })),
    ).toThrow(/chronology/);
  });

  it("fails closed when limitations are tampered behind the packet digest", () => {
    const original = pair();
    const tamperedPacketBody: any = structuredClone(original.packet);
    delete tamperedPacketBody.digest;
    tamperedPacketBody.unresolvedLimitations = [];
    const tampered = seal(tamperedPacketBody);
    expect(() =>
      assembleReleaseClaim(
        claimInput({
          humanVerdicts: [{ packet: tampered, verdict: original.verdict }],
        }),
      ),
    ).toThrow(/packet mismatch/);
  });

  it("changes evidenceDigest whenever bound provenance or limitations change", () => {
    const first = assembleReleaseClaim(
      claimInput({ humanVerdicts: [pair({ limitations: ["Limitation A."] })] }),
    );
    const second = assembleReleaseClaim(
      claimInput({ humanVerdicts: [pair({ limitations: ["Limitation B."] })] }),
    );
    const third = assembleReleaseClaim(
      claimInput({
        humanVerdicts: [
          pair({ limitations: ["Limitation A."], decided: "2026-08-11T02:31:00.000Z" }),
        ],
      }),
    );
    expect(first.evidenceDigest).not.toBe(second.evidenceDigest);
    expect(first.evidenceDigest).not.toBe(third.evidenceDigest);
    expect(first.evidenceDigest).toBe(
      assembleReleaseClaim(
        claimInput({ humanVerdicts: [pair({ limitations: ["Limitation A."] })] }),
      ).evidenceDigest,
    );
  });

  it.each([
    ["revise", "incomplete"],
    ["cancel", "incomplete"],
    ["reject", "no-go"],
  ] as const)("maps %o truthfully to %s", (outcome, status) => {
    const claim = assembleReleaseClaim(
      claimInput({ humanVerdicts: [pair({ outcome })] }),
    );
    expect(claim.status).toBe(status);
    if (status === "incomplete") {
      expect(claim.incompleteCells).toEqual(["human-verdicts"]);
    }
    expect(claim.humanVerdicts[0].outcome).toBe(outcome);
    expect(claim.authority).toBe("none");
  });

  it("never lets a non-accept verdict ride along with satisfied quota", () => {
    const accept = pair();
    const revise = pair({ outcome: "revise", limitations: ["Revise demand."] });
    const claim = assembleReleaseClaim(
      claimInput({
        humanVerdicts: [accept, revise],
        requiredHumanVerdicts: 1,
      }),
    );
    expect(claim.status).toBe("incomplete");
    expect(claim.incompleteCells).toEqual(["human-verdicts"]);
    expect(claim.humanVerdicts.map((ref) => ref.outcome)).toEqual([
      "accept",
      "revise",
    ]);
    expect(claim.authority).toBe("none");
  });

  it("fails closed when one packet is reviewed twice with distinct verdicts", () => {
    const { packet, verdict } = pair();
    const body: any = structuredClone(verdict);
    delete body.digest;
    body.verdictId = "verdict-accept-cell-1-b";
    const basis = {
      principalId: body.authentication.principalId,
      role: body.authentication.role,
      method: body.authentication.method,
      verifier: body.authentication.verifier,
      verifiedAt: body.authentication.verifiedAt,
      authority: body.authentication.authority,
      subjectDigest: verdictSubjectDigest(packet, body),
    };
    body.authentication = { ...basis, proofDigest: sha256(basis) };
    expect(() =>
      assembleReleaseClaim(
        claimInput({
          humanVerdicts: [
            { packet, verdict },
            { packet, verdict: seal(body) },
          ],
          requiredHumanVerdicts: 2,
        }),
      ),
    ).toThrow(/already carries a final verdict/);
  });

  it("stays incomplete with human-verdicts when qualified accepts miss the quota", () => {
    const claim = assembleReleaseClaim(
      claimInput({ requiredHumanVerdicts: 2, humanVerdicts: [pair()] }),
    );
    expect(claim.status).toBe("incomplete");
    expect(claim.incompleteCells).toEqual(["human-verdicts"]);
    expect(claim.authority).toBe("none");
  });

  it("keeps release authority none even at evidence-complete with stale inputs rejected", () => {
    const stale = structuredClone(pair());
    (stale.verdict as any).decidedAt = "2026-08-11T02:59:00.000Z";
    expect(() =>
      assembleReleaseClaim(claimInput({ humanVerdicts: [{ ...stale }] })),
    ).toThrow(/subject mismatch|digest mismatch/);
    const claim = assembleReleaseClaim(
      claimInput({ humanVerdicts: [pair()], requiredHumanVerdicts: 0 }),
    );
    expect(claim.status).toBe("evidence-complete");
    expect(claim.authority).toBe("none");
  });

  it("rejects a mismatched generatedAt and context clock even inside verdict validity", () => {
    const { packet, verdict } = pair();
    expect(() =>
      assembleReleaseClaim(
        claimInput({
          humanVerdicts: [{ packet, verdict }],
          generatedAt,
          validationContext: validationContext("2026-08-11T03:15:00.000Z"),
        }),
      ),
    ).toThrow(/one trusted clock/);
    const claim = assembleReleaseClaim(
      claimInput({
        humanVerdicts: [{ packet, verdict }],
        generatedAt,
        validationContext: validationContext(generatedAt),
      }),
    );
    expect(claim.status).toBe("evidence-complete");
  });
});

describe("Release Claim schema alignment", () => {
  it("publishes a closed schema that rejects duplicated refs and limitations", () => {
    const schema = JSON.parse(
      readFileSync(resolve(root, "schemas", "eval-lab.schema.json"), "utf8"),
    );
    const validate = new Ajv2020({
      strict: false,
      formats: { "date-time": true },
    }).compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $ref: "#/$defs/ReleaseClaim",
      $defs: schema.$defs,
    });
    const { packet, verdict } = pair();
    const claim = assembleReleaseClaim(
      claimInput({ humanVerdicts: [{ packet, verdict }] }),
    );
    expect(validate(claim), JSON.stringify(validate.errors)).toBe(true);
    const duplicatedRef = {
      ...claim,
      humanVerdicts: [claim.humanVerdicts[0], structuredClone(claim.humanVerdicts[0])],
    };
    expect(validate(duplicatedRef)).toBe(false);
    const duplicatedLimitations = {
      ...claim,
      humanVerdicts: [
        {
          ...claim.humanVerdicts[0],
          unresolvedLimitations: ["Same.", "Same."],
        },
      ],
    };
    expect(validate(duplicatedLimitations)).toBe(false);
  });
});
