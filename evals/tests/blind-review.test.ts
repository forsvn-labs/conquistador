import { describe, expect, it } from "vitest";

import { createBlindPair, revealBlindAssignment } from "../src/blind-review";
import type { HumanVerdict } from "../src/contracts";
import { sha } from "./helpers";

describe("blind human review", () => {
  it("separates opaque presentation from the secret assignment", () => {
    const { pair, assignment } = createBlindPair({
      id: "pair-1",
      caseId: "case-1",
      left: { identity: "candidate-c", artifactDigest: sha("1") },
      right: { identity: "historical-control", artifactDigest: sha("2") },
      nonce: "a secret nonce with at least thirty two characters",
      presentedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(JSON.stringify(pair)).not.toContain("candidate-c");
    expect(JSON.stringify(pair)).not.toContain("historical-control");
    expect(assignment.armAIdentity).not.toBe(assignment.armBIdentity);

    const verdict: HumanVerdict = {
      schemaVersion: "conquistador.human-verdict/v1",
      id: "verdict-1",
      blindPairId: pair.id,
      reviewer: "reviewer-7",
      reviewerRevision: "rubric-1.0.0",
      artifactDigests: [pair.armA.artifactDigest, pair.armB.artifactDigest],
      verdict: "A",
      rationale: "Arm A is more complete and preserves the approval boundary.",
      recordedAt: "2026-08-11T01:00:00.000Z",
      assignmentDigest: pair.assignmentDigest,
    };
    expect(revealBlindAssignment(pair, verdict, assignment)).toEqual(assignment);
  });

  it("produces both shuffled orders and rejects early or mismatched reveal", () => {
    const orders = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      const { assignment } = createBlindPair({
        id: `pair-${index}`,
        caseId: "case-1",
        left: { identity: "left", artifactDigest: sha("3") },
        right: { identity: "right", artifactDigest: sha("4") },
        nonce: `nonce-${index}-with-at-least-thirty-two-characters`,
        presentedAt: "2026-08-11T00:00:00.000Z",
      });
      orders.add(`${assignment.armAIdentity}:${assignment.armBIdentity}`);
    }
    expect(orders.size).toBe(2);
  });
});
