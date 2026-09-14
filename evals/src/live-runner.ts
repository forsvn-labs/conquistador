import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { AnyRun, BrokenRun, Run, Sha256 } from "./contracts.ts";
import {
  canonicalJson,
  digestBytes,
  digestValue,
  type PreparedExecution,
  type PromptfooExecutionManifest,
  verifyManifestBinding,
} from "./live-manifest.ts";
import {
  expectedPromptfooRuntimeIdentity,
  type PromptfooRuntimeIdentity,
  verifyPromptfooInstallation,
} from "./promptfoo-integrity.ts";
import { PROMPTFOO_VERSION } from "./promptfoo-version.ts";
import { invariant } from "./validate.ts";

export type ProcessResult = { status: number | null; stdout: string; stderr: string; error?: Error };
export type RunProcess = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => ProcessResult;
export const TEST_ONLY_PROVIDER_CREDENTIAL = "conquistador-test-only-credential-not-valid";
type ExecutionMode = "live" | "test-fixture";

export type RepetitionReceipt = {
  schemaVersion: "conquistador.promptfoo-repetition-receipt/v1";
  executionId: string;
  executionMode: ExecutionMode;
  repetition: 1 | 2 | 3;
  bindingDigest: Sha256;
  promptfooRuntimeDigest: Sha256;
  promptfooVersion: typeof PROMPTFOO_VERSION;
  provider: string;
  model: string;
  modelVersion: string;
  providerCallStarted: boolean;
  exitCode: number | null;
  stdoutDigest: Sha256;
  stderrDigest: Sha256;
  rawResultDigest: Sha256 | null;
  outputDigest: Sha256 | null;
  observedCostUsd: number | null;
  observedCostMicroUsd: number | null;
  tokenUsage: Record<string, number> | null;
  run: AnyRun;
  humanVerdict: "pending";
  authority: "none";
  redactionApplied: true;
  receiptDigest: Sha256;
};

export type ExecutionSummary = {
  schemaVersion: "conquistador.promptfoo-execution-summary/v1";
  executionId: string;
  executionMode: ExecutionMode;
  bindingDigest: Sha256;
  candidateBuildId: string;
  sourceCommit: string;
  caseId: string;
  providerCellId: string;
  provider: string;
  model: string;
  modelVersion: string;
  promptfooVersion: typeof PROMPTFOO_VERSION;
  promptfooRuntimeDigest: Sha256;
  plannedRepetitions: 3;
  providerCallsStarted: number;
  completedCandidateExecutions: number;
  brokenCandidateExecutions: number;
  testFixtureExecutions: number;
  pendingRepetitions: number;
  resumedTerminalRepetitions: number;
  observedCostUsd: number | null;
  observedCostMicroUsd: number | null;
  budgetStopped: boolean;
  humanVerdicts: 0;
  releaseEligible: false;
  authority: "none";
  stateDirectory: string;
  receiptDigests: Sha256[];
};

function defaultRunProcess(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }): ProcessResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error } : {}),
  };
}

function atomicJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  renameSync(temporary, path);
}

function atomicText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, value, { flag: "wx", mode: 0o600 });
  renameSync(temporary, path);
}

function receiptDigest(receipt: Omit<RepetitionReceipt, "receiptDigest">): Sha256 {
  return digestValue(receipt);
}

export function verifyRepetitionReceipt(receipt: RepetitionReceipt, manifest: PromptfooExecutionManifest): void {
  invariant(receipt.executionId === manifest.executionId && receipt.bindingDigest === manifest.bindingDigest, "stored repetition crosses execution bindings");
  invariant(
    receipt.promptfooRuntimeDigest === expectedPromptfooRuntimeIdentity(manifest.harness.promptfooInstallation).identityDigest,
    "stored repetition crosses Promptfoo runtime identities",
  );
  const { receiptDigest: observed, ...body } = receipt;
  invariant(receiptDigest(body) === observed, "stored repetition receipt digest differs");
  invariant(receipt.run.candidateBuildId === manifest.candidate.candidateId, "stored repetition crosses Candidate Builds");
  invariant(receipt.run.providerCellId === manifest.providerCell.id, "stored repetition crosses provider cells");
  invariant(receipt.run.caseId === manifest.case.id, "stored repetition crosses cases");
  invariant(receipt.providerCallStarted === (receipt.executionMode === "live"), "stored repetition misstates live provider-call authority");
  if (receipt.observedCostUsd === null) {
    invariant(receipt.observedCostMicroUsd === null, "stored repetition has mismatched cost accounting");
  } else {
    invariant(reportedCostMicroUsd(receipt.observedCostUsd) === receipt.observedCostMicroUsd, "stored repetition cost accounting differs");
  }
  invariant(receipt.humanVerdict === "pending" && receipt.authority === "none", "stored repetition claims human or release authority");
}

function bindExecutionMode(stateDirectory: string, executionMode: ExecutionMode): void {
  const path = resolve(stateDirectory, "execution-mode.json");
  const binding = { schemaVersion: "conquistador.promptfoo-execution-mode/v1", executionMode };
  if (existsSync(path)) {
    invariant(canonicalJson(JSON.parse(readFileSync(path, "utf8"))) === canonicalJson(binding), "state directory crosses live and test-fixture execution modes");
  } else {
    atomicJson(path, binding);
  }
}

function bindRuntimeIdentity(stateDirectory: string, identity: PromptfooRuntimeIdentity): void {
  const path = resolve(stateDirectory, "promptfoo-runtime.json");
  if (existsSync(path)) {
    const stored = JSON.parse(readFileSync(path, "utf8")) as PromptfooRuntimeIdentity;
    invariant(stored.identityDigest === identity.identityDigest && canonicalJson(stored) === canonicalJson(identity), "state directory belongs to a different Promptfoo runtime");
  } else {
    atomicJson(path, identity);
  }
}

function verifyRuntimeUnchanged(input: {
  promptfooBinary: string;
  manifest: PromptfooExecutionManifest;
  expectedIdentity: PromptfooRuntimeIdentity;
}): string {
  const observed = verifyPromptfooInstallation({
    promptfooBinary: input.promptfooBinary,
    expected: input.manifest.harness.promptfooInstallation,
  });
  invariant(observed.identity.identityDigest === input.expectedIdentity.identityDigest, "Promptfoo runtime changed after integrity verification");
  return observed.entrypoint;
}

function runPromptfoo(entrypoint: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, runProcess: RunProcess): ProcessResult {
  return runProcess(process.execPath, [entrypoint, ...args], { cwd, env });
}

function processVersion(entrypoint: string, cwd: string, env: NodeJS.ProcessEnv, runProcess: RunProcess): string {
  const result = runPromptfoo(entrypoint, ["--version"], cwd, env, runProcess);
  invariant(result.status === 0, "Promptfoo binary version check failed");
  const match = `${result.stdout}\n${result.stderr}`.match(/\b(\d+\.\d+\.\d+)\b/);
  invariant(match?.[1] === PROMPTFOO_VERSION, `Promptfoo binary must be exactly ${PROMPTFOO_VERSION}`);
  return match[1];
}

function missingCredentials(manifest: PromptfooExecutionManifest, environment: NodeJS.ProcessEnv): string[] {
  return manifest.providerCell.execution.credentialEnvironmentVariables.filter((name) => !environment[name]);
}

function credentialFreeEnvironment(source: NodeJS.ProcessEnv, stateDirectory: string): NodeJS.ProcessEnv {
  const allowedRuntimeNames = [
    "PATH",
    "TMPDIR",
    "TMP",
    "TEMP",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "NODE_EXTRA_CA_CERTS",
  ];
  const environment = Object.fromEntries(allowedRuntimeNames.flatMap((name) => source[name] === undefined ? [] : [[name, source[name]]]));
  return {
    ...environment,
    HOME: resolve(stateDirectory, "runtime-home"),
    PROMPTFOO_CONFIG_DIR: resolve(stateDirectory, "promptfoo-state"),
    PROMPTFOO_DISABLE_TELEMETRY: "true",
    PROMPTFOO_DISABLE_UPDATE: "true",
    FORCE_COLOR: "0",
  };
}

function providerEnvironment(
  manifest: PromptfooExecutionManifest,
  source: NodeJS.ProcessEnv,
  stateDirectory: string,
  testOnly: boolean,
): NodeJS.ProcessEnv {
  const environment = credentialFreeEnvironment(source, stateDirectory);
  for (const name of manifest.providerCell.execution.credentialEnvironmentVariables) {
    const value = source[name];
    invariant(value !== undefined, `missing provider credential ${name}`);
    if (testOnly) invariant(value === TEST_ONLY_PROVIDER_CREDENTIAL, "test-only process injection rejects production credential values");
    environment[name] = testOnly ? TEST_ONLY_PROVIDER_CREDENTIAL : value;
  }
  return environment;
}

function acquireLock(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    let owner = 0;
    try { owner = JSON.parse(readFileSync(path, "utf8")).pid; } catch { /* fail closed below */ }
    let live = false;
    if (Number.isInteger(owner) && owner > 0) {
      try { process.kill(owner, 0); live = true; } catch { live = false; }
    }
    invariant(!live, `execution ${path} is already active`);
    rmSync(path);
  }
  const descriptor = openSync(path, "wx", 0o600);
  writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`);
  closeSync(descriptor);
  return () => { if (existsSync(path)) rmSync(path); };
}

function resultRecord(value: unknown): Record<string, any> {
  const matches: Record<string, any>[] = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) { entry.forEach(visit); return; }
    if (!entry || typeof entry !== "object") return;
    const record = entry as Record<string, any>;
    if (typeof record.output === "string" && ("success" in record || "score" in record || "provider" in record || "response" in record)) matches.push(record);
    Object.values(record).forEach(visit);
  };
  visit(value);
  const unique = [...new Map(matches.map((entry) => [digestBytes(entry.output), entry])).values()];
  invariant(unique.length === 1, `Promptfoo result must contain exactly one model output, found ${unique.length}`);
  return unique[0];
}

function numberRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]));
  return entries.length ? Object.fromEntries(entries) : null;
}

function reportedCostMicroUsd(value: number): number {
  invariant(Number.isFinite(value) && value >= 0, "Promptfoo reported cost must be finite and non-negative");
  const microUsd = Math.ceil(value * 1_000_000);
  invariant(Number.isSafeInteger(microUsd), "Promptfoo reported cost exceeds safe integer accounting");
  return microUsd;
}

function successfulReceipt(input: {
  manifest: PromptfooExecutionManifest;
  repetition: 1 | 2 | 3;
  executionMode: ExecutionMode;
  promptfooRuntimeDigest: Sha256;
  startedAt: string;
  finishedAt: string;
  process: ProcessResult;
  rawBytes: Buffer;
  parsed: unknown;
}): RepetitionReceipt {
  const output = resultRecord(input.parsed);
  const outputDigest = digestBytes(output.output);
  const response = output.response && typeof output.response === "object" ? output.response : {};
  const observedCostUsd = typeof output.cost === "number" ? output.cost : typeof response.cost === "number" ? response.cost : null;
  const observedCostMicroUsd = observedCostUsd === null ? null : reportedCostMicroUsd(observedCostUsd);
  invariant(
    observedCostMicroUsd === null || observedCostMicroUsd <= input.manifest.limits.worstCaseRequestCostMicroUsd,
    "Promptfoo reported cost exceeds the provider-declared worst-case request cost",
  );
  const tokenUsage = numberRecord(output.tokenUsage ?? response.tokenUsage);
  const traceDigest = digestValue({
    executionId: input.manifest.executionId,
    executionMode: input.executionMode,
    repetition: input.repetition,
    bindingDigest: input.manifest.bindingDigest,
    outputDigest,
    rawResultDigest: digestBytes(input.rawBytes),
    observedCostUsd,
    observedCostMicroUsd,
    tokenUsage,
  });
  const run: Run = {
    schemaVersion: "conquistador.run/v1",
    id: `${input.manifest.executionId}.r${input.repetition}`,
    caseId: input.manifest.case.id,
    candidateBuildId: input.manifest.candidate.candidateId,
    providerCellId: input.manifest.providerCell.id,
    repetition: input.repetition,
    status: "inconclusive",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    traceDigest,
    artifactDigests: [outputDigest],
    assertionResults: input.manifest.case.assertions.map((assertionId) => ({
      assertionId,
      status: "inconclusive",
      evidenceDigests: [outputDigest],
    })),
    dimensionResults: [],
    externalActions: [],
    terminalMarker: true,
  };
  const body: Omit<RepetitionReceipt, "receiptDigest"> = {
    schemaVersion: "conquistador.promptfoo-repetition-receipt/v1",
    executionId: input.manifest.executionId,
    executionMode: input.executionMode,
    repetition: input.repetition,
    bindingDigest: input.manifest.bindingDigest,
    promptfooRuntimeDigest: input.promptfooRuntimeDigest,
    promptfooVersion: PROMPTFOO_VERSION,
    provider: input.manifest.providerCell.provider,
    model: input.manifest.providerCell.model,
    modelVersion: input.manifest.providerCell.modelVersion,
    providerCallStarted: input.executionMode === "live",
    exitCode: input.process.status,
    stdoutDigest: digestBytes(input.process.stdout),
    stderrDigest: digestBytes(input.process.stderr),
    rawResultDigest: digestBytes(input.rawBytes),
    outputDigest,
    observedCostUsd,
    observedCostMicroUsd,
    tokenUsage,
    run,
    humanVerdict: "pending",
    authority: "none",
    redactionApplied: true,
  };
  return { ...body, receiptDigest: receiptDigest(body) };
}

function brokenReceipt(input: {
  manifest: PromptfooExecutionManifest;
  repetition: 1 | 2 | 3;
  executionMode: ExecutionMode;
  promptfooRuntimeDigest: Sha256;
  startedAt: string;
  finishedAt: string;
  process: ProcessResult;
  cause: string;
  rawResultDigest?: Sha256;
}): RepetitionReceipt {
  const traceDigest = digestValue({
    executionId: input.manifest.executionId,
    executionMode: input.executionMode,
    repetition: input.repetition,
    bindingDigest: input.manifest.bindingDigest,
    promptfooRuntimeDigest: input.promptfooRuntimeDigest,
    exitCode: input.process.status,
    stdoutDigest: digestBytes(input.process.stdout),
    stderrDigest: digestBytes(input.process.stderr),
    cause: input.cause,
  });
  const run: BrokenRun = {
    schemaVersion: "conquistador.broken-run/v1",
    id: `${input.manifest.executionId}.r${input.repetition}.broken`,
    caseId: input.manifest.case.id,
    candidateBuildId: input.manifest.candidate.candidateId,
    providerCellId: input.manifest.providerCell.id,
    repetition: input.repetition,
    status: "broken",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    cause: input.cause,
    traceDigest,
    terminalMarker: true,
  };
  const body: Omit<RepetitionReceipt, "receiptDigest"> = {
    schemaVersion: "conquistador.promptfoo-repetition-receipt/v1",
    executionId: input.manifest.executionId,
    executionMode: input.executionMode,
    repetition: input.repetition,
    bindingDigest: input.manifest.bindingDigest,
    promptfooRuntimeDigest: input.promptfooRuntimeDigest,
    promptfooVersion: PROMPTFOO_VERSION,
    provider: input.manifest.providerCell.provider,
    model: input.manifest.providerCell.model,
    modelVersion: input.manifest.providerCell.modelVersion,
    providerCallStarted: input.executionMode === "live",
    exitCode: input.process.status,
    stdoutDigest: digestBytes(input.process.stdout),
    stderrDigest: digestBytes(input.process.stderr),
    rawResultDigest: input.rawResultDigest ?? null,
    outputDigest: null,
    observedCostUsd: null,
    observedCostMicroUsd: null,
    tokenUsage: null,
    run,
    humanVerdict: "pending",
    authority: "none",
    redactionApplied: true,
  };
  return { ...body, receiptDigest: receiptDigest(body) };
}

function promptfooConfig(manifest: PromptfooExecutionManifest, promptPath: string, repetition: number): unknown {
  return {
    description: `${manifest.executionId} ${manifest.case.id} repetition ${repetition}`,
    sharing: false,
    evaluateOptions: { cache: false, maxConcurrency: 1 },
    prompts: [pathToFileURL(promptPath).href],
    providers: [{
      id: manifest.providerCell.execution.promptfooProviderId,
      config: manifest.providerCell.execution.settings,
    }],
    tests: [{
      description: `${manifest.case.id} repetition ${repetition}`,
      metadata: {
        executionId: manifest.executionId,
        candidateBuildId: manifest.candidate.candidateId,
        caseId: manifest.case.id,
        providerCellId: manifest.providerCell.id,
        repetition,
      },
    }],
  };
}

export function preflightPromptfooExecution(input: {
  prepared: PreparedExecution;
  promptfooBinary: string;
  stateDirectory: string;
  environment?: NodeJS.ProcessEnv;
  testOnlyRunProcess?: RunProcess;
}): {
  ready: boolean;
  executionMode: ExecutionMode;
  budgetReady: boolean;
  promptfooVersion: string;
  promptfooRuntimeDigest: Sha256;
  missingCredentials: string[];
  maxCostUsd: number;
  worstCaseRequestCostUsd: number;
  candidateBuildId: string;
  caseId: string;
  providerCellId: string;
  plannedRepetitions: 3;
  authority: "none";
} {
  verifyManifestBinding(input.prepared.manifest);
  invariant(digestBytes(input.prepared.prompt) === input.prepared.manifest.harness.promptDigest, "prepared prompt digest differs");
  const sourceEnvironment = input.environment ?? process.env;
  const stateDirectory = resolve(input.stateDirectory);
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const executionMode: ExecutionMode = input.testOnlyRunProcess ? "test-fixture" : "live";
  bindExecutionMode(stateDirectory, executionMode);
  const runtime = verifyPromptfooInstallation({
    promptfooBinary: input.promptfooBinary,
    expected: input.prepared.manifest.harness.promptfooInstallation,
  });
  bindRuntimeIdentity(stateDirectory, runtime.identity);
  const inspectionEnvironment = credentialFreeEnvironment(sourceEnvironment, stateDirectory);
  mkdirSync(inspectionEnvironment.HOME!, { recursive: true, mode: 0o700 });
  mkdirSync(inspectionEnvironment.PROMPTFOO_CONFIG_DIR!, { recursive: true, mode: 0o700 });
  const processRunner = input.testOnlyRunProcess ?? defaultRunProcess;
  const promptfooVersion = processVersion(runtime.entrypoint, stateDirectory, inspectionEnvironment, processRunner);
  verifyRuntimeUnchanged({ promptfooBinary: input.promptfooBinary, manifest: input.prepared.manifest, expectedIdentity: runtime.identity });
  const absentCredentials = missingCredentials(input.prepared.manifest, sourceEnvironment);
  const budgetReady = input.prepared.manifest.limits.worstCaseRequestCostMicroUsd <= input.prepared.manifest.limits.maxCostMicroUsd;
  return {
    ready: absentCredentials.length === 0 && budgetReady,
    executionMode,
    budgetReady,
    promptfooVersion,
    promptfooRuntimeDigest: runtime.identity.identityDigest,
    missingCredentials: absentCredentials,
    maxCostUsd: input.prepared.manifest.limits.maxCostUsd,
    worstCaseRequestCostUsd: input.prepared.manifest.limits.worstCaseRequestCostUsd,
    candidateBuildId: input.prepared.manifest.candidate.candidateId,
    caseId: input.prepared.manifest.case.id,
    providerCellId: input.prepared.manifest.providerCell.id,
    plannedRepetitions: 3,
    authority: "none",
  };
}

export function executePromptfoo(input: {
  prepared: PreparedExecution;
  promptfooBinary: string;
  stateDirectory: string;
  environment?: NodeJS.ProcessEnv;
  testOnlyRunProcess?: RunProcess;
  now?: () => string;
}): ExecutionSummary {
  const manifest = input.prepared.manifest;
  verifyManifestBinding(manifest);
  invariant(digestBytes(input.prepared.prompt) === manifest.harness.promptDigest, "prepared prompt digest differs");
  const sourceEnvironment = input.environment ?? process.env;
  const absentCredentials = missingCredentials(manifest, sourceEnvironment);
  invariant(absentCredentials.length === 0, `missing provider credentials: ${absentCredentials.join(", ")}`);
  const stateDirectory = resolve(input.stateDirectory);
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const releaseLock = acquireLock(resolve(stateDirectory, "execution.lock"));
  try {
    const executionMode: ExecutionMode = input.testOnlyRunProcess ? "test-fixture" : "live";
    bindExecutionMode(stateDirectory, executionMode);
    const runtime = verifyPromptfooInstallation({
      promptfooBinary: input.promptfooBinary,
      expected: manifest.harness.promptfooInstallation,
    });
    bindRuntimeIdentity(stateDirectory, runtime.identity);
    const processRunner = input.testOnlyRunProcess ?? defaultRunProcess;
    const inspectionEnvironment = credentialFreeEnvironment(sourceEnvironment, stateDirectory);
    mkdirSync(inspectionEnvironment.HOME!, { recursive: true, mode: 0o700 });
    mkdirSync(inspectionEnvironment.PROMPTFOO_CONFIG_DIR!, { recursive: true, mode: 0o700 });
    processVersion(runtime.entrypoint, stateDirectory, inspectionEnvironment, processRunner);
    let entrypoint = verifyRuntimeUnchanged({ promptfooBinary: input.promptfooBinary, manifest, expectedIdentity: runtime.identity });
    const manifestPath = resolve(stateDirectory, "manifest.json");
    const promptPath = resolve(stateDirectory, "prompt.txt");
    if (existsSync(manifestPath)) {
      const stored = JSON.parse(readFileSync(manifestPath, "utf8")) as PromptfooExecutionManifest;
      verifyManifestBinding(stored);
      invariant(stored.bindingDigest === manifest.bindingDigest, "state directory belongs to a different execution binding");
      invariant(digestBytes(readFileSync(promptPath)) === manifest.harness.promptDigest, "stored prompt digest differs");
    } else {
      atomicJson(manifestPath, manifest);
      atomicText(promptPath, input.prepared.prompt);
    }

    const receipts: RepetitionReceipt[] = [];
    let resumedTerminalRepetitions = 0;
    let budgetStopped = false;
    const now = input.now ?? (() => new Date().toISOString());
    for (const repetition of [1, 2, 3] as const) {
      const receiptPath = resolve(stateDirectory, `repetition-${repetition}.json`);
      if (existsSync(receiptPath)) {
        const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as RepetitionReceipt;
        verifyRepetitionReceipt(receipt, manifest);
        invariant(receipt.executionMode === executionMode, "stored repetition crosses live and test-fixture execution modes");
        receipts.push(receipt);
        resumedTerminalRepetitions += 1;
        if (receipt.run.schemaVersion === "conquistador.broken-run/v1") break;
        if (receipt.observedCostMicroUsd === null) {
          budgetStopped = true;
          break;
        }
        continue;
      }
      const attemptPath = resolve(stateDirectory, `repetition-${repetition}.attempt.json`);
      invariant(
        !existsSync(attemptPath),
        `repetition ${repetition} has an interrupted launch commitment; do not retry because provider-call state is unknown`,
      );
      const observedCostMicroUsd = receipts.reduce((sum, receipt) => sum + (receipt.observedCostMicroUsd ?? 0), 0);
      if (observedCostMicroUsd + manifest.limits.worstCaseRequestCostMicroUsd > manifest.limits.maxCostMicroUsd) {
        budgetStopped = true;
        break;
      }
      const configPath = resolve(stateDirectory, `promptfoo-${repetition}.json`);
      const outputPath = resolve(stateDirectory, `promptfoo-result-${repetition}.json`);
      atomicJson(configPath, promptfooConfig(manifest, promptPath, repetition));
      const startedAt = now();
      const promptfooArguments = [
        "eval",
        "--config", configPath,
        "--no-cache",
        "--no-share",
        "--no-progress-bar",
        "--no-table",
        "--max-concurrency", "1",
        "--repeat", "1",
        "--output", outputPath,
      ];
      atomicJson(attemptPath, {
        schemaVersion: "conquistador.promptfoo-launch-commitment/v1",
        executionId: manifest.executionId,
        executionMode,
        repetition,
        bindingDigest: manifest.bindingDigest,
        startedAt,
        promptfooRuntimeDigest: runtime.identity.identityDigest,
        commandDigest: digestValue({ command: process.execPath, entrypoint: manifest.harness.promptfooInstallation.entrypointPath, arguments: promptfooArguments }),
        providerCallState: "unknown-until-terminal-receipt",
      });
      entrypoint = verifyRuntimeUnchanged({ promptfooBinary: input.promptfooBinary, manifest, expectedIdentity: runtime.identity });
      const environment = providerEnvironment(manifest, sourceEnvironment, stateDirectory, Boolean(input.testOnlyRunProcess));
      const processResult = runPromptfoo(entrypoint, promptfooArguments, stateDirectory, environment, processRunner);
      const finishedAt = now();
      let receipt: RepetitionReceipt;
      if (processResult.status !== 0 || processResult.error) {
        receipt = brokenReceipt({
          manifest,
          repetition,
          executionMode,
          promptfooRuntimeDigest: runtime.identity.identityDigest,
          startedAt,
          finishedAt,
          process: processResult,
          cause: processResult.error ? "Promptfoo process did not complete" : `Promptfoo exited ${String(processResult.status)}`,
        });
      } else if (!existsSync(outputPath)) {
        receipt = brokenReceipt({
          manifest,
          repetition,
          executionMode,
          promptfooRuntimeDigest: runtime.identity.identityDigest,
          startedAt,
          finishedAt,
          process: processResult,
          cause: "Promptfoo wrote no JSON result",
        });
      } else {
        const rawBytes = readFileSync(outputPath);
        try {
          receipt = successfulReceipt({
            manifest,
            repetition,
            executionMode,
            promptfooRuntimeDigest: runtime.identity.identityDigest,
            startedAt,
            finishedAt,
            process: processResult,
            rawBytes,
            parsed: JSON.parse(rawBytes.toString("utf8")),
          });
        } catch (error) {
          const invalidCost = error instanceof Error && /reported cost/.test(error.message);
          receipt = brokenReceipt({
            manifest,
            repetition,
            executionMode,
            promptfooRuntimeDigest: runtime.identity.identityDigest,
            startedAt,
            finishedAt,
            process: processResult,
            cause: invalidCost ? "Promptfoo reported invalid cost" : "Promptfoo JSON did not contain one bound model output",
            rawResultDigest: digestBytes(rawBytes),
          });
        }
      }
      atomicJson(receiptPath, receipt);
      receipts.push(receipt);
      if (receipt.run.schemaVersion === "conquistador.broken-run/v1") break;
      if (receipt.observedCostUsd === null) {
        budgetStopped = true;
        break;
      }
    }
    const completedCandidateExecutions = receipts.filter((receipt) => receipt.executionMode === "live" && receipt.run.schemaVersion === "conquistador.run/v1").length;
    const brokenCandidateExecutions = receipts.filter((receipt) => receipt.executionMode === "live" && receipt.run.schemaVersion === "conquistador.broken-run/v1").length;
    const testFixtureExecutions = receipts.filter((receipt) => receipt.executionMode === "test-fixture").length;
    const observedCosts = receipts.map((receipt) => receipt.observedCostUsd).filter((cost): cost is number => cost !== null);
    const observedCostsMicroUsd = receipts.map((receipt) => receipt.observedCostMicroUsd).filter((cost): cost is number => cost !== null);
    const summary: ExecutionSummary = {
      schemaVersion: "conquistador.promptfoo-execution-summary/v1",
      executionId: manifest.executionId,
      executionMode,
      bindingDigest: manifest.bindingDigest,
      candidateBuildId: manifest.candidate.candidateId,
      sourceCommit: manifest.candidate.sourceCommit,
      caseId: manifest.case.id,
      providerCellId: manifest.providerCell.id,
      provider: manifest.providerCell.provider,
      model: manifest.providerCell.model,
      modelVersion: manifest.providerCell.modelVersion,
      promptfooVersion: PROMPTFOO_VERSION,
      promptfooRuntimeDigest: runtime.identity.identityDigest,
      plannedRepetitions: 3,
      providerCallsStarted: receipts.filter((receipt) => receipt.providerCallStarted).length,
      completedCandidateExecutions,
      brokenCandidateExecutions,
      testFixtureExecutions,
      pendingRepetitions: 3 - receipts.length,
      resumedTerminalRepetitions,
      observedCostUsd: observedCosts.length ? observedCosts.reduce((sum, cost) => sum + cost, 0) : null,
      observedCostMicroUsd: observedCostsMicroUsd.length ? observedCostsMicroUsd.reduce((sum, cost) => sum + cost, 0) : null,
      budgetStopped,
      humanVerdicts: 0,
      releaseEligible: false,
      authority: "none",
      stateDirectory,
      receiptDigests: receipts.map((receipt) => receipt.receiptDigest),
    };
    atomicJson(resolve(stateDirectory, "summary.json"), summary);
    return summary;
  } finally {
    releaseLock();
  }
}
