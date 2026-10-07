import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type PlaybookRecord,
  validatePlaybookRecord,
} from "../src/registry.ts";
import { seal } from "../src/review-contract.ts";
import {
  type ResumeRunOptions,
  type StartRunOptions,
  loadPlaybookRun,
  resumePlaybookRun as resumeRaw,
  startPlaybookRun as startRaw,
} from "../src/runner.ts";
import { canonicalReviewFixture } from "./review-fixture.ts";
import { testJudgmentProvider, testResponseFor } from "./judgment-fixture.ts";
import { createHostJudgmentProvider, requestDigestOf } from "../src/judgment.ts";

function withTestJudgment<T>(options: T): T {
  return { judgment: testJudgmentProvider(), ...options } as unknown as T;
}

const startPlaybookRun = (options: StartRunOptions) =>
  startRaw(withTestJudgment(options));
const resumePlaybookRun = (options: ResumeRunOptions) =>
  resumeRaw(withTestJudgment(options));

const fixturePath = resolve(
  import.meta.dirname,
  "../fixtures/playbooks/content-intelligence-loop.json",
);
const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function runsDir(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "conquistador-run-"));
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

function inputs(): Record<string, unknown> {
  return {
    product: "Conquistador",
    audience: "founders who already work in a coding agent",
    channel: "linkedin",
    goals:
      "one evidence-backed post that can be reviewed before any draft is created",
  };
}

const GRAPH = [
  "load-context",
  "pull-signals",
  "normalize-data",
  "rank-opportunities",
  "select-hypothesis",
  "create-artifact",
  "specialist-review",
  "approved-action",
  "observe-results",
  "measure-and-decide",
  "store-learning",
] as const;

describe("Local Playbook Runner", () => {
  it("fails closed when the playbook record does not validate", async () => {
    const directory = runsDir();
    await expect(startPlaybookRun({
      playbook: { steps: ["research", "write"] },
      inputs: inputs(),
      runsDir: directory,
      runId: "run-invalid",
    })).rejects.toThrow(/prose sequence is not a playbook|must be an object/);
    expect(existsSync(resolve(directory, "run-invalid", "state.json"))).toBe(
      false,
    );
  });

  it("executes the declared content-intelligence-loop graph and stops at the review gate", async () => {
    const directory = runsDir();
    const first = await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-loop",
    });
    expect(first.status).toBe("awaiting-review");
    expect(first.plan.order).toEqual([...GRAPH]);
    expect(existsSync(resolve(first.directory, "plan.json"))).toBe(true);
    expect(existsSync(resolve(first.directory, "review-packet.json"))).toBe(
      true,
    );
    expect(first.state.steps["specialist-review"].status).toBe("completed");
    expect(first.state.steps["approved-action"].status).toBe("pending");
    expect(first.state.artifacts["action-receipt"]).toBeUndefined();
    const reviewEvent = first.trace.find((event) =>
      event.type === "gate.review"
    );
    expect(reviewEvent?.detail).toMatchObject({
      humanRequired: true,
      modelCannotSatisfy: true,
      actionNotTaken: true,
    });
    const packet = JSON.parse(
      readFileSync(resolve(first.directory, "review-packet.json"), "utf8"),
    ) as {
      actionProposals: Array<{ executed: boolean }>;
    };
    expect(
      packet.actionProposals.every((proposal) => proposal.executed === false),
    ).toBe(true);
    const completed = first.trace.filter(
      (event) => event.type === "judgment.completed",
    );
    expect(completed.length).toBe(3);
    expect(completed.every((event) => event.detail.evidenceEligible === false))
      .toBe(true);
    expect(first.trace.filter((e) => e.type === "judgment.requested").length)
      .toBe(3);
    for (const event of completed) {
      const receipt = JSON.parse(
        readFileSync(
          resolve(first.directory, `receipts/${event.stepId}.json`),
          "utf8",
        ),
      ) as { judgment?: { evidenceEligible?: boolean; requestId?: string } };
      expect(receipt.judgment?.evidenceEligible).toBe(false);
      expect(receipt.judgment?.requestId).toBe(event.detail.requestId);
    }
    expect(first.trace.some((event) => event.detail.liveCall === true)).toBe(
      false,
    );
    expect(
      readFileSync(resolve(import.meta.dirname, "../src/runner.ts"), "utf8"),
    ).not.toMatch(
      /createProvider|credentialEnv|OPENAI_API_KEY|ANTHROPIC_API_KEY/,
    );

    const resumed = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-loop",
      ...canonicalReviewFixture(directory, "run-loop", "accept"),
    });
    expect(resumed.status).toBe("completed");
    expect(GRAPH.map((id) => resumed.state.steps[id].status)).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
    const started = resumed.trace.filter((event) =>
      event.type === "step.started"
    ).map((event) => event.stepId);
    expect(started).toEqual([...GRAPH]);
    const skipped = resumed.trace.filter((event) =>
      event.type === "step.skipped"
    ).map((event) => event.stepId);
    expect(skipped).toEqual(GRAPH.slice(0, 7));
    const action = resumed.trace.find((event) => event.type === "gate.action");
    expect(action?.detail).toMatchObject({
      executed: false,
      fallback: "human-action-manifest",
      humanRequired: true,
      modelCannotSatisfy: true,
    });
    const receipt = readFileSync(
      resolve(resumed.directory, "artifacts/action-receipt.md"),
      "utf8",
    );
    expect(receipt).toMatch(/Executed: no/);
    expect(receipt).toMatch(/does not perform external actions/i);
    const invoked = resumed.trace.filter((event) =>
      event.type === "operation.invoked"
    );
    expect(invoked.map((event) => event.detail.operationId)).toEqual([
      "signals.pull-bounded",
      "distribution.create-draft",
      "performance.observe-window",
    ]);
    expect(
      invoked.every((event) => event.detail.kind === "human-action-manifest"),
    ).toBe(true);
    const runReceipt = JSON.parse(
      readFileSync(resolve(resumed.directory, "receipts/run.json"), "utf8"),
    ) as { cost: number };
    expect(runReceipt.cost).toBe(0);
    expect(resumed.state.artifacts["approved-context"].parents).toEqual([]);
    expect(resumed.state.artifacts["normalized-signals"].parents).toContain(
      "signal-bundle",
    );
  });

  it("resumes after interrupt without redoing completed idempotent work", async () => {
    const directory = runsDir();
    const interrupted = await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-resume",
      interruptAfter: "load-context",
    });
    expect(interrupted.status).toBe("cancelled");
    expect(interrupted.state.steps["load-context"].status).toBe("completed");
    expect(interrupted.state.steps["pull-signals"].status).toBe("pending");
    const digest = interrupted.state.artifacts["approved-context"].digest;

    const resumed = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-resume",
    });
    expect(resumed.status).toBe("awaiting-review");
    expect(resumed.state.artifacts["approved-context"].digest).toBe(digest);
    expect(
      resumed.trace.some((event) =>
        event.type === "step.skipped" && event.stepId === "load-context"
      ),
    ).toBe(true);
    expect(
      resumed.trace.filter((event) =>
        event.type === "step.started" && event.stepId === "load-context"
      ),
    ).toHaveLength(1);
    expect(resumed.state.steps["load-context"].attempts).toBe(1);
    expect(loadPlaybookRun(directory, "run-resume").status).toBe(
      "awaiting-review",
    );
  });

  it("stops or degrades exactly as the playbook declares", async () => {
    const directory = runsDir();
    const stopped = await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-stop",
      failStep: { id: "normalize-data", error: "normalizer exploded" },
    });
    expect(stopped.status).toBe("failed");
    expect(stopped.state.steps["load-context"].status).toBe("completed");
    expect(stopped.state.steps["pull-signals"].status).toBe("completed");
    expect(stopped.state.steps["normalize-data"].status).toBe("failed");
    expect(stopped.state.steps["normalize-data"].error).toBe(
      "normalizer exploded",
    );
    expect(stopped.state.steps["rank-opportunities"].status).toBe("pending");
    expect(
      stopped.trace.some((event) =>
        event.type === "step.failed" && event.detail.failureBehavior === "stop"
      ),
    ).toBe(true);

    const degraded = await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-degrade",
      failStep: { id: "pull-signals", error: "signals unavailable" },
    });
    expect(degraded.status).toBe("awaiting-review");
    expect(degraded.state.steps["pull-signals"].status).toBe("degraded");
    expect(degraded.state.steps["pull-signals"].attempts).toBe(2);
    expect(degraded.state.steps["normalize-data"].status).toBe("completed");
    expect(
      degraded.trace.some((event) =>
        event.type === "step.degraded" &&
        event.detail.failureBehavior === "degrade"
      ),
    ).toBe(true);
    const bundle = JSON.parse(
      readFileSync(
        resolve(degraded.directory, "artifacts/signal-bundle.json"),
        "utf8",
      ),
    ) as {
      body: { executed: boolean; fallback: string; degraded: boolean };
    };
    expect(bundle.body.executed).toBe(false);
    expect(bundle.body.fallback).toBe("human-action-manifest");
    expect(bundle.body.degraded).toBe(true);
  });

  it("keeps review rejection separate from external action", async () => {
    const directory = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-reject",
    });
    const rejected = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-reject",
      ...canonicalReviewFixture(directory, "run-reject", "reject"),
    });
    expect(rejected.status).toBe("rejected");
    expect(rejected.state.steps["approved-action"].status).toBe("pending");
    expect(rejected.state.artifacts["action-receipt"]).toBeUndefined();
    expect(rejected.trace.some((event) => event.type === "gate.action")).toBe(
      false,
    );
    expect(rejected.trace.at(-1)?.detail).toMatchObject({
      reason: "review-rejected",
      actionNotTaken: true,
    });
  });

  it.each(["revise", "reject", "cancel"] as const)(
    "treats %s as a distinct terminal review transition without action",
    async (outcome) => {
      const directory = runsDir();
      const runId = `run-${outcome}`;
      await startPlaybookRun({
        playbook: playbook(),
        inputs: inputs(),
        runsDir: directory,
        runId,
      });
      const result = await resumePlaybookRun({
        runsDir: directory,
        runId,
        ...canonicalReviewFixture(directory, runId, outcome),
      });
      expect(result.status).toBe(
        outcome === "revise"
          ? "revision-requested"
          : outcome === "reject"
          ? "rejected"
          : "cancelled",
      );
      expect(
        existsSync(
          resolve(result.directory, "canonical-action-authorization.json"),
        ),
      ).toBe(false);
    },
  );

  it("fails wrong, expired, changed, and rehydrated conflicting authority", async () => {
    const wrongDir = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: wrongDir,
      runId: "run-wrong",
    });
    const wrong = canonicalReviewFixture(wrongDir, "run-wrong", "reject");
    await expect(resumePlaybookRun({
      runsDir: wrongDir,
      runId: "run-wrong",
      ...wrong,
      verification: {
        ...wrong.verification,
        verifyAuthentication: () => false,
      },
    })).rejects.toThrow(/host authentication/);

    const staleDir = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: staleDir,
      runId: "run-stale",
    });
    await expect(resumePlaybookRun({
      runsDir: staleDir,
      runId: "run-stale",
      ...canonicalReviewFixture(staleDir, "run-stale", "reject", {
        now: "2099-01-01T00:00:00.000Z",
      }),
    })).rejects.toThrow(/expired|chronology/);

    const changedDir = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: changedDir,
      runId: "run-changed",
    });
    const changedFixture = canonicalReviewFixture(
      changedDir,
      "run-changed",
      "accept",
    );
    const changedAuthorization: any = structuredClone(
      changedFixture.actionAuthorization,
    );
    delete changedAuthorization.digest;
    changedAuthorization.allowed.payloadDigest = `sha256:${"0".repeat(64)}`;
    await expect(resumePlaybookRun({
      runsDir: changedDir,
      runId: "run-changed",
      ...changedFixture,
      actionAuthorization: seal(changedAuthorization),
    })).rejects.toThrow(/allowed action mismatch/);

    const replayDir = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: replayDir,
      runId: "run-rehydrate",
    });
    await resumePlaybookRun({
      runsDir: replayDir,
      runId: "run-rehydrate",
      ...canonicalReviewFixture(replayDir, "run-rehydrate", "revise"),
    });
    await expect(resumePlaybookRun({
      runsDir: replayDir,
      runId: "run-rehydrate",
      ...canonicalReviewFixture(replayDir, "run-rehydrate", "reject", {
        verdictId: "fresh-conflicting-verdict",
      }),
    })).rejects.toThrow(
      /packet verdict already consumed|packet revision already has a terminal verdict/,
    );
  });

  it("persists issued authorization and accepts one delayed exact receipt after reload", async () => {
    const directory = runsDir();
    const runId = "run-delayed-receipt";
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId,
    });
    const pendingAuthority = canonicalReviewFixture(
      directory,
      runId,
      "accept",
      { omitReceipt: true },
    );
    const pending = await resumePlaybookRun({
      runsDir: directory,
      runId,
      ...pendingAuthority,
    });
    expect(pending.status).toBe("awaiting-action-receipt");
    expect(pending.state.steps["approved-action"].status).toBe("pending");
    expect(loadPlaybookRun(directory, runId).status).toBe(
      "awaiting-action-receipt",
    );
    const stillPending = await resumePlaybookRun({ runsDir: directory, runId });
    expect(stillPending.status).toBe("awaiting-action-receipt");

    const exactReceipt = canonicalReviewFixture(directory, runId, "accept")
      .actionReceipt!;
    const completed = await resumePlaybookRun({
      runsDir: directory,
      runId,
      actionReceipt: exactReceipt,
      now: pendingAuthority.now,
    });
    expect(completed.status).toBe("completed");
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId,
      actionReceipt: exactReceipt,
      now: pendingAuthority.now,
    })).rejects.toThrow(/not awaiting an action receipt/);
  });

  it("fails closed for mismatched receipt and missing persisted authority snapshot", async () => {
    const directory = runsDir();
    const runId = "run-receipt-mismatch";
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId,
    });
    const pending = canonicalReviewFixture(directory, runId, "accept", {
      omitReceipt: true,
    });
    await resumePlaybookRun({ runsDir: directory, runId, ...pending });
    const mismatchFixture = canonicalReviewFixture(directory, runId, "accept");
    const mismatched: any = structuredClone(mismatchFixture.actionReceipt);
    delete mismatched.digest;
    mismatched.payloadDigest = `sha256:${"1".repeat(64)}`;
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId,
      actionReceipt: seal(mismatched),
      now: pending.now,
    })).rejects.toThrow(/receipt action mismatch/);

    const statePath = resolve(directory, runId, "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    const transitions = state.reviewTransitions;
    delete state.reviewTransitions;
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    expect(loadPlaybookRun(directory, runId).state.reviewTransitions).toEqual(
      transitions,
    );
    state.reviewTransitions = transitions;
    delete state.review;
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    expect(loadPlaybookRun(directory, runId).state.review).toBeDefined();
  });

  it.each(["failed", "cancelled"] as const)(
    "stops immediate %s action receipts before observation or learning",
    async (receiptStatus) => {
      const directory = runsDir();
      const runId = `run-immediate-${receiptStatus}`;
      await startPlaybookRun({
        playbook: playbook(),
        inputs: inputs(),
        runsDir: directory,
        runId,
      });
      const result = await resumePlaybookRun({
        runsDir: directory,
        runId,
        ...canonicalReviewFixture(directory, runId, "accept", {
          receiptStatus,
        }),
      });
      expect(result.status).toBe(receiptStatus);
      expect(result.state.steps["approved-action"].status).toBe("pending");
      expect(result.state.steps["observe-results"].status).toBe("pending");
      expect(result.state.artifacts["observation-record"]).toBeUndefined();
      expect(result.state.artifacts["learning-record"]).toBeUndefined();
      const restarted = await resumePlaybookRun({ runsDir: directory, runId });
      expect(restarted.status).toBe(receiptStatus);
      expect(restarted.state.steps["observe-results"].status).toBe("pending");
    },
  );

  it.each(["failed", "cancelled"] as const)(
    "stops delayed %s receipts after reload and rejects reuse",
    async (receiptStatus) => {
      const directory = runsDir();
      const runId = `run-delayed-${receiptStatus}`;
      await startPlaybookRun({
        playbook: playbook(),
        inputs: inputs(),
        runsDir: directory,
        runId,
      });
      const pending = canonicalReviewFixture(directory, runId, "accept", {
        omitReceipt: true,
      });
      await resumePlaybookRun({ runsDir: directory, runId, ...pending });
      expect(loadPlaybookRun(directory, runId).status).toBe(
        "awaiting-action-receipt",
      );
      const receipt = canonicalReviewFixture(directory, runId, "accept", {
        receiptStatus,
      }).actionReceipt!;
      const stopped = await resumePlaybookRun({
        runsDir: directory,
        runId,
        actionReceipt: receipt,
        now: pending.now,
      });
      expect(stopped.status).toBe(receiptStatus);
      expect(stopped.state.steps["observe-results"].status).toBe("pending");
      await expect(resumePlaybookRun({
        runsDir: directory,
        runId,
        actionReceipt: receipt,
        now: pending.now,
      })).rejects.toThrow(/not awaiting an action receipt/);
    },
  );

  it("keeps human review cancellation terminal across restart", async () => {
    const directory = runsDir();
    const runId = "run-human-cancel-terminal";
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId,
    });
    const cancelled = await resumePlaybookRun({
      runsDir: directory,
      runId,
      ...canonicalReviewFixture(directory, runId, "cancel"),
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.state.terminalAuthorityStop).toBe("review-cancelled");
    expect(loadPlaybookRun(directory, runId).status).toBe("cancelled");
    const second = await resumePlaybookRun({ runsDir: directory, runId });
    expect(second.status).toBe("cancelled");
    expect(second.state.steps["approved-action"].status).toBe("pending");
  });

  it.each(
    [
      "journal",
      "state",
      "trace",
      "decision",
      "authorization",
      "gate",
      "receipt",
    ] as const,
  )("recovers an interrupted authority commit after %s", async (boundary) => {
    const directory = runsDir();
    const runId = `run-fault-${boundary}`;
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId,
    });
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId,
      ...canonicalReviewFixture(directory, runId, "accept"),
      faultAfterAuthorityBoundary: boundary,
    })).rejects.toThrow(/injected authority fault/);
    const recovered = loadPlaybookRun(directory, runId);
    expect(recovered.status).toBe("running");
    expect(recovered.state.reviewTransitions?.consumedAuthorizations)
      .toHaveLength(1);
    expect(existsSync(resolve(recovered.directory, "review-packet.json"))).toBe(
      true,
    );
    expect(
      existsSync(
        resolve(recovered.directory, "canonical-action-authorization.json"),
      ),
    ).toBe(true);
    expect(existsSync(resolve(recovered.directory, "action-gate.json"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(recovered.directory, "canonical-action-receipt.json")),
    ).toBe(true);
    const completed = await resumePlaybookRun({ runsDir: directory, runId });
    expect(completed.status).toBe("completed");
  });

  it.each(["cancel", "failed", "cancelled"] as const)(
    "reconstructs mandatory terminal authority state after %s tampering",
    async (terminalKind) => {
      const directory = runsDir();
      const runId = `run-terminal-repair-${terminalKind}`;
      await startPlaybookRun({
        playbook: playbook(),
        inputs: inputs(),
        runsDir: directory,
        runId,
      });
      const fixture = terminalKind === "cancel"
        ? canonicalReviewFixture(directory, runId, "cancel")
        : canonicalReviewFixture(directory, runId, "accept", {
          receiptStatus: terminalKind,
        });
      const stopped = await resumePlaybookRun({
        runsDir: directory,
        runId,
        ...fixture,
      });
      const statePath = resolve(stopped.directory, "state.json");
      const authoritative = JSON.parse(readFileSync(statePath, "utf8"));

      for (
        const mutation of [
          (state: any) => delete state.terminalAuthorityStop,
          (state: any) =>
            state.terminalAuthorityStop =
              state.terminalAuthorityStop === "review-cancelled"
                ? "action-receipt-failed"
                : "review-cancelled",
          (state: any) =>
            state.status = state.status === "failed" ? "cancelled" : "failed",
        ]
      ) {
        const altered = structuredClone(authoritative);
        mutation(altered);
        writeFileSync(statePath, `${JSON.stringify(altered, null, 2)}\n`);
        const repaired = loadPlaybookRun(directory, runId);
        expect(repaired.state).toEqual(authoritative);
        expect(repaired.state.steps["observe-results"].status).toBe("pending");
      }

      const restarted = await resumePlaybookRun({ runsDir: directory, runId });
      expect(restarted.status).toBe(stopped.status);
      expect(restarted.state.steps["observe-results"].status).toBe("pending");
    },
  );

  it.each(["failed", "cancelled"] as const)(
    "reconstructs delayed %s receipt terminality after restart tampering",
    async (receiptStatus) => {
      const directory = runsDir();
      const runId = `run-delayed-terminal-repair-${receiptStatus}`;
      await startPlaybookRun({
        playbook: playbook(),
        inputs: inputs(),
        runsDir: directory,
        runId,
      });
      const pending = canonicalReviewFixture(directory, runId, "accept", {
        omitReceipt: true,
      });
      await resumePlaybookRun({ runsDir: directory, runId, ...pending });
      const receipt = canonicalReviewFixture(directory, runId, "accept", {
        receiptStatus,
      }).actionReceipt!;
      const stopped = await resumePlaybookRun({
        runsDir: directory,
        runId,
        actionReceipt: receipt,
        now: pending.now,
      });
      const statePath = resolve(stopped.directory, "state.json");
      const authoritative = JSON.parse(readFileSync(statePath, "utf8"));
      const altered = structuredClone(authoritative);
      delete altered.terminalAuthorityStop;
      altered.status = receiptStatus === "failed" ? "cancelled" : "failed";
      writeFileSync(statePath, `${JSON.stringify(altered, null, 2)}\n`);
      const repaired = loadPlaybookRun(directory, runId);
      expect(repaired.state).toEqual(authoritative);
      expect(repaired.state.steps["observe-results"].status).toBe("pending");
    },
  );

  it("repairs every current authority projection and is repeat-load deterministic", async () => {
    const directory = runsDir();
    const runId = "run-applied-projection-repair";
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId,
    });
    await resumePlaybookRun({
      runsDir: directory,
      runId,
      ...canonicalReviewFixture(directory, runId, "accept", {
        omitReceipt: true,
      }),
    });
    const runDirectory = resolve(directory, runId);
    const journal = JSON.parse(
      readFileSync(resolve(runDirectory, "authority-commit.json"), "utf8"),
    );
    expect(journal.phase).toBe("applied");
    const projectionPaths = [
      journal.projections.decision.path,
      "canonical-action-authorization.json",
      "action-gate.json",
    ];
    writeFileSync(resolve(runDirectory, "state.json"), '{"altered":true}\n');
    writeFileSync(resolve(runDirectory, "trace.json"), "[]\n");
    loadPlaybookRun(directory, runId);
    expect(
      JSON.parse(readFileSync(resolve(runDirectory, "state.json"), "utf8")),
    )
      .toEqual(journal.state);
    expect(
      JSON.parse(readFileSync(resolve(runDirectory, "trace.json"), "utf8")),
    )
      .toEqual(journal.trace);
    for (const projectionPath of projectionPaths) {
      const absolute = resolve(runDirectory, projectionPath);
      unlinkSync(absolute);
      loadPlaybookRun(directory, runId);
      expect(JSON.parse(readFileSync(absolute, "utf8"))).toEqual(
        projectionPath === journal.projections.decision.path
          ? journal.projections.decision.value
          : projectionPath === "canonical-action-authorization.json"
          ? journal.projections.authorization
          : journal.projections.gate,
      );
      writeFileSync(absolute, '{"altered":true}\n');
      loadPlaybookRun(directory, runId);
    }
    const once = readFileSync(resolve(runDirectory, "state.json"), "utf8");
    loadPlaybookRun(directory, runId);
    expect(readFileSync(resolve(runDirectory, "state.json"), "utf8")).toBe(
      once,
    );
  });

  it("retires the checkpoint after success and preserves later progress", async () => {
    const directory = runsDir();
    const runId = "run-retired-checkpoint";
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId,
    });
    const completed = await resumePlaybookRun({
      runsDir: directory,
      runId,
      ...canonicalReviewFixture(directory, runId, "accept"),
    });
    const runDirectory = completed.directory;
    const journal = JSON.parse(
      readFileSync(resolve(runDirectory, "authority-commit.json"), "utf8"),
    );
    expect(journal.phase).toBe("retired");
    expect(completed.state.steps["store-learning"].status).toBe("completed");
    expect(existsSync(resolve(directory, "learning.jsonl"))).toBe(false);

    const receiptPath = resolve(
      runDirectory,
      "canonical-action-receipt.json",
    );
    unlinkSync(receiptPath);
    const recovered = loadPlaybookRun(directory, runId);
    expect(recovered.status).toBe("completed");
    expect(recovered.state.steps["store-learning"].status).toBe("completed");
    expect(existsSync(resolve(directory, "learning.jsonl"))).toBe(false);
    expect(JSON.parse(readFileSync(receiptPath, "utf8"))).toEqual(
      journal.projections.receipt,
    );
    writeFileSync(receiptPath, '{"altered":true}\n');
    loadPlaybookRun(directory, runId);
    expect(JSON.parse(readFileSync(receiptPath, "utf8"))).toEqual(
      journal.projections.receipt,
    );
    const stateBytes = readFileSync(
      resolve(runDirectory, "state.json"),
      "utf8",
    );
    loadPlaybookRun(directory, runId);
    expect(readFileSync(resolve(runDirectory, "state.json"), "utf8")).toBe(
      stateBytes,
    );
  });

  it("pauses at the first skill step with awaiting-judgment when no provider exists", async () => {
    const directory = runsDir();
    const paused = await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-await",
      judgment: undefined,
    });
    expect(paused.status).toBe("awaiting-judgment");
    expect(paused.state.steps["rank-opportunities"].status).toBe(
      "awaiting-judgment",
    );
    expect(paused.state.steps["normalize-data"].status).toBe("completed");
    expect(paused.state.steps["select-hypothesis"].status).toBe("pending");
    expect(paused.state.artifacts["opportunity-briefs"]).toBeUndefined();
    expect(existsSync(resolve(paused.directory, "review-packet.json"))).toBe(
      false,
    );
    expect(paused.trace.some((event) => event.type === "judgment.requested"))
      .toBe(true);
    expect(paused.trace.some((event) => event.type === "judgment.completed"))
      .toBe(false);
    const record = paused.state.judgments?.["rank-opportunities"];
    expect(record?.state).toBe("pending");
    const request = JSON.parse(
      readFileSync(resolve(paused.directory, record!.requestPath!), "utf8"),
    ) as { requestId: string; identity: { stepId: string }; budget: unknown };
    expect(request.requestId).toBe(record!.requestId);
    expect(request.identity.stepId).toBe("rank-opportunities");

    const stillPaused = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-await",
      judgment: undefined,
    });
    expect(stillPaused.status).toBe("awaiting-judgment");
  });

  it("persists the sealed request before invoking an injected provider and records evidence ineligibility", async () => {
    const directory = runsDir();
    const seen: string[] = [];
    const provider = {
      binding: {
        hostId: "test-host",
        adapterId: "test-fixture",
        adapterVersion: "1.0.0",
      },
      testOnly: true as const,
      execute: async (request: Parameters<typeof testResponseFor>[0]) => {
        seen.push(request.requestId);
        return testResponseFor(request);
      },
    };
    const result = await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-spy",
      judgment: provider,
    });
    expect(seen.length).toBe(3);
    const record = result.state.judgments!["specialist-review"];
    expect(seen[0]).toBe(result.state.judgments!["rank-opportunities"].requestId);
    expect(record.state).toBe("consumed");
    expect(result.state.tokenUsage.judgmentTokens).toBe(90);
    const storedRequest = JSON.parse(
      readFileSync(
        resolve(directory, "run-spy", record.requestPath!),
        "utf8",
      ),
    ) as { requestId: string };
    expect(storedRequest.requestId).toBe(record.requestId);
  });

  it("gives raw providers only an immutable reparse of the sealed request and rejects a recomputed forgery", async () => {
    const directory = runsDir();
    let mutationRejected = false;
    const maliciousProvider = {
      testOnly: true as const,
      execute: async (request: Parameters<typeof testResponseFor>[0]) => {
        expect(Object.isFrozen(request)).toBe(true);
        expect(Object.isFrozen(request.skill)).toBe(true);
        expect(() => {
          (request as unknown as { skill: { version: string } }).skill.version = "9.9.9";
        }).toThrow();
        mutationRejected = true;
        const forged = structuredClone(request);
        forged.skill.version = "9.9.9";
        forged.requestDigest = requestDigestOf(forged);
        return testResponseFor(forged);
      },
    };
    await expect(startRaw({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-malicious-request-mutation",
      judgment: maliciousProvider,
    })).rejects.toThrow(/does not bind the pending request/);
    expect(mutationRejected).toBe(true);
    const paused = loadPlaybookRun(directory, "run-malicious-request-mutation");
    expect(paused.status).toBe("awaiting-judgment");
    expect(paused.state.artifacts["opportunity-briefs"]).toBeUndefined();
    const pending = paused.state.judgments!["rank-opportunities"];
    const sealed = JSON.parse(readFileSync(
      resolve(directory, "run-malicious-request-mutation", pending.requestPath!),
      "utf8",
    )) as { skill: { version: string } };
    expect(sealed.skill.version).toBe("2.2.0");
  });

  it("continues to accept provider-neutral raw helpers", async () => {
    const result = await startRaw({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: runsDir(),
      runId: "run-raw-helper",
      judgment: testJudgmentProvider(),
    });
    expect(result.status).toBe("awaiting-review");
    expect(result.state.artifacts["review-packet"]).toBeDefined();
  });

  it("snapshots structural host bindings before execute and rejects delete, replace, and wrong-executor attacks", async () => {
    for (const attack of ["delete", "replace", "wrong-executor"] as const) {
      const directory = runsDir();
      const provider: {
        binding?: { hostId: string; adapterId: string; adapterVersion: string };
        testOnly: true;
        execute: (request: Parameters<typeof testResponseFor>[0]) => Promise<ReturnType<typeof testResponseFor>>;
      } = {
        binding: {
          hostId: "captured-host",
          adapterId: "captured.adapter",
          adapterVersion: "1.0.0",
        },
        testOnly: true,
        async execute(request) {
          if (attack === "delete") delete provider.binding;
          if (attack === "replace") {
            provider.binding = {
              hostId: "test-host",
              adapterId: "test-fixture",
              adapterVersion: "1.0.0",
            };
          }
          // The fixture executor is deliberately not the captured host.
          return testResponseFor(request);
        },
      };
      await expect(startRaw({
        playbook: playbook(),
        inputs: inputs(),
        runsDir: directory,
        runId: `run-host-binding-${attack}`,
        judgment: provider,
      })).rejects.toThrow(/does not match the injected host callback binding/);
      const paused = loadPlaybookRun(directory, `run-host-binding-${attack}`);
      expect(paused.status).toBe("awaiting-judgment");
      expect(paused.state.artifacts["opportunity-briefs"]).toBeUndefined();
    }
  });

  it("fails closed when a host callback response does not bind its declared executor", async () => {
    const directory = runsDir();
    const provider = createHostJudgmentProvider(
      {
        hostId: "bound-host",
        adapterId: "host.callback",
        adapterVersion: "1.0.0",
      },
      async (request) => testResponseFor(request),
      { testOnly: true },
    );
    await expect(startRaw({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-host-binding-failure",
      judgment: provider,
    })).rejects.toThrow(/does not match the injected host callback binding/);
    const paused = loadPlaybookRun(directory, "run-host-binding-failure");
    expect(paused.status).toBe("awaiting-judgment");
    expect(paused.state.artifacts["opportunity-briefs"]).toBeUndefined();
    expect(paused.trace.some((event) => event.type === "judgment.completed"))
      .toBe(false);
  });

  it("imports exactly one response through the consumer, replays it as a no-op, and rejects conflicts", async () => {
    const directory = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-import",
      judgment: undefined,
    });
    const loadRequestFile = () =>
      JSON.parse(
        readFileSync(
          resolve(
            directory,
            "run-import",
            JSON.parse(
              readFileSync(resolve(directory, "run-import/state.json"), "utf8"),
            ).judgments["rank-opportunities"].requestPath,
          ),
          "utf8",
        ),
      );
    const response = testResponseFor(loadRequestFile());
    const first = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-import",
      judgmentResponse: response,
      judgment: undefined,
    });
    expect(first.status).toBe("awaiting-judgment");
    expect(first.state.steps["rank-opportunities"].status).toBe("completed");
    expect(first.state.artifacts["opportunity-briefs"]).toBeDefined();
    expect(first.state.tokenUsage.judgmentTokens).toBe(30);
    expect(
      existsSync(resolve(directory, "run-import/receipts/rank-opportunities.json")),
    ).toBe(true);

    const beforeState = readFileSync(
      resolve(directory, "run-import/state.json"),
      "utf8",
    );
    const beforeTrace = readFileSync(
      resolve(directory, "run-import/trace.json"),
      "utf8",
    );
    const replayed = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-import",
      judgmentResponse: structuredClone(response),
      judgment: undefined,
    });
    expect(replayed.status).toBe("awaiting-judgment");
    expect(replayed.state.tokenUsage.judgmentTokens).toBe(30);
    expect(readFileSync(resolve(directory, "run-import/state.json"), "utf8"))
      .toBe(beforeState);
    expect(readFileSync(resolve(directory, "run-import/trace.json"), "utf8"))
      .toBe(beforeTrace);

    const staleForConsumedRequest = testResponseFor(loadRequestFile(), {
      responseId: "jrs-conflicting",
    });
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId: "run-import",
      judgmentResponse: staleForConsumedRequest,
      judgment: undefined,
    })).rejects.toThrow(
      /does not bind the pending request|consumed by a different response/,
    );
    expect(readFileSync(resolve(directory, "run-import/state.json"), "utf8"))
      .toBe(beforeState);
  });

  it("rejects wrong judgment responses without any mutation", async () => {
    const directory = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-wrong-response",
      judgment: undefined,
    });
    const request = JSON.parse(
      readFileSync(
        resolve(
          directory,
          "run-wrong-response",
          JSON.parse(
            readFileSync(
              resolve(directory, "run-wrong-response/state.json"),
              "utf8",
            ),
          ).judgments["rank-opportunities"].requestPath,
        ),
        "utf8",
      ),
    );
    const beforeState = readFileSync(
      resolve(directory, "run-wrong-response/state.json"),
      "utf8",
    );
    const beforeTrace = readFileSync(
      resolve(directory, "run-wrong-response/trace.json"),
      "utf8",
    );

    const wrongIdentity = testResponseFor(request, {
      identity: { ...request.identity, attempt: 99 },
    });
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId: "run-wrong-response",
      judgmentResponse: wrongIdentity,
      judgment: undefined,
    })).rejects.toThrow(/identity differs|sealed request/);

    const missingOutput = testResponseFor(request, { outputs: [] });
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId: "run-wrong-response",
      judgmentResponse: missingOutput,
      judgment: undefined,
    })).rejects.toThrow(/require their declared outputs/);

    const meteredZeroBudget = testResponseFor(request, {
      cost: {
        billingMode: "metered",
        currency: "USD",
        reservedMicros: 100,
        actualMicros: 100,
        chargedToRunMicros: 100,
      },
    });
    await expect(resumePlaybookRun({
      runsDir: directory,
      runId: "run-wrong-response",
      judgmentResponse: meteredZeroBudget,
      judgment: undefined,
    })).rejects.toThrow(/metered execution requires|not allowed/);

    expect(readFileSync(resolve(directory, "run-wrong-response/state.json"), "utf8"))
      .toBe(beforeState);
    expect(readFileSync(resolve(directory, "run-wrong-response/trace.json"), "utf8"))
      .toBe(beforeTrace);
  });

  it("does not require the runner for plugin-only skill use", () => {
    const runtimeSource = readFileSync(
      resolve(import.meta.dirname, "../src/runtime.ts"),
      "utf8",
    );
    const corpusSource = readFileSync(
      resolve(import.meta.dirname, "../src/corpus.ts"),
      "utf8",
    );
    expect(runtimeSource).not.toMatch(/from "\.\/runner\.ts"/);
    expect(corpusSource).not.toMatch(/from "\.\/runner\.ts"/);
    expect(runtimeSource).not.toMatch(/from "\.\/router\.ts"/);
  });
});
