import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionManifest } from "../src/contracts.ts";
import { validateExtensionManifest } from "../src/validate.ts";
import { catalog, root } from "./helpers.ts";

function fixture(name: "outcome-skill" | "host-tool" | "provider-adapter"): ExtensionManifest {
  return JSON.parse(readFileSync(resolve(root, `fixtures/v1/extensions/${name}.json`), "utf8")) as ExtensionManifest;
}

function mutate(
  name: "outcome-skill" | "host-tool" | "provider-adapter",
  change: (value: any) => void,
): ExtensionManifest {
  const value = fixture(name);
  change(value);
  return value;
}

describe("discoverable extension metadata", () => {
  it.each(["outcome-skill", "host-tool", "provider-adapter"] as const)(
    "expresses and validates the %s kind",
    (kind) => expect(() => validateExtensionManifest(fixture(kind), catalog())).not.toThrow(),
  );

  it.each([
    ["undeclared fields", mutate("host-tool", (value) => { value.execute = true; }), /undeclared fields/],
    ["floating version", mutate("host-tool", (value) => { value.version = "latest"; }), /exact semver/],
    ["floating source", mutate("host-tool", (value) => { value.provenance.sourceVersion = "latest"; }), /source version/],
    ["floating source identity", mutate("host-tool", (value) => { value.provenance.sourceId = "latest"; }), /source identity/],
    ["wildcard ID", mutate("host-tool", (value) => { value.operations[0].id = "github.*"; }), /IDs must be exact|wildcards/],
    ["wildcard scope", mutate("host-tool", (value) => { value.operations[0].connection.scopes = ["metadata:*"]; }), /scopes must be exact/],
    ["duplicate operation", mutate("host-tool", (value) => { value.operations.push(structuredClone(value.operations[0])); }), /operation IDs must be unique/],
    ["raw URL field", mutate("outcome-skill", (value) => { value.operations[0].failure.url = "https://example.com"; }), /undeclared fields/],
    ["raw method field", mutate("outcome-skill", (value) => { value.operations[0].failure.method = "POST"; }), /undeclared fields/],
    ["raw command field", mutate("outcome-skill", (value) => { value.operations[0].failure.command = "tool"; }), /undeclared fields/],
    ["raw shell field", mutate("outcome-skill", (value) => { value.operations[0].failure.shell = "tool"; }), /undeclared fields/],
    ["raw MCP field", mutate("outcome-skill", (value) => { value.operations[0].failure.rawMcpMethod = "tools.call"; }), /undeclared fields/],
    ["credential handle", mutate("host-tool", (value) => { value.connectionRef = "vault-ref:github"; }), /credential-shaped/],
    ["nested secret", mutate("outcome-skill", (value) => { value.operations[0].failure.retry.apiToken = "not-even-a-real-token"; }), /credential-shaped/],
  ])("rejects %s", (_label, value, message) => {
    expect(() => validateExtensionManifest(value as ExtensionManifest, catalog())).toThrow(message as RegExp);
  });

  it.each([
    ["unknown operation", mutate("host-tool", (value) => { value.operations[0].catalog.operationId = "github.unknown.get"; }), /unknown catalog operation/],
    ["cross-provider operation", mutate("host-tool", (value) => { value.operations[0].catalog.provider = "semrush"; }), /crosses providers/],
    ["capability mismatch", mutate("host-tool", (value) => { value.operations[0].capabilityId = "source.issue.read"; }), /identity differs/],
    ["input mismatch", mutate("host-tool", (value) => { value.operations[0].inputSchema.required = ["owner"]; }), /input schema differs/],
    ["output mismatch", mutate("host-tool", (value) => { value.operations[0].outputSchema.required = ["repository"]; }), /output schema differs/],
    ["authority mismatch", mutate("host-tool", (value) => { value.operations[0].actionClass = "draft"; value.operations[0].budget.maximumUnitsPerRun = 1; value.operations[0].budget.maximumCostPerRun = 0; }), /authority differs/],
    ["provider mismatch", mutate("host-tool", (value) => { value.operations[0].connection.provider = "semrush"; }), /connection provider differs/],
    ["scope mismatch", mutate("host-tool", (value) => { value.operations[0].connection.scopes = ["contents:read"]; }), /connection scopes differ/],
    ["optional required connection", mutate("host-tool", (value) => { value.operations[0].connection.required = false; }), /connection requirement differs/],
    ["unit mismatch", mutate("provider-adapter", (value) => { value.operations[0].budget.quotaUnit = "request"; }), /budget units differ/],
    ["unit overrun", mutate("provider-adapter", (value) => { value.operations[0].budget.maximumUnitsPerRun = 1001; }), /unit ceiling exceeds/],
    ["cost overrun", mutate("provider-adapter", (value) => { value.operations[0].budget.maximumCostPerRun = 11; }), /cost ceiling exceeds/],
    ["maturity overclaim", mutate("host-tool", (value) => { value.operations[0].maturity = "supported"; }), /not established/],
    ["retry overclaim", mutate("host-tool", (value) => { value.operations[0].failure.retry = { strategy: "bounded", maximumAttempts: 2, backoff: "fixed" }; }), /retry policy exceeds/],
  ])("rejects catalog contradiction: %s", (_label, value, message) => {
    expect(() => validateExtensionManifest(value as ExtensionManifest, catalog())).toThrow(message as RegExp);
  });

  it.each(["metered-observe", "draft", "consequential"] as const)(
    "requires finite ceilings for %s",
    (actionClass) => {
      const value = mutate("outcome-skill", (manifest) => {
        manifest.operations[0].actionClass = actionClass;
      });
      expect(() => validateExtensionManifest(value, catalog())).toThrow(/finite unit ceiling/);
    },
  );

  it.each(["draft", "consequential", "prohibited"] as const)(
    "rejects a skill-owned %s operation without a catalog boundary",
    (actionClass) => {
      const value = mutate("outcome-skill", (manifest) => {
        manifest.operations[0].actionClass = actionClass;
        if (actionClass === "draft" || actionClass === "consequential") {
          manifest.operations[0].budget.maximumUnitsPerRun = 1;
          manifest.operations[0].budget.maximumCostPerRun = 0;
        }
      });
      expect(() => validateExtensionManifest(value, catalog())).toThrow(/skill-owned operation must be observe-only/);
    },
  );

  it.each([
    ["negative unit", "maximumUnitsPerRun", -1, /unit ceiling must be finite and positive/],
    ["non-finite unit", "maximumUnitsPerRun", Number.POSITIVE_INFINITY, /unit ceiling must be finite and positive/],
    ["negative cost", "maximumCostPerRun", -1, /cost ceiling must be finite and non-negative/],
    ["non-finite cost", "maximumCostPerRun", Number.NaN, /cost ceiling must be finite and non-negative/],
  ] as const)("rejects an observe operation with a %s optional ceiling", (_label, key, amount, message) => {
    const value = mutate("outcome-skill", (manifest) => {
      manifest.operations[0].budget[key] = amount;
    });
    expect(() => validateExtensionManifest(value, catalog())).toThrow(message);
  });

  it("requires every outcome-skill dependency to use exact catalog capability and operation IDs", () => {
    const value = mutate("outcome-skill", (manifest) => {
      manifest.operations[0].dependencies[0].operationId = "search-console.*";
    });
    expect(() => validateExtensionManifest(value, catalog())).toThrow(/IDs must be exact|wildcards/);
  });

  it("keeps the published schema aligned with the closed TypeScript shape", () => {
    const schema = JSON.parse(readFileSync(resolve(root, "schemas/tool-module.schema.json"), "utf8"));
    expect(schema.$defs.ExtensionManifest.additionalProperties).toBe(false);
    expect(schema.$defs.ExtensionOperation.additionalProperties).toBe(false);
    expect(schema.$defs.ExtensionManifest.properties.kind.enum).toEqual([
      "outcome-skill",
      "host-tool",
      "provider-adapter",
    ]);
    expect(schema.$defs.ExtensionOperation.required).toEqual(expect.arrayContaining([
      "inputSchema", "outputSchema", "actionClass", "budget", "connection", "maturity", "failure",
    ]));
    expect(schema.$defs.ExtensionManifest.oneOf[0].properties.operations.items.allOf[1].properties.actionClass.const).toBe("observe");
  });
});
