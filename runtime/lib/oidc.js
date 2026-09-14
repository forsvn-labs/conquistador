import { createRemoteJWKSet, jwtVerify } from "jose";
function sameConfig(left, right) {
    return left.issuer === right.issuer &&
        left.audience === right.audience &&
        left.jwksUrl === right.jwksUrl;
}
export function createOidcVerifier(auth, options = {}) {
    const config = structuredClone(auth);
    const keySet = options.keySet ?? createRemoteJWKSet(new URL(config.jwksUrl), {
        timeoutDuration: 5_000,
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
    });
    return async (token, requestedConfig) => {
        if (!sameConfig(config, requestedConfig)) {
            throw new Error("[conquistador.oidc] verifier configuration differs from the authenticated boundary");
        }
        const { payload } = await jwtVerify(token, keySet, {
            issuer: config.issuer,
            audience: config.audience,
            algorithms: ["RS256", "PS256", "ES256", "EdDSA"],
            clockTolerance: 5,
            requiredClaims: ["sub"],
        });
        if (typeof payload.sub !== "string" || !payload.sub.trim()) {
            throw new Error("[conquistador.oidc] stable subject is required");
        }
        return { issuer: config.issuer, subject: payload.sub };
    };
}
