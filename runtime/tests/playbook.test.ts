import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readLearningLedger } from "../src/learning.ts";
import { type CliHost, runCli } from "../src/main.ts";
import {
  type PlaybookRecord,
  validatePlaybookRecord,
} from "../src/registry.ts";
import {
  type ResumeRunOptions,
  type StartRunOptions,
  resumePlaybookRun as resumeRaw,
  startPlaybookRun as startRaw,
} from "../src/runner.ts";
import { canonicalReviewFixture } from "./review-fixture.ts";
import {
  testJudgmentProvider,
  testResponseFor,
} from "./judgment-fixture.ts";

function withTestJudgment<T>(options: T): T {
  return { judgment: testJudgmentProvider(), ...options } as unknown as T;
}

const startPlaybookRun = (options: StartRunOptions) =>
  startRaw(withTestJudgment(options));
const resumePlaybookRun = (options: ResumeRunOptions) =>
  resumeRaw(withTestJudgment(options));

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(
  root,
  "fixtures/playbooks/content-intelligence-loop.json",
);
const inputPath = resolve(
  root,
  "fixtures/inputs/content-intelligence-loop.json",
);
const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function runsDir(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "conquistador-playbook-"));
  temporary.push(directory);
  return directory;
}

function host() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const value: CliHost = {
    env: {},
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  };
  return { host: value, stdout, stderr };
}

function playbook(): PlaybookRecord {
  const record = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as PlaybookRecord;
  validatePlaybookRecord(record);
  return record;
}

function inputs(): Record<string, unknown> {
  return JSON.parse(readFileSync(inputPath, "utf8")) as Record<string, unknown>;
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

describe("content-intelligence-loop executable playbook", () => {
  it("runs the declared graph through CLI from fixture input to review, action manifest, and learning", async () => {
    const directory = runsDir();
    const output = host();
    expect(
      await runCli([
        "run",
        "--playbook",
        "content-intelligence-loop",
        "--input",
        inputPath,
        "--runs-dir",
        directory,
        "--run-id",
        "run-cli-loop",
      ], output.host),
    ).toBe(0);
    const first = JSON.parse(output.stdout.at(-1)!) as {
      status: string;
      runId: string;
      judgment?: { stepId?: string; requestDigest?: string };
    };
    expect(first).toMatchObject({
      status: "awaiting-judgment",
      runId: "run-cli-loop",
    });

    const runDir = resolve(directory, "run-cli-loop");
    let summary = first;
    for (let round = 0; round < 3; round += 1) {
      expect(summary.status).toBe("awaiting-judgment");
      const exported = resolve(runDir, `judgment-export-${round}.json`);
      expect(
        await runCli([
          "judgment",
          "export",
          "--run-id",
          "run-cli-loop",
          "--runs-dir",
          directory,
          "--output",
          exported,
        ], output.host),
      ).toBe(0);
      const request = JSON.parse(readFileSync(exported, "utf8")) as Parameters<
        typeof testResponseFor
      >[0];
      const responseFile = resolve(runDir, `judgment-response-${round}.json`);
      writeFileSync(responseFile, JSON.stringify(testResponseFor(request)));
      expect(
        await runCli([
          "resume",
          "--run-id",
          "run-cli-loop",
          "--runs-dir",
          directory,
          "--judgment-response",
          responseFile,
        ], output.host),
      ).toBe(0);
      summary = JSON.parse(output.stdout.at(-1)!) as typeof first;
    }
    expect(summary.status).toBe("awaiting-review");

    expect(
      await runCli([
        "resume",
        "--run-id",
        "run-cli-loop",
        "--runs-dir",
        directory,
        "--review",
        "accept",
      ], output.host),
    ).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/unknown argument: --review/);

    const completed = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-cli-loop",
      ...canonicalReviewFixture(directory, "run-cli-loop", "accept"),
    });
    expect(completed.status).toBe("completed");

    const trace = JSON.parse(
      readFileSync(resolve(runDir, "trace.json"), "utf8"),
    ) as Array<{
      type: string;
      stepId?: string;
      detail: Record<string, unknown>;
    }>;
    const started = trace.filter((event) => event.type === "step.started").map((
      event,
    ) => event.stepId);
    expect(started).toEqual([...GRAPH]);
    expect(
      trace.some((event) =>
        event.type === "gate.review" && event.detail.outcome === "accept"
      ),
    ).toBe(true);
    const action = trace.find((event) => event.type === "gate.action");
    expect(action?.detail).toMatchObject({
      executed: false,
      fallback: "human-action-manifest",
    });
    const invoked = trace.filter((event) => event.type === "operation.invoked");
    expect(invoked.map((event) => event.detail.operationId)).toEqual([
      "signals.pull-bounded",
      "distribution.create-draft",
      "performance.observe-window",
    ]);
    expect(
      invoked.every((event) =>
        event.detail.executed === false && event.detail.liveCall === false
      ),
    ).toBe(true);
    const create = trace.find((event) =>
      event.type === "judgment.completed" && event.stepId === "create-artifact"
    );
    expect(create?.detail.skillId).toBe("write-social");

    const receipt = readFileSync(
      resolve(runDir, "artifacts/action-receipt.md"),
      "utf8",
    );
    expect(receipt).toMatch(/Human action manifest/);
    expect(receipt).toMatch(/Executed: no/);
    expect(receipt).toMatch(/Provider: unverified/);
    expect(existsSync(resolve(runDir, "artifacts/approved-context.md"))).toBe(
      true,
    );
    expect(existsSync(resolve(runDir, "artifacts/created-artifact.meta.json")))
      .toBe(true);
    expect(existsSync(resolve(runDir, "artifacts/learning-record.md"))).toBe(
      true,
    );
    const learning = readLearningLedger(resolve(directory, "learning.jsonl"));
    expect(
      learning.every((entry) =>
        entry.approved === true && entry.inferred === false &&
        entry.source.reviewPacketId !== undefined &&
        entry.kind !== "observed-result"
      ),
    ).toBe(true);
    expect(learning.some((entry) =>
      entry.kind === "action" && entry.source.actionReceiptId === "fixture-terminal-receipt"
    )).toBe(true);
  });

  it("stops at a revise verdict without taking the action", async () => {
    const directory = runsDir();
    await startPlaybookRun({
      playbook: playbook(),
      inputs: inputs(),
      runsDir: directory,
      runId: "run-revise",
    });
    const revised = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-revise",
      ...canonicalReviewFixture(directory, "run-revise", "revise"),
    });
    expect(revised.status).toBe("revision-requested");
    expect(revised.state.steps["approved-action"].status).toBe("pending");
    expect(revised.state.artifacts["action-receipt"]).toBeUndefined();
    expect(revised.trace.some((event) => event.type === "gate.action")).toBe(
      false,
    );
    expect(revised.trace.at(-1)?.detail).toMatchObject({
      reason: "review-revise",
      actionNotTaken: true,
    });
    expect(existsSync(resolve(directory, "learning.jsonl"))).toBe(false);
  });

  it("records the creation skill by registry identity and keeps skills independently usable", async () => {
    const directory = runsDir();
    const first = await startPlaybookRun({
      playbook: playbook(),
      inputs: { ...inputs(), channel: "landing page" },
      runsDir: directory,
      runId: "run-write-copy",
    });
    const created = first.trace.find((event) =>
      event.type === "judgment.completed" && event.stepId === "create-artifact"
    );
    expect(created?.detail.skillId).toBe("write-copy");
    const hypothesis = readFileSync(
      resolve(first.directory, "artifacts/hypothesis.md"),
      "utf8",
    );
    expect(hypothesis).toMatch(/nativeFormat: copy/);
    const runtimeSource = readFileSync(resolve(root, "src/runtime.ts"), "utf8");
    const corpusSource = readFileSync(resolve(root, "src/corpus.ts"), "utf8");
    expect(runtimeSource).not.toMatch(/from "\.\/runner\.ts"/);
    expect(corpusSource).not.toMatch(/from "\.\/runner\.ts"/);
    expect(runtimeSource).not.toMatch(/from "\.\/operations\.ts"/);
  });

  it("emits a human action manifest when the provider is unsupported", async () => {
    const record = playbook();
    const action = record.stepGraph.nodes.find((node) =>
      node.id === "approved-action"
    );
    if (!action) throw new Error("approved-action is missing");
    action.uses = {
      ...action.uses,
      toolOperationId: "unsupported.provider-draft",
    };
    const directory = runsDir();
    await startPlaybookRun({
      playbook: record,
      inputs: inputs(),
      runsDir: directory,
      runId: "run-unsupported",
    });
    const completed = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-unsupported",
      ...canonicalReviewFixture(directory, "run-unsupported", "accept"),
    });
    expect(completed.status).toBe("completed");
    const invoked = completed.trace.find((event) =>
      event.type === "operation.invoked" &&
      event.detail.operationId === "unsupported.provider-draft"
    );
    expect(invoked?.detail).toMatchObject({
      provider: "unsupported-provider",
      verificationStatus: "unsupported",
      kind: "human-action-manifest",
      executed: false,
      liveCall: false,
    });
    const receipt = readFileSync(
      resolve(completed.directory, "artifacts/action-receipt.md"),
      "utf8",
    );
    expect(receipt).toMatch(/Human action manifest/);
    expect(receipt).toMatch(/Provider: unsupported-provider/);
    expect(receipt).toMatch(/Reason: unsupported/);
    expect(receipt).toMatch(/Executed: no/);
    expect(receipt).not.toMatch(/Executed: yes/);
  });

  it("refuses to run a playbook that is not executable", async () => {
    const record = playbook();
    record.executionStatus = "unimplemented";
    record.notExecutableReason = "No runner trace exists yet.";
    await expect(startPlaybookRun({
      playbook: record,
      inputs: inputs(),
      runsDir: runsDir(),
      runId: "run-blocked",
    })).rejects.toThrow(/is not executable/);
  });
});
