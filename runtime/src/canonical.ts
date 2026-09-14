import { createHash } from "node:crypto";

export type Sha256 = `sha256:${string}`;

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
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

const SECRET_KEY = /(?:authorization|api[-_]?key|token|password|secret|cookie|credential)/i;
const SECRET_VALUE = /(?:sk-[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{20,}|bearer\s+[A-Za-z0-9._-]{8,})/i;

export function redact(value: unknown, exactSecrets: readonly string[] = []): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry, exactSecrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redact(child, exactSecrets),
      ]),
    );
  }
  if (
    typeof value === "string" &&
    (SECRET_VALUE.test(value) || exactSecrets.some((secret) => secret.length > 0 && value.includes(secret)))
  ) return "[REDACTED]";
  return value;
}
