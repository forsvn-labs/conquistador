import { type Sha256, sha256 } from "./canonical.ts";
import { assertNoCredential } from "./credential-detector.ts";
import { isCanonicalId } from "./principal.ts";

const SHA = /^sha256:[a-f0-9]{64}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function fail(message: string): never {
  throw new Error(`[review-contract] ${message}`);
}

export function ok(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

export function obj(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
}

export function exact(value: object, keys: string[], label: string): void {
  const actual = Object.keys(value);
  ok(
    actual.length === keys.length && actual.every((key) => keys.includes(key)),
    `${label} fields are not closed`,
  );
}

export function text(value: unknown, label: string): asserts value is string {
  ok(
    typeof value === "string" && value.trim() === value && value.length > 0,
    `${label} is required`,
  );
}

export function id(value: unknown, label: string): asserts value is string {
  text(value, label);
  ok(isCanonicalId(value), `${label} is not exact or contains credentials`);
}

export function nullableId(
  value: unknown,
  label: string,
): asserts value is string | null {
  if (value !== null) id(value, label);
}

export function dg(value: unknown, label: string): asserts value is Sha256 {
  ok(
    typeof value === "string" && SHA.test(value),
    `${label} must be sha256`,
  );
}

export function utc(value: unknown, label: string): asserts value is string {
  ok(
    typeof value === "string" && UTC.test(value) &&
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
    `${label} must be exact UTC`,
  );
}

export function strings(
  value: unknown,
  label: string,
  empty = false,
): asserts value is string[] {
  ok(
    Array.isArray(value) && (empty || value.length > 0),
    `${label} must be an array`,
  );
  value.forEach((entry, index) => text(entry, `${label}[${index}]`));
  ok(new Set(value).size === value.length, `${label} must be unique`);
}

export function noSecret(value: unknown, label: string): void {
  assertNoCredential(value, label);
}

export function jsonData(value: unknown, label: string): void {
  if (
    value === null || typeof value === "string" || typeof value === "boolean"
  ) return;
  if (typeof value === "number") {
    ok(Number.isFinite(value), `${label} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    ok(
      Object.getOwnPropertySymbols(value).length === 0 &&
        Object.keys(value).length === value.length &&
        Object.keys(value).every((key, index) => key === String(index)),
      `${label} contains an array hole or surplus property`,
    );
    value.forEach((entry, index) => jsonData(entry, `${label}[${index}]`));
    return;
  }
  ok(typeof value === "object", `${label} contains a non-JSON value`);
  const prototype = Object.getPrototypeOf(value);
  ok(
    prototype === Object.prototype || prototype === null,
    `${label} contains a non-plain object`,
  );
  ok(
    Reflect.ownKeys(value).length === Object.keys(value).length &&
      Reflect.ownKeys(value).every((key) => typeof key === "string"),
    `${label} contains a symbol or non-enumerable property`,
  );
  for (const [key, entry] of Object.entries(value)) {
    jsonData(entry, `${label}.${key}`);
  }
}

export function bodyDigest<T extends { digest: Sha256 }>(value: T): void {
  dg(value.digest, "digest");
  const { digest, ...body } = value;
  ok(sha256(body) === digest, "digest mismatch");
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}
