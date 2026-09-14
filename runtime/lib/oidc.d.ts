import { type JWTVerifyGetKey } from "jose";
import type { ConquistadorConfig } from "./contracts.ts";
import type { OidcVerifier } from "./http.ts";
type OidcAuth = Extract<ConquistadorConfig["server"]["auth"], {
    mode: "oidc";
}>;
export declare function createOidcVerifier(auth: OidcAuth, options?: {
    keySet?: JWTVerifyGetKey;
}): OidcVerifier;
export {};
