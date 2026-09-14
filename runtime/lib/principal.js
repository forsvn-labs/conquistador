import { sha256 } from "./canonical.js";
import { containsCredential } from "./credential-detector.js";
const CANONICAL_ID = /^[a-z0-9][a-z0-9:._-]{0,127}$/;
const RESERVED_IDS = new Set(["latest", "default", "*"]);
export function isCanonicalId(value) {
    return typeof value === "string" && value.trim() === value &&
        CANONICAL_ID.test(value) && !RESERVED_IDS.has(value) &&
        !value.includes("*") && !containsCredential(value);
}
export function canonicalOidcSubjectBinding(issuer, subject) {
    if (!issuer.trim() || !subject.trim() || containsCredential(issuer) ||
        containsCredential(subject)) {
        throw new Error("[conquistador.principal] OIDC issuer and subject must be safe non-empty strings");
    }
    return {
        issuer,
        subjectDigest: sha256({ issuer, subject }),
    };
}
export function canonicalOidcPrincipalId(issuer, subject) {
    const binding = canonicalOidcSubjectBinding(issuer, subject);
    const principalId = `oidc:${binding.subjectDigest.slice("sha256:".length)}`;
    if (!isCanonicalId(principalId)) {
        throw new Error("[conquistador.principal] canonical OIDC principal is invalid");
    }
    return principalId;
}
