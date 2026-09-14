import { createHash } from "node:crypto";

import type { Sha256 } from "./contracts.ts";

export function canonicalJson(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== "object") return entry;
    const record = entry as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, normalize(record[key])]));
  };
  return JSON.stringify(normalize(value));
}

export function sha256(value: unknown): Sha256 {
  const source = typeof value === "string" ? value : canonicalJson(value);
  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
