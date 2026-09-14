import type { IncomingMessage } from "node:http";
import type { AuthenticationProof, HostAuthenticationVerifier, HumanAuthenticationChallenge } from "./review-contract.ts";
/** Optional operator-owned authority, separate from agent transport credentials. */
export declare function createOperatorHumanAuth(env: Record<string, string | undefined>, transportSecrets?: readonly string[]): {
    authenticate(challenge: HumanAuthenticationChallenge, request: IncomingMessage): AuthenticationProof;
    verify: HostAuthenticationVerifier;
} | undefined;
