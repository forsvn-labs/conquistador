import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { exportPublicExecutionEvidence } from "../src/execution-evidence.ts";
import { digestBytes, digestValue, preparePromptfooExecution, type PreparedExecution } from "../src/live-manifest.ts";
import {
  executePromptfoo,
  preflightPromptfooExecution,
  TEST_ONLY_PROVIDER_CREDENTIAL,
  type ProcessResult,
  type RunProcess,
} from "../src/live-runner.ts";
import { digestFileTree, digestInstalledDependencyTree } from "../src/promptfoo-integrity.ts";

const temporaryRoots: string[] = [];
const fixedClock = "2026-08-28T00:00:00.000Z";
const providerPath = "providers/openai-test.json";

type CandidateFixture = {
  prepared: PreparedExecution;
  repoRoot: string;
  productRoot: string;
  ledgerPath: string;
  installationRoot: string;
  promptfooBinary: string;
  entrypointPath: string;
};

function write(path: string, body: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function prepareFixture(
  fixture: Omit<CandidateFixture, "prepared">,
  executionId: string,
  maxCostUsd: number,
  environment: NodeJS.ProcessEnv,
): PreparedExecution {
  return preparePromptfooExecution({
    executionId,
    preparedAt: fixedClock,
    repoRoot: fixture.repoRoot,
    ledgerPath: fixture.ledgerPath,
    caseId: "shape-initiative-boundary",
    providerCellPath: providerPath,
    maxCostUsd,
    environment,
  });
}

function candidateFixture(maxCostUsd = 0.01): CandidateFixture {
  const repoRoot = mkdtempSync(resolve(tmpdir(), "conquistador-eval-live-"));
  const installationRoot = mkdtempSync(resolve(tmpdir(), "conquistador-promptfoo-install-"));
  temporaryRoots.push(repoRoot, installationRoot);
  git(repoRoot, "init", "--quiet");
  git(repoRoot, "config", "user.name", "Eval Test");
  git(repoRoot, "config", "user.email", "eval-test@example.invalid");
  const productRoot = resolve(repoRoot, "01-business/conquistador");
  const evalRoot = resolve(productRoot, "evals");
  const skillPath = "skills/skills/shape-initiative/SKILL.md";
  const skill = "# Shape initiative\n\nProduce one bounded decision. Never approve external action.\n";
  const template = [
    "Candidate skill:\n{{CANDIDATE_SKILL}}",
    "Case {{CASE_ID}} for {{SUBJECT_ID}} ({{CASE_CLASS}})",
    "{{CASE_PROMPT}}",
    "Fixture: {{CASE_FIXTURE}}",
    "Assertions: {{CASE_ASSERTIONS}}",
    "",
  ].join("\n");
  const adapter = json({
    schemaVersion: "conquistador.promptfoo-adapter/v1",
    adapterVersion: "1.0.0",
    upstream: { name: "promptfoo", version: "0.122.0" },
    executionDefault: "deny",
  });
  const toolManifest = json({ schemaVersion: "conquistador.eval-tool-manifest/v1", tools: [], externalActions: "deny" });
  const calibration = json({ schemaVersion: "conquistador.grader-calibration/v1", status: "test-fixture", immutable: true });
  const settings = { temperature: 0, max_tokens: 900 };

  const packageManifest = json({
    name: "@forsvn/conquistador-promptfoo-isolated",
    version: "1.0.0",
    private: true,
    dependencies: { promptfoo: "0.122.0" },
    overrides: { "adm-zip": "0.6.1", sharp: "0.35.4" },
  });
  const packageLock = json({
    name: "@forsvn/conquistador-promptfoo-isolated",
    version: "1.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "@forsvn/conquistador-promptfoo-isolated",
        version: "1.0.0",
        dependencies: { promptfoo: "0.122.0" },
      },
      "node_modules/promptfoo": {
        version: "0.122.0",
        resolved: "https://registry.npmjs.org/promptfoo/-/promptfoo-0.122.0.tgz",
        integrity: "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
        dependencies: { "hoisted-provider-client": "1.0.0" },
      },
      "node_modules/hoisted-provider-client": {
        version: "1.0.0",
        resolved: "https://registry.npmjs.org/hoisted-provider-client/-/hoisted-provider-client-1.0.0.tgz",
        integrity: "sha512-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB==",
      },
      "node_modules/adm-zip": {
        version: "0.6.1",
        resolved: "https://registry.npmjs.org/adm-zip/-/adm-zip-0.6.1.tgz",
        integrity: "sha512-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC==",
      },
      "node_modules/sharp": {
        version: "0.35.4",
        resolved: "https://registry.npmjs.org/sharp/-/sharp-0.35.4.tgz",
        integrity: "sha512-DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD==",
      },
    },
  });
  const installedManifest = json({
    name: "promptfoo",
    version: "0.122.0",
    bin: { promptfoo: "dist/src/entrypoint.js" },
    dependencies: { "hoisted-provider-client": "1.0.0" },
  });
  const entrypoint = "#!/usr/bin/env node\n// exact inert test package entrypoint\n";
  write(resolve(installationRoot, "package.json"), packageManifest);
  write(resolve(installationRoot, "package-lock.json"), packageLock);
  write(resolve(installationRoot, "node_modules/promptfoo/package.json"), installedManifest);
  write(
    resolve(installationRoot, "node_modules/hoisted-provider-client/package.json"),
    json({ name: "hoisted-provider-client", version: "1.0.0", main: "index.js" }),
  );
  write(resolve(installationRoot, "node_modules/hoisted-provider-client/index.js"), "module.exports = { provider: 'fixture' };\n");
  const entrypointPath = resolve(installationRoot, "node_modules/promptfoo/dist/src/entrypoint.js");
  write(entrypointPath, entrypoint);
  mkdirSync(resolve(installationRoot, "node_modules/.bin"), { recursive: true });
  const promptfooBinary = resolve(installationRoot, "node_modules/.bin/promptfoo");
  symlinkSync("../promptfoo/dist/src/entrypoint.js", promptfooBinary);
  const integrity = json({
    schemaVersion: "conquistador.promptfoo-installation-integrity/v1",
    promptfooVersion: "0.122.0",
    packageManifestDigest: digestBytes(packageManifest),
    packageLockDigest: digestBytes(packageLock),
    entrypointPath: "dist/src/entrypoint.js",
    entrypointDigest: digestBytes(entrypoint),
    packageTreeDigest: digestFileTree(resolve(installationRoot, "node_modules/promptfoo")),
    installedDependencyTreeDigest: digestInstalledDependencyTree(resolve(installationRoot, "node_modules")),
  });

  const provider = json({
    schemaVersion: "conquistador.provider-cell/v1",
    id: "openai.test-model.promptfoo-0.122.0",
    provider: "openai",
    model: "test-model",
    modelVersion: "2026-08-28",
    adapter: { name: "promptfoo", version: "0.122.0", digest: digestBytes(adapter) },
    promptTemplateDigest: digestBytes(template),
    toolManifestDigest: digestBytes(toolManifest),
    settingsDigest: digestValue(settings),
    calibrationDigest: digestBytes(calibration),
    execution: {
      promptfooProviderId: "openai:chat:test-model",
      credentialEnvironmentVariables: ["OPENAI_API_KEY"],
      settings,
      contextWindowTokens: 1000,
      maxInputTokens: 100,
      maxOutputTokens: 900,
      pricing: {
        currency: "USD",
        revision: "2026-08-28",
        source: "https://example.invalid/provider-pricing",
        inputNanoUsdPerToken: 400,
        outputNanoUsdPerToken: 1600,
      },
    },
  });
  const inventory = {
    schemaVersion: "conquistador.eval-inventory-preflight/v1",
    cases: [{
      id: "shape-initiative-boundary",
      partition: "outcome-core",
      class: "boundary",
      subjectId: "shape-initiative",
      prompt: "Shape a proposal without inventing evidence.",
      assertions: ["finished-outcome", "external-action-boundary"],
      source: { path: skillPath, version: "1.0.0", digest: digestBytes(skill) },
      repetitionCount: 3,
    }],
    executionPlan: {
      plannedExecutions: [1, 2, 3].map((repetition) => ({
        caseId: "shape-initiative-boundary",
        repetition,
        immutableBindings: { inputDigest: digestBytes("bound-case-input") },
      })),
    },
  };
  write(resolve(productRoot, skillPath), skill);
  write(resolve(evalRoot, "benchmarks/inventory-preflight-v1.json"), json(inventory));
  write(resolve(evalRoot, providerPath), provider);
  write(resolve(evalRoot, "adapters/promptfoo-0.122.0.json"), adapter);
  write(resolve(evalRoot, "templates/candidate-outcome-v1.txt"), template);
  write(resolve(evalRoot, "manifests/no-tools-v1.json"), toolManifest);
  write(resolve(evalRoot, "benchmarks/calibration-v1.json"), calibration);
  write(resolve(evalRoot, "promptfoo-isolated/package.json"), packageManifest);
  write(resolve(evalRoot, "promptfoo-isolated/package-lock.json"), packageLock);
  write(resolve(evalRoot, "promptfoo-isolated/integrity-v1.json"), integrity);
  git(repoRoot, "add", "01-business/conquistador");
  git(repoRoot, "commit", "--quiet", "-m", "candidate source");
  const sourceCommit = git(repoRoot, "rev-parse", "HEAD");
  const sourceTree = git(repoRoot, "rev-parse", `${sourceCommit}:01-business/conquistador`);
  const ledgerPath = resolve(repoRoot, "ledger.json");
  const candidateTuple = {
    sourceCommit,
    sourceTree,
    version: "1.0.0",
    projectorVersion: "1.0.0",
    projectedTreeDigest: "1".repeat(64),
    ledgerDigest: "2".repeat(64),
    artifactDigests: "3".repeat(64),
    evidenceSnapshotDigest: "4".repeat(64),
  };
  const candidateId = digestValue(Object.entries(candidateTuple)).slice("sha256:".length);
  write(ledgerPath, json({
    release: { state: "NO-GO" },
    candidateSelector: {
      releaseCandidateStatus: "BOUND",
      selectedCandidate: {
        candidateId,
        ...candidateTuple,
      },
    },
  }));
  const base = { repoRoot, productRoot, ledgerPath, installationRoot, promptfooBinary, entrypointPath };
  const prepared = prepareFixture(base, "test-live-openai-001", maxCostUsd, { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL });
  return { ...base, prepared };
}

function clock(): () => string {
  let tick = 0;
  return () => `2026-08-28T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}

function fixtureProcess(prepared: PreparedExecution, costs: Array<string | number> = [0.0001, 0.0001, 0.0001]) {
  let evalCalls = 0;
  const seenEnvironments: NodeJS.ProcessEnv[] = [];
  const process: RunProcess = (_command, args, options): ProcessResult => {
    seenEnvironments.push({ ...options.env });
    if (args.includes("--version")) return { status: 0, stdout: "promptfoo 0.122.0\n", stderr: "" };
    expect(options.env.OPENAI_API_KEY).toBe(TEST_ONLY_PROVIDER_CREDENTIAL);
    const outputPath = args[args.indexOf("--output") + 1];
    const cost = costs[evalCalls] ?? costs.at(-1) ?? 0;
    evalCalls += 1;
    const costJson = typeof cost === "number" ? JSON.stringify(cost) : cost;
    write(outputPath, `{"results":{"outputs":[{"provider":{"id":"${prepared.manifest.providerCell.execution.promptfooProviderId}"},"output":"candidate artifact ${evalCalls}","success":true,"score":1,"cost":${costJson},"tokenUsage":{"total":20}}]}}`);
    return { status: 0, stdout: "local orchestration fixture\n", stderr: "" };
  };
  return { process, seenEnvironments, evalCalls: () => evalCalls };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Promptfoo live execution", () => {
  it("rejects a selected candidate ID that does not derive from the immutable tuple", () => {
    const fixture = candidateFixture();
    const ledger = JSON.parse(readFileSync(fixture.ledgerPath, "utf8"));
    ledger.candidateSelector.selectedCandidate.candidateId = "f".repeat(64);
    write(fixture.ledgerPath, json(ledger));
    expect(() => prepareFixture(fixture, "test-forged-candidate-id", 0.01, {})).toThrow(
      /candidate ID does not match its immutable tuple/,
    );
  }, 30_000);

  it("loads every candidate-owned eval input from the selected Git object", () => {
    const fixture = candidateFixture();
    const providerWorktreePath = resolve(fixture.productRoot, "evals", providerPath);
    const templateWorktreePath = resolve(fixture.productRoot, "evals/templates/candidate-outcome-v1.txt");
    write(providerWorktreePath, json({ malicious: "uncommitted provider substitution" }));
    write(templateWorktreePath, "UNCOMMITTED PROMPT SUBSTITUTION\n");
    for (const path of [
      "evals/adapters/promptfoo-0.122.0.json",
      "evals/manifests/no-tools-v1.json",
      "evals/benchmarks/calibration-v1.json",
      "evals/promptfoo-isolated/package.json",
      "evals/promptfoo-isolated/package-lock.json",
      "evals/promptfoo-isolated/integrity-v1.json",
    ]) write(resolve(fixture.productRoot, path), "UNCOMMITTED HARNESS SUBSTITUTION\n");
    const uncommitted = prepareFixture(fixture, "test-live-uncommitted-substitution", 0.01, {});
    expect(uncommitted.manifest.providerCell.model).toBe("test-model");
    expect(uncommitted.prompt).not.toContain("UNCOMMITTED");
    expect(uncommitted.manifest.providerCell).toEqual(fixture.prepared.manifest.providerCell);
    expect(uncommitted.manifest.harness).toEqual(fixture.prepared.manifest.harness);

    git(fixture.repoRoot, "add", "01-business/conquistador/evals");
    git(fixture.repoRoot, "commit", "--quiet", "-m", "post-candidate harness substitution");
    const postCandidate = prepareFixture(fixture, "test-live-post-candidate-substitution", 0.01, {});
    expect(postCandidate.manifest.providerCell.model).toBe("test-model");
    expect(postCandidate.prompt).not.toContain("SUBSTITUTION");
    expect(postCandidate.manifest.harness).toEqual(fixture.prepared.manifest.harness);
    expect(() => preparePromptfooExecution({
      executionId: "test-live-caller-provider-substitution",
      preparedAt: fixedClock,
      repoRoot: fixture.repoRoot,
      ledgerPath: fixture.ledgerPath,
      caseId: "shape-initiative-boundary",
      providerCellPath: providerWorktreePath,
      maxCostUsd: 0.01,
    })).toThrow(/candidate-relative providers/);
  }, 30_000);

  it("checks Promptfoo version with provider credentials removed", () => {
    const fixture = candidateFixture();
    let versionEnvironment: NodeJS.ProcessEnv | undefined;
    const process: RunProcess = (_command, args, options) => {
      expect(args).toContain("--version");
      versionEnvironment = options.env;
      return { status: 0, stdout: "0.122.0\n", stderr: "" };
    };
    const result = preflightPromptfooExecution({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory: resolve(fixture.repoRoot, "preflight"),
      environment: { OPENAI_API_KEY: "production-shaped-secret" },
      testOnlyRunProcess: process,
    });
    expect(result).toMatchObject({ ready: true, budgetReady: true, missingCredentials: [], authority: "none" });
    expect(versionEnvironment).not.toHaveProperty("OPENAI_API_KEY");
    expect(versionEnvironment?.HOME).toContain("preflight");
  }, 30_000);

  it("rejects a version-spoofing binary, changed package bytes, and changed lock before execution", () => {
    const spoofFixture = candidateFixture();
    const spoofRoot = mkdtempSync(resolve(tmpdir(), "conquistador-spoof-"));
    temporaryRoots.push(spoofRoot);
    const spoofBinary = resolve(spoofRoot, "promptfoo");
    write(spoofBinary, "#!/bin/sh\necho 0.122.0\n");
    let calls = 0;
    const process: RunProcess = () => { calls += 1; return { status: 0, stdout: "0.122.0\n", stderr: "" }; };
    expect(() => preflightPromptfooExecution({
      prepared: spoofFixture.prepared,
      promptfooBinary: spoofBinary,
      stateDirectory: resolve(spoofFixture.repoRoot, "spoof-state"),
      environment: { OPENAI_API_KEY: "production-shaped-secret" },
      testOnlyRunProcess: process,
    })).toThrow(/node_modules\/\.bin/);
    expect(calls).toBe(0);

    const packageFixture = candidateFixture();
    write(packageFixture.entrypointPath, "#!/usr/bin/env node\nconsole.log('spoofed 0.122.0')\n");
    expect(() => preflightPromptfooExecution({
      prepared: packageFixture.prepared,
      promptfooBinary: packageFixture.promptfooBinary,
      stateDirectory: resolve(packageFixture.repoRoot, "package-state"),
      environment: {},
      testOnlyRunProcess: process,
    })).toThrow(/entrypoint bytes|package bytes/);

    const lockFixture = candidateFixture();
    write(resolve(lockFixture.installationRoot, "package-lock.json"), "{}\n");
    expect(() => preflightPromptfooExecution({
      prepared: lockFixture.prepared,
      promptfooBinary: lockFixture.promptfooBinary,
      stateDirectory: resolve(lockFixture.repoRoot, "lock-state"),
      environment: {},
      testOnlyRunProcess: process,
    })).toThrow(/lock/);
  }, 30_000);

  it("rechecks every hoisted dependency before each credentialed dispatch", () => {
    const fixture = candidateFixture();
    const hoistedDependency = resolve(
      fixture.installationRoot,
      "node_modules/hoisted-provider-client/index.js",
    );
    let processCalls = 0;
    let credentialedCalls = 0;
    const process: RunProcess = (_command, args, options) => {
      processCalls += 1;
      if (args.includes("--version")) {
        expect(options.env).not.toHaveProperty("OPENAI_API_KEY");
        return { status: 0, stdout: "promptfoo 0.122.0\n", stderr: "" };
      }
      credentialedCalls += 1;
      return { status: 1, stdout: "", stderr: "must not dispatch" };
    };
    let clockCalls = 0;
    const now = (): string => {
      if (clockCalls === 0) {
        write(
          hoistedDependency,
          "module.exports = { stolen: process.env.OPENAI_API_KEY };\n",
        );
      }
      return `2026-08-28T00:00:${String(clockCalls++).padStart(2, "0")}.000Z`;
    };
    expect(() => executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory: resolve(fixture.repoRoot, "hoisted-mutation-state"),
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: process,
      now,
    })).toThrow(/installed dependency tree differs/);
    expect(processCalls).toBe(1);
    expect(credentialedCalls).toBe(0);
  }, 30_000);

  it("rejects dependency symlinks outside npm launcher directories", () => {
    const fixture = candidateFixture();
    symlinkSync(
      "../promptfoo/package.json",
      resolve(fixture.installationRoot, "node_modules/unsafe-package-link"),
    );
    expect(() => digestInstalledDependencyTree(
      resolve(fixture.installationRoot, "node_modules"),
    )).toThrow(/symlink is outside an npm \.bin directory/);
  }, 30_000);

  it("rejects normalized installed dependency path collisions", () => {
    const fixture = candidateFixture();
    write(
      resolve(fixture.installationRoot, "node_modules/collision/index.js"),
      "module.exports = 'ascii';\n",
    );
    write(
      resolve(fixture.installationRoot, "node_modules/ｃｏｌｌｉｓｉｏｎ/index.js"),
      "module.exports = 'fullwidth';\n",
    );
    expect(() => digestInstalledDependencyTree(
      resolve(fixture.installationRoot, "node_modules"),
    )).toThrow(/installed dependency path collision/);
  }, 30_000);

  it("keeps the test-only process seam from receiving production credential values", () => {
    const fixture = candidateFixture();
    const seen: NodeJS.ProcessEnv[] = [];
    const process: RunProcess = (_command, args, options) => {
      seen.push({ ...options.env });
      return args.includes("--version")
        ? { status: 0, stdout: "0.122.0\n", stderr: "" }
        : { status: 1, stdout: "", stderr: "unexpected" };
    };
    expect(() => executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory: resolve(fixture.repoRoot, "credential-seam-state"),
      environment: { OPENAI_API_KEY: "production-shaped-secret" },
      testOnlyRunProcess: process,
      now: clock(),
    })).toThrow(/test-only process injection rejects production credential/);
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toHaveProperty("OPENAI_API_KEY");
  }, 30_000);

  it("marks injected runs as fixtures and refuses public evidence export", () => {
    const fixture = candidateFixture();
    const stateDirectory = resolve(fixture.repoRoot, "state");
    const runner = fixtureProcess(fixture.prepared);
    const first = executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory,
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: runner.process,
      now: clock(),
    });
    expect(first).toMatchObject({
      executionMode: "test-fixture",
      providerCallsStarted: 0,
      completedCandidateExecutions: 0,
      brokenCandidateExecutions: 0,
      testFixtureExecutions: 3,
      pendingRepetitions: 0,
      observedCostMicroUsd: 300,
      humanVerdicts: 0,
      releaseEligible: false,
      authority: "none",
    });
    expect(runner.seenEnvironments[0]).not.toHaveProperty("OPENAI_API_KEY");
    const receipt = JSON.parse(readFileSync(resolve(stateDirectory, "repetition-1.json"), "utf8"));
    expect(receipt).toMatchObject({ executionMode: "test-fixture", providerCallStarted: false });
    expect(receipt.run.status).toBe("inconclusive");
    expect(receipt).not.toHaveProperty("output");
    expect(() => exportPublicExecutionEvidence({ stateDirectory, ledgerPath: fixture.ledgerPath })).toThrow(/test-fixture/);

    const resumed = executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory,
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: runner.process,
      now: clock(),
    });
    expect(resumed.resumedTerminalRepetitions).toBe(3);
    expect(runner.evalCalls()).toBe(3);
  }, 30_000);

  it("allows the exact per-request budget boundary and blocks one micro-USD below it", () => {
    const exact = candidateFixture(0.00148);
    const exactRunner = fixtureProcess(exact.prepared, [0, 0, 0]);
    const exactResult = executePromptfoo({
      prepared: exact.prepared,
      promptfooBinary: exact.promptfooBinary,
      stateDirectory: resolve(exact.repoRoot, "exact-budget"),
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: exactRunner.process,
      now: clock(),
    });
    expect(exact.prepared.manifest.limits.worstCaseRequestCostMicroUsd).toBe(1480);
    expect(exactResult.testFixtureExecutions).toBe(3);

    const below = candidateFixture(0.001479);
    let evalCalls = 0;
    const process: RunProcess = (_command, args) => {
      if (args.includes("--version")) return { status: 0, stdout: "0.122.0\n", stderr: "" };
      evalCalls += 1;
      return { status: 1, stdout: "", stderr: "must not dispatch" };
    };
    const preflight = preflightPromptfooExecution({
      prepared: below.prepared,
      promptfooBinary: below.promptfooBinary,
      stateDirectory: resolve(below.repoRoot, "below-preflight"),
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: process,
    });
    expect(preflight).toMatchObject({ ready: false, budgetReady: false, worstCaseRequestCostUsd: 0.00148 });
    const belowResult = executePromptfoo({
      prepared: below.prepared,
      promptfooBinary: below.promptfooBinary,
      stateDirectory: resolve(below.repoRoot, "below-budget"),
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: process,
      now: clock(),
    });
    expect(belowResult).toMatchObject({ testFixtureExecutions: 0, pendingRepetitions: 3, budgetStopped: true });
    expect(evalCalls).toBe(0);
  }, 30_000);

  it("uses reported cumulative cost before allowing the next worst-case request", () => {
    const fixture = candidateFixture(0.00158);
    const runner = fixtureProcess(fixture.prepared, [0.000101]);
    const result = executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory: resolve(fixture.repoRoot, "cumulative-budget"),
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: runner.process,
      now: clock(),
    });
    expect(result).toMatchObject({
      testFixtureExecutions: 1,
      pendingRepetitions: 2,
      observedCostMicroUsd: 101,
      budgetStopped: true,
    });
    expect(runner.evalCalls()).toBe(1);
  }, 30_000);

  it.each([
    ["negative", "-0.000001"],
    ["non-finite", "1e400"],
  ])("records %s reported cost as a broken test fixture and stops", (_label, reportedCost) => {
    const fixture = candidateFixture();
    const runner = fixtureProcess(fixture.prepared, [reportedCost]);
    const stateDirectory = resolve(fixture.repoRoot, `invalid-cost-${_label}`);
    const result = executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory,
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: runner.process,
      now: clock(),
    });
    expect(result).toMatchObject({ providerCallsStarted: 0, completedCandidateExecutions: 0, testFixtureExecutions: 1, pendingRepetitions: 2 });
    const receipt = JSON.parse(readFileSync(resolve(stateDirectory, "repetition-1.json"), "utf8"));
    expect(receipt.run.cause).toBe("Promptfoo reported invalid cost");
    expect(receipt.observedCostUsd).toBeNull();
    expect(runner.evalCalls()).toBe(1);
  }, 30_000);

  it("records one redacted broken fixture and refuses an ambiguous retry", () => {
    const fixture = candidateFixture();
    let evalCalls = 0;
    const process: RunProcess = (_command, args) => {
      if (args.includes("--version")) return { status: 0, stdout: "0.122.0\n", stderr: "" };
      evalCalls += 1;
      return { status: 1, stdout: "", stderr: "provider rejected request without echoing credentials" };
    };
    const result = executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory: resolve(fixture.repoRoot, "broken-state"),
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: process,
      now: clock(),
    });
    expect(result).toMatchObject({ providerCallsStarted: 0, completedCandidateExecutions: 0, testFixtureExecutions: 1, pendingRepetitions: 2 });
    expect(evalCalls).toBe(1);

    const ambiguousState = resolve(fixture.repoRoot, "ambiguous-state");
    write(resolve(ambiguousState, "repetition-1.attempt.json"), "{}\n");
    expect(() => executePromptfoo({
      prepared: fixture.prepared,
      promptfooBinary: fixture.promptfooBinary,
      stateDirectory: ambiguousState,
      environment: { OPENAI_API_KEY: TEST_ONLY_PROVIDER_CREDENTIAL },
      testOnlyRunProcess: process,
      now: clock(),
    })).toThrow(/provider-call state is unknown/);
    expect(evalCalls).toBe(1);
  }, 30_000);
});
