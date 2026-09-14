import { type Sha256 } from "./canonical.ts";
export declare function isCanonicalId(value: unknown): value is string;
export declare function canonicalOidcSubjectBinding(issuer: string, subject: string): {
    issuer: string;
    subjectDigest: Sha256;
};
export declare function canonicalOidcPrincipalId(issuer: string, subject: string): string;
