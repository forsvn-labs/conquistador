import { type Sha256 } from "./canonical.ts";
export declare function fail(message: string): never;
export declare function ok(condition: unknown, message: string): asserts condition;
export declare function obj(value: unknown, label: string): asserts value is Record<string, unknown>;
export declare function exact(value: object, keys: string[], label: string): void;
export declare function text(value: unknown, label: string): asserts value is string;
export declare function id(value: unknown, label: string): asserts value is string;
export declare function nullableId(value: unknown, label: string): asserts value is string | null;
export declare function dg(value: unknown, label: string): asserts value is Sha256;
export declare function utc(value: unknown, label: string): asserts value is string;
export declare function strings(value: unknown, label: string, empty?: boolean): asserts value is string[];
export declare function noSecret(value: unknown, label: string): void;
export declare function jsonData(value: unknown, label: string): void;
export declare function bodyDigest<T extends {
    digest: Sha256;
}>(value: T): void;
export declare function deepFreeze<T>(value: T): T;
