import { sha256 } from "../src/canonical.ts";
import type {
  AuthenticationProof,
  HostAuthenticationVerifier,
  HostHumanAuthenticator,
  TransportAuthentication,
} from "../src/review-contract.ts";

export const TEST_TRANSPORT: TransportAuthentication = {
  principalId: "operator-1",
  method: "test-transport",
  verifier: "test-transport-verifier",
  verifiedAt: "2026-08-21T00:00:00.000Z",
  subjectBinding: {
    issuer: "conquistador:test",
    subjectDigest: sha256({
      issuer: "conquistador:test",
      subject: "operator-1",
    }),
  },
};

export const testHumanAuthenticator: HostHumanAuthenticator = (challenge) => {
  const basis = {
    principalId: challenge.principalId,
    role: challenge.role,
    method: "test-human-presence",
    verifier: "test-human-verifier",
    verifiedAt: challenge.now,
    authority: challenge.authority,
    subjectDigest: challenge.subjectDigest,
  };
  return { ...basis, proofDigest: sha256(basis) };
};

export const testHostAuthenticationVerifier: HostAuthenticationVerifier = (
  proof: AuthenticationProof,
  context,
) =>
  proof.verifier === "test-human-verifier" &&
  proof.authority === context.authority &&
  proof.role === context.role &&
  proof.subjectDigest === context.subjectDigest &&
  proof.proofDigest === sha256({
    principalId: proof.principalId,
    role: proof.role,
    method: proof.method,
    verifier: proof.verifier,
    verifiedAt: proof.verifiedAt,
    authority: proof.authority,
    subjectDigest: proof.subjectDigest,
  });
