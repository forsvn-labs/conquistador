import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { canonicalJson, type Sha256 } from "./canonical.ts";
import type { AuthenticationProof, HostAuthenticationVerifier, HumanAuthenticationChallenge } from "./review-contract.ts";

const REVIEW_ENV = "CONQUISTADOR_HUMAN_REVIEW_TOKEN";
const ACTION_ENV = "CONQUISTADOR_HUMAN_ACTION_TOKEN";
const VERIFIER = "conquistador-operator-secret-v1";

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Optional operator-owned authority, separate from agent transport credentials. */
export function createOperatorHumanAuth(
  env: Record<string, string | undefined>,
  transportSecrets: readonly string[] = [],
): {
  authenticate(challenge: HumanAuthenticationChallenge, request: IncomingMessage): AuthenticationProof;
  verify: HostAuthenticationVerifier;
} | undefined {
  const reviewSecret = env[REVIEW_ENV];
  const actionSecret = env[ACTION_ENV];
  if (!reviewSecret && !actionSecret) return undefined;
  if (!reviewSecret || reviewSecret.length < 32 || (actionSecret && actionSecret.length < 32)) {
    throw new Error("operator review credentials require distinct secrets of at least 32 characters");
  }
  if (transportSecrets.some((secret) => equal(secret, reviewSecret) || (actionSecret && equal(secret, actionSecret))) ||
      (actionSecret && equal(reviewSecret, actionSecret))) {
    throw new Error("human credentials must differ from each other and from service/provider credentials");
  }
  const sign = (basis: Omit<AuthenticationProof, "proofDigest">, secret: string): Sha256 =>
    `sha256:${createHmac("sha256", secret).update(canonicalJson(basis)).digest("hex")}`;
  const secretFor = (authority: string, role: string) =>
    authority === "content-review" && role === "reviewer" ? reviewSecret :
      authority === "consequential-action" && role === "operator" ? actionSecret : undefined;
  return {
    authenticate(challenge, request) {
      const secret = secretFor(challenge.authority, challenge.role);
      const header = challenge.authority === "content-review"
        ? "x-conquistador-human-review-token" : "x-conquistador-human-action-token";
      const supplied = request.headers[header];
      if (!secret || typeof supplied !== "string" || !equal(supplied, secret)) {
        throw new Error("separate operator authentication is required");
      }
      if (challenge.authority === "consequential-action" &&
          (!challenge.actionPayloadDigest || request.headers["x-conquistador-action-payload-digest"] !== challenge.actionPayloadDigest)) {
        throw new Error("exact action payload approval is required");
      }
      const basis: Omit<AuthenticationProof, "proofDigest"> = {
        principalId: challenge.principalId, role: challenge.role,
        method: "operator-held-secret", verifier: VERIFIER,
        verifiedAt: challenge.now, authority: challenge.authority, subjectDigest: challenge.subjectDigest,
      };
      return { ...basis, proofDigest: sign(basis, secret) };
    },
    verify(proof, context) {
      const secret = secretFor(context.authority, context.role);
      if (!secret || proof.verifier !== VERIFIER || proof.method !== "operator-held-secret" ||
          proof.role !== context.role || proof.authority !== context.authority ||
          proof.subjectDigest !== context.subjectDigest) return false;
      const { proofDigest, ...basis } = proof;
      return equal(proofDigest, sign(basis, secret));
    },
  };
}
