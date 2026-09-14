import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { createOidcVerifier } from "../src/oidc.ts";

describe("owned OIDC verifier", () => {
  it("verifies signature, issuer, audience, expiry, and stable subject", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "test-key";
    publicJwk.alg = "RS256";
    const keySet = createLocalJWKSet({ keys: [publicJwk] });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://issuer.example.com")
      .setAudience("conquistador")
      .setSubject(" Auth0|Valid-Subject ")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const verifier = createOidcVerifier({
      mode: "oidc",
      issuer: "https://issuer.example.com",
      audience: "conquistador",
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
    }, { keySet });
    await expect(verifier(token, {
      mode: "oidc",
      issuer: "https://issuer.example.com",
      audience: "conquistador",
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
    })).resolves.toEqual({
      issuer: "https://issuer.example.com",
      subject: " Auth0|Valid-Subject ",
    });
    const wrongAudience = createOidcVerifier({
      mode: "oidc",
      issuer: "https://issuer.example.com",
      audience: "other",
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
    }, { keySet });
    await expect(wrongAudience(token, {
      mode: "oidc",
      issuer: "https://issuer.example.com",
      audience: "other",
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
    })).rejects.toThrow();
  });
});
