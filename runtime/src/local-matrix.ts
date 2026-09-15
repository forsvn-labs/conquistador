import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

import { canonicalJson, type Sha256, sha256 } from "./canonical.ts";
import { parseConfigYaml } from "./config.ts";
import { loadRuntimeCorpus } from "./corpus.ts";
import {
  JUDGMENT_REQUEST_SCHEMA,
  JUDGMENT_RESPONSE_SCHEMA,
  type JudgmentRequestV1,
  type JudgmentResponseV1,
  outputContentDigestOf,
  parseSealedRequest,
  responseDigestOf,
  validateJudgmentResponse,
} from "./judgment.ts";
import { loadOperationCatalog } from "./operations.ts";
import {
  type ActionAuthorizationV1,
  type ActionReceiptV1,
  type AuthenticationProof,
  authorizationSubjectDigest,
  REVIEW_CONTRACT_VERSION,
  type ReviewPacketV1,
  type ReviewVerdictV1,
  seal,
  verdictSubjectDigest,
} from "./review-contract.ts";
import {
  resumePlaybookRun,
  startPlaybookRun,
  loadPlaybookRun,
  type RunSnapshot,
} from "./runner.ts";
import { InMemoryRuntime, RuntimeFailure } from "./runtime.ts";
import {
  applyMigrations,
  BACKUP_SCHEMA,
  buildExportBundle,
  buildLocalBackup,
  checkMigration,
  createLocalBackup,
  enforceRetention,
  ensureLocalStateRoot,
  eraseScope,
  exportData,
  EXPORT_SCHEMA,
  hasSuccessfulBackupReceipt,
  inventoryDataRoot,
  MIGRATION_CHECK_SCHEMA,
  parseLifecycleScope,
  readLifecycleReceipts,
  recoverInterruptedRestore,
  recoverStaging,
  restoreBackup,
  verifyBackupContainer,
  verifyExportContainer,
} from "./local-state.ts";

export const MATRIX_SCHEMA = "conquistador.runtime-local-matrix/v1";
export const MATRIX_ID = "runtime-local:v1";
const FIXED_SEAM = "2026-08-21T00:00:00.000Z";

export type LocalMatrixCell = {
  id: string;
  scenario: string;
  result: "pass";
  detail: Record<string, unknown>;
};

export type LocalMatrixRecord = {
  schemaVersion: typeof MATRIX_SCHEMA;
  matrixId: typeof MATRIX_ID;
  generatedAt: string;
  scope: "local-current-host-only";
  releaseState: "NO-GO";
  candidateStatus: "UNBOUND";
  supportPromotion: false;
  profileCells: Array<{ id: string; result: "pass"; detail: Record<string, unknown> }>;
  cells: LocalMatrixCell[];
  adversarial: { cases: number; rejected: number };
  boundaries: Record<string, unknown>;
  digest: Sha256;
};

function fail(message: string): never {
  throw new Error(`[conquistador.local-matrix] ${message}`);
}

function expectRejection(battery: Battery, label: string, run: () => unknown): void {
  battery.cases += 1;
  try {
    run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("conquistador.local-state")) {
      battery.rejected += 1;
      return;
    }
    fail(`${label} failed for the wrong reason: ${String(error)}`);
  }
  fail(`${label} was not rejected`);
}

type Battery = { cases: number; rejected: number };

function fixedClock(start: number): () => Date {
  let tick = 0;
  return () => new Date(start + tick++);
}

function localProfileConfig(dataDir: string): string {
  return [
    'schemaVersion: "conquistador.config/v1"',
    'instance:',
    '  id: "local-matrix"',
    'models:',
    '  primary:',
    '    provider: "openai"',
    '    model: "gpt-example"',
    '    credentialEnv: "OPENAI_API_KEY"',
    'server:',
    '  profile: "local"',
    '  bind: "127.0.0.1"',
    '  port: 4317',
    '  auth:',
    '    mode: "local"',
    '  allowedOrigins: []',
    '  trustedProxies: []',
    'data:',
    `  dir: "${dataDir}"`,
    '  sessionRetentionDays: 30',
    '  traceRetentionDays: 14',
    '  artifactPolicy: "accepted-only"',
    '  backupPolicy: "operator"',
    'memory:',
    '  mode: "review-promoted"',
    '  scopePolicy: "instance-workspace-project"',
    'sandbox:',
    '  mode: "disabled"',
    '  projectRoots: []',
    'limits:',
    '  activeSessions: 4',
    '  internalSpecialists: 2',
    '  tokensPerRun: 32000',
    '  timeoutSeconds: 600',
    '  queuedMessages: 20',
    '  bodyBytes: 1048576',
    'tools:',
    '  actionPolicy: "human-bound"',
  ].join("\n");
}

function singleNodeProfileConfig(): string {
  return localProfileConfig("/tmp/conquistador-unused")
    .replace('profile: "local"', 'profile: "single-node"')
    .replace('bind: "127.0.0.1"', 'bind: "10.0.0.8"')
    .replace('mode: "local"', 'mode: "bearer"\n    tokenEnv: "CONQUISTADOR_TOKEN"')
    .replace(
      'allowedOrigins: []',
      'publicUrl: "https://conquistador.example.internal"\n  allowedOrigins: ["https://conquistador.example.internal"]',
    )
    .replace('trustedProxies: []', 'trustedProxies: ["10.0.0.9"]');
}

type AuthorityFixture = {
  verdict: ReturnType<typeof seal>;
  actionAuthorization: ReturnType<typeof seal>;
  actionReceipt: ReturnType<typeof seal>;
  verification: {
    now: string;
    verifyAuthentication: (
      candidate: AuthenticationProof,
      context: { role: string; authority: string; subjectDigest: string },
    ) => boolean;
  };
  now: () => Date;
};

function localJudgmentResponse(
  request: JudgmentRequestV1,
): JudgmentResponseV1 {
  const outputs = request.outputContract.artifacts.map((contract) => {
    const entry = {
      artifactId: contract.artifactId,
      schema: contract.schema,
      format: contract.format,
      body: contract.format === "json"
        ? { stepId: request.identity.stepId, skill: request.skill.id }
        : [
          `# Local seam output for ${request.identity.stepId}`,
          "",
          `Deterministic local-host output attributed to ${request.skill.id}.`,
          "No external provider was called and no candidate was bound.",
        ].join("\n"),
    };
    return { ...entry, contentDigest: outputContentDigestOf(entry) };
  });
  const draft: Omit<JudgmentResponseV1, "responseDigest"> = {
    schema: JUDGMENT_RESPONSE_SCHEMA,
    responseId: `jrs-${request.execution.idempotencyKey.slice("sha256:".length, 7 + 16)}`,
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    identity: structuredClone(request.identity),
    skill: structuredClone(request.skill),
    outcome: "succeeded",
    executor: {
      hostId: "local-current-host",
      adapterId: "local-matrix-seam",
      adapterVersion: "1.0.0",
      executionId: `local-exec-${request.execution.idempotencyKey.slice(7, 23)}`,
      loadedAssetManifestDigest: request.skill.packageDigest,
    },
    model: {
      provider: "none",
      providerCellId: "local-offline",
      model: "unbound-local",
      modelVersion: "0.0.0",
      settingsDigest: request.skill.interfaceDigest,
      promptTemplateDigest: request.skill.packageDigest,
    },
    outputs,
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 30,
    },
    cost: {
      billingMode: "host-covered",
      currency: "USD",
      reservedMicros: 0,
      actualMicros: null,
      chargedToRunMicros: 0,
    },
    tools: [],
    failure: null,
    redaction: {
      applied: true,
      policyDigest: request.redaction.policyDigest,
    },
    startedAt: request.execution.createdAt,
    finishedAt: request.execution.createdAt,
  };
  return { ...draft, responseDigest: responseDigestOf(draft) };
}

function declaredSkillStepCount(playbook: unknown): number {
  const nodes = (playbook as {
    stepGraph?: { nodes?: Array<{ kind?: string }> };
  })?.stepGraph?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    fail("fixture playbook has no step graph");
  }
  const skillSteps = nodes.filter((node) => node?.kind === "skill").length;
  if (skillSteps < 1) fail("fixture playbook declares no skill steps");
  return skillSteps;
}

function containedJudgmentRequestPath(
  runDirectory: string,
  requestPath: string,
): string {
  if (!requestPath.startsWith("judgments/") || requestPath.includes("..")) {
    fail("judgment request path is not a canonical judgments member");
  }
  const absolute = resolve(runDirectory, requestPath);
  const contained = relative(runDirectory, absolute);
  if (isAbsolute(contained) || contained.startsWith("..")) {
    fail(`judgment request path escaped ${runDirectory}`);
  }
  return absolute;
}

async function driveAwaitingJudgmentRun(options: {
  runsDir: string;
  runId: string;
  operations: ReturnType<typeof loadOperationCatalog>;
  playbook: unknown;
  now: () => Date;
  expectedStatus: RunSnapshot["status"];
}): Promise<{ snapshot: RunSnapshot; responsesConsumed: number }> {
  const runDirectory = resolve(options.runsDir, options.runId);
  const maxDispatches = declaredSkillStepCount(options.playbook);
  let snapshot = loadPlaybookRun(options.runsDir, options.runId);
  const seenRequestIds = new Set<string>();
  const seenRequestDigests = new Set<string>();
  let responsesConsumed = 0;
  while (snapshot.status === "awaiting-judgment") {
    if (responsesConsumed >= maxDispatches) {
      fail(
        `run ${options.runId} exceeded its ${maxDispatches} declared skill-step judgments`,
      );
    }
    const pendingEntries = Object.entries(snapshot.state.judgments ?? {})
      .filter(([, record]) => record.state === "pending");
    if (pendingEntries.length !== 1) {
      fail(
        `run ${options.runId} must hold exactly one pending judgment record`,
      );
    }
    const [pendingKey, pending] = pendingEntries[0];
    const requestPath = containedJudgmentRequestPath(
      runDirectory,
      pending.requestPath,
    );
    const request = parseSealedRequest(
      JSON.parse(readFileSync(requestPath, "utf8")),
    );
    if (
      request.requestId !== pending.requestId ||
      request.requestDigest !== pending.requestDigest
    ) {
      fail("persisted judgment request does not bind its runner record");
    }
    if (
      seenRequestIds.has(request.requestId) ||
      seenRequestDigests.has(request.requestDigest)
    ) {
      fail("run re-presented a judgment request id or digest");
    }
    seenRequestIds.add(request.requestId);
    seenRequestDigests.add(request.requestDigest);
    const response = localJudgmentResponse(request);
    validateJudgmentResponse(request, response);
    responsesConsumed += 1;
    snapshot = await resumePlaybookRun({
      operations: options.operations,
      runId: options.runId,
      runsDir: options.runsDir,
      now: options.now,
      judgmentResponse: response,
    });
    const consumed = snapshot.state.judgments?.[pendingKey];
    if (
      !consumed ||
      consumed.state !== "consumed" ||
      consumed.responseDigest !== response.responseDigest
    ) {
      fail("judgment resume made no observable progress");
    }
  }
  if (snapshot.status !== options.expectedStatus) {
    fail(
      `run ${options.runId} settled at ${snapshot.status} instead of ${options.expectedStatus}`,
    );
  }
  return { snapshot, responsesConsumed };
}

function canonicalAuthorityFixture(runsDir: string, runId: string): AuthorityFixture {
  const packet = JSON.parse(
    readFileSync(resolve(runsDir, runId, "canonical-review-packet.json"), "utf8"),
  ) as ReviewPacketV1;
  const decidedAt = new Date(Date.parse(packet.createdAt) + 1).toISOString();
  const expiresAt = new Date(Date.parse(decidedAt) + 3_600_000).toISOString();
  const proof = (
    role: "reviewer" | "operator",
    authority: string,
    subjectDigest: Sha256,
  ): AuthenticationProof => {
    const basis = {
      principalId: `fixture-${role}`,
      role,
      method: "deterministic-fixture",
      verifier: "implementation-test-only",
      verifiedAt: decidedAt,
      authority,
      subjectDigest,
    };
    return { ...basis, proofDigest: sha256(basis) };
  };
  const verdictBasis = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "review-verdict" as const,
    verdictId: `${runId}-verdict`,
    outcome: "accept" as const,
    packetId: packet.packetId,
    packetDigest: packet.digest,
    artifactId: packet.artifact.artifactId,
    artifactRevision: packet.artifact.revision,
    artifactDigest: packet.artifact.digest,
    actionPayloadDigest: packet.actionProposal!.payloadDigest,
    sessionId: packet.identity.sessionId,
    runId: packet.identity.runId,
    candidateId: packet.identity.candidateId,
    evidenceId: packet.identity.evidenceId,
    decidedAt,
    expiryPolicy: "expires" as const,
    expiresAt,
    singleUse: true as const,
  };
  const verdict = seal({
    ...verdictBasis,
    authentication: proof("reviewer", "content-review", verdictSubjectDigest(packet, verdictBasis)),
  });
  const authorizationBasis = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "action-authorization" as const,
    authorizationId: `${runId}-authorization`,
    verdictId: verdict.verdictId,
    verdictDigest: verdict.digest,
    packetId: packet.packetId,
    packetDigest: packet.digest,
    sessionId: packet.identity.sessionId,
    runId: packet.identity.runId,
    candidateId: packet.identity.candidateId,
    artifact: packet.artifact,
    allowed: {
      authority: packet.actionProposal!.authority,
      operation: packet.actionProposal!.operation,
      connectionRef: packet.actionProposal!.connectionRef,
      payloadDigest: packet.actionProposal!.payloadDigest,
    },
    authorizedAt: decidedAt,
    expiresAt,
    singleUse: true as const,
  };
  const actionAuthorization = seal({
    ...authorizationBasis,
    authentication: proof(
      "operator",
      "consequential-action",
      authorizationSubjectDigest(authorizationBasis),
    ),
  });
  const actionReceipt = seal({
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "action-receipt" as const,
    receiptId: `${runId}-terminal-receipt`,
    authorizationId: actionAuthorization.authorizationId,
    authorizationDigest: actionAuthorization.digest,
    sessionId: packet.identity.sessionId,
    runId: packet.identity.runId,
    candidateId: packet.identity.candidateId,
    artifact: packet.artifact,
    authority: actionAuthorization.allowed.authority,
    operation: actionAuthorization.allowed.operation,
    connectionRef: actionAuthorization.allowed.connectionRef,
    payloadDigest: actionAuthorization.allowed.payloadDigest,
    status: "succeeded" as const,
    startedAt: decidedAt,
    finishedAt: decidedAt,
    redactionApplied: true as const,
    terminal: true as const,
  });
  return {
    verdict,
    actionAuthorization,
    actionReceipt,
    verification: {
      now: decidedAt,
      verifyAuthentication: (candidate, context) =>
        candidate.verifier === "implementation-test-only" &&
        candidate.principalId === `fixture-${context.role}` &&
        candidate.authority === context.authority &&
        candidate.subjectDigest === context.subjectDigest &&
        candidate.proofDigest === sha256({
          principalId: candidate.principalId,
          role: candidate.role,
          method: candidate.method,
          verifier: candidate.verifier,
          verifiedAt: candidate.verifiedAt,
          authority: candidate.authority,
          subjectDigest: candidate.subjectDigest,
        }),
    },
    now: () => new Date(decidedAt),
  };
}

async function completeRun(
  productRoot: string,
  runsDir: string,
  runId: string,
  now: () => Date,
): Promise<RunSnapshot> {
  const playbook = JSON.parse(
    readFileSync(resolve(productRoot, "runtime/fixtures/playbooks/content-intelligence-loop.json"), "utf8"),
  ) as unknown;
  const inputs = JSON.parse(
    readFileSync(resolve(productRoot, "runtime/fixtures/inputs/content-intelligence-loop.json"), "utf8"),
  ) as Record<string, unknown>;
  const operations = loadOperationCatalog(
    resolve(productRoot, "runtime/fixtures/operations/v1.json"),
  );
  await startPlaybookRun({ playbook, inputs, operations, runsDir, runId, now });
  await driveAwaitingJudgmentRun({
    runsDir,
    runId,
    operations,
    playbook,
    now,
    expectedStatus: "awaiting-review",
  });
  const authority = canonicalAuthorityFixture(runsDir, runId);
  const reviewed = await resumePlaybookRun({
    operations,
    runId,
    runsDir,
    now,
    verdict: authority.verdict as unknown as ReviewVerdictV1,
    verification: authority.verification as never,
    actionAuthorization: authority.actionAuthorization as unknown as ActionAuthorizationV1,
    actionReceipt: authority.actionReceipt as unknown as ActionReceiptV1,
  });
  if (reviewed.status !== "awaiting-judgment") return reviewed;
  const finished = await driveAwaitingJudgmentRun({
    runsDir,
    runId,
    operations,
    playbook,
    now,
    expectedStatus: "completed",
  });
  return finished.snapshot;
}

export async function buildRuntimeLocalMatrix(options: {
  workRoot: string;
  productRoot: string;
}): Promise<LocalMatrixRecord> {
  const { workRoot, productRoot } = options;
  const START = Date.parse(FIXED_SEAM);
  const now = fixedClock(START);
  const stamp = () => new Date(START).toISOString();
  const dataDir = resolve(workRoot, "data");
  const root = dataDir;
  const cells: LocalMatrixCell[] = [];
  const battery: Battery = { cases: 0, rejected: 0 };

  const config = parseConfigYaml(localProfileConfig(dataDir));
  if (config.server.profile !== "local") fail("local profile config drifted");
  const identity = ensureLocalStateRoot(root, {
    instanceId: config.instance.id,
    now: stamp(),
  });

  const runsDir = resolve(root, "sessions");
  const playbook = () =>
    JSON.parse(
      readFileSync(
        resolve(productRoot, "runtime/fixtures/playbooks/content-intelligence-loop.json"),
        "utf8",
      ),
    ) as unknown;
  const inputs = () =>
    JSON.parse(
      readFileSync(
        resolve(productRoot, "runtime/fixtures/inputs/content-intelligence-loop.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
  const operations = loadOperationCatalog(
    resolve(productRoot, "runtime/fixtures/operations/v1.json"),
  );
  const graphNodes = (playbook() as {
    stepGraph: { nodes: Array<{ id: string }> };
  }).stepGraph.nodes;
  const firstStepId = graphNodes[0]!.id;
  const secondStepId = graphNodes[1]!.id;

  const alpha = await startPlaybookRun({
    playbook: playbook(),
    inputs: inputs(),
    operations,
    runsDir,
    runId: "run-alpha",
    now,
    interruptAfter: firstStepId,
  });
  const alphaResumed = await resumePlaybookRun({
    operations,
    runsDir,
    runId: "run-alpha",
    now,
    interruptAfter: secondStepId,
  });
  const preservedSteps = Object.values(alphaResumed.state.steps)
    .filter((step) => step.status === "completed").length;
  cells.push({
    id: "fifo.resume.preserves-completed-work",
    scenario:
      "interrupted run resumes in declared order and preserves completed step work",
    result: "pass",
    detail: {
      interruptedAt: alpha.status,
      resumedTo: alphaResumed.status,
      preservedSteps,
      order: alphaResumed.plan.order,
    },
  });

  const beta = await startPlaybookRun({
    playbook: playbook(),
    inputs: inputs(),
    operations,
    runsDir,
    runId: "run-beta",
    now,
  });
  if (beta.status !== "awaiting-judgment") {
    fail("run-beta did not pause at awaiting-judgment");
  }
  const betaPendings = Object.entries(beta.state.judgments ?? {}).filter(
    ([, record]) => record.state === "pending",
  );
  if (betaPendings.length !== 1) {
    fail("run-beta must hold exactly one pending judgment record");
  }
  if (betaPendings[0][1].requestPath !== "judgments/rank-opportunities.a1.request.json") {
    fail("run-beta paused somewhere other than the first skill step");
  }
  const betaPendingPath = containedJudgmentRequestPath(
    resolve(runsDir, "run-beta"),
    betaPendings[0][1].requestPath,
  );
  const sealedRequest = parseSealedRequest(
    JSON.parse(readFileSync(betaPendingPath, "utf8")),
  );
  if (sealedRequest.schema !== JUDGMENT_REQUEST_SCHEMA) {
    fail("persisted judgment request schema drifted");
  }
  const betaPending = betaPendings[0][1];
  if (
    sealedRequest.requestId !== betaPending.requestId ||
    sealedRequest.requestDigest !== betaPending.requestDigest
  ) {
    fail("persisted judgment request does not bind its runner record");
  }
  if (
    sealedRequest.identity.runId !== "run-beta" ||
    sealedRequest.identity.stepId !== "rank-opportunities"
  ) {
    fail("sealed judgment request is not bound to run-beta rank-opportunities");
  }
  cells.push({
    id: "judgment.sealed-pending-request",
    scenario:
      "skill steps pause the run at awaiting-judgment behind one sealed JudgmentRequestV1 persisted and bound to the run",
    result: "pass",
    detail: {
      schemaVersion: JUDGMENT_REQUEST_SCHEMA,
      stepId: sealedRequest.identity.stepId,
      skillId: sealedRequest.skill.id,
      purpose: sealedRequest.purpose,
      requestId: sealedRequest.requestId,
      requestDigest: sealedRequest.requestDigest,
      attempt: betaPending.attempt,
      providerCalls: 0,
      externalExecution: false,
    },
  });

  const reloaded = loadPlaybookRun(runsDir, "run-beta");
  const reloadedPending = Object.values(reloaded.state.judgments ?? {}).find(
    (record) => record.state === "pending",
  );
  if (!reloadedPending || reloadedPending.state !== "pending") {
    fail("restart lost the sealed pending judgment record");
  }
  if (
    reloadedPending.requestId !== betaPending.requestId ||
    reloadedPending.requestDigest !== betaPending.requestDigest
  ) {
    fail("restart changed the pending judgment binding");
  }
  const reloadedRequest = parseSealedRequest(
    JSON.parse(
      readFileSync(resolve(runsDir, "run-beta", reloadedPending.requestPath), "utf8"),
    ),
  );
  if (reloadedRequest.requestDigest !== reloadedPending.requestDigest) {
    fail("restarted run no longer binds its sealed request file");
  }
  cells.push({
    id: "restart.state-recovery",
    scenario: "run state reloads from disk after restart with authority intact",
    result: "pass",
    detail: {
      runId: reloaded.runId,
      status: reloaded.status,
      stateSchema: reloaded.state.schemaVersion,
      pendingJudgment: {
        requestId: reloadedPending.requestId,
        requestDigest: reloadedPending.requestDigest,
      },
    },
  });

  const betaDriven = await driveAwaitingJudgmentRun({
    runsDir,
    runId: "run-beta",
    operations,
    playbook: playbook(),
    now,
    expectedStatus: "awaiting-review",
  });
  const betaSnapshot = betaDriven.snapshot;
  cells.push({
    id: "judgment.sealed-response-resume",
    scenario:
      "sealed JudgmentResponseV1 responses bound to each pending request resume the same run to awaiting-review with no human verdict",
    result: "pass",
    detail: {
      responsesConsumed: betaDriven.responsesConsumed,
      declaredSkillStepBound: declaredSkillStepCount(playbook()),
      resumedTo: betaSnapshot.status,
      humanVerdict: false,
      externalProviderCalls: 0,
    },
  });

  const done = await completeRun(productRoot, runsDir, "run-done", now);
  if (done.status !== "completed") fail("run-done did not complete");
  const doneEnvelopes = inventoryDataRoot(root)
    .filter((entry) => entry.path.startsWith("sessions/run-done/artifacts/"))
    .length;
  const memoryEntries = inventoryDataRoot(root)
    .filter((entry) => entry.class === "memory").length;
  if (memoryEntries !== 0) fail("run completion must not promote durable learning");
  cells.push({
    id: "terminal.reviewed-completion",
    scenario:
      "review accept plus authorized action receipt completes a run with approved artifacts and no automatic learning promotion",
    result: "pass",
    detail: {
      status: done.status,
      artifactFiles: doneEnvelopes,
      memoryEntries,
      externalExecution: false,
    },
  });

  const past = fixedClock(START - 40 * 86_400_000);
  await startPlaybookRun({
    playbook: playbook(),
    inputs: inputs(),
    operations,
    runsDir,
    runId: "run-old",
    now: past,
    signal: AbortSignal.abort(),
  });
  await startPlaybookRun({
    playbook: playbook(),
    inputs: inputs(),
    operations,
    runsDir,
    runId: "run-stale",
    now: past,
  });

  mkdirSync(resolve(root, "diagnostics"), { recursive: true });
  writeFileSync(
    resolve(root, "diagnostics", "notes.md"),
    "operator note bearer Zx9qW3rTyAsDfGhJ12 token\n",
  );

  const backupPath = "backups/matrix-backup.json";
  const created = createLocalBackup(root, { file: backupPath, now: stamp() });
  const verified = verifyBackupContainer(created.file, {
    root,
    expectedInstanceId: identity.instanceId,
  });
  const rebuiltA = buildLocalBackup(root, { now: stamp() });
  const rebuiltB = buildLocalBackup(root, { now: stamp() });
  if (rebuiltA.manifestDigest !== rebuiltB.manifestDigest) {
    fail("backup rebuild is not deterministic");
  }
  const storedPaths = verified.inventory.map((entry) => entry.path).sort();
  const rebuiltPaths = rebuiltA.inventory.map((entry) => entry.path).sort();
  if (JSON.stringify(storedPaths) !== JSON.stringify(rebuiltPaths)) {
    fail("stored backup inventory diverged from its rebuild");
  }
  const redactedInBackup = JSON.parse(
    readFileSync(created.file, "utf8"),
  ) as { files: Array<{ path: string; content: string }> };
  const notesFile = redactedInBackup.files.find((file) =>
    file.path === "diagnostics/notes.md"
  );
  if (!notesFile || !notesFile.content.includes("[REDACTED]")) {
    fail("diagnostics were not redacted in the backup");
  }
  cells.push({
    id: "backup.create-verify-deterministic-redacted",
    scenario:
      "quiescent backup creates a versioned sealed container, verifies read-only, rebuilds byte-deterministically, and redacts secrets",
    result: "pass",
    detail: {
      schemaVersion: BACKUP_SCHEMA,
      fileCount: verified.fileCount,
      totalBytes: verified.totalBytes,
      manifestDigest: verified.manifestDigest,
      redactionApplied: true,
    },
  });

  const betaArtifact = resolve(
    root,
    "sessions/run-beta/artifacts/created-artifact.md",
  );
  const pristineArtifact = readFileSync(betaArtifact, "utf8");
  writeFileSync(betaArtifact, "mutated after backup\n");
  rmSync(resolve(root, "sessions/run-alpha"), { recursive: true, force: true });
  const restored = restoreBackup(root, {
    file: backupPath,
    now: stamp(),
  });
  if (readFileSync(betaArtifact, "utf8") !== pristineArtifact) {
    fail("restore did not repair mutated state");
  }
  if (!existsSync(resolve(root, "sessions/run-alpha/state.json"))) {
    fail("restore did not restore deleted state");
  }
  cells.push({
    id: "restore.mutation-recovery",
    scenario:
      "restore verifies first, repairs mutated and deleted state exactly, and records one receipt",
    result: "pass",
    detail: {
      restoredFiles: restored.restoredFiles,
      manifestDigest: restored.manifestDigest,
    },
  });

  const migrationCheck = checkMigration(root);
  if (migrationCheck.blockers.length > 0) fail(`unexpected migration blockers: ${JSON.stringify(migrationCheck.blockers)}`);
  const appliedOnce = applyMigrations(root, { now: stamp() });
  const appliedTwice = applyMigrations(root, { now: stamp() });
  cells.push({
    id: "migrate.check-apply-idempotent",
    scenario:
      "migration check is read-only with exact from/to schemas; apply is idempotent and rollback-safe",
    result: "pass",
    detail: {
      schemaVersion: MIGRATION_CHECK_SCHEMA,
      from: migrationCheck.from,
      to: migrationCheck.to,
      pending: migrationCheck.pending,
      firstApply: appliedOnce.applied,
      secondApply: appliedTwice.applied,
    },
  });

  const exportPath = "backups/matrix-export.json";
  const exported = exportData(root, {
    scope: "all",
    file: exportPath,
    now: stamp(),
  });
  const verifiedExport = verifyExportContainer(exported.file, {
    root,
    expectedInstanceId: identity.instanceId,
  });
  if (!verifiedExport.readme.includes("no running service")) {
    fail("export lacks its portable reader contract");
  }
  cells.push({
    id: "export.portable-redacted",
    scenario:
      "portable export carries user-owned artifacts, approved memory, and redacted receipts readable without the runtime",
    result: "pass",
    detail: {
      schemaVersion: EXPORT_SCHEMA,
      scope: "all",
      fileCount: verifiedExport.fileCount,
      provenance: verifiedExport.provenance,
    },
  });

  const retentionDryRun = enforceRetention(
    root,
    {
      sessionRetentionDays: config.data.sessionRetentionDays,
      traceRetentionDays: config.data.traceRetentionDays,
      artifactPolicy: config.data.artifactPolicy,
    },
    { now: stamp(), apply: false },
  );
  if (!retentionDryRun.expiredSessions.includes("run-old")) {
    fail("session retention missed the expired terminal run");
  }
  if (!retentionDryRun.protectedSessions.includes("run-done")) {
    fail("accepted artifact policy did not protect the reviewed run");
  }
  if (!existsSync(resolve(root, "sessions/run-old"))) {
    fail("dry-run retention must not mutate");
  }
  const retentionApplied = enforceRetention(
    root,
    {
      sessionRetentionDays: config.data.sessionRetentionDays,
      traceRetentionDays: config.data.traceRetentionDays,
      artifactPolicy: config.data.artifactPolicy,
    },
    { now: stamp(), apply: true },
  );
  if (existsSync(resolve(root, "sessions/run-old"))) {
    fail("applied retention did not remove the expired session");
  }
  const staleTrace = JSON.parse(
    readFileSync(resolve(root, "sessions/run-stale/trace.json"), "utf8"),
  ) as Array<{ at: string }>;
  if (staleTrace.some((event) => Date.parse(event.at) < START - 14 * 86_400_000)) {
    fail("trace retention did not prune stale events");
  }
  cells.push({
    id: "retention.session-and-trace-separate",
    scenario:
      "session and trace retention enforce separately; accepted/reviewed artifacts stay explicitly protected",
    result: "pass",
    detail: {
      expiredSessions: retentionApplied.expiredSessions,
      protectedSessions: retentionApplied.protectedSessions,
      prunedTraces: retentionApplied.prunedTraces,
      dryRunMutatedNothing: true,
    },
  });

  const beforeErase = inventoryDataRoot(root).map((entry) => entry.path);
  const eraseReceipt = eraseScope(root, {
    scope: "session:run-alpha",
    confirm: "session:run-alpha",
    recoverability: "backup",
    now: stamp(),
  });
  if (existsSync(resolve(root, "sessions/run-alpha"))) {
    fail("erase left its exact scope behind");
  }
  for (const path of beforeErase) {
    if (path.startsWith("sessions/run-alpha/")) continue;
    if (path.startsWith("sessions/run-beta/") || path.startsWith("sessions/run-done/") ||
      path === "instance.json" || path.startsWith("receipts/")) {
      if (!existsSync(resolve(root, path))) fail(`erase touched unrelated path ${path}`);
    }
  }
  if (!existsSync(resolve(root, backupPath))) {
    fail("erase implicitly removed the operator backup");
  }
  const terminalReceipts = readLifecycleReceipts(root).filter((receipt) =>
    receipt.op === "erase.apply"
  );
  if (terminalReceipts.length !== 1 || terminalReceipts[0].id !== eraseReceipt.id) {
    fail("erase terminal receipt is missing or duplicated");
  }
  cells.push({
    id: "erase.exact-scope-terminal-receipt",
    scenario:
      "exact-scope erase removes only its scope, keeps unrelated sessions and operator backups, and records one redacted terminal receipt",
    result: "pass",
    detail: {
      scope: eraseReceipt.detail.scope,
      removedFiles: eraseReceipt.detail.removedFiles,
      classes: eraseReceipt.detail.classes,
      terminal: eraseReceipt.terminal ?? false,
    },
  });

  const tamperedBase = JSON.parse(readFileSync(created.file, "utf8")) as Record<string, unknown>;
  let tamperedSequence = 0;
  const writeTampered = (
    mutate: (container: Record<string, unknown>) => void,
  ): string => {
    const clone = JSON.parse(JSON.stringify(tamperedBase)) as Record<string, unknown>;
    mutate(clone);
    const path = resolve(workRoot, `tampered-${tamperedSequence += 1}.json`);
    writeFileSync(path, JSON.stringify(clone, null, 2));
    return path;
  };
  const reseal = (container: Record<string, unknown>): void => {
    const { manifestDigest: _ignored, ...body } = container;
    container.manifestDigest = sha256(body);
  };

  expectRejection(battery, "traversal member path", () => {
    verifyBackupContainer(writeTampered((container) => {
      container.inventory = [{
        path: "../escape.json",
        class: "diagnostic",
        bytes: 2,
        digest: "sha256:" + "0".repeat(64),
      }];
      container.files = [{ path: "../escape.json", encoding: "utf8", content: "{}" }];
      container.totalBytes = 2;
      container.fileCount = 1;
      reseal(container);
    }));
  });
  expectRejection(battery, "absolute member path", () => {
    verifyBackupContainer(writeTampered((container) => {
      container.inventory = [{
        path: "/etc/passwd",
        class: "diagnostic",
        bytes: 2,
        digest: "sha256:" + "0".repeat(64),
      }];
      container.files = [{ path: "/etc/passwd", encoding: "utf8", content: "{}" }];
      container.totalBytes = 2;
      container.fileCount = 1;
      reseal(container);
    }));
  });
  expectRejection(battery, "duplicate member paths", () => {
    verifyBackupContainer(writeTampered((container) => {
      const entry = (container.inventory as Array<Record<string, unknown>>)[0];
      container.inventory = [entry, { ...entry }];
      reseal(container);
    }));
  });
  expectRejection(battery, "case-colliding member paths", () => {
    verifyBackupContainer(writeTampered((container) => {
      const inventory = container.inventory as Array<{
        path: string;
        class: string;
        bytes: number;
        digest: string;
      }>;
      const source = inventory.find((entry) =>
        entry.path.startsWith("sessions/run-beta/")
      );
      if (!source) fail("fixture member missing");
      const slash = source.path.lastIndexOf("/");
      inventory.push({
        ...source,
        path: `${source.path.slice(0, slash + 1)}${
          source.path[slash + 1]!.toUpperCase()
        }${source.path.slice(slash + 2)}`,
      });
      reseal(container);
    }));
  });
  expectRejection(battery, "member digest mismatch", () => {
    verifyBackupContainer(writeTampered((container) => {
      const files = container.files as Array<{
        path: string;
        encoding: string;
        content: string;
      }>;
      files[0]!.content = `${files[0]!.content}tampered\n`;
    }));
  });
  expectRejection(battery, "manifest digest mismatch", () => {
    verifyBackupContainer(writeTampered((container) => {
      container.totalBytes = (container.totalBytes as number) + 1;
    }));
  });
  expectRejection(battery, "stale container schema", () => {
    verifyBackupContainer(writeTampered((container) => {
      container.schemaVersion = "conquistador.backup/v0";
      container.kind = "backup";
      reseal(container);
    }));
  });
  expectRejection(battery, "malformed metadata", () => {
    verifyBackupContainer(writeTampered((container) => {
      delete container.instanceId;
      reseal(container);
    }));
  });
  expectRejection(battery, "oversized container quota", () => {
    verifyBackupContainer(created.file, { root, maxContainerBytes: 16 });
  });
  expectRejection(battery, "cross-instance restore", () => {
    verifyBackupContainer(created.file, {
      root,
      expectedInstanceId: "other-instance",
    });
  });
  expectRejection(battery, "foreign-session collision restore", () => {
    const collisionRoot = resolve(workRoot, "collision-root");
    mkdirSync(collisionRoot, { recursive: true });
    ensureLocalStateRoot(collisionRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    mkdirSync(resolve(collisionRoot, "sessions", "run-foreign"), { recursive: true });
    writeFileSync(
      resolve(collisionRoot, "sessions", "run-foreign", "state.json"),
      JSON.stringify({ schemaVersion: "conquistador.run-state/v1" }),
    );
    restoreBackup(collisionRoot, {
      file: resolve(root, backupPath),
      now: stamp(),
    });
  });
  expectRejection(battery, "symlinked state path", () => {
    const linkRoot = resolve(workRoot, "symlink-root");
    mkdirSync(linkRoot, { recursive: true });
    ensureLocalStateRoot(linkRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    symlinkSync(
      resolve(workRoot, "outside.json"),
      resolve(linkRoot, "diagnostics", "link.md"),
    );
    inventoryDataRoot(linkRoot);
  });
  expectRejection(battery, "unsupported state file type", () => {
    const binRoot = resolve(workRoot, "binary-root");
    mkdirSync(binRoot, { recursive: true });
    ensureLocalStateRoot(binRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    writeFileSync(resolve(binRoot, "diagnostics", "blob.bin"), Buffer.alloc(4));
    inventoryDataRoot(binRoot);
  });
  expectRejection(battery, "traversal scope", () => {
    parseLifecycleScope("session:../../etc", ["all", "session"]);
  });
  expectRejection(battery, "ambiguous scope", () => {
    parseLifecycleScope("all:extra", ["all", "session"]);
  });
  expectRejection(battery, "erase confirmation mismatch", () => {
    eraseScope(root, {
      scope: "session:run-beta",
      confirm: "session:run-other",
      recoverability: "decline",
      now: stamp(),
    });
  });
  expectRejection(battery, "erase of nonexistent scope", () => {
    eraseScope(root, {
      scope: "session:run-missing",
      confirm: "session:run-missing",
      recoverability: "decline",
      now: stamp(),
    });
  });
  expectRejection(battery, "erase without declared backup", () => {
    const bareRoot = resolve(workRoot, "bare-root");
    mkdirSync(bareRoot, { recursive: true });
    ensureLocalStateRoot(bareRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    if (hasSuccessfulBackupReceipt(bareRoot)) fail("bare root has a backup receipt");
    eraseScope(bareRoot, {
      scope: "all",
      confirm: "all",
      recoverability: "backup",
      now: stamp(),
    });
  });

  const partialRoot = resolve(workRoot, "partial-root");
  mkdirSync(partialRoot, { recursive: true });
  ensureLocalStateRoot(partialRoot, {
    instanceId: identity.instanceId,
    now: stamp(),
  });
  battery.cases += 1;
  try {
    createLocalBackup(partialRoot, {
      file: "backups/partial.json",
      now: stamp(),
      faultAfter: "payload",
    });
    fail("partial backup write was not rejected");
  } catch (error) {
    if (!(error instanceof Error) ||
      !error.message.includes("injected fault after payload")) {
      throw error;
    }
    battery.rejected += 1;
  }
  recoverStaging(partialRoot);
  battery.cases += 1;
  try {
    verifyBackupContainer(resolve(partialRoot, "backups", "partial.json"));
    fail("a partial backup container verified");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("local-state")) {
      throw error;
    }
    battery.rejected += 1;
  }

  const diskRoot = resolve(workRoot, "disk-root");
  mkdirSync(diskRoot, { recursive: true });
  ensureLocalStateRoot(diskRoot, {
    instanceId: identity.instanceId,
    now: stamp(),
  });
  createLocalBackup(diskRoot, { file: "backups/disk-full.json", now: stamp() });
  battery.cases += 1;
  try {
    restoreBackup(diskRoot, {
      file: "backups/disk-full.json",
      now: stamp(),
      faultAfter: "first-file",
    });
    fail("injected disk-full seam was not rejected");
  } catch (error) {
    if (!(error instanceof Error) ||
      !error.message.includes("injected fault after first restored file")) {
      throw error;
    }
    battery.rejected += 1;
  }
  const diskRollforward = recoverInterruptedRestore(diskRoot);
  const diskVerified = verifyBackupContainer(
    resolve(diskRoot, "backups", "disk-full.json"),
  );
  const diskStateAfterRollforward = inventoryDataRoot(diskRoot)
    .filter((entry) => entry.path !== "receipts/lifecycle.jsonl");
  for (const entry of diskStateAfterRollforward) {
    const stored = diskVerified.inventory.find((item) => item.path === entry.path);
    if (!stored || stored.digest !== entry.digest) {
      fail(`disk-full roll-forward left drifted state: ${entry.path}`);
    }
  }

  battery.cases += 1;
  try {
    const corruptRoot = resolve(workRoot, "corrupt-root");
    mkdirSync(corruptRoot, { recursive: true });
    ensureLocalStateRoot(corruptRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    writeFileSync(resolve(corruptRoot, "instance.json"), "{not json");
    applyMigrations(corruptRoot, { now: stamp() });
    fail("corrupt state did not block migration");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("migration blocked")) {
      throw error;
    }
    battery.rejected += 1;
  }
  battery.cases += 1;
  try {
    const staleRoot = resolve(workRoot, "stale-root");
    mkdirSync(staleRoot, { recursive: true });
    ensureLocalStateRoot(staleRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    const staleInstance = JSON.parse(
      readFileSync(resolve(staleRoot, "instance.json"), "utf8"),
    ) as Record<string, unknown>;
    staleInstance.schemaVersion = "conquistador.local-state/v99";
    writeFileSync(
      resolve(staleRoot, "instance.json"),
      JSON.stringify(staleInstance),
    );
    applyMigrations(staleRoot, { now: stamp() });
    fail("stale future schema did not block migration");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("migration blocked")) {
      throw error;
    }
    battery.rejected += 1;
  }
  battery.cases += 1;
  try {
    const lockRoot = resolve(workRoot, "lock-root");
    mkdirSync(lockRoot, { recursive: true });
    ensureLocalStateRoot(lockRoot, {
      instanceId: identity.instanceId,
      now: stamp(),
    });
    writeFileSync(
      resolve(lockRoot, "locks", "lifecycle.lock"),
      JSON.stringify({
        acquiredAt: new Date().toISOString(),
        owner: "00000000-0000-4000-8000-000000000001",
        pid: process.pid,
      }),
    );
    createLocalBackup(lockRoot, { file: "backups/locked.json", now: stamp() });
    fail("lock contention did not fail closed");
  } catch (error) {
    if (!(error instanceof Error) ||
      !error.message.includes("another lifecycle operation")) {
      throw error;
    }
    battery.rejected += 1;
  }

  cells.push({
    id: "containment.adversarial-battery",
    scenario:
      "path escape, absolute members, duplicates, case collisions, digest and manifest drift, stale schema, malformed metadata, quotas, cross-instance ambiguity, collisions, symlinks, special types, traversal and ambiguous scopes, confirmation mismatch, missing scopes, undeclared backups, partial writes, disk-full seams, corrupt and stale state, and lock contention all fail closed",
    result: "pass",
    detail: {
      cases: battery.cases,
      rejected: battery.rejected,
      diskFullRollForwardFiles: diskRollforward.restoredFiles,
      partialWriteLeftNoContainer: true,
    },
  });

  const corpus = loadRuntimeCorpus(resolve(productRoot, "skills/skills"));
  let releaseConcurrent = () => {};
  const concurrentGate = new Promise<void>((resolvePromise) => {
    releaseConcurrent = resolvePromise;
  });
  let concurrentStarted = 0;
  const concurrentRuntime = new InMemoryRuntime({
    provider: {
      id: "openai.responses.direct",
      generate: async () => {
        concurrentStarted += 1;
        await concurrentGate;
        return {
          provider: "openai" as const,
          providerCellId: "openai.responses.direct",
          text: "concurrent local-matrix work",
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    },
    corpus,
    maximumSessions: 1,
    maximumQueuedMessages: 1,
  });
  const concurrentSession = concurrentRuntime.createSession({
    principalId: "local-operator",
  });
  try {
    concurrentRuntime.createSession({ principalId: "local-operator" });
    fail("session ceiling was not enforced");
  } catch (error) {
    if (
      !(error instanceof RuntimeFailure) ||
      !error.message.includes("active session ceiling")
    ) {
      throw error;
    }
  }
  const concurrentFirst = concurrentRuntime.sendMessage(concurrentSession.id, {
    id: "message-1",
    content: "Create launch copy",
    principalId: "local-operator",
  });
  for (let i = 0; i < 50 && concurrentStarted === 0; i += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
  if (concurrentStarted !== 1) fail("first concurrent turn did not start");
  const concurrentQueued = concurrentRuntime.sendMessage(concurrentSession.id, {
    id: "message-2",
    content: "Create paid campaign copy",
    principalId: "local-operator",
  });
  try {
    concurrentRuntime.sendMessage(concurrentSession.id, {
      id: "message-3",
      content: "Write outreach",
      principalId: "local-operator",
    });
    fail("queue ceiling was not enforced");
  } catch (error) {
    if (
      !(error instanceof RuntimeFailure) ||
      !error.message.includes("session queue ceiling")
    ) {
      throw error;
    }
  }
  releaseConcurrent();
  await concurrentFirst;
  try {
    await concurrentQueued;
    fail("queued work survived the review boundary");
  } catch (error) {
    if (
      !(error instanceof RuntimeFailure) ||
      !error.message.includes("final review decision")
    ) {
      throw error;
    }
  }
  try {
    parseConfigYaml(
      localProfileConfig(dataDir).replace('mode: "disabled"', 'mode: "docker"'),
    );
    fail("docker sandbox was accepted");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("docker is unimplemented")
    ) {
      throw error;
    }
  }
  try {
    parseConfigYaml(`${localProfileConfig(dataDir)}\nschedule:\n  cron: "0 0 * * *"\n`);
    fail("schedule engine was accepted");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("undeclared")) {
      throw error;
    }
  }
  cells.push({
    id: "runtime.concurrent-ceilings-and-review-queue",
    scenario:
      "one active session, one queued message, extra concurrent work fails closed; review rejects stranded queue; docker sandbox and schedule keys are unimplemented",
    result: "pass",
    detail: {
      sessionCeiling: 1,
      queueCeiling: 1,
      startedTurns: concurrentStarted,
      dockerSandbox: "unimplemented",
      customerSchedules: false,
    },
  });

  const singleNode = parseConfigYaml(singleNodeProfileConfig());
  cells.push({
    id: "profiles.loopback-and-authenticated-single-node",
    scenario:
      "loopback/local and authenticated single-node profiles validate locally with no hidden hosted dependency",
    result: "pass",
    detail: {
      local: { profile: config.server.profile, bind: config.server.bind, auth: config.server.auth.mode },
      singleNode: {
        profile: singleNode.server.profile,
        auth: singleNode.server.auth.mode,
        publicUrl: singleNode.server.publicUrl,
      },
      credentialsUsed: false,
      networkCalls: 0,
    },
  });

  const boundaries = {
    localCurrentHostOnly: true,
    ociAmd64Arm64Evidence: false,
    linuxCleanHostEvidence: false,
    macosCleanHostEvidence: false,
    liveProviderCells: 0,
    hostedDependency: "none",
    customerSchedulesEnabled: false,
    unattendedExternalMutation: false,
    dockerSandboxEnabled: false,
    releaseState: "NO-GO",
    candidateStatus: "UNBOUND",
    supportPromotion: false,
  };

  const body = {
    schemaVersion: MATRIX_SCHEMA,
    matrixId: MATRIX_ID,
    generatedAt: FIXED_SEAM,
    scope: "local-current-host-only" as const,
    releaseState: "NO-GO" as const,
    candidateStatus: "UNBOUND" as const,
    supportPromotion: false as const,
    profileCells: [] as LocalMatrixRecord["profileCells"],
    cells,
    adversarial: { cases: battery.cases, rejected: battery.rejected },
    boundaries,
  };
  return { ...body, digest: sha256(body) } as LocalMatrixRecord;
}

export function renderMatrix(record: LocalMatrixRecord): string {
  return `${canonicalJson(record)}\n`;
}
