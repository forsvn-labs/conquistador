import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  invokeVerifiedOperation,
  loadOperationCatalog,
  validateOperationCatalog,
  type OperationCatalog,
} from "../src/operations.ts";

const root = resolve(import.meta.dirname, "..");
const catalogPath = resolve(root, "fixtures/operations/v1.json");

function catalog(): OperationCatalog {
  return loadOperationCatalog(catalogPath);
}

describe("Verified operation interface", () => {
  it("loads a fail-closed catalog that declares provider, capability, and verification status", () => {
    const loaded = catalog();
    expect(() => validateOperationCatalog(loaded)).not.toThrow();
    expect(loaded.schemaVersion).toBe("conquistador.verified-operations/v1");
    expect(loaded.records.map((record) => record.id)).toEqual([
      "signals.pull-bounded",
      "distribution.create-draft",
      "performance.observe-window",
      "unsupported.provider-draft",
      "fixture.recorded-stub",
    ]);
    for (const record of loaded.records) {
      expect(record.provider.length).toBeGreaterThan(0);
      expect(record.capabilityId.length).toBeGreaterThan(0);
      expect(record.verificationStatus.length).toBeGreaterThan(0);
    }
    const schema = JSON.parse(readFileSync(resolve(root, "schemas/operation.schema.json"), "utf8"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(loaded), JSON.stringify(validate.errors)).toBe(true);
  });

  it("yields a typed human action manifest for unverified and unsupported providers", () => {
    const unverified = invokeVerifiedOperation({
      operationId: "distribution.create-draft",
      catalog: catalog(),
      runId: "run-1",
      stepId: "approved-action",
    });
    expect(unverified.kind).toBe("human-action-manifest");
    if (unverified.kind !== "human-action-manifest") throw new Error("expected manifest");
    expect(unverified.manifest).toMatchObject({
      schemaVersion: "conquistador.artifact.human-action-manifest/v1",
      operationId: "distribution.create-draft",
      provider: "unverified",
      capabilityId: "distribution.draft",
      verificationStatus: "unverified",
      reason: "unverified",
      executed: false,
      liveCall: false,
      credentialsUsed: false,
      fallback: "human-action-manifest",
    });

    const unsupported = invokeVerifiedOperation({
      operationId: "unsupported.provider-draft",
      catalog: catalog(),
      runId: "run-1",
      stepId: "approved-action",
    });
    expect(unsupported.kind).toBe("human-action-manifest");
    if (unsupported.kind !== "human-action-manifest") throw new Error("expected manifest");
    expect(unsupported.manifest.reason).toBe("unsupported");
    expect(unsupported.manifest.provider).toBe("unsupported-provider");
    expect(unsupported.executed).toBe(false);
    expect(unsupported.liveCall).toBe(false);
    expect(unsupported.credentialsUsed).toBe(false);
  });

  it("records a stub for a cataloged operation that is not live, and never fakes execution", () => {
    const stubbed = invokeVerifiedOperation({
      operationId: "fixture.recorded-stub",
      catalog: catalog(),
      runId: "run-1",
      stepId: "pull-signals",
    });
    expect(stubbed.kind).toBe("recorded-stub");
    if (stubbed.kind !== "recorded-stub") throw new Error("expected stub");
    expect(stubbed.stub).toMatchObject({
      schemaVersion: "conquistador.artifact.provider-draft-stub/v1",
      operationId: "fixture.recorded-stub",
      verificationStatus: "fixture-verified",
      stubbed: true,
      executed: false,
      liveCall: false,
      credentialsUsed: false,
    });

    const unknown = invokeVerifiedOperation({
      operationId: "no-such.operation",
      catalog: catalog(),
      runId: "run-1",
      stepId: "approved-action",
    });
    expect(unknown.kind).toBe("human-action-manifest");
    if (unknown.kind !== "human-action-manifest") throw new Error("expected manifest");
    expect(unknown.manifest.reason).toBe("unknown-operation");
    expect(unknown.manifest.executed).toBe(false);

    const source = readFileSync(resolve(root, "src/operations.ts"), "utf8");
    expect(source).not.toMatch(/fetch\(|createProvider|OPENAI_API_KEY|ANTHROPIC_API_KEY|credentialEnv/);
  });

  it("fails closed on an empty catalog, duplicate ids, or a claimed supported-without-status record", () => {
    expect(() => validateOperationCatalog({
      schemaVersion: "conquistador.verified-operations/v1",
      records: [],
    })).toThrow(/records are required/);
    const loaded = catalog();
    expect(() => validateOperationCatalog({
      ...loaded,
      records: [...loaded.records, loaded.records[0]],
    })).toThrow(/operation ids must be unique/);
    expect(() => validateOperationCatalog({
      schemaVersion: "conquistador.verified-operations/v1",
      records: [{
        id: "x.y",
        provider: "x",
        capabilityId: "x.y",
        verificationStatus: "pretend-live",
        actionClass: "draft",
      }],
    })).toThrow(/verificationStatus is invalid/);
  });
});
