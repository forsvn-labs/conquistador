import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { createOperatorHumanAuth } from "../src/human-auth.ts";
import { TEST_TRANSPORT } from "./auth-fixture.ts";
import type { HumanAuthenticationChallenge } from "../src/review-contract.ts";

const review = "review-fixture-secret-12345678901234567890";
const action = "action-fixture-secret-12345678901234567890";
const env = { CONQUISTADOR_HUMAN_REVIEW_TOKEN: review, CONQUISTADOR_HUMAN_ACTION_TOKEN: action };
const challenge: HumanAuthenticationChallenge = {
  transport: TEST_TRANSPORT, principalId: TEST_TRANSPORT.principalId,
  role: "reviewer", authority: "content-review", now: new Date().toISOString(), subjectDigest: `sha256:${"a".repeat(64)}`,
};
function headers(values: Record<string, string>): IncomingMessage { return { headers: values } as IncomingMessage; }

describe("operator-held review authority", () => {
  it("requires a separate credential and authenticates the exact subject", () => {
    const auth = createOperatorHumanAuth(env)!;
    expect(() => auth.authenticate(challenge, headers({ authorization: `Bearer ${review}` }))).toThrow();
    const proof = auth.authenticate(challenge, headers({ "x-conquistador-human-review-token": review }));
    expect(auth.verify(proof, { ...challenge })).toBe(true);
    expect(auth.verify({ ...proof, principalId: "different-operator" }, { ...challenge })).toBe(false);
    expect(auth.verify(proof, { ...challenge, subjectDigest: `sha256:${"b".repeat(64)}` })).toBe(false);
    expect(JSON.stringify(proof)).not.toContain(review);
  });
  it("does not turn content review into action authority", () => {
    const auth = createOperatorHumanAuth(env)!;
    const actionChallenge: HumanAuthenticationChallenge = { ...challenge, role: "operator", authority: "consequential-action", actionPayloadDigest: `sha256:${"b".repeat(64)}` };
    expect(() => auth.authenticate(actionChallenge, headers({ "x-conquistador-human-review-token": review }))).toThrow();
    expect(() => auth.authenticate(actionChallenge, headers({ "x-conquistador-human-action-token": action }))).toThrow();
    const proof = auth.authenticate(actionChallenge, headers({ "x-conquistador-human-action-token": action, "x-conquistador-action-payload-digest": actionChallenge.actionPayloadDigest! }));
    expect(auth.verify(proof, actionChallenge)).toBe(true);
  });
  it("rejects reused and short secrets", () => {
    expect(() => createOperatorHumanAuth({ ...env, CONQUISTADOR_HUMAN_ACTION_TOKEN: review })).toThrow(/differ/);
    expect(() => createOperatorHumanAuth(env, [review])).toThrow(/differ/);
    expect(() => createOperatorHumanAuth({ CONQUISTADOR_HUMAN_REVIEW_TOKEN: "short" })).toThrow(/32/);
    expect(createOperatorHumanAuth({})).toBeUndefined();
  });
});
