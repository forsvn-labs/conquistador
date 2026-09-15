import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";
import { sha256 } from "../src/canonical.ts";

import {
  applyHumanEdit,
  type ArtifactEnvelope,
  assertAttribution,
  type AttributionContext,
  consumePriorArtifact,
  readEnvelope,
  validateArtifactEnvelope,
} from "../src/artifacts.ts";
import {
  type ActionGateRecord,
  actionPayloadDigest,
  evaluateActionGate,
  evaluateReviewApproval,
  type PlaybookReviewPacket,
  validateActionGateRecord,
  validatePlaybookReviewPacket,
} from "../src/gates.ts";
import {
  appendLearningEntry,
  learningEntriesFromRun,
  learningLedgerPath,
  readLearningLedger,
  validateLearningEntry,
} from "../src/learning.ts";
import {
  type PlaybookRecord,
  validatePlaybookRecord,
} from "../src/registry.ts";
import {
  type ResumeRunOptions,
  type RunSnapshot,
  type StartRunOptions,
  resumePlaybookRun as resumeRaw,
  startPlaybookRun as startRaw,
} from "../src/runner.ts";
import { canonicalReviewFixture } from "./review-fixture.ts";
import { testJudgmentProvider } from "./judgment-fixture.ts";
import {
  type ReviewPacketV1,
  ReviewTransitionState,
} from "../src/review-contract.ts";

function withTestJudgment<T>(options: T): T {
  return { judgment: testJudgmentProvider(), ...options } as unknown as T;
}

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(
  root,
  "fixtures/playbooks/content-intelligence-loop.json",
);
const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function runsDir(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "conquistador-lineage-"));
  temporary.push(directory);
  return directory;
}

function playbook(): PlaybookRecord {
  const record = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as PlaybookRecord;
  validatePlaybookRecord(record);
  return record;
}

function inputs(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    product: "Conquistador",
    audience: "founders who already work in a coding agent",
    channel: "linkedin",
    goals:
      "one evidence-backed post that can be reviewed before any draft is created",
    ...extra,
  };
}

function compileSchema() {
  const schema = JSON.parse(
    readFileSync(resolve(root, "schemas/artifact.schema.json"), "utf8"),
  );
  return new Ajv2020({ strict: false, formats: { "date-time": true } }).compile(
    schema,
  );
}

function attributionFrom(
  snapshot: RunSnapshot,
  record: PlaybookRecord,
): AttributionContext {
  return {
    runId: snapshot.runId,
    playbookId: snapshot.state.playbookId,
    playbookVersion: snapshot.state.playbookVersion,
    produced: Object.values(snapshot.state.artifacts).map((artifact) => ({
      artifactId: artifact.id,
      stepId: artifact.producedBy,
    })),
    steps: record.stepGraph.nodes.map((node) => {
      const judgment = snapshot.trace.find((event) =>
        event.type === "judgment.completed" && event.stepId === node.id
      );
      const skillId = typeof judgment?.detail.skillId === "string"
        ? judgment.detail.skillId
        : node.uses.skillId;
      const skillVersion =
        typeof judgment?.detail.skillVersion === "string"
          ? judgment.detail.skillVersion
          : undefined;
      return {
        id: node.id,
        skillId,
        skillVersion,
        scriptId: node.uses.scriptId,
        toolOperationId: node.uses.toolOperationId,
      };
    }),
  };
}

async function runToReview(
  directory: string,
  runId: string,
  extraInputs: Record<string, unknown> = {},
) {
  return startRaw(withTestJudgment({
    playbook: playbook(),
    inputs: inputs(extraInputs),
    runsDir: directory,
    runId,
  }));
}

async function completeRun(
  directory: string,
  runId: string,
  extraInputs: Record<string, unknown> = {},
) {
  await runToReview(directory, runId, extraInputs);
  return resumeRaw(withTestJudgment({
    runsDir: directory,
    runId,
    ...canonicalReviewFixture(directory, runId, "accept"),
  }));
}

function envelopeOf(
  snapshot: RunSnapshot,
  artifactId: string,
): ArtifactEnvelope {
  const relative = snapshot.state.artifacts[artifactId]?.envelopePath ??
    `artifacts/${artifactId}.meta.json`;
  return readEnvelope(resolve(snapshot.directory, relative));
}

function actionAuthority(directory: string, runId: string) {
  const runDirectory = resolve(directory, runId);
  const state = JSON.parse(
    readFileSync(resolve(runDirectory, "state.json"), "utf8"),
  );
  const canonicalPacket = JSON.parse(
    readFileSync(
      resolve(runDirectory, "canonical-review-packet.json"),
      "utf8",
    ),
  ) as ReviewPacketV1;
  const transitions = new ReviewTransitionState(state.reviewTransitions);
  const verdict = transitions.consumedVerdict(canonicalPacket);
  const authorization = transitions.issuedAuthorization(
    state.review.authorizationDigest,
  );
  return {
    canonicalPacket,
    transitions,
    verdict,
    authorization,
    context: canonicalReviewFixture(directory, runId, "accept").verification,
  };
}

describe("Artifact envelope", () => {
  it("writes markdown-default artifacts with schema-valid sidecar metadata from the flagship loop", async () => {
    const directory = runsDir();
    const snapshot = await completeRun(directory, "run-envelope");
    expect(snapshot.status).toBe("completed");
    const created = envelopeOf(snapshot, "created-artifact");
    expect(() => validateArtifactEnvelope(created)).not.toThrow();
    expect(created.identity.format).toBe("markdown");
    expect(created.identity.artifactId).toBe("created-artifact");
    expect(created.provenance.playbookId).toBe("content-intelligence-loop");
    expect(created.provenance.playbookVersion).toBe(playbook().version);
    expect(created.provenance.skillId).toBe("write-social");
    expect(created.provenance.skillVersion).toBe("2.1.0");
    expect(created.provenance.skillPackageDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(created.provenance.skillInterfaceDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(created.status).toBe("approved");
    expect(created.results).toEqual({ status: "unknown" });
    expect(created.reviewVerdict?.outcome).toBe("accept");
    expect(created.reviewVerdict?.boundContentDigest).toBe(
      created.contentDigest,
    );
    const observation = envelopeOf(snapshot, "observation-record");
    expect(observation.status).toBe("observed");
    expect(observation.results.status).toBe("unknown");
    expect(observation.observationWindow).toMatchObject({ elapsed: false });
    const validate = compileSchema();
    expect(validate(created), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(observation), JSON.stringify(validate.errors)).toBe(true);
    expect(
      existsSync(resolve(snapshot.directory, "artifacts/created-artifact.md")),
    ).toBe(true);
    expect(
      existsSync(
        resolve(snapshot.directory, "artifacts/created-artifact.meta.json"),
      ),
    ).toBe(true);
  });

  it("rejects fabricated playbook, skill, or version attribution against the run trace", async () => {
    const directory = runsDir();
    const snapshot = await completeRun(directory, "run-attribution");
    const created = envelopeOf(snapshot, "created-artifact");
    const context = attributionFrom(snapshot, playbook());
    expect(() => assertAttribution(created, context)).not.toThrow();

    expect(() =>
      assertAttribution({
        ...created,
        provenance: {
          ...created.provenance,
          playbookId: "some-other-playbook",
        },
      }, context)
    ).toThrow(/playbook id was not produced by this run/);

    expect(() =>
      assertAttribution({
        ...created,
        provenance: { ...created.provenance, playbookVersion: "9.9.9" },
      }, context)
    ).toThrow(/playbook version was not produced by this run/);

    expect(() =>
      assertAttribution({
        ...created,
        provenance: { ...created.provenance, skillId: "write-copy" },
      }, context)
    ).toThrow(/skill id was not used by the producing step/);

    expect(() =>
      assertAttribution({
        ...created,
        provenance: { ...created.provenance, skillVersion: "9.9.9" },
      }, context)
    ).toThrow(/skill version is not in the run context/);

    const contextEnvelope = envelopeOf(snapshot, "approved-context");
    expect(contextEnvelope.provenance.scriptId).toBe("load-approved-context");
    expect(() =>
      assertAttribution({
        ...contextEnvelope,
        provenance: { ...contextEnvelope.provenance, skillId: "write-social" },
      }, context)
    ).toThrow(/skill id was not used by the producing step/);
  });
});

describe("Review Packet and action gate", () => {
  it("keeps review and action as separate contracts bound to content hashes", async () => {
    const directory = runsDir();
    const snapshot = await completeRun(directory, "run-gates");
    const packet = JSON.parse(
      readFileSync(resolve(snapshot.directory, "review-packet.json"), "utf8"),
    ) as PlaybookReviewPacket;
    const gate = JSON.parse(
      readFileSync(resolve(snapshot.directory, "action-gate.json"), "utf8"),
    ) as ActionGateRecord;
    expect(() => validatePlaybookReviewPacket(packet)).not.toThrow();
    expect(() => validateActionGateRecord(gate)).not.toThrow();
    expect(packet.schemaVersion).toBe("conquistador.review-packet/v1");
    expect(gate.schemaVersion).toBe("conquistador.action-gate/v1");
    expect(packet.actionGateSeparate).toBe(true);
    expect(gate.gateId).not.toBe(packet.gateId);
    expect(gate.afterGate).toBe(packet.gateId);
    expect(packet).not.toHaveProperty("outcome");
    expect(gate.executed).toBe(false);
    expect(gate.liveCall).toBe(false);
    const validate = compileSchema();
    expect(validate(packet), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(gate), JSON.stringify(validate.errors)).toBe(true);
    const current = Object.fromEntries(
      packet.boundArtifacts.map((
        entry,
      ) => [entry.artifactId, entry.contentDigest]),
    );
    expect(evaluateReviewApproval(packet, current)).toEqual({ ok: true });
    const authority = actionAuthority(directory, "run-gates");
    expect(evaluateActionGate({
      packet,
      ...authority,
      gate,
      currentContentDigests: current,
      currentPayloadDigest: gate.boundPayloadDigest,
    })).toEqual({ ok: true });
  });

  it("fails closed when the artifact changes after the bound review", async () => {
    const directory = runsDir();
    const first = await runToReview(directory, "run-stale-artifact");
    expect(first.status).toBe("awaiting-review");
    const createdPath = resolve(
      first.directory,
      "artifacts/created-artifact.md",
    );
    writeFileSync(
      createdPath,
      `${
        readFileSync(createdPath, "utf8")
      }\nEdited after the packet was bound.\n`,
    );
    await expect(resumeRaw(withTestJudgment({
      runsDir: directory,
      runId: "run-stale-artifact",
      ...canonicalReviewFixture(directory, "run-stale-artifact", "accept"),
    }))).rejects.toThrow(
      /stale approval: artifact created-artifact changed after the bound review/,
    );
    expect(existsSync(resolve(first.directory, "action-gate.json"))).toBe(
      false,
    );
    expect(
      JSON.parse(readFileSync(resolve(first.directory, "state.json"), "utf8"))
        .status,
    ).toBe("awaiting-review");
  });

  it("fails closed when the action payload changes after approval", async () => {
    const directory = runsDir();
    const snapshot = await completeRun(directory, "run-stale-payload");
    const packet = JSON.parse(
      readFileSync(resolve(snapshot.directory, "review-packet.json"), "utf8"),
    ) as PlaybookReviewPacket;
    const gate = JSON.parse(
      readFileSync(resolve(snapshot.directory, "action-gate.json"), "utf8"),
    ) as ActionGateRecord;
    const current = Object.fromEntries(
      packet.boundArtifacts.map((
        entry,
      ) => [entry.artifactId, entry.contentDigest]),
    );
    const changedPayload = actionPayloadDigest({
      mutationClass: "publish",
      operationId: "distribution.create-draft",
      artifactContentDigests: current,
    });
    expect(changedPayload).not.toBe(gate.boundPayloadDigest);
    const authority = actionAuthority(directory, "run-stale-payload");
    expect(evaluateActionGate({
      packet,
      ...authority,
      gate,
      currentContentDigests: current,
      currentPayloadDigest: changedPayload,
    })).toMatchObject({ ok: false, code: "stale-approval" });
    const { digest: _digest, ...gateBasis } = gate;
    const forgedGateBasis = {
      ...gateBasis,
      boundPayloadDigest: changedPayload,
    };
    const forgedGate = {
      ...forgedGateBasis,
      digest: sha256(forgedGateBasis),
    } as ActionGateRecord;
    expect(evaluateActionGate({
      packet,
      ...authority,
      gate: forgedGate,
      currentContentDigests: current,
      currentPayloadDigest: changedPayload,
    })).toMatchObject({
      ok: false,
      code: "unreviewed",
      detail: "action gate payload is not the exact authorized payload",
    });
    const mutated = {
      ...current,
      "created-artifact": actionPayloadDigest({
        mutationClass: "draft",
        operationId: "x",
        artifactContentDigests: {},
      }),
    };
    expect(evaluateReviewApproval(packet, mutated)).toMatchObject({
      ok: false,
      code: "stale-approval",
    });
  });
});

describe("Later-run consumption", () => {
  it("reads a prior approved artifact with its verdict and never treats unreviewed revisions as truth", async () => {
    const directory = runsDir();
    const first = await completeRun(directory, "run-prior-approved");
    const createdPath = resolve(
      first.directory,
      "artifacts/created-artifact.md",
    );
    const approved = consumePriorArtifact(createdPath);
    expect(approved.reviewedAs).toBe("approved");
    expect(approved.verdict).toBe("accept");
    expect(approved.reason).toBe("approved");

    const laterApproved = await completeRun(directory, "run-later-approved", {
      priorApprovedContext: createdPath,
    });
    const approvedContext = readFileSync(
      resolve(laterApproved.directory, "artifacts/approved-context.md"),
      "utf8",
    );
    expect(approvedContext).toMatch(/Prior consumption: approved/);
    expect(approvedContext).toMatch(/user-owned, not universal truth/);
    expect(approvedContext).not.toMatch(/do not treat as truth/);

    applyHumanEdit({
      artifactFile: createdPath,
      newBody: `${
        readEnvelope(
          resolve(first.directory, "artifacts/created-artifact.meta.json"),
        ).identity.artifactId
      } revised after approval`,
      summary: "Operator tightened the draft",
      now: "2026-08-20T12:00:00.000Z",
    });
    const revised = consumePriorArtifact(createdPath);
    expect(revised.reviewedAs).toBe("unreviewed");
    expect(revised.reason).toBe("revised-after-approval");

    const laterRevised = await runToReview(directory, "run-later-revised", {
      priorApprovedContext: createdPath,
    });
    const revisedContext = readFileSync(
      resolve(laterRevised.directory, "artifacts/approved-context.md"),
      "utf8",
    );
    expect(revisedContext).toMatch(/Prior consumption: unreviewed/);
    expect(revisedContext).toMatch(/revised-after-approval/);
    expect(revisedContext).toMatch(/do not treat as truth/);
  });

  it("surfaces an unapproved prior artifact as unreviewed", async () => {
    const directory = runsDir();
    const first = await runToReview(directory, "run-prior-draft");
    const createdPath = resolve(
      first.directory,
      "artifacts/created-artifact.md",
    );
    const consumption = consumePriorArtifact(createdPath);
    expect(consumption.reviewedAs).toBe("unreviewed");
    expect(consumption.reason).toBe("missing-verdict");
    const later = await runToReview(directory, "run-later-draft", {
      priorApprovedContext: createdPath,
    });
    const context = readFileSync(
      resolve(later.directory, "artifacts/approved-context.md"),
      "utf8",
    );
    expect(context).toMatch(/Prior consumption: unreviewed/);
    expect(context).toMatch(/do not treat as truth/);
    expect(context).not.toMatch(/Prior verdict: accept/);
  });

  it("treats a forged verdict sidecar without consumed transition state as unreviewed", async () => {
    const directory = runsDir();
    const first = await runToReview(directory, "run-forged-sidecar");
    const createdPath = resolve(
      first.directory,
      "artifacts/created-artifact.md",
    );
    const sidecarPath = resolve(
      first.directory,
      "artifacts/created-artifact.meta.json",
    );
    const envelope = readEnvelope(sidecarPath);
    const canonicalPacket = JSON.parse(
      readFileSync(
        resolve(first.directory, "canonical-review-packet.json"),
        "utf8",
      ),
    ) as ReviewPacketV1;
    const forged = {
      ...envelope,
      status: "approved",
      reviewVerdict: {
        packetId: canonicalPacket.packetId,
        packetDigest: canonicalPacket.digest,
        outcome: "accept",
        artifactId: envelope.identity.artifactId,
        artifactRevision: envelope.revision.n,
        boundContentDigest: envelope.contentDigest,
        decidedAt: "2026-08-21T00:30:00.000Z",
      },
    } as ArtifactEnvelope;
    expect(() => validateArtifactEnvelope(forged)).not.toThrow();
    writeFileSync(sidecarPath, `${JSON.stringify(forged, null, 2)}\n`);
    const consumption = consumePriorArtifact(createdPath);
    expect(consumption).toMatchObject({
      reviewedAs: "unreviewed",
      reason: "missing-verdict",
    });
    expect(consumption.verdict).toBeUndefined();
  });
});

describe("Local learning ledger", () => {
  it("preserves explicit ledger APIs without promoting accepted run content automatically", async () => {
    const directory = runsDir();
    const snapshot = await completeRun(directory, "run-learning");
    const ledgerPath = learningLedgerPath(directory);
    expect(existsSync(ledgerPath)).toBe(false);
    const authority = actionAuthority(directory, snapshot.runId);
    const entries = learningEntriesFromRun({
      runId: snapshot.runId,
      recordedAt: "2026-08-22T00:00:00.000Z",
      envelopes: Object.values(snapshot.state.artifacts).map(artifact => envelopeOf(snapshot, artifact.id)),
      canonicalPacket: authority.canonicalPacket,
      verdict: authority.verdict,
      actionReceipt: authority.transitions.consumedReceipt(authority.authorization.digest),
    });
    // Explicit fixture writes exercise the low-level API, not runtime consent.
    for (const entry of entries) appendLearningEntry(ledgerPath, entry);
    expect(readLearningLedger(ledgerPath)).toEqual(entries);
    const before = readFileSync(ledgerPath);
    await completeRun(directory, "run-preserves-learning");
    expect(readFileSync(ledgerPath)).toEqual(before);
    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every((entry) =>
        entry.approved === true && entry.inferred === false
      ),
    ).toBe(true);
    expect(
      entries.every((entry) =>
        ["fact", "decision", "edit-delta", "action", "observed-result"].includes(entry.kind) &&
        entry.source.reviewPacketId !== undefined
      ),
    ).toBe(true);
    expect(
      entries.some((entry) =>
        entry.kind === "fact" && entry.source.artifactId === "created-artifact"
      ),
    ).toBe(true);
    expect(entries.some((entry) =>
      entry.kind === "action" &&
      entry.source.actionReceiptId === "fixture-terminal-receipt" &&
      entry.source.artifactId === "review-bundle"
    )).toBe(true);
    expect(entries.some((entry) => entry.kind === "observed-result")).toBe(false);
    expect(
      entries.every((entry) =>
        !JSON.stringify(entry).includes("hiddenReasoning")
      ),
    ).toBe(true);
    const validate = compileSchema();
    for (const entry of entries) {
      expect(() => validateLearningEntry(entry)).not.toThrow();
      expect(validate(entry), JSON.stringify(validate.errors)).toBe(true);
    }

    expect(() =>
      appendLearningEntry(ledgerPath, {
        schemaVersion: "conquistador.learning-entry/v1",
        id: "inferred-1",
        recordedAt: "2026-08-20T00:00:00.000Z",
        runId: snapshot.runId,
        kind: "fact",
        approved: true,
        inferred: true,
        source: {
          artifactId: "created-artifact",
          contentDigest: envelopeOf(snapshot, "created-artifact").contentDigest,
          reviewPacketId: "x",
        },
        body: { guess: "the post performed well" },
      })
    ).toThrow(/model-inferred/);

    expect(() =>
      appendLearningEntry(ledgerPath, {
        schemaVersion: "conquistador.learning-entry/v1",
        id: "reason-1",
        recordedAt: "2026-08-20T00:00:00.000Z",
        runId: snapshot.runId,
        kind: "fact",
        approved: true,
        inferred: false,
        source: {
          artifactId: "created-artifact",
          contentDigest: envelopeOf(snapshot, "created-artifact").contentDigest,
          reviewPacketId: "x",
        },
        body: { hiddenReasoning: "the model thought this" },
      })
    ).toThrow(/hidden reasoning or model output/);
  });

  it("does not promote a measured observation that merely self-declares the review-bundle verdict", async () => {
    const directory = runsDir();
    const snapshot = await completeRun(directory, "run-measured-learning");
    const authority = actionAuthority(directory, snapshot.runId);
    const receipt = authority.transitions.consumedReceipt(
      authority.authorization.digest,
    );
    expect(receipt).toBeDefined();

    const reviewBundle = envelopeOf(snapshot, "review-bundle");
    const observation = structuredClone(envelopeOf(snapshot, "observation-record"));
    observation.observationWindow = { declared: "48h", elapsed: true };
    observation.results = { status: "known", measures: { impressions: 42 } };
    observation.reviewVerdict = {
      packetId: authority.canonicalPacket.packetId,
      packetDigest: authority.canonicalPacket.digest,
      outcome: "accept",
      artifactId: observation.identity.artifactId,
      artifactRevision: observation.revision.n,
      boundContentDigest: observation.contentDigest,
      decidedAt: authority.verdict.decidedAt,
    };
    const input = {
      runId: snapshot.runId,
      recordedAt: "2026-08-22T00:00:00.000Z",
      envelopes: [reviewBundle, observation],
      canonicalPacket: authority.canonicalPacket,
      verdict: authority.verdict,
      actionReceipt: receipt!,
    };
    const learned = learningEntriesFromRun(input);
    expect(learned.filter((entry) => entry.kind === "action")).toHaveLength(1);
    expect(learned.filter((entry) => entry.kind === "observed-result")).toHaveLength(0);

    const unreviewed = structuredClone(observation);
    unreviewed.reviewVerdict = null;
    expect(learningEntriesFromRun({ ...input, envelopes: [reviewBundle, unreviewed] })
      .some((entry) => entry.kind === "observed-result")).toBe(false);
    const mismatchedProjection = structuredClone(observation);
    mismatchedProjection.reviewVerdict!.artifactId = "created-artifact";
    mismatchedProjection.reviewVerdict!.artifactRevision = reviewBundle.revision.n;
    expect(learningEntriesFromRun({ ...input, envelopes: [reviewBundle, mismatchedProjection] })
      .some((entry) => entry.kind === "observed-result")).toBe(false);
    expect(learningEntriesFromRun({
      ...input,
      actionReceipt: { ...receipt!, status: "failed" },
    }).some((entry) => entry.kind === "action" || entry.kind === "observed-result"))
      .toBe(false);
  });

  it("does not require lineage contracts for plugin-only skill use", () => {
    const runtimeSource = readFileSync(resolve(root, "src/runtime.ts"), "utf8");
    const corpusSource = readFileSync(resolve(root, "src/corpus.ts"), "utf8");
    expect(runtimeSource).not.toMatch(/from "\.\/artifacts\.ts"/);
    expect(runtimeSource).not.toMatch(/from "\.\/gates\.ts"/);
    expect(runtimeSource).not.toMatch(/from "\.\/learning\.ts"/);
    expect(corpusSource).not.toMatch(/from "\.\/artifacts\.ts"/);
  });
});
