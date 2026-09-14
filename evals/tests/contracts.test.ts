import { describe, expect, it } from "vitest";

import { selectExactCandidate } from "../src/build-selector";
import { createPromptfooPlan, PROMPTFOO_VERSION, rejectTestOnlyCliArguments } from "../src/promptfoo-adapter";
import { candidate, candidateId, evalCase, provider } from "./helpers";

describe("exact candidate selection", () => {
  it("binds source, staged artifact, runtime, tool, prompt, provider, model, and adapter", () => {
    const selection = selectExactCandidate(candidate(), evalCase(), provider());
    expect(selection).toMatchObject({
      buildId: candidateId,
      sourceCommit: "a".repeat(40),
      caseId: "example-normal",
      provider: "example",
      model: "model-2026-08-11",
      modelVersion: "2026-08-11",
      adapterVersion: "0.122.0",
    });
    expect(selection.toolModuleDigest).toMatch(/^sha256:/);
    expect(selection.promptTemplateDigest).toMatch(/^sha256:/);
  });

  it("rejects missing tool identity and wildcard models", () => {
    const build = candidate() as any;
    delete build.modules.toolModule.version;
    expect(() => selectExactCandidate(build, evalCase(), provider())).toThrow(/toolModule.version/);

    const cell = provider();
    cell.model = "model-*";
    expect(() => selectExactCandidate(candidate(), evalCase(), cell)).toThrow(/exact provider model ID/);
    cell.model = "model-2026-08-11";
    cell.modelVersion = "latest";
    expect(() => selectExactCandidate(candidate(), evalCase(), cell)).toThrow(/modelVersion/);
  });

  it("rejects a friendly build alias and incomplete OCI identity", () => {
    const build = candidate();
    build.id = "latest-candidate";
    expect(() => selectExactCandidate(build, evalCase(), provider())).toThrow(/exact projector SHA-256 ID/);
    const missingArchitecture = candidate();
    missingArchitecture.stage.ociInputs[1].name = "conquistador-linux-other";
    expect(() => selectExactCandidate(missingArchitecture, evalCase(), provider())).toThrow(/amd64 and arm64/);
  });

  it("rejects a requested identity mismatch", () => {
    expect(() =>
      selectExactCandidate(candidate(), evalCase(), provider(), { adapterVersion: "0.121.0" }),
    ).toThrow(/adapterVersion differs/);
  });

  it("creates a non-executing, no-cache, no-share Promptfoo plan", () => {
    const plan = createPromptfooPlan(candidate(), evalCase(), provider());
    expect(plan.promptfooVersion).toBe(PROMPTFOO_VERSION);
    expect(plan.command).toEqual([
      "promptfoo",
      "eval",
      "--config",
      "promptfooconfig.yaml",
      "--no-cache",
      "--no-share",
    ]);
    expect(plan.executionAuthorized).toBe(false);
  });

  it("rejects any unpinned Promptfoo adapter", () => {
    const cell = provider();
    cell.adapter.version = "0.121.0";
    expect(() => createPromptfooPlan(candidate(), evalCase(), cell)).toThrow(/exactly 0.122.0/);
  });

  it("does not expose the test-only process seam through the CLI", () => {
    expect(() => rejectTestOnlyCliArguments(["--execute", "--test-only-run-process", "fake"])).toThrow(/unavailable from the CLI/);
    expect(() => rejectTestOnlyCliArguments(["--execute", "--ledger", "/tmp/forged.json"])).toThrow(/authority overrides/);
    expect(() => rejectTestOnlyCliArguments(["--execute", "--repo-root=/tmp/forged-repo"])).toThrow(/authority overrides/);
    expect(() => rejectTestOnlyCliArguments(["--execute"])).not.toThrow();
  });
});
