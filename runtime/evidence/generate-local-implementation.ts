#!/usr/bin/env bun

// Local implementation evidence: deterministic skeleton plus fail-closed pause.
//
// This generator runs the real router and the real runner on the canonical
// playbook fixtures with NO judgment provider bound. Post-N2a that must pause
// at the first skill step with `awaiting-judgment`, one sealed pending
// JudgmentRequestV1, no completed skill artifact, no human review packet, and
// no consumed judgment response. The generator fails closed if any stubbed
// completion appears, if a test/fake provider completes a skill step, or if a
// playbook could be admitted from this run. Admitted playbooks stay empty;
// release stays NO-GO; candidate stays UNBOUND.

import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";

import { canonicalJson, sha256 } from "../src/canonical.ts";
import { parseSealedRequest } from "../src/judgment.ts";
import { loadOperationCatalog } from "../src/operations.ts";
import { routeIntent } from "../src/router.ts";
import { resumePlaybookRun, startPlaybookRun } from "../src/runner.ts";

const productRoot = resolve(import.meta.dirname, "..", "..");
const evidencePath = resolve(
  productRoot,
  "release/evidence/local-implementation-v1.json",
);
const FIXED_START = Date.parse("2026-08-21T00:00:00.000Z");
const RUN_ID = "local-implementation-content-intelligence-loop-v1";

const DETERMINISTIC_PREFIX = [
  "load-context",
  "pull-signals",
  "normalize-data",
] as const;
const FIRST_SKILL_STEP = "rank-opportunities";
const DETERMINISTIC_ARTIFACTS = [
  "approved-context",
  "signal-bundle",
  "normalized-signals",
] as const;

const SOURCE_PATHS = [
  "runtime/schemas/artifact.schema.json",
  "runtime/schemas/judgment-request.schema.json",
  "runtime/schemas/judgment-response.schema.json",
  "runtime/schemas/registry.schema.json",
  "runtime/schemas/router.schema.json",
  "runtime/schemas/review-contract.schema.json",
  "runtime/schemas/credential-detector.schema.json",
  "runtime/src/artifacts.ts",
  "runtime/src/canonical.ts",
  "runtime/src/gates.ts",
  "runtime/src/judgment.ts",
  "runtime/src/skill-assets.ts",
  "runtime/src/learning.ts",
  "runtime/src/operations.ts",
  "runtime/src/principal.ts",
  "runtime/src/registry.ts",
  "runtime/src/router.ts",
  "runtime/src/review-contract.ts",
  "runtime/src/review-events.ts",
  "runtime/src/review-validation.ts",
  "runtime/src/credential-detector.ts",
  "runtime/src/runner.ts",
  "runtime/src/steps.ts",
  "runtime/evidence/generate-local-implementation.ts",
] as const;

const FIXTURE_PATHS = {
  playbook: "runtime/fixtures/playbooks/content-intelligence-loop.json",
  input: "runtime/fixtures/inputs/content-intelligence-loop.json",
  operations: "runtime/fixtures/operations/v1.json",
  router: "runtime/fixtures/router/capability-routes.json",
} as const;

function fileDigest(path: string): string {
  return `sha256:${
    createHash("sha256").update(readFileSync(resolve(productRoot, path)))
      .digest("hex")
  }`;
}

function fileDigestFromAbsolute(path: string): string {
  return `sha256:${
    createHash("sha256").update(readFileSync(path)).digest("hex")
  }`;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(productRoot, path), "utf8")) as Record<
    string,
    unknown
  >;
}

function fixedClock(): () => Date {
  let tick = 0;
  return () => new Date(FIXED_START + tick++);
}

function fail(message: string): never {
  throw new Error(`[generate-local-implementation] ${message}`);
}

function artifactBody(
  runDirectory: string,
  artifact: { path: string },
): unknown {
  const raw = readFileSync(resolve(runDirectory, artifact.path), "utf8");
  if (artifact.path.endsWith(".json")) {
    return (JSON.parse(raw) as { body: unknown }).body;
  }
  return raw.replace(/^---\n[\s\S]*?\n---\n\n/, "").replace(/\n$/, "");
}

function runDirectoryText(runDirectory: string, files: string[]): string {
  return files.map((file) => readFileSync(resolve(runDirectory, file), "utf8"))
    .join("\n");
}

async function generate(): Promise<Record<string, unknown>> {
  const workRoot = mkdtempSync(
    resolve(tmpdir(), "conquistador-local-evidence-"),
  );
  try {
    const runsDir = resolve(workRoot, "runs");
    const playbook = readJson(FIXTURE_PATHS.playbook);
    const inputs = readJson(FIXTURE_PATHS.input);
    const operations = loadOperationCatalog(
      resolve(productRoot, FIXTURE_PATHS.operations),
    );
    const now = fixedClock();
    const routed = routeIntent("run the content intelligence loop");
    if (
      routed.outcome !== "playbook" ||
      routed.targetId !== "content-intelligence-loop"
    ) {
      fail("canonical router did not select content-intelligence-loop");
    }

    // No provider is bound anywhere in this run. Absence of a provider must
    // mean durable pause, never stubbed completion.
    const paused = await startPlaybookRun({
      playbook,
      inputs,
      operations,
      runsDir,
      runId: RUN_ID,
      now,
    });
    const resumedStillPaused = await resumePlaybookRun({
      operations,
      runId: RUN_ID,
      runsDir,
      now,
    });
    if (
      paused.status !== "awaiting-judgment" ||
      resumedStillPaused.status !== "awaiting-judgment"
    ) {
      fail(
        `expected a fail-closed awaiting-judgment pause, found ${paused.status}/${resumedStillPaused.status}`,
      );
    }

    const directory = paused.directory;
    const steps = paused.state.steps as Record<
      string,
      { id: string; status: string; attempts: number; outputDigests?: unknown }
    >;
    for (const id of DETERMINISTIC_PREFIX) {
      if (steps[id]?.status !== "completed") {
        fail(`deterministic step ${id} did not complete before the pause`);
      }
    }
    if (steps[FIRST_SKILL_STEP]?.status !== "awaiting-judgment") {
      fail(
        `step ${FIRST_SKILL_STEP} is ${steps[FIRST_SKILL_STEP]?.status}, not awaiting-judgment`,
      );
    }
    const prefixIndex = paused.plan.order.indexOf(FIRST_SKILL_STEP);
    for (const id of paused.plan.order.slice(prefixIndex + 1)) {
      if (steps[id]?.status !== "pending") {
        fail(`downstream step ${id} advanced past a sealed judgment request`);
      }
    }

    const artifacts = Object.values(paused.state.artifacts as Record<
      string,
      { id: string; producedBy: string; parents: string[]; path: string; digest: string; contentDigest: string | null }
    >);
    const artifactIds = artifacts.map((artifact) => artifact.id).sort();
    if (
      canonicalJson(artifactIds) !==
        canonicalJson([...DETERMINISTIC_ARTIFACTS].sort())
    ) {
      fail(`unexpected artifact inventory at the pause: ${artifactIds.join(", ")}`);
    }
    if (paused.state.artifacts["opportunity-briefs"] !== undefined) {
      fail("a completed skill artifact exists without a validated judgment response");
    }

    const judgments = paused.state.judgments as Record<
      string,
      {
        requestId: string;
        requestDigest: string;
        attempt: number;
        state: string;
        requestPath: string;
        responseDigest?: string;
        consumedAt?: string;
      }
    >;
    const judgmentStepIds = Object.keys(judgments ?? {});
    if (
      canonicalJson(judgmentStepIds.sort()) !==
        canonicalJson([FIRST_SKILL_STEP])
    ) {
      fail(`unexpected judgment records: ${judgmentStepIds.join(", ")}`);
    }
    const pendingRecord = judgments[FIRST_SKILL_STEP];
    if (!pendingRecord || pendingRecord.state !== "pending") {
      fail(`judgment request for ${FIRST_SKILL_STEP} is not pending`);
    }
    if (pendingRecord.responseDigest || pendingRecord.consumedAt) {
      fail("a judgment response was consumed without an authorized provider");
    }
    if (
      (resumedStillPaused.state.judgments as typeof judgments)[FIRST_SKILL_STEP]
        ?.requestId !== pendingRecord.requestId
    ) {
      fail("resume without a response did not preserve the pending request");
    }

    const requestAbsolutePath = resolve(directory, pendingRecord.requestPath);
    const request = parseSealedRequest(JSON.parse(
      readFileSync(requestAbsolutePath, "utf8"),
    ));
    if (request.identity.stepId !== FIRST_SKILL_STEP) {
      fail("sealed request is not bound to the paused step");
    }
    if (request.identity.attempt !== 1) {
      fail("sealed request attempt drifted");
    }
    if (request.budget.maximumChargeMicros !== 0) {
      fail("sealed request exceeds the zero-cost playbook budget");
    }
    if (request.redaction?.applied !== true) {
      fail("sealed request is not redacted");
    }

    const requestedEvents = paused.trace.filter((
      event: { type: string; detail?: Record<string, unknown> },
    ) => event.type === "judgment.requested");
    if (requestedEvents.length !== 1) {
      fail("the pause must record exactly one judgment.requested event");
    }
    for (const event of paused.trace) {
      if (event.type === "judgment.completed") {
        fail("a judgment.completed event exists without an authorized response");
      }
      if (
        event.type === "gate.review" || event.type === "gate.action"
      ) {
        fail(`${event.type} fired before any judgment completed`);
      }
      if (
        event.type === "run.stopped" &&
        (event.detail as Record<string, unknown> | undefined)?.reason !==
          "awaiting-judgment"
      ) {
        fail(`run stopped for an unexpected reason at the pause`);
      }
    }
    const executedOrder = paused.trace
      .filter((event: { type: string }) => event.type === "step.completed")
      .map((event: { stepId?: string }) => event.stepId);
    if (canonicalJson(executedOrder) !== canonicalJson(DETERMINISTIC_PREFIX)) {
      fail("executed order is not the exact deterministic prefix");
    }

    // Fail closed on stubbed completion or fake-provider completion markers.
    const persistedFiles = ["plan.json", "state.json", "trace.json"].concat(
      readdirSync(resolve(directory, "judgments"))
        .filter((name) => name.endsWith(".json"))
        .map((name) => `judgments/${name}`),
    );
    const serialized = runDirectoryText(directory, persistedFiles);
    if (/stubbed|judgment\.stubbed/i.test(serialized)) {
      fail("judgment.stubbed appeared in a persisted run record");
    }
    if (/"testOnly"\s*:\s*true/.test(serialized)) {
      fail("a test-only provider marker appeared in a persisted run record");
    }
    for (const forbidden of [
      "review-packet.json",
      "canonical-review-packet.json",
      "action-gate.json",
    ]) {
      try {
        readFileSync(resolve(directory, forbidden));
        fail(`${forbidden} exists before any judgment completed`);
      } catch (error) {
        if ((error as Error).message.startsWith("[generate-local-implementation]")) throw error;
      }
    }

    const artifactEntries = artifacts.map((artifact) => ({
      artifactId: artifact.id,
      producedBy: artifact.producedBy,
      parents: artifact.parents,
      path: artifact.path,
      fileDigest: artifact.digest,
      contentDigest: artifact.contentDigest,
      body: artifactBody(directory, artifact),
    }));

    const evidenceBasis = {
      schemaVersion: "conquistador.local-implementation-evidence/v1",
      evidenceId:
        "local-implementation:exts-173-176:content-intelligence-loop:v1",
      generatedAt: "2026-08-21T00:00:00.000Z",
      scope: "deterministic-local-fail-closed-awaiting-judgment-evidence",
      ownerIssues: {
        "contract:skill-registry": "FOR-173",
        "contract:playbook-registry": "FOR-173",
        "contract:capability-router": "FOR-174",
        "contract:playbook-runner": "FOR-174",
        "contract:artifact-system": "FOR-175",
        "playbook:content-intelligence-loop": "FOR-176",
      },
      admittedStatuses: {
        contracts: [
          "contract:skill-registry",
          "contract:playbook-registry",
          "contract:capability-router",
          "contract:playbook-runner",
          "contract:artifact-system",
        ],
        playbooks: [],
        status: "candidate-implemented",
        playbookAdmission: "none-no-authorized-judgment-response-exists",
      },
      bindings: {
        sourceFiles: Object.fromEntries(
          SOURCE_PATHS.map((path) => [path, fileDigest(path)]),
        ),
        fixtureFiles: Object.fromEntries(
          Object.values(FIXTURE_PATHS).map((path) => [path, fileDigest(path)]),
        ),
        playbook: {
          path: FIXTURE_PATHS.playbook,
          rawByteDigest: fileDigest(FIXTURE_PATHS.playbook),
          canonicalId: playbook.canonicalId,
          id: playbook.id,
          version: playbook.version,
          executionStatus: playbook.executionStatus,
          canonicalRecordDigest: sha256(playbook),
        },
        fixtureInput: {
          path: FIXTURE_PATHS.input,
          canonicalDigest: sha256(inputs),
          fileDigest: fileDigest(FIXTURE_PATHS.input),
        },
        router: { decision: routed, contractFile: FIXTURE_PATHS.router },
      },
      execution: {
        runId: RUN_ID,
        clock: {
          kind: "fixed-monotonic-millisecond",
          startsAt: "2026-08-21T00:00:00.000Z",
        },
        judgmentProviderBound: false,
        runStatusAfterStart: paused.status,
        runStatusAfterResumeWithoutResponse: resumedStillPaused.status,
        terminalStatus: null,
        suspendedAtStep: FIRST_SKILL_STEP,
        deterministicPrefix: [...DETERMINISTIC_PREFIX],
        planDigest: paused.plan.digest,
        declaredOrder: paused.plan.order,
        executedOrder,
        dependencyGraph: paused.plan.nodes.map((node) => ({
          id: node.id,
          dependsOn: node.dependsOn,
        })),
        stepOutcomes: paused.plan.order.map((id) => ({
          id,
          status: steps[id].status,
          attempts: steps[id].attempts,
          outputDigests: steps[id].outputDigests ?? {},
        })),
        pendingJudgmentRequest: {
          stepId: FIRST_SKILL_STEP,
          requestId: request.requestId,
          requestDigest: request.requestDigest,
          requestSchema: request.schema,
          attempt: request.identity.attempt,
          purpose: request.purpose,
          skillRef: request.skill,
          maximumChargeMicros: request.budget.maximumChargeMicros,
          requestPath: pendingRecord.requestPath,
          requestFileDigest: fileDigestFromAbsolute(requestAbsolutePath),
          recordState: pendingRecord.state,
        },
        trace: paused.trace,
        artifacts: artifactEntries,
      },
      assertions: {
        declaredGraphFullyRan: false,
        firstSkillStepAwaitingJudgment: true,
        deterministicPrefixCompletedInDependencyOrder: true,
        noCompletedSkillArtifact: true,
        noHumanReviewPacket: true,
        noActionGateOrReceipt: true,
        noJudgmentResponseConsumed: true,
        pendingRequestSealedAndPersisted: true,
        resumeWithoutResponsePreservesPause: true,
        noStubbedJudgmentMarker: true,
        noTestProviderCompletion: true,
      },
      releaseBoundary: {
        candidateBinding: null,
        candidateStatus: "UNBOUND",
        releaseState: "NO-GO",
        candidateEvidence: false,
        liveProviderEvidence: false,
        publicDistributionEvidence: false,
        cleanHostEvidence: false,
        humanReleaseVerdict: false,
        providerSupportPromoted: false,
        externalActionPerformed: false,
        exts156Executions: 0,
        humanVerdicts: 0,
      },
    };
    return { ...evidenceBasis, digest: sha256(evidenceBasis) };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

const evidence = await generate();
const bytes = `${canonicalJson(evidence)}\n`;
if (process.argv.includes("--stdout")) process.stdout.write(bytes);
else {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, bytes);
  console.log(
    `[generate-local-implementation] PASS — ${
      relative(productRoot, evidencePath)
    } ${sha256(bytes)}`,
  );
}
