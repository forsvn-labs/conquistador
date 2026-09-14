import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ConnectionReference } from "../src/contracts.ts";
import { validateConnectionReference, validateConnectionRotation } from "../src/validate.ts";
import { connection, root } from "./helpers.ts";

const storagePolicy = {
  referenceMetadata: "conquistador-local" as const,
  secretStorage: "host-secure-store-only" as const,
  export: "forbidden" as const,
  recovery: "reauthenticate-only" as const,
};

function production(): ConnectionReference {
  const value = connection("github", ["metadata:read"]);
  return {
    ...value,
    id: "conn.github.production.01",
    environment: "production",
    usage: "user-production",
    principal: { accountId: "account-prod", workspaceId: "workspace-prod", displayName: "Production account" },
    storagePolicy,
  };
}

describe("closed host-owned connection references", () => {
  it("expresses valid sandbox and production references without secrets", () => {
    const fixture = JSON.parse(readFileSync(resolve(root, "fixtures/v1/connections/github-sandbox.json"), "utf8")) as ConnectionReference;
    expect(() => validateConnectionReference(fixture)).not.toThrow();
    expect(() => validateConnectionReference(production())).not.toThrow();
    expect(JSON.stringify([fixture, production()])).not.toMatch(/credentialHandle|vault-ref|apiKey|password|bearer/i);
  });

  it.each([
    ["undeclared field", (value: any) => { value.extra = true; }],
    ["credential handle", (value: any) => { value.credentialHandle = "vault-ref:legacy"; }],
    ["nested secret key", (value: any) => { value.principal.secret = "hidden"; }],
    ["wildcard identity", (value: any) => { value.principal.workspaceId = "*"; }],
    ["wildcard scope", (value: any) => { value.scopes[0] = "metadata:*"; }],
    ["wildcard operation", (value: any) => { value.allowedOperationIds[0] = "github.*"; }],
    ["duplicate scope", (value: any) => { value.scopes.push(value.scopes[0]); }],
    ["invalid pairing", (value: any) => { value.usage = "user-production"; }],
    ["bad expiry", (value: any) => { value.expiresAt = value.verifiedAt; }],
    ["active invalidation", (value: any) => { value.invalidatedAt = value.verifiedAt; }],
    ["revoked without invalidation", (value: any) => { value.state = "revoked"; }],
    ["changed storage", (value: any) => { value.storagePolicy.export = "allowed"; }],
  ])("rejects %s", (_label, mutate) => {
    const value: any = connection("github", ["metadata:read"]);
    mutate(value);
    expect(() => validateConnectionReference(value)).toThrow();
  });

  it("allows exact rotation and rejects authority or ownership drift", () => {
    const previous: ConnectionReference = {
      ...production(), state: "revoked", invalidatedAt: "2026-08-10T01:00:00.000Z",
    };
    const next: ConnectionReference = {
      ...production(), id: "conn.github.production.02", revision: 2, rotatedFrom: previous.id,
      verifiedAt: "2026-08-10T01:00:00.000Z",
    };
    expect(() => validateConnectionRotation(previous, next)).not.toThrow();
    const reordered: ConnectionReference = {
      ...next,
      principal: {
        displayName: next.principal.displayName,
        workspaceId: next.principal.workspaceId,
        accountId: next.principal.accountId,
      },
      allowedOperationIds: [...next.allowedOperationIds].reverse(),
      scopes: [...next.scopes].reverse(),
      storagePolicy: {
        recovery: next.storagePolicy.recovery,
        export: next.storagePolicy.export,
        secretStorage: next.storagePolicy.secretStorage,
        referenceMetadata: next.storagePolicy.referenceMetadata,
      },
    };
    expect(() => validateConnectionRotation(previous, reordered)).not.toThrow();
    for (const mutate of [
      (value: any) => { value.provider = "other"; },
      (value: any) => { value.principal.accountId = "other"; },
      (value: any) => { value.principal.workspaceId = "other"; },
      (value: any) => { value.scopes = ["contents:read"]; },
      (value: any) => { value.allowedOperationIds = ["github.release.list"]; },
      (value: any) => { value.environment = "sandbox"; value.usage = "ephemeral-test"; },
      (value: any) => { value.storagePolicy.referenceMetadata = "other"; },
      (value: any) => { value.revision = 3; },
      (value: any) => { value.rotatedFrom = "conn.github.production.other"; },
    ]) {
      const changed: any = structuredClone(next);
      mutate(changed);
      expect(() => validateConnectionRotation(previous, changed)).toThrow();
    }
  });

  it("keeps fixtures sandbox-only and free of credential-shaped material", () => {
    const directory = resolve(root, "fixtures/v1/connections");
    const bodies = readdirSync(directory).map((name) => readFileSync(resolve(directory, name), "utf8"));
    expect(bodies).not.toHaveLength(0);
    for (const body of bodies) {
      expect(body).not.toMatch(/credentialHandle|vault-ref|authorization|api[-_]?key|password|bearer\s|production|user-production/i);
    }
  });
});
