import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { canonicalJson, type Sha256, sha256 } from "./canonical.ts";

export const SELF_HOSTED_SCHEMA_VERSION = "conquistador.self-hosted-conformance/v1";
export const SELF_HOSTED_DECLARATION_VERSION = "exts-155.self-hosted-runtime/v1";
export const SELF_HOSTED_COLLECTOR_VERSION = "self-hosted-collector/v1";
export const SELF_HOSTED_FIXED_CLOCK = "2026-08-22T00:00:00.000Z";

export const SELF_HOSTED_PATHS = {
  declaration: "runtime/conformance/matrix-v1.json",
  schema: "runtime/conformance/schema-v1.json",
  corpus: "runtime/conformance/adversarial-v1.json",
  record: "release/evidence/self-hosted/conformance-v1.json",
  report: "release/evidence/self-hosted/conformance-v1.md",
  externalPacket: "release/evidence/self-hosted/external-execution-packet-v1.json",
} as const;

const TIMING_KEYS = new Set(["startTime", "endTime", "duration"]);

export function normalizedReporter(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedReporter);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    TIMING_KEYS.has(key) ? "[TIMING]" : normalizedReporter(child),
  ]));
}

export function normalizedReporterDigest(report: unknown): Sha256 {
  return sha256(normalizedReporter(report));
}

const EXACT_CELL_IDS = [
  "SH-API-MACOS-ARM64",
  "SH-CANDIDATE-MACOS-ARM64",
  "SH-CLEAN-HOST-LINUX-X64",
  "SH-CLEAN-HOST-MACOS-ARM64",
  "SH-CLI-CONFIG-MACOS-ARM64",
  "SH-HUMAN-AUTH-CANDIDATE",
  "SH-LINUX-X64-RUNTIME",
  "SH-OCI-AMD64",
  "SH-OCI-ARM64",
  "SH-PROVIDER-ANTHROPIC-LIVE",
  "SH-PROVIDER-DECL-MACOS-ARM64",
  "SH-PROVIDER-OPENAI-LIVE",
  "SH-PROVIDER-VERCEL-LIVE",
  "SH-REVIEW-AUTH-MACOS-ARM64",
  "SH-SECURITY-MACOS-ARM64",
  "SH-STATE-MACOS-ARM64",
  "SH-SUPPORT-LINUX-X64",
  "SH-SUPPORT-MACOS-ARM64",
] as const;

export type CellId = typeof EXACT_CELL_IDS[number];
export type ProofClass =
  | "local-runtime"
  | "candidate-bound"
  | "platform"
  | "provider-live"
  | "clean-host"
  | "oci"
  | "human"
  | "customer-support";
export type CellStatus = "passed" | "missing";

export type SourceBinding = { path: string; sha256: Sha256 };
export type CommandRequirement = {
  kind: "command";
  cwd: "runtime";
  argv: string[];
};
export type ReceiptRequirement = {
  kind: "external-receipt";
  receiptClass:
    | "candidate-bound-runtime"
    | "linux-x64-runtime"
    | "provider-live"
    | "oci-image"
    | "clean-host-lifecycle"
    | "authenticated-human-authority"
    | "customer-support";
};

export type CellDeclaration = {
  id: CellId;
  ownerIssue: "EXTS-155";
  platform: "macos" | "linux" | "provider" | "oci" | "support" | "candidate";
  architecture: "arm64" | "x64" | "amd64" | "none";
  profile: string;
  identity: {
    provider: string | null;
    model: string | null;
    apiVersion: string | null;
    image: string | null;
    tag: string | null;
    imageDigest: Sha256 | null;
  };
  proofClass: ProofClass;
  required: CommandRequirement | ReceiptRequirement;
  expectedStatus: CellStatus;
  currentSupportClaim: "local-macos-arm64-only" | "unsupported-pending-exact-evidence";
  missingReason: string | null;
  sources: SourceBinding[];
};

export type SelfHostedDeclaration = {
  declarationVersion: typeof SELF_HOSTED_DECLARATION_VERSION;
  ownerIssue: "EXTS-155";
  fixedClock: typeof SELF_HOSTED_FIXED_CLOCK;
  authority: {
    releaseState: "NO-GO";
    candidateStatus: "UNBOUND";
    selectedCandidate: null;
    g3Status: "INCOMPLETE";
    landing: "disabled";
    exts161Packet: null;
  };
  timingNormalization: readonly ["startTime", "endTime", "duration"];
  cells: CellDeclaration[];
};

export type LocalObservation = {
  cellId: CellId;
  command: CommandRequirement;
  exitCode: number;
  reportDigest: Sha256;
  counts: {
    testSuites: number;
    passedTestSuites: number;
    failedTestSuites: number;
    tests: number;
    passedTests: number;
    failedTests: number;
  };
};

export type ExternalReceipt = {
  cellId: CellId;
  receiptId: string;
  receiptClass: ReceiptRequirement["receiptClass"];
  status: "succeeded";
  startedAt: string;
  finishedAt: string;
  sequence: number;
  replayNonce: string;
  subjectDigest: Sha256;
  evidence: SourceBinding;
};

export type ObservationSet = {
  fixedClock: typeof SELF_HOSTED_FIXED_CLOCK;
  declarationRawDigest: Sha256;
  local: LocalObservation[];
  external: ExternalReceipt[];
};

export type ResolvedFile = {
  path: string;
  sha256: Sha256;
  bytes: Uint8Array;
  kind: "regular" | "special";
  ancestorSymlink: boolean;
};
export type FileResolver = (path: string) => ResolvedFile;

export type ConformanceRow = CellDeclaration & {
  result: {
    status: CellStatus;
    observedAt: string | null;
    command: CommandRequirement | null;
    exitCode: number | null;
    counts: LocalObservation["counts"] | null;
    reportDigest: Sha256 | null;
    observationDigest: Sha256 | null;
    receipt: ExternalReceipt | null;
    missingReason: string | null;
  };
};

export type ConformanceRecord = {
  schemaVersion: typeof SELF_HOSTED_SCHEMA_VERSION;
  declarationVersion: typeof SELF_HOSTED_DECLARATION_VERSION;
  collectorVersion: typeof SELF_HOSTED_COLLECTOR_VERSION;
  generatedAt: typeof SELF_HOSTED_FIXED_CLOCK;
  declarationRawDigest: Sha256;
  authority: SelfHostedDeclaration["authority"];
  host: { platform: "macos"; architecture: "arm64" };
  rows: ConformanceRow[];
  aggregate: {
    total: number;
    passed: number;
    missing: number;
    supported: number;
    byProofClass: Record<ProofClass, { total: number; passed: number; missing: number }>;
    missingReasons: string[];
  };
  overall: "INCOMPLETE";
  digest: Sha256;
};

export class ConformanceError extends Error {
  readonly code: string;
  constructor(code: string, detail: string) {
    super(`[${code}] ${detail}`);
    this.name = "ConformanceError";
    this.code = code;
  }
}

const fail = (code: string, detail: string): never => {
  throw new ConformanceError(code, detail);
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const expectObject = (value: unknown, label: string): Record<string, unknown> =>
  isObject(value) ? value : fail("E_SHAPE", `${label} must be an object`);
const expectArray = (value: unknown, label: string): unknown[] =>
  Array.isArray(value) ? value : fail("E_SHAPE", `${label} must be an array`);
const expectString = (value: unknown, label: string): string =>
  typeof value === "string" ? value : fail("E_SHAPE", `${label} must be a string`);
const expectInteger = (value: unknown, label: string): number =>
  Number.isInteger(value) ? value as number : fail("E_SHAPE", `${label} must be an integer`);
const exactKeys = (record: Record<string, unknown>, keys: readonly string[], label: string): void => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail("E_SHAPE", `${label} keys drifted; expected ${expected.join(",")}`);
  }
};
const canonicalId = (id: string): string => id.normalize("NFKC").toLocaleLowerCase("en-US");
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const FLOATING = /(?:^|[-/:._])(?:latest|default|auto|current|stable|main|master)(?:$|[-/:._])|[*?]/i;
const SECRET_KEY = /(?:authorization|api[-_]?key|token|password|secret|cookie|credential)/i;

export function assertNoSecretLikeKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretLikeKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) fail("E_SECRET_KEY", `${path}.${key} is forbidden at every JSON value type`);
    assertNoSecretLikeKeys(child, `${path}.${key}`);
  }
}

function sourceBinding(value: unknown, label: string, resolver: FileResolver): SourceBinding {
  const record = expectObject(value, label);
  exactKeys(record, ["path", "sha256"], label);
  const path = expectString(record.path, `${label}.path`);
  const digest = expectString(record.sha256, `${label}.sha256`);
  if (isAbsolute(path)) fail("E_PATH_ABSOLUTE", `${label} must be relative`);
  if (path.split(/[\\/]/).some((part) => part === ".." || part === "." || part === "")) {
    fail("E_PATH_TRAVERSAL", `${label} contains traversal or an empty component`);
  }
  const resolved = resolver(path);
  if (resolved.ancestorSymlink) fail("E_PATH_SYMLINK", `${label} has a symlink ancestor`);
  if (resolved.kind !== "regular") fail("E_PATH_SPECIAL", `${label} is not a regular file`);
  if (!SHA256.test(digest)) fail("E_DIGEST_FORMAT", `${label}.sha256 is malformed`);
  if (resolved.sha256 !== digest) fail("E_DIGEST_STALE", `${label} digest is stale`);
  return { path, sha256: digest as Sha256 };
}

function command(value: unknown, label: string): CommandRequirement {
  const record = expectObject(value, label);
  exactKeys(record, ["kind", "cwd", "argv"], label);
  if (record.kind !== "command" || record.cwd !== "runtime") fail("E_COMMAND", `${label} command boundary drifted`);
  const argv = expectArray(record.argv, `${label}.argv`).map((entry, index) => expectString(entry, `${label}.argv[${index}]`));
  if (argv.length < 2 || argv.some((part) => part.length === 0)) fail("E_COMMAND", `${label} command must be explicit`);
  return { kind: "command", cwd: "runtime", argv };
}

function receiptRequirement(value: unknown, label: string): ReceiptRequirement {
  const record = expectObject(value, label);
  exactKeys(record, ["kind", "receiptClass"], label);
  const classes: ReceiptRequirement["receiptClass"][] = [
    "candidate-bound-runtime", "linux-x64-runtime", "provider-live", "oci-image",
    "clean-host-lifecycle", "authenticated-human-authority", "customer-support",
  ];
  if (record.kind !== "external-receipt" || !classes.includes(record.receiptClass as ReceiptRequirement["receiptClass"])) {
    fail("E_RECEIPT_CLASS", `${label} receipt class is not closed`);
  }
  return { kind: "external-receipt", receiptClass: record.receiptClass as ReceiptRequirement["receiptClass"] };
}

type CellLock = Pick<CellDeclaration, "platform" | "architecture" | "profile" | "proofClass" | "expectedStatus" | "currentSupportClaim"> & {
  provider: string | null;
  model: string | null;
  apiVersion: string | null;
  image: string | null;
  tag: string | null;
  receiptClass?: ReceiptRequirement["receiptClass"];
  command?: readonly string[];
};

const VITEST = "node_modules/.bin/vitest";
const CELL_LOCKS: Record<CellId, CellLock> = {
  "SH-CLI-CONFIG-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "cli-config-schema", proofClass: "local-runtime", expectedStatus: "passed", currentSupportClaim: "local-macos-arm64-only", provider: null, model: null, apiVersion: null, image: null, tag: null, command: [VITEST, "run", "tests/cli.test.ts", "tests/config.test.ts", "tests/protocol.test.ts", "--reporter=json"] },
  "SH-API-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "session-message-event-cancel-review-api", proofClass: "local-runtime", expectedStatus: "passed", currentSupportClaim: "local-macos-arm64-only", provider: null, model: null, apiVersion: null, image: null, tag: null, command: [VITEST, "run", "tests/api.test.ts", "tests/http.test.ts", "tests/main.test.ts", "--reporter=json"] },
  "SH-REVIEW-AUTH-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "authenticated-review-consequential-authority", proofClass: "local-runtime", expectedStatus: "passed", currentSupportClaim: "local-macos-arm64-only", provider: null, model: null, apiVersion: null, image: null, tag: null, command: [VITEST, "run", "tests/review-contract.test.ts", "tests/oidc.test.ts", "tests/runner.test.ts", "--reporter=json"] },
  "SH-STATE-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "state-backup-verify-restore-migrate-export-erase-retain-restart-resume", proofClass: "local-runtime", expectedStatus: "passed", currentSupportClaim: "local-macos-arm64-only", provider: null, model: null, apiVersion: null, image: null, tag: null, command: [VITEST, "run", "tests/local-state.test.ts", "tests/lifecycle-cli.test.ts", "tests/runner.test.ts", "--reporter=json"] },
  "SH-SECURITY-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "limits-redaction-secret-isolation-containment-replay-crash-receipts", proofClass: "local-runtime", expectedStatus: "passed", currentSupportClaim: "local-macos-arm64-only", provider: null, model: null, apiVersion: null, image: null, tag: null, command: [VITEST, "run", "tests/local-state.test.ts", "tests/review-contract.test.ts", "tests/publication.test.ts", "tests/provenance.test.ts", "tests/runtime.test.ts", "--reporter=json"] },
  "SH-PROVIDER-DECL-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "provider-model-api-declarations-fixture-only", proofClass: "local-runtime", expectedStatus: "passed", currentSupportClaim: "local-macos-arm64-only", provider: "declared-provider-catalog", model: "provider-cells-v1.0.0", apiVersion: "provider-matrix-2026-08-11", image: null, tag: null, command: [VITEST, "run", "tests/provider.test.ts", "--reporter=json"] },
  "SH-CANDIDATE-MACOS-ARM64": { platform: "candidate", architecture: "arm64", profile: "candidate-bound-runtime", proofClass: "candidate-bound", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "candidate-bound-runtime" },
  "SH-LINUX-X64-RUNTIME": { platform: "linux", architecture: "x64", profile: "full-runtime", proofClass: "platform", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "linux-x64-runtime" },
  "SH-CLEAN-HOST-MACOS-ARM64": { platform: "macos", architecture: "arm64", profile: "clean-host-install-lifecycle", proofClass: "clean-host", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "clean-host-lifecycle" },
  "SH-CLEAN-HOST-LINUX-X64": { platform: "linux", architecture: "x64", profile: "clean-host-install-lifecycle", proofClass: "clean-host", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "clean-host-lifecycle" },
  "SH-PROVIDER-ANTHROPIC-LIVE": { platform: "provider", architecture: "none", profile: "provider-live", proofClass: "provider-live", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: "anthropic", model: "claude-sonnet-4-20250514", apiVersion: "2023-06-01", image: null, tag: null, receiptClass: "provider-live" },
  "SH-PROVIDER-OPENAI-LIVE": { platform: "provider", architecture: "none", profile: "provider-live", proofClass: "provider-live", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: "openai", model: "gpt-5-2025-08-07", apiVersion: "responses-2025-08-07", image: null, tag: null, receiptClass: "provider-live" },
  "SH-PROVIDER-VERCEL-LIVE": { platform: "provider", architecture: "none", profile: "provider-live", proofClass: "provider-live", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: "vercel-ai-gateway", model: "openai/gpt-5-2025-08-07", apiVersion: "responses-compatible-2025-08-07", image: null, tag: null, receiptClass: "provider-live" },
  "SH-OCI-AMD64": { platform: "oci", architecture: "amd64", profile: "immutable-image", proofClass: "oci", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: "ghcr.io/forsvn-labs/conquistador", tag: "1.0.0-amd64", receiptClass: "oci-image" },
  "SH-OCI-ARM64": { platform: "oci", architecture: "arm64", profile: "immutable-image", proofClass: "oci", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: "ghcr.io/forsvn-labs/conquistador", tag: "1.0.0-arm64", receiptClass: "oci-image" },
  "SH-HUMAN-AUTH-CANDIDATE": { platform: "candidate", architecture: "none", profile: "authenticated-human-review-and-action", proofClass: "human", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "authenticated-human-authority" },
  "SH-SUPPORT-MACOS-ARM64": { platform: "support", architecture: "arm64", profile: "customer-support-posture", proofClass: "customer-support", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "customer-support" },
  "SH-SUPPORT-LINUX-X64": { platform: "support", architecture: "x64", profile: "customer-support-posture", proofClass: "customer-support", expectedStatus: "missing", currentSupportClaim: "unsupported-pending-exact-evidence", provider: null, model: null, apiVersion: null, image: null, tag: null, receiptClass: "customer-support" },
};

function assertIdentityExact(identity: CellDeclaration["identity"], lock: CellLock, id: CellId): void {
  const pairs = [["provider", identity.provider, lock.provider, "E_PROVIDER"], ["model", identity.model, lock.model, "E_MODEL"], ["apiVersion", identity.apiVersion, lock.apiVersion, "E_API_VERSION"], ["image", identity.image, lock.image, "E_IMAGE"], ["tag", identity.tag, lock.tag, "E_IMAGE_TAG"]] as const;
  for (const [label, actual, expected, code] of pairs) {
    if (actual !== null && FLOATING.test(actual)) fail(`E_FLOATING_${label.toUpperCase()}`, `${id} ${label} is floating`);
    if (actual !== expected) fail(code, `${id} ${label} drifted`);
  }
  if (identity.imageDigest !== null) fail("E_IMAGE_DIGEST_CLAIM", `${id} cannot claim an image digest without evidence`);
}

export function validateDeclaration(input: unknown, resolver: FileResolver): SelfHostedDeclaration {
  assertNoSecretLikeKeys(input);
  const root = expectObject(input, "declaration");
  exactKeys(root, ["declarationVersion", "ownerIssue", "fixedClock", "authority", "timingNormalization", "cells"], "declaration");
  if (root.declarationVersion !== SELF_HOSTED_DECLARATION_VERSION) fail("E_VERSION", "declaration version drifted");
  if (root.ownerIssue !== "EXTS-155") fail("E_OWNER", "declaration owner must be EXTS-155");
  if (root.fixedClock !== SELF_HOSTED_FIXED_CLOCK) fail("E_CLOCK", "fixed clock drifted");
  const authority = expectObject(root.authority, "authority");
  exactKeys(authority, ["releaseState", "candidateStatus", "selectedCandidate", "g3Status", "landing", "exts161Packet"], "authority");
  if (authority.releaseState !== "NO-GO") fail("E_RELEASE_STATE", "release must remain NO-GO");
  if (authority.candidateStatus !== "UNBOUND" || authority.selectedCandidate !== null) fail("E_CANDIDATE", "candidate must remain UNBOUND/null");
  if (authority.g3Status !== "INCOMPLETE") fail("E_G3", "G3 must remain INCOMPLETE");
  if (authority.landing !== "disabled") fail("E_LANDING", "landing must remain disabled");
  if (authority.exts161Packet !== null) fail("E_EXTS161", "no EXTS-161 packet exists");
  const timing = expectArray(root.timingNormalization, "timingNormalization");
  if (canonicalJson(timing) !== canonicalJson(["startTime", "endTime", "duration"])) fail("E_TIMING_NORMALIZATION", "timing normalization keys drifted");
  const rawCells = expectArray(root.cells, "cells");
  const seen = new Set<string>();
  const cells: CellDeclaration[] = rawCells.map((entry, index) => {
    const label = `cells[${index}]`;
    const cell = expectObject(entry, label);
    exactKeys(cell, ["id", "ownerIssue", "platform", "architecture", "profile", "identity", "proofClass", "required", "expectedStatus", "currentSupportClaim", "missingReason", "sources"], label);
    const id = expectString(cell.id, `${label}.id`) as CellId;
    if (id !== id.normalize("NFKC")) fail("E_ID_NFKC", `${id} is not NFKC`);
    const folded = canonicalId(id);
    if (seen.has(folded)) fail("E_DUPLICATE_CELL", `${id} collides after NFKC/case-folding`);
    seen.add(folded);
    if (!EXACT_CELL_IDS.includes(id)) fail("E_CELL_SET", `${id} is not a frozen cell`);
    const lock = CELL_LOCKS[id];
    if (cell.ownerIssue !== "EXTS-155") fail("E_OWNER", `${id} owner drifted`);
    if (cell.platform !== lock.platform) fail("E_PLATFORM", `${id} platform drifted`);
    if (cell.architecture !== lock.architecture) fail("E_ARCHITECTURE", `${id} architecture drifted`);
    if (cell.profile !== lock.profile) fail("E_PROFILE", `${id} profile drifted`);
    if (cell.proofClass !== lock.proofClass) fail("E_PROOF_CLASS", `${id} proof class drifted`);
    if (cell.expectedStatus !== lock.expectedStatus) fail("E_EXPECTED_STATUS", `${id} expected status drifted`);
    if (cell.currentSupportClaim !== lock.currentSupportClaim) fail("E_SUPPORT_CLAIM", `${id} support claim drifted`);
    const identityRecord = expectObject(cell.identity, `${label}.identity`);
    exactKeys(identityRecord, ["provider", "model", "apiVersion", "image", "tag", "imageDigest"], `${label}.identity`);
    for (const key of ["provider", "model", "apiVersion", "image", "tag"] as const) {
      if (identityRecord[key] !== null && typeof identityRecord[key] !== "string") fail("E_SHAPE", `${label}.identity.${key} must be string|null`);
    }
    if (identityRecord.imageDigest !== null && (typeof identityRecord.imageDigest !== "string" || !SHA256.test(identityRecord.imageDigest))) fail("E_DIGEST_FORMAT", `${label}.identity.imageDigest invalid`);
    const identity = identityRecord as CellDeclaration["identity"];
    assertIdentityExact(identity, lock, id);
    const required = lock.command ? command(cell.required, `${label}.required`) : receiptRequirement(cell.required, `${label}.required`);
    if (lock.command && canonicalJson((required as CommandRequirement).argv) !== canonicalJson(lock.command)) fail("E_COMMAND", `${id} expected command drifted`);
    if (!lock.command && required.kind === "external-receipt" && required.receiptClass !== lock.receiptClass) fail("E_RECEIPT_CLASS", `${id} receipt class drifted`);
    if (lock.expectedStatus === "passed" && cell.missingReason !== null) fail("E_MISSING_REASON", `${id} passed declaration has a missing reason`);
    if (lock.expectedStatus === "missing" && (typeof cell.missingReason !== "string" || !cell.missingReason.trim())) fail("E_MISSING_REASON", `${id} missing declaration requires an exact reason`);
    const sources = expectArray(cell.sources, `${label}.sources`).map((source, sourceIndex) => sourceBinding(source, `${label}.sources[${sourceIndex}]`, resolver));
    if (sources.length === 0) fail("E_SOURCE_EMPTY", `${id} requires at least one bound source`);
    const sourceKeys = sources.map((source) => canonicalId(source.path));
    if (new Set(sourceKeys).size !== sourceKeys.length) fail("E_DUPLICATE_SOURCE", `${id} repeats a source after NFKC/case-folding`);
    if (required.kind === "command") {
      const commandedTestPaths = required.argv
        .filter((argument) => argument.startsWith("tests/") && argument.endsWith(".test.ts"))
        .map((argument) => canonicalId(`runtime/${argument}`));
      for (const commandedPath of commandedTestPaths) {
        if (!sourceKeys.includes(commandedPath)) fail("E_SOURCE_COVERAGE", `${id} does not bind every commanded test file`);
      }
    }
    return { id, ownerIssue: "EXTS-155", platform: lock.platform, architecture: lock.architecture, profile: lock.profile, identity, proofClass: lock.proofClass, required, expectedStatus: lock.expectedStatus, currentSupportClaim: lock.currentSupportClaim, missingReason: cell.missingReason as string | null, sources };
  });
  const actualSet = [...seen].sort();
  const expectedSet = EXACT_CELL_IDS.map(canonicalId).sort();
  if (canonicalJson(actualSet) !== canonicalJson(expectedSet)) fail("E_CELL_SET", "cell set is missing, extra, renamed, or duplicated");
  const ociAmd64 = cells.find((cell) => cell.id === "SH-OCI-AMD64")!;
  const ociArm64 = cells.find((cell) => cell.id === "SH-OCI-ARM64")!;
  if (ociAmd64.architecture === ociArm64.architecture) fail("E_OCI_ARCH_ALIAS", "OCI cells cannot claim one architecture twice");
  return {
    declarationVersion: SELF_HOSTED_DECLARATION_VERSION,
    ownerIssue: "EXTS-155",
    fixedClock: SELF_HOSTED_FIXED_CLOCK,
    authority: authority as SelfHostedDeclaration["authority"],
    timingNormalization: ["startTime", "endTime", "duration"],
    cells,
  };
}

function counts(input: unknown, label: string): LocalObservation["counts"] {
  const record = expectObject(input, label);
  const keys = ["testSuites", "passedTestSuites", "failedTestSuites", "tests", "passedTests", "failedTests"] as const;
  exactKeys(record, keys, label);
  const result = Object.fromEntries(keys.map((key) => [key, expectInteger(record[key], `${label}.${key}`)])) as LocalObservation["counts"];
  if (Object.values(result).some((value) => value < 0)) fail("E_OBSERVATION_COUNTS", `${label} counts must be nonnegative`);
  if (result.passedTestSuites + result.failedTestSuites !== result.testSuites || result.passedTests + result.failedTests !== result.tests) fail("E_OBSERVATION_COUNTS", `${label} totals drifted`);
  return result;
}

function externalReceipt(input: unknown, label: string, resolver: FileResolver): ExternalReceipt {
  const record = expectObject(input, label);
  exactKeys(record, ["cellId", "receiptId", "receiptClass", "status", "startedAt", "finishedAt", "sequence", "replayNonce", "subjectDigest", "evidence"], label);
  const cellId = expectString(record.cellId, `${label}.cellId`) as CellId;
  const receiptId = expectString(record.receiptId, `${label}.receiptId`);
  const receiptClass = expectString(record.receiptClass, `${label}.receiptClass`) as ReceiptRequirement["receiptClass"];
  if (record.status !== "succeeded") fail("E_RECEIPT_STATUS", `${label} must be terminal succeeded evidence`);
  const startedAt = expectString(record.startedAt, `${label}.startedAt`);
  const finishedAt = expectString(record.finishedAt, `${label}.finishedAt`);
  if (!Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(finishedAt))) fail("E_TIMESTAMP", `${label} timestamp is invalid`);
  if (Date.parse(startedAt) > Date.parse(finishedAt)) fail("E_TIMESTAMP_ORDER", `${label} timestamps are reversed`);
  const sequence = expectInteger(record.sequence, `${label}.sequence`);
  if (sequence < 1) fail("E_RECEIPT_ORDER", `${label} sequence must start at one`);
  const replayNonce = expectString(record.replayNonce, `${label}.replayNonce`);
  if (!/^[a-f0-9]{32}$/.test(replayNonce)) fail("E_REPLAY", `${label} replay nonce is not exact`);
  const subjectDigest = expectString(record.subjectDigest, `${label}.subjectDigest`);
  if (!SHA256.test(subjectDigest)) fail("E_DIGEST_FORMAT", `${label}.subjectDigest is malformed`);
  return { cellId, receiptId, receiptClass, status: "succeeded", startedAt, finishedAt, sequence, replayNonce, subjectDigest: subjectDigest as Sha256, evidence: sourceBinding(record.evidence, `${label}.evidence`, resolver) };
}

function aggregate(rows: ConformanceRow[]): ConformanceRecord["aggregate"] {
  const proofClasses: ProofClass[] = ["local-runtime", "candidate-bound", "platform", "provider-live", "clean-host", "oci", "human", "customer-support"];
  const byProofClass = Object.fromEntries(proofClasses.map((proofClass) => {
    const subset = rows.filter((row) => row.proofClass === proofClass);
    return [proofClass, { total: subset.length, passed: subset.filter((row) => row.result.status === "passed").length, missing: subset.filter((row) => row.result.status === "missing").length }];
  })) as ConformanceRecord["aggregate"]["byProofClass"];
  const passed = rows.filter((row) => row.result.status === "passed").length;
  const missingReasons = rows.filter((row) => row.result.status === "missing").map((row) => `${row.id}: ${row.result.missingReason}`).sort();
  return { total: rows.length, passed, missing: rows.length - passed, supported: 0, byProofClass, missingReasons };
}

export function collectConformance(declarationInput: unknown, observationInput: unknown, resolver: FileResolver): ConformanceRecord {
  assertNoSecretLikeKeys(observationInput);
  const declaration = validateDeclaration(declarationInput, resolver);
  const observation = expectObject(observationInput, "observationSet");
  exactKeys(observation, ["fixedClock", "declarationRawDigest", "local", "external"], "observationSet");
  if (observation.fixedClock !== SELF_HOSTED_FIXED_CLOCK) fail("E_CLOCK", "observation fixed clock drifted");
  const declarationRawDigest = expectString(observation.declarationRawDigest, "observationSet.declarationRawDigest");
  if (!SHA256.test(declarationRawDigest)) fail("E_DIGEST_FORMAT", "declaration digest malformed");
  sourceBinding(
    { path: SELF_HOSTED_PATHS.declaration, sha256: declarationRawDigest },
    "observationSet.declaration",
    resolver,
  );
  const local = expectArray(observation.local, "observationSet.local").map((entry, index): LocalObservation => {
    const record = expectObject(entry, `local[${index}]`);
    exactKeys(record, ["cellId", "command", "exitCode", "reportDigest", "counts"], `local[${index}]`);
    const reportDigest = expectString(record.reportDigest, `local[${index}].reportDigest`);
    if (!SHA256.test(reportDigest)) fail("E_DIGEST_FORMAT", `local[${index}].reportDigest is malformed`);
    return { cellId: expectString(record.cellId, `local[${index}].cellId`) as CellId, command: command(record.command, `local[${index}].command`), exitCode: expectInteger(record.exitCode, `local[${index}].exitCode`), reportDigest: reportDigest as Sha256, counts: counts(record.counts, `local[${index}].counts`) };
  });
  const external = expectArray(observation.external, "observationSet.external").map((entry, index) => externalReceipt(entry, `external[${index}]`, resolver));
  const allObservationIds = [...local.map((entry) => canonicalId(entry.cellId)), ...external.map((entry) => canonicalId(entry.cellId))];
  if (new Set(allObservationIds).size !== allObservationIds.length) fail("E_DUPLICATE_EVIDENCE", "evidence cells collide");
  const replay = new Set<string>();
  for (const receipt of external) {
    if (replay.has(receipt.replayNonce)) fail("E_REPLAY", `replay nonce reused by ${receipt.cellId}`);
    replay.add(receipt.replayNonce);
  }
  if (external.length > 0 && declaration.authority.selectedCandidate === null) fail("E_CANDIDATE", "external evidence cannot promote an unbound candidate");
  const rows = declaration.cells.map((cell): ConformanceRow => {
    const localEvidence = local.find((entry) => canonicalId(entry.cellId) === canonicalId(cell.id));
    const receipt = external.find((entry) => canonicalId(entry.cellId) === canonicalId(cell.id));
    if (cell.proofClass === "local-runtime") {
      if (!localEvidence) throw new ConformanceError("E_LOCAL_EVIDENCE_MISSING", `${cell.id} local command was not captured`);
      const evidence = localEvidence;
      if (evidence.command.cwd !== "runtime" || canonicalJson(evidence.command.argv) !== canonicalJson((cell.required as CommandRequirement).argv)) fail("E_COMMAND", `${cell.id} captured a different command`);
      if (evidence.exitCode !== 0 || evidence.counts.failedTests !== 0 || evidence.counts.failedTestSuites !== 0) fail("E_COMMAND_FAILED", `${cell.id} command did not pass`);
      return { ...cell, result: { status: "passed", observedAt: SELF_HOSTED_FIXED_CLOCK, command: evidence.command, exitCode: 0, counts: evidence.counts, reportDigest: evidence.reportDigest, observationDigest: sha256(evidence), receipt: null, missingReason: null } };
    }
    if (localEvidence) fail("E_PROOF_SUBSTITUTION", `${cell.id} cannot use local macOS proof for ${cell.proofClass}`);
    if (receipt) fail("E_CANDIDATE", `${cell.id} receipt cannot be admitted while candidate is null`);
    return { ...cell, result: { status: "missing", observedAt: null, command: null, exitCode: null, counts: null, reportDigest: null, observationDigest: null, receipt: null, missingReason: cell.missingReason } };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const extras = local.filter((entry) => !declaration.cells.some((cell) => canonicalId(cell.id) === canonicalId(entry.cellId)));
  if (extras.length) fail("E_CELL_SET", `observation includes unknown cell ${extras[0].cellId}`);
  const basis = {
    schemaVersion: SELF_HOSTED_SCHEMA_VERSION as typeof SELF_HOSTED_SCHEMA_VERSION,
    declarationVersion: SELF_HOSTED_DECLARATION_VERSION as typeof SELF_HOSTED_DECLARATION_VERSION,
    collectorVersion: SELF_HOSTED_COLLECTOR_VERSION as typeof SELF_HOSTED_COLLECTOR_VERSION,
    generatedAt: SELF_HOSTED_FIXED_CLOCK as typeof SELF_HOSTED_FIXED_CLOCK,
    declarationRawDigest: declarationRawDigest as Sha256,
    authority: declaration.authority,
    host: { platform: "macos" as const, architecture: "arm64" as const },
    rows,
    aggregate: aggregate(rows),
    overall: "INCOMPLETE" as const,
  };
  return { ...basis, digest: sha256(basis) };
}

export function validateRecord(input: unknown, resolver: FileResolver): ConformanceRecord {
  assertNoSecretLikeKeys(input);
  const record = expectObject(input, "record");
  exactKeys(record, ["schemaVersion", "declarationVersion", "collectorVersion", "generatedAt", "declarationRawDigest", "authority", "host", "rows", "aggregate", "overall", "digest"], "record");
  if (record.schemaVersion !== SELF_HOSTED_SCHEMA_VERSION || record.declarationVersion !== SELF_HOSTED_DECLARATION_VERSION || record.collectorVersion !== SELF_HOSTED_COLLECTOR_VERSION) fail("E_VERSION", "record versions drifted");
  if (record.generatedAt !== SELF_HOSTED_FIXED_CLOCK) fail("E_CLOCK", "record clock drifted");
  const declarationRawDigest = expectString(record.declarationRawDigest, "record.declarationRawDigest");
  if (!SHA256.test(declarationRawDigest)) fail("E_DIGEST_FORMAT", "record declaration digest malformed");
  sourceBinding(
    { path: SELF_HOSTED_PATHS.declaration, sha256: declarationRawDigest },
    "record.declaration",
    resolver,
  );
  const authority = expectObject(record.authority, "record.authority");
  exactKeys(authority, ["releaseState", "candidateStatus", "selectedCandidate", "g3Status", "landing", "exts161Packet"], "record.authority");
  if (authority.releaseState !== "NO-GO") fail("E_RELEASE_STATE", "record release claimed GO");
  if (authority.candidateStatus !== "UNBOUND" || authority.selectedCandidate !== null) fail("E_CANDIDATE", "record candidate is not UNBOUND/null");
  if (authority.g3Status !== "INCOMPLETE") fail("E_G3", "record G3 claimed pass");
  if (authority.landing !== "disabled") fail("E_LANDING", "record landing is enabled");
  if (authority.exts161Packet !== null) fail("E_EXTS161", "record invented an EXTS-161 packet");
  const host = expectObject(record.host, "record.host");
  exactKeys(host, ["platform", "architecture"], "record.host");
  if (host.platform !== "macos" || host.architecture !== "arm64") fail("E_HOST", "record host drifted");
  const rows = expectArray(record.rows, "record.rows") as unknown as ConformanceRow[];
  if (rows.length !== EXACT_CELL_IDS.length) fail("E_CELL_SET", "record row set size drifted");
  validateDeclaration({
    declarationVersion: SELF_HOSTED_DECLARATION_VERSION,
    ownerIssue: "EXTS-155",
    fixedClock: SELF_HOSTED_FIXED_CLOCK,
    authority,
    timingNormalization: ["startTime", "endTime", "duration"],
    cells: (record.rows as Record<string, unknown>[]).map(({ result: _result, ...cell }) => cell),
  }, resolver);
  const seen = new Set<string>();
  for (const [index, rowValue] of (record.rows as unknown[]).entries()) {
    const row = expectObject(rowValue, `record.rows[${index}]`);
    exactKeys(row, ["id", "ownerIssue", "platform", "architecture", "profile", "identity", "proofClass", "required", "expectedStatus", "currentSupportClaim", "missingReason", "sources", "result"], `record.rows[${index}]`);
    const id = expectString(row.id, `record.rows[${index}].id`) as CellId;
    if (!EXACT_CELL_IDS.includes(id)) fail("E_CELL_SET", `${id} is not frozen`);
    const folded = canonicalId(id);
    if (seen.has(folded)) fail("E_DUPLICATE_CELL", `${id} duplicated`);
    seen.add(folded);
    const lock = CELL_LOCKS[id];
    if (row.ownerIssue !== "EXTS-155") fail("E_OWNER", `${id} owner drifted`);
    if (row.platform !== lock.platform) fail("E_PLATFORM", `${id} platform drifted`);
    if (row.architecture !== lock.architecture) fail("E_ARCHITECTURE", `${id} architecture drifted`);
    if (row.profile !== lock.profile) fail("E_PROFILE", `${id} profile drifted`);
    if (row.proofClass !== lock.proofClass) fail("E_PROOF_CLASS", `${id} proof class drifted`);
    const result = expectObject(row.result, `${id}.result`);
    exactKeys(result, ["status", "observedAt", "command", "exitCode", "counts", "reportDigest", "observationDigest", "receipt", "missingReason"], `${id}.result`);
    if (lock.proofClass === "local-runtime") {
      if (result.status !== "passed" || result.observedAt !== SELF_HOSTED_FIXED_CLOCK || result.exitCode !== 0 || result.receipt !== null || result.missingReason !== null) fail("E_LOCAL_RESULT", `${id} local result drifted`);
      const resultCommand = command(result.command, `${id}.result.command`);
      if (canonicalJson(resultCommand) !== canonicalJson(row.required)) fail("E_COMMAND", `${id} result command drifted`);
      const resultCounts = counts(result.counts, `${id}.result.counts`);
      if (resultCounts.testSuites < 1 || resultCounts.tests < 1 || resultCounts.failedTestSuites !== 0 || resultCounts.failedTests !== 0) fail("E_COMMAND_FAILED", `${id} result does not prove a passing test execution`);
      const reportDigest = expectString(result.reportDigest, `${id}.result.reportDigest`);
      const observationDigest = expectString(result.observationDigest, `${id}.result.observationDigest`);
      if (!SHA256.test(reportDigest) || !SHA256.test(observationDigest)) fail("E_DIGEST_FORMAT", `${id} result digest is malformed`);
      const evidence: LocalObservation = {
        cellId: id,
        command: resultCommand,
        exitCode: 0,
        reportDigest: reportDigest as Sha256,
        counts: resultCounts,
      };
      if (sha256(evidence) !== observationDigest) fail("E_OBSERVATION_DIGEST", `${id} observation digest is stale`);
      if (row.currentSupportClaim !== "local-macos-arm64-only") fail("E_SUPPORT_CLAIM", `${id} local support wording drifted`);
    } else {
      if (result.status !== "missing" || result.observedAt !== null || result.command !== null || result.exitCode !== null || result.counts !== null || result.reportDigest !== null || result.observationDigest !== null || result.receipt !== null || typeof result.missingReason !== "string") fail("E_INCOMPLETE_ROW", `${id} incomplete row claimed evidence`);
      if (row.currentSupportClaim !== "unsupported-pending-exact-evidence") fail("E_SUPPORT_CLAIM", `${id} incomplete row claimed support`);
    }
  }
  if (canonicalJson([...seen].sort()) !== canonicalJson(EXACT_CELL_IDS.map(canonicalId).sort())) fail("E_CELL_SET", "record cell set drifted");
  const actualAggregate = expectObject(record.aggregate, "record.aggregate");
  const recomputed = aggregate(rows);
  if (canonicalJson(actualAggregate) !== canonicalJson(recomputed)) fail("E_AGGREGATE", "record aggregate is not derived from rows");
  if (recomputed.supported !== 0) fail("E_SUPPORT_CLAIM", "runtime tests cannot become customer support evidence");
  if (record.overall !== "INCOMPLETE") fail("E_OVERALL", "overall must remain INCOMPLETE");
  const digest = expectString(record.digest, "record.digest");
  if (!SHA256.test(digest)) fail("E_DIGEST_FORMAT", "record digest malformed");
  const { digest: _discard, ...basis } = record;
  if (sha256(basis) !== digest) fail("E_RECORD_DIGEST", "record digest is stale");
  return record as unknown as ConformanceRecord;
}

export function fileSystemResolver(productRoot: string): FileResolver {
  const rootReal = realpathSync(productRoot);
  return (path: string): ResolvedFile => {
    if (isAbsolute(path)) fail("E_PATH_ABSOLUTE", `${path} is absolute`);
    const parts = path.split(/[\\/]/);
    if (parts.some((part) => part === ".." || part === "." || part === "")) fail("E_PATH_TRAVERSAL", `${path} traverses`);
    let cursor = rootReal;
    let ancestorSymlink = false;
    for (const part of parts) {
      cursor = resolve(cursor, part);
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) ancestorSymlink = true;
    }
    const rel = relative(rootReal, cursor);
    if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) fail("E_PATH_TRAVERSAL", `${path} escaped root`);
    const stat = lstatSync(cursor);
    const bytes = stat.isFile() && !stat.isSymbolicLink() ? readFileSync(cursor) : new Uint8Array();
    return { path, sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, bytes, kind: stat.isFile() && !stat.isSymbolicLink() ? "regular" : "special", ancestorSymlink };
  };
}

export function renderConformanceReport(record: ConformanceRecord): string {
  const rows = record.rows.map((row) => `| ${row.id} | ${row.platform}/${row.architecture} | ${row.profile} | ${row.proofClass} | ${row.result.status.toUpperCase()} | ${row.result.missingReason ?? "local command passed"} |`).join("\n");
  const missing = record.aggregate.missingReasons.map((reason) => `- ${reason}`).join("\n");
  return `# Self-hosted runtime conformance authority v1\n\nGenerated at fixed clock: \`${record.generatedAt}\`\n\nRelease **NO-GO** · candidate **UNBOUND** (\`selectedCandidate: null\`) · G3 **INCOMPLETE** · landing **disabled**.\n\n## Matrix\n\n| Cell | Target | Profile | Proof class | Result | Evidence / exact gap |\n|---|---|---|---|---|---|\n${rows}\n\nTotals: ${record.aggregate.total} cells · ${record.aggregate.passed} passed local macOS arm64 · ${record.aggregate.missing} missing · ${record.aggregate.supported} supported.\n\n## Missing external evidence\n\n${missing}\n\nLocal structural/runtime proof is local proof only. It is not candidate-bound, Linux x64, provider-live, clean-host, OCI, authenticated-human, or customer-support proof. No EXTS-161 packet exists.\n\nRecord digest: \`${record.digest}\`\n`;
}

export function renderExternalPacket(record: ConformanceRecord): string {
  const rows = record.rows.filter((row) => row.result.status === "missing").map((row) => ({ cellId: row.id, ownerIssue: row.ownerIssue, platform: row.platform, architecture: row.architecture, profile: row.profile, identity: row.identity, requiredReceiptClass: (row.required as ReceiptRequirement).receiptClass, currentStatus: "missing", authorityRequired: row.proofClass === "provider-live" ? "The operator must separately authorize credentialed provider execution and spend." : row.proofClass === "oci" ? "The operator must separately authorize image build, registry publication, and immutable digest capture." : row.proofClass === "human" ? "The operator must supply authenticated human review and consequential-action authority receipts." : "The operator must separately authorize the named external or clean-host execution." }));
  return `${canonicalJson({ schemaVersion: "conquistador.self-hosted-external-packet/v1", generatedAt: SELF_HOSTED_FIXED_CLOCK, releaseState: "NO-GO", candidateStatus: "UNBOUND", selectedCandidate: null, g3Status: "INCOMPLETE", landing: "disabled", credentialsIncluded: false, externalActionsPerformed: false, cells: rows })}\n`;
}
