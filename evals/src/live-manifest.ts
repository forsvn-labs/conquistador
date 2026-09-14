import { committedLayout } from "./committed-layout.ts";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ProviderCell, Sha256 } from "./contracts.ts";
import { canonicalJson, digestBytes, digestValue } from "./digest.ts";
import {
  type PromptfooIntegrityBinding,
  validatePromptfooIntegrityBinding,
  validatePromptfooLock,
} from "./promptfoo-integrity.ts";
import { PROMPTFOO_VERSION } from "./promptfoo-version.ts";
import { invariant, requireSha256, validateProviderCell } from "./validate.ts";

export { canonicalJson, digestBytes, digestValue } from "./digest.ts";

const HEX_40 = /^[0-9a-f]{40}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const IMMUTABLE_CANDIDATE_FIELDS = [
  "sourceCommit",
  "sourceTree",
  "version",
  "projectorVersion",
  "projectedTreeDigest",
  "ledgerDigest",
  "artifactDigests",
  "evidenceSnapshotDigest",
] as const;
const EXECUTION_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const FORBIDDEN_SETTING_KEY = /(?:api.?key|authorization|credential|password|secret|token)$/i;
const SECRET_SHAPE = /(?:sk-(?:proj-|ant-api03-)?[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{16,})/;

export type BoundCandidate = {
  candidateId: string;
  sourceCommit: string;
  sourceTree: string;
  version: string;
  projectorVersion: string;
  projectedTreeDigest: string;
  ledgerDigest: string;
  artifactDigests: string;
  evidenceSnapshotDigest: string;
};

export type LiveProviderCell = ProviderCell & {
  execution: {
    promptfooProviderId: string;
    credentialEnvironmentVariables: string[];
    settings: Record<string, unknown>;
    contextWindowTokens: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    pricing: {
      currency: "USD";
      revision: string;
      source: string;
      inputNanoUsdPerToken: number;
      outputNanoUsdPerToken: number;
    };
  };
};

export type CandidateCaseBinding = {
  id: string;
  partition: string;
  class: string;
  subjectId: string;
  prompt: string;
  fixture: Record<string, unknown> | null;
  assertions: string[];
  source: { path: string; version: string; digest: Sha256 };
  inputDigest: Sha256;
};

export type PromptfooExecutionManifest = {
  schemaVersion: "conquistador.promptfoo-execution-manifest/v1";
  executionId: string;
  preparedAt: string;
  candidate: BoundCandidate;
  case: CandidateCaseBinding;
  providerCell: LiveProviderCell;
  harness: {
    version: "1.1.0";
    promptfooVersion: typeof PROMPTFOO_VERSION;
    adapterDigest: Sha256;
    templateDigest: Sha256;
    toolManifestDigest: Sha256;
    calibrationDigest: Sha256;
    promptfooIntegrityDigest: Sha256;
    promptfooInstallation: PromptfooIntegrityBinding;
    promptDigest: Sha256;
  };
  limits: {
    repetitions: 3;
    maxConcurrency: 1;
    maxOutputTokens: number;
    maxCostUsd: number;
    maxCostMicroUsd: number;
    worstCaseRequestCostUsd: number;
    worstCaseRequestCostMicroUsd: number;
  };
  authority: {
    externalActions: "deny";
    humanVerdict: "pending";
    release: "none";
  };
  bindingDigest: Sha256;
};

export type PreparedExecution = {
  manifest: PromptfooExecutionManifest;
  prompt: string;
  missingCredentials: string[];
};

function json(path: string): any {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function safeProductPath(path: string): string {
  invariant(
    Boolean(path) && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") &&
      path.split("/").every((part) => Boolean(part) && part !== "." && part !== ".."),
    `candidate source path is unsafe: ${path}`,
  );
  return path;
}

function git(repoRoot: string, args: string[]): Buffer {
  try {
    return execFileSync("git", ["-C", resolve(repoRoot), ...args], {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(`[eval-lab] git ${args[0] ?? "read"} failed for the exact candidate source`);
  }
}

function candidateFile(repoRoot: string, candidate: BoundCandidate, path: string): Buffer {
  return git(repoRoot, [
    "show",
    `${candidate.sourceCommit}:${committedLayout(repoRoot, candidate.sourceCommit, candidate.sourceTree).prefix}${safeProductPath(path)}`,
  ]);
}

function candidateEvalFile(repoRoot: string, candidate: BoundCandidate, path: string): Buffer {
  return candidateFile(repoRoot, candidate, `evals/${safeProductPath(path)}`);
}

function boundCandidate(ledgerPath: string): BoundCandidate {
  const ledger = json(ledgerPath);
  invariant(ledger.release?.state === "NO-GO", "live eval preparation cannot weaken release NO-GO");
  invariant(ledger.candidateSelector?.releaseCandidateStatus === "BOUND", "release candidate is not BOUND");
  const candidate = ledger.candidateSelector.selectedCandidate as BoundCandidate | null;
  invariant(Boolean(candidate) && typeof candidate === "object", "selected candidate is absent");
  invariant(
    JSON.stringify(Object.keys(candidate).sort()) ===
      JSON.stringify(["candidateId", ...IMMUTABLE_CANDIDATE_FIELDS].sort()),
    "selected candidate immutable tuple fields differ",
  );
  invariant(HEX_64.test(candidate.candidateId), "selected candidate ID is not exact");
  invariant(HEX_40.test(candidate.sourceCommit) && HEX_40.test(candidate.sourceTree), "selected candidate Git identity is not exact");
  invariant(["1.0.0", "0.1.0"].includes(candidate.version) && candidate.projectorVersion === "1.0.0", "selected candidate version is unsupported");
  for (const field of ["projectedTreeDigest", "ledgerDigest", "artifactDigests", "evidenceSnapshotDigest"] as const) {
    invariant(HEX_64.test(candidate[field]), `selected candidate ${field} is not exact`);
  }
  const derivedCandidateId = digestValue(
    IMMUTABLE_CANDIDATE_FIELDS.map((field) => [field, candidate[field]]),
  ).slice("sha256:".length);
  invariant(candidate.candidateId === derivedCandidateId, "selected candidate ID does not match its immutable tuple");
  return structuredClone(candidate);
}

function validateSettings(value: unknown, path = "settings"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateSettings(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    invariant(typeof value !== "string" || !SECRET_SHAPE.test(value), `${path} contains credential-shaped material`);
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    invariant(!FORBIDDEN_SETTING_KEY.test(key), `${path}.${key} may not carry credentials`);
    validateSettings(entry, `${path}.${key}`);
  }
}

export function validateLiveProviderCell(value: unknown): asserts value is LiveProviderCell {
  validateProviderCell(value);
  const cell = value as LiveProviderCell;
  invariant(cell.adapter.name === "promptfoo" && cell.adapter.version === PROMPTFOO_VERSION, `live execution requires promptfoo ${PROMPTFOO_VERSION}`);
  invariant(Boolean(cell.execution) && typeof cell.execution === "object", "provider cell has no live execution binding");
  const execution = cell.execution;
  invariant(
    typeof execution.promptfooProviderId === "string" &&
      execution.promptfooProviderId.includes(cell.model) &&
      !/[\s*]/.test(execution.promptfooProviderId),
    "promptfoo provider ID must bind the exact model",
  );
  invariant(
    Array.isArray(execution.credentialEnvironmentVariables) &&
      execution.credentialEnvironmentVariables.length > 0 &&
      new Set(execution.credentialEnvironmentVariables).size === execution.credentialEnvironmentVariables.length &&
      execution.credentialEnvironmentVariables.every((name) => ENV_NAME.test(name)),
    "provider credential environment names must be a non-empty exact set",
  );
  invariant(Boolean(execution.settings) && typeof execution.settings === "object" && !Array.isArray(execution.settings), "provider settings are required");
  validateSettings(execution.settings);
  invariant(Number.isInteger(execution.maxOutputTokens) && execution.maxOutputTokens > 0 && execution.maxOutputTokens <= 4096, "maxOutputTokens must be between 1 and 4096");
  invariant(Number.isInteger(execution.contextWindowTokens) && execution.contextWindowTokens > 0, "contextWindowTokens must be a positive integer");
  invariant(Number.isInteger(execution.maxInputTokens) && execution.maxInputTokens > 0, "maxInputTokens must be a positive integer");
  invariant(execution.maxInputTokens + execution.maxOutputTokens === execution.contextWindowTokens, "input and output limits must exactly partition the context window");
  const tokenLimit = execution.settings.max_tokens ?? execution.settings.max_completion_tokens ?? execution.settings.maxOutputTokens;
  invariant(tokenLimit === execution.maxOutputTokens, "provider settings must enforce maxOutputTokens");
  invariant(digestValue(execution.settings) === cell.settingsDigest, "provider settings digest differs");
  invariant(Boolean(execution.pricing) && typeof execution.pricing === "object", "provider pricing is required");
  invariant(execution.pricing.currency === "USD", "provider pricing must use USD");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(execution.pricing.revision), "provider pricing revision must be an exact date");
  invariant(/^https:\/\//.test(execution.pricing.source), "provider pricing source must be HTTPS");
  invariant(
    Number.isInteger(execution.pricing.inputNanoUsdPerToken) && execution.pricing.inputNanoUsdPerToken > 0 &&
      Number.isInteger(execution.pricing.outputNanoUsdPerToken) && execution.pricing.outputNanoUsdPerToken > 0,
    "provider token prices must be positive integer nano-USD rates",
  );
}

export function exactUsdToMicroUsd(value: number, label: string): number {
  invariant(Number.isFinite(value) && value >= 0, `${label} must be finite and non-negative`);
  const microUsd = Math.round(value * 1_000_000);
  invariant(Number.isSafeInteger(microUsd) && Math.abs(value - microUsd / 1_000_000) < 1e-12, `${label} must use at most six decimal places`);
  return microUsd;
}

export function worstCaseRequestCostMicroUsd(providerCell: LiveProviderCell): number {
  const pricing = providerCell.execution.pricing;
  const nanoUsd =
    providerCell.execution.maxInputTokens * pricing.inputNanoUsdPerToken +
    providerCell.execution.maxOutputTokens * pricing.outputNanoUsdPerToken;
  invariant(Number.isSafeInteger(nanoUsd), "provider worst-case request cost exceeds safe integer accounting");
  return Math.ceil(nanoUsd / 1_000);
}

function inventoryCase(repoRoot: string, candidate: BoundCandidate, caseId: string): CandidateCaseBinding {
  const inventoryBytes = candidateFile(repoRoot, candidate, "evals/benchmarks/inventory-preflight-v1.json");
  const inventory = JSON.parse(inventoryBytes.toString("utf8"));
  invariant(inventory.schemaVersion === "conquistador.eval-inventory-preflight/v1", "candidate inventory schema is not v1");
  const candidateCase = inventory.cases.find((entry: any) => entry.id === caseId);
  invariant(Boolean(candidateCase), `candidate inventory has no case ${caseId}`);
  invariant(candidateCase.repetitionCount === 3, "live cases require exactly three repetitions");
  const sourceBytes = candidateFile(repoRoot, candidate, candidateCase.source.path);
  invariant(digestBytes(sourceBytes) === candidateCase.source.digest, "candidate case source digest differs from committed bytes");
  const plans = inventory.executionPlan.plannedExecutions.filter((entry: any) => entry.caseId === caseId);
  invariant(plans.length === 3, "candidate case does not have three planned repetitions");
  invariant(new Set(plans.map((entry: any) => entry.repetition)).size === 3, "candidate case repetition plan is not exact");
  invariant(new Set(plans.map((entry: any) => entry.immutableBindings.inputDigest)).size === 1, "candidate case input binding drifts across repetitions");
  return {
    id: candidateCase.id,
    partition: candidateCase.partition,
    class: candidateCase.class,
    subjectId: candidateCase.subjectId,
    prompt: candidateCase.prompt,
    fixture: candidateCase.fixture ?? null,
    assertions: [...candidateCase.assertions],
    source: structuredClone(candidateCase.source),
    inputDigest: plans[0].immutableBindings.inputDigest,
  };
}

function renderPrompt(template: string, candidateCase: CandidateCaseBinding, skill: string): string {
  const values: Record<string, string> = {
    CANDIDATE_SKILL: skill,
    CASE_ID: candidateCase.id,
    SUBJECT_ID: candidateCase.subjectId,
    CASE_CLASS: candidateCase.class,
    CASE_PROMPT: candidateCase.prompt,
    CASE_FIXTURE: canonicalJson(candidateCase.fixture),
    CASE_ASSERTIONS: candidateCase.assertions.join(", "),
  };
  let rendered = template;
  for (const [key, value] of Object.entries(values)) rendered = rendered.replaceAll(`{{${key}}}`, value);
  invariant(!/\{\{[A-Z_]+\}\}/.test(rendered), "prompt template has an unresolved binding");
  return rendered;
}

export function preparePromptfooExecution(input: {
  executionId: string;
  preparedAt: string;
  repoRoot: string;
  ledgerPath: string;
  caseId: string;
  providerCellPath: string;
  maxCostUsd: number;
  environment?: NodeJS.ProcessEnv;
}): PreparedExecution {
  invariant(EXECUTION_ID.test(input.executionId), "execution ID must be lowercase and path-safe");
  invariant(Number.isFinite(input.maxCostUsd) && input.maxCostUsd > 0 && input.maxCostUsd <= 100, "maxCostUsd must be above zero and at most 100");
  const maxCostMicroUsd = exactUsdToMicroUsd(input.maxCostUsd, "maxCostUsd");
  invariant(!Number.isNaN(Date.parse(input.preparedAt)) && new Date(input.preparedAt).toISOString() === input.preparedAt, "preparedAt must be exact UTC");
  const candidate = boundCandidate(input.ledgerPath);
  const productTree = committedLayout(input.repoRoot, candidate.sourceCommit, candidate.sourceTree).tree;
  invariant(productTree === candidate.sourceTree, "selected candidate source tree differs from Git");
  const candidateCase = inventoryCase(input.repoRoot, candidate, input.caseId);
  invariant(input.providerCellPath.startsWith("providers/") && input.providerCellPath.endsWith(".json"), "provider cell must be a candidate-relative providers/*.json path");
  const providerCell = JSON.parse(candidateEvalFile(input.repoRoot, candidate, input.providerCellPath).toString("utf8"));
  validateLiveProviderCell(providerCell);

  const adapterBytes = candidateEvalFile(input.repoRoot, candidate, `adapters/promptfoo-${PROMPTFOO_VERSION}.json`);
  const templateBytes = candidateEvalFile(input.repoRoot, candidate, "templates/candidate-outcome-v1.txt");
  const toolManifestBytes = candidateEvalFile(input.repoRoot, candidate, "manifests/no-tools-v1.json");
  const calibrationBytes = candidateEvalFile(input.repoRoot, candidate, "benchmarks/calibration-v1.json");
  const promptfooPackageManifestBytes = candidateEvalFile(input.repoRoot, candidate, "promptfoo-isolated/package.json");
  const promptfooPackageLockBytes = candidateEvalFile(input.repoRoot, candidate, "promptfoo-isolated/package-lock.json");
  const promptfooIntegrityBytes = candidateEvalFile(input.repoRoot, candidate, "promptfoo-isolated/integrity-v1.json");
  const adapterDigest = digestBytes(adapterBytes);
  const templateDigest = digestBytes(templateBytes);
  const toolManifestDigest = digestBytes(toolManifestBytes);
  const calibrationDigest = digestBytes(calibrationBytes);
  const promptfooIntegrityDigest = digestBytes(promptfooIntegrityBytes);
  invariant(providerCell.adapter.digest === adapterDigest, "provider cell adapter digest differs");
  invariant(providerCell.promptTemplateDigest === templateDigest, "provider cell prompt template digest differs");
  invariant(providerCell.toolManifestDigest === toolManifestDigest, "provider cell tool manifest digest differs");
  invariant(providerCell.calibrationDigest === calibrationDigest, "provider cell calibration digest differs");
  const promptfooInstallation = JSON.parse(promptfooIntegrityBytes.toString("utf8"));
  validatePromptfooIntegrityBinding(promptfooInstallation);
  validatePromptfooLock(promptfooPackageManifestBytes, promptfooPackageLockBytes);
  invariant(promptfooInstallation.packageManifestDigest === digestBytes(promptfooPackageManifestBytes), "Promptfoo install manifest digest differs from candidate bytes");
  invariant(promptfooInstallation.packageLockDigest === digestBytes(promptfooPackageLockBytes), "Promptfoo install lock digest differs from candidate bytes");

  const skillBytes = candidateFile(input.repoRoot, candidate, candidateCase.source.path);
  const prompt = renderPrompt(templateBytes.toString("utf8"), candidateCase, skillBytes.toString("utf8"));
  const promptDigest = digestBytes(prompt);
  const worstCaseRequestCostMicroUsdValue = worstCaseRequestCostMicroUsd(providerCell);
  const authority = { externalActions: "deny", humanVerdict: "pending", release: "none" } as const;
  const limits = {
    repetitions: 3,
    maxConcurrency: 1,
    maxOutputTokens: providerCell.execution.maxOutputTokens,
    maxCostUsd: input.maxCostUsd,
    maxCostMicroUsd,
    worstCaseRequestCostUsd: worstCaseRequestCostMicroUsdValue / 1_000_000,
    worstCaseRequestCostMicroUsd: worstCaseRequestCostMicroUsdValue,
  } as const;
  const harness = {
    version: "1.1.0",
    promptfooVersion: PROMPTFOO_VERSION,
    adapterDigest,
    templateDigest,
    toolManifestDigest,
    calibrationDigest,
    promptfooIntegrityDigest,
    promptfooInstallation,
    promptDigest,
  } as const;
  const schemaVersion = "conquistador.promptfoo-execution-manifest/v1" as const;
  const bindingDigest = digestValue({
    schemaVersion,
    executionId: input.executionId,
    preparedAt: input.preparedAt,
    candidate,
    case: candidateCase,
    providerCell,
    harness,
    limits,
    authority,
  });
  const manifest: PromptfooExecutionManifest = {
    schemaVersion,
    executionId: input.executionId,
    preparedAt: input.preparedAt,
    candidate,
    case: candidateCase,
    providerCell,
    harness,
    limits,
    authority,
    bindingDigest,
  };
  const environment = input.environment ?? process.env;
  const missingCredentials = providerCell.execution.credentialEnvironmentVariables.filter((name) => !environment[name]);
  return { manifest, prompt, missingCredentials };
}

export function verifyManifestBinding(manifest: PromptfooExecutionManifest): void {
  requireSha256(manifest.bindingDigest, "execution manifest bindingDigest");
  const { bindingDigest, ...binding } = manifest;
  invariant(digestValue(binding) === bindingDigest, "execution manifest binding digest differs");
}
