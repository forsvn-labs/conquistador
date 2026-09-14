import { type IncomingMessage, type Server } from "node:http";
import { ApiV1 } from "./api.ts";
import type { ConquistadorConfig } from "./contracts.ts";
import type { HostHumanAuthenticator, HumanAuthenticationChallenge } from "./review-contract.ts";
type OidcAuth = Extract<ConquistadorConfig["server"]["auth"], {
    mode: "oidc";
}>;
export type VerifiedOidcIdentity = {
    issuer: string;
    subject: string;
};
export type OidcVerifier = (token: string, config: OidcAuth) => VerifiedOidcIdentity | Promise<VerifiedOidcIdentity>;
export type HttpServerOptions = {
    api: ApiV1;
    config: ConquistadorConfig;
    env?: Record<string, string | undefined>;
    verifyOidc?: OidcVerifier;
    authenticateHumanReview?: (challenge: HumanAuthenticationChallenge, request: IncomingMessage) => ReturnType<HostHumanAuthenticator>;
};
/**
 * Creates the Conquistador-owned HTTP boundary. The caller owns listen/close and
 * supplies OIDC verification as a replaceable host capability.
 */
export declare function createHttpServer(options: HttpServerOptions): Server;
export {};
