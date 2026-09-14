import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineAdapter } from "../src/adapter.ts";
import { sha256 } from "../src/canonical.ts";
import { advanceSupportCell, supportIsFresh } from "../src/lifecycle.ts";
import { CAPABILITY_ERROR_CODES, type SupportCell } from "../src/contracts.ts";
import { validateAdapterManifest, validateCatalog } from "../src/validate.ts";
import { catalog, evidence, manifest, operation, root } from "./helpers.ts";

const fixtures = JSON.parse(readFileSync(resolve(root, "fixtures/v1/conformance.json"), "utf8")) as {
  adapterVersion: string;
  checkedAt: string;
  suite: string;
  globalAssertions: string[];
  operations: Array<{ id: string; assertions: string[] }>;
};

describe("operation-level catalog", () => {
  it("validates seven researched providers without claiming support", () => {
    const value = catalog();
    expect(() => validateCatalog(value)).not.toThrow();
    expect(value.operations).toHaveLength(17);
    expect(new Set(value.operations.map((item) => item.provider))).toEqual(
      new Set(["github", "google-analytics", "search-console", "posthog", "semrush", "typefully", "openseo"]),
    );
    expect(value.operations.some((item) => item.provider === "emdash" || item.provider === "solai" || item.provider === "csm")).toBe(false);
    expect(
      value.operations.filter((item) => item.provider === "openseo").map((item) => item.id).sort(),
    ).toEqual([
      "openseo.get-google-analytics-organic-landing-pages",
      "openseo.get-search-console-performance",
      "openseo.get-serp-results",
    ]);
    expect(value.operations.every((item) =>
      item.supportCells.every((cell) =>
        cell.state === (item.actionClass === "prohibited" ? "researched" : "fixture-verified"),
      ),
    )).toBe(true);
    for (const item of value.operations.filter((entry) => entry.provider === "openseo")) {
      const fixture = item.supportCells.flatMap((cell) => cell.evidence).find((entry) => entry.kind === "fixture")!;
      expect(fixture.digest).toBe(
        sha256({
          operationId: item.id,
          providerVersion: item.providerApiVersion,
          adapterVersion: fixtures.adapterVersion,
          checkedAt: fixtures.checkedAt,
          suite: fixtures.suite,
          assertions: [
            ...fixtures.globalAssertions,
            ...fixtures.operations.find((scenario: { id: string }) => scenario.id === item.id)!.assertions,
          ],
        }),
      );
    }
    expect(value.status).toBe("candidate-operations-not-supported");
    for (const item of value.operations) {
      const research = item.supportCells.flatMap((cell) => cell.evidence).find((entry) => entry.kind === "research")!;
      expect(research.digest).toBe(
        sha256({
          operationId: item.id,
          officialSources: item.officialSources,
          checkedAt: item.checkedAt,
          providerApiVersion: item.providerApiVersion,
          provenance: item.provenance,
        }),
      );
    }
  });

  it("binds each implemented operation to reproducible fixture evidence without promotion", () => {
    const value = catalog();
    for (const item of value.operations.filter((entry) => entry.actionClass !== "prohibited")) {
      const scenario = fixtures.operations.find((entry: { id: string }) => entry.id === item.id);
      expect(scenario).toBeDefined();
      if (!scenario) throw new Error(`missing fixture scenario for ${item.id}`);
      const evidenceEntry = item.supportCells.flatMap((cell) => cell.evidence).find((entry) => entry.kind === "fixture");
      expect(evidenceEntry).toMatchObject({
        providerVersion: item.providerApiVersion,
        adapterVersion: fixtures.adapterVersion,
        checkedAt: fixtures.checkedAt,
      });
      expect(evidenceEntry?.digest).toBe(sha256({
        operationId: item.id,
        providerVersion: item.providerApiVersion,
        adapterVersion: fixtures.adapterVersion,
        checkedAt: fixtures.checkedAt,
        suite: fixtures.suite,
        assertions: [...fixtures.globalAssertions, ...scenario.assertions],
      }));
      expect(item.supportCells.every((cell) => cell.state !== "live-verified" && cell.state !== "supported")).toBe(true);
    }
    const prohibited = value.operations.find((item) => item.id === "typefully.post.delete")!;
    expect(prohibited.supportCells.every((cell) => cell.state === "researched")).toBe(true);
    expect(prohibited.knownGaps.join(" ")).toMatch(/intentionally prohibited/);
  });

  it("publishes schemas for every stable Tool Module contract", () => {
    const schema = JSON.parse(readFileSync(resolve(root, "schemas/tool-module.schema.json"), "utf8"));
    expect(schema.$ref).toBe("#/$defs/Catalog");
    expect(Object.keys(schema.$defs)).toEqual(
      expect.arrayContaining([
        "Catalog",
        "OperationContract",
        "SupportCell",
        "CapabilityRequest",
        "CapabilityResult",
        "CapabilityError",
        "AdapterManifest",
        "ExtensionManifest",
        "ConnectionReference",
        "HostConnectionResolution",
        "ConsequentialManifest",
        "HumanApproval",
        "Receipt",
        "ToolCandidateBuild",
        "ProviderOnboardingRecord",
        "OnboardingDemand",
        "OnboardingOperationSnapshot",
        "OnboardingResearch",
        "OnboardingFixtureProof",
        "OnboardingLiveProof",
        "OnboardingSupportProof",
        "OnboardingFailurePosture",
      ]),
    );
    expect(schema.$defs.CapabilityError.properties.code.enum).toEqual(CAPABILITY_ERROR_CODES);
    expect(schema.$defs.OnboardingLiveProof.required).toEqual(
      expect.arrayContaining(["authenticatedHuman", "authenticationMethod"]),
    );
    expect(schema.$defs.OnboardingSupportProof.required).toEqual(
      expect.arrayContaining(["authenticatedHuman", "authenticationMethod"]),
    );
    expect(schema.$defs.OnboardingLiveProof.properties.authenticatedHuman.const).toBe(true);
    expect(schema.$defs.OnboardingSupportProof.properties.authenticatedHuman.const).toBe(true);
    expect(schema.$defs.ProviderOnboardingRecord.properties.id.pattern).toBe("^[a-z0-9]+(?:[.:-][a-z0-9]+)*$");
    for (const property of ["supportCellId", "supportOwner", "nextProofOwner"]) {
      expect(schema.$defs.ProviderOnboardingRecord.properties[property].not.pattern).toBe("\\*");
    }
    for (const property of ["requestedOutcome", "ownerRef"]) {
      expect(schema.$defs.OnboardingDemand.properties[property].not.pattern).toBe("\\*");
    }
    for (const property of ["rateLimit", "quotaUnit", "monetaryUnit"]) {
      expect(schema.$defs.OnboardingOperationSnapshot.properties[property].not.pattern).toBe("\\*");
    }
    expect(schema.$defs.OnboardingResearch.properties.providerApiVersion.not.pattern).toContain("[Ll]atest");
    expect(schema.$defs.OnboardingFixtureProof.properties.providerVersion.not.pattern).toContain("[Ll]atest");
    expect(schema.$defs.OnboardingFailurePosture.allOf).toHaveLength(2);
    expect(schema.$defs.OnboardingFailurePosture.properties.retry.allOf).toHaveLength(2);
  });

  it("rejects a support claim that skips fixture and candidate-bound live evidence", () => {
    const value = catalog();
    value.status = "candidate-bound";
    const item = value.operations[0];
    item.supportCells[0] = {
      id: "forged-cell",
      platform: "darwin",
      architecture: "arm64",
      state: "supported",
      evidence: [evidence("release-matrix", item, "8")],
    };
    expect(() => validateCatalog(value)).toThrow(/does not establish supported/);
  });

  it("advances one cell sequentially and requires live receipt plus release matrix", () => {
    const item = operation("github.repository.get");
    let cell: SupportCell = {
      id: "cell-1",
      platform: "darwin",
      architecture: "arm64",
      state: "unknown",
      evidence: [],
    };
    cell = advanceSupportCell(cell, "cataloged", evidence("research", item, "1")) as SupportCell;
    cell = advanceSupportCell(cell, "researched", evidence("research", item, "2")) as SupportCell;
    cell = advanceSupportCell(cell, "fixture-verified", evidence("fixture", item, "3")) as SupportCell;
    expect(() => advanceSupportCell(cell, "live-verified", evidence("fixture", item, "4"))).toThrow(/live evidence/);
    cell = advanceSupportCell(cell, "live-verified", evidence("live", item, "5")) as SupportCell;
    cell = advanceSupportCell(cell, "supported", evidence("release-matrix", item, "6")) as SupportCell;
    expect(cell.state).toBe("supported");
    expect(supportIsFresh(cell, new Date("2026-08-11T00:00:00.000Z"), 30, item.providerApiVersion, "1.0.0")).toBe(true);
    expect(supportIsFresh(cell, new Date("2026-09-30T00:00:00.000Z"), 30, item.providerApiVersion, "1.0.0")).toBe(false);
    expect(supportIsFresh(cell, new Date("2026-08-11T00:00:00.000Z"), 30, "drifted", "1.0.0")).toBe(false);
  });

  it("requires human acceptance to retire a preserved cell", () => {
    const item = operation("github.repository.get");
    const cell: SupportCell = {
      id: "cell-1",
      platform: "darwin",
      architecture: "arm64",
      state: "researched",
      evidence: [],
    };
    const retirement = evidence("retirement", item, "7");
    expect(() => advanceSupportCell(cell, "retired", retirement)).toThrow(/human acceptance/);
    retirement.humanAcceptanceId = "human-verdict-1";
    expect(advanceSupportCell(cell, "retired", retirement).state).toBe("retired");
  });
});

describe("Adapter SDK conformance", () => {
  it("accepts only exact catalog operations and handler inventories", () => {
    const value = catalog();
    const adapterManifest = manifest("github", ["github.repository.get"], value);
    expect(() => validateAdapterManifest(adapterManifest, value)).not.toThrow();
    expect(() => defineAdapter(adapterManifest, {}, value)).toThrow(/handlers must exactly match/);
    const handler = async () => {
      throw new Error("not executed by conformance");
    };
    expect(defineAdapter(adapterManifest, { "github.repository.get": handler }, value).manifest.id).toBe("github.adapter");
  });

  it("rejects unknown, wildcard, cross-provider, and prohibited operations", () => {
    const value = catalog();
    const unknown = manifest("github", ["github.repository.get"], value);
    unknown.operationIds = ["github.*"];
    expect(() => validateAdapterManifest(unknown, value)).toThrow(/unknown operation/);

    const mixed = manifest("github", ["github.repository.get", "typefully.post.list"], value);
    expect(() => validateAdapterManifest(mixed, value)).toThrow(/mixes providers/);

    const prohibited = manifest("typefully", ["typefully.post.delete"], value);
    expect(() => validateAdapterManifest(prohibited, value)).toThrow(/prohibited operation/);
  });
});
