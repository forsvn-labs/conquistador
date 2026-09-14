import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { root } from "./helpers";

function json(path: string): any {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

describe("immutable benchmark partitions", () => {
  it("publishes every stable contract schema", () => {
    const schema = json("schemas/eval-lab.schema.json");
    expect(Object.keys(schema.$defs)).toEqual(
      expect.arrayContaining([
        "EvalCase",
        "Fixture",
        "CandidateBuild",
        "ProviderCell",
        "Run",
        "BrokenRun",
        "Assertion",
        "Dimension",
        "JudgeResult",
        "BlindPair",
        "HumanVerdict",
        "Experiment",
        "Decision",
        "ReleaseClaim",
      ]),
    );
  });

  it("freezes the full matrix and leaves missing evidence visible", () => {
    const matrix = json("benchmarks/matrix-v1.json");
    const outcome = matrix.partitions.filter((entry: any) => entry.id.startsWith("outcome-"));
    expect(outcome.reduce((sum: number, entry: any) => sum + entry.uniqueCasesRequired, 0)).toBe(112);
    expect(outcome.reduce((sum: number, entry: any) => sum + entry.executionsRequired, 0)).toBe(336);
    expect(matrix.partitions.find((entry: any) => entry.id === "parent-workflow").uniqueCasesRequired).toBe(25);
    expect(matrix.stochasticControls.aaExecutionsPerProviderModelCell).toBe(12);
    expect(matrix.runPolicy.brokenRunMaximumRate).toBe(0.02);
    expect(matrix.incomplete.length).toBeGreaterThan(0);
  });

  it("provides 20 fixtures and all four buckets for each grader", () => {
    const calibration = json("benchmarks/calibration-v1.json");
    expect(calibration.graders.map((entry: any) => entry.grader).sort()).toEqual(["artifact", "media", "model"]);
    for (const grader of calibration.graders) {
      expect(grader.fixtures).toHaveLength(20);
      for (const bucket of calibration.policy.requiredBuckets) {
        expect(grader.fixtures.filter((fixture: any) => fixture.bucket === bucket)).toHaveLength(5);
      }
      expect(grader.fixtures.filter((fixture: any) => fixture.safetyCritical).every((fixture: any) => fixture.expectedVerdict === "fail")).toBe(true);
    }
    expect(calibration.policy.falseSafetyPassTolerance).toBe(0);
  });

  it("pins Promptfoo compatibility without installing it into the lab or product", () => {
    const adapter = json("adapters/promptfoo-0.122.0.json");
    const packageJson = json("package.json");
    const isolatedPackage = json("promptfoo-isolated/package.json");
    const integrity = json("promptfoo-isolated/integrity-v1.json");
    expect(adapter.upstream.version).toBe("0.122.0");
    expect(adapter.executionDefault).toBe("deny");
    expect(adapter.knownRisk.status).toBe("isolated-live-environment-required");
    expect(adapter.knownRisk.npmAudit).toMatchObject({ high: 0, critical: 0 });
    expect(isolatedPackage.dependencies).toEqual({ promptfoo: "0.122.0" });
    expect(isolatedPackage.overrides).toEqual({ "adm-zip": "0.6.1", sharp: "0.35.4" });
    expect(integrity.installedDependencyTreeDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.devDependencies.promptfoo).toBeUndefined();
    expect(packageJson.peerDependencies?.promptfoo).toBeUndefined();
  });

  it("publishes one exact, credential-reference-only live provider cell", () => {
    const cell = json("providers/openai-gpt-4.1-mini-2025-04-14.json");
    expect(cell).toMatchObject({
      provider: "openai",
      model: "gpt-4.1-mini-2025-04-14",
      modelVersion: "2025-04-14",
      execution: {
        promptfooProviderId: "openai:chat:gpt-4.1-mini-2025-04-14",
        credentialEnvironmentVariables: ["OPENAI_API_KEY"],
        maxOutputTokens: 900,
      },
    });
    expect(JSON.stringify(cell)).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);

  });
});
