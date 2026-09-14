export type Sha256 = `sha256:${string}`;
export declare function canonicalJson(value: unknown): string;
export declare function sha256(value: unknown): Sha256;
export declare function deepFreeze<T>(value: T): Readonly<T>;
export declare function redact(value: unknown, exactSecrets?: readonly string[]): unknown;
