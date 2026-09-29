import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { type CliHost, runCli, defaultRunsDirectory } from "../src/main.ts";
import {
  createHostJudgmentProvider,
  type JudgmentProvider,
} from "../src/judgment.ts";
import { resumePlaybookRun } from "../src/runner.ts";
import { testResponseFor } from "./judgment-fixture.ts";
import { canonicalReviewFixture } from "./review-fixture.ts";

const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function host(
  env: Record<string, string | undefined> = {},
  judgment?: JudgmentProvider,
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const value: CliHost = {
    env,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
    ...(judgment ? { judgment } : {}),
  };
  return { host: value, stdout, stderr };
}

describe("owned CLI execution boundary", () => {
  it("initializes once, validates config read-only, and never prints credential values", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "conquistador-cli-"));
    temporary.push(directory);
    const path = resolve(directory, "runtime.yaml");
    const output = host({ OPENAI_API_KEY: "do-not-print-this" });
    expect(await runCli(["init", "--config", path], output.host)).toBe(0);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("conquistador.config/v1");
    expect(await runCli(["init", "--config", path], output.host)).toBe(2);
    expect(await runCli(["doctor", "--config", path], output.host)).toBe(0);
    expect(output.stdout.join("\n")).not.toContain("do-not-print-this");
  });

  it("reports version and fails closed for reserved later commands", async () => {
    const output = host();
    expect(await runCli(["version"], output.host)).toBe(0);
    expect(output.stdout.at(-1)).toMatch(/^(?:1\.0\.0|0\.2\.1)$/);
    expect(await runCli(["eval"], output.host)).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/reserved but unavailable/);
  });

  it("runs, routes, and inspects a playbook without provider credentials", async () => {
    const directory = mkdtempSync(
      resolve(tmpdir(), "conquistador-playbook-cli-"),
    );
    temporary.push(directory);
    const input = resolve(directory, "input.json");
    writeFileSync(
      input,
      JSON.stringify({
        product: "Conquistador",
        audience: "operators",
        channel: "linkedin",
        goals: "one reviewed artifact",
      }),
    );
    const output = host();
    const playbook = resolve(
      import.meta.dirname,
      "../fixtures/playbooks/content-intelligence-loop.json",
    );
    expect(
      await runCli([
        "run",
        "--playbook-file",
        playbook,
        "--input",
        input,
        "--runs-dir",
        directory,
        "--run-id",
        "run-cli",
      ], output.host),
    ).toBe(0);
    const summary = JSON.parse(output.stdout.at(-1)!) as {
      status: string;
      runId: string;
    };
    expect(summary).toMatchObject({
      status: "awaiting-judgment",
      runId: "run-cli",
    });
    expect(
      await runCli(
        ["status", "--run-id", "run-cli", "--runs-dir", directory],
        output.host,
      ),
    ).toBe(0);
    expect(
      await runCli([
        "resume",
        "--run-id",
        "run-cli",
        "--runs-dir",
        directory,
        "--review",
        "accept",
      ], output.host),
    ).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/unknown argument: --review/);
    for (let round = 0; round < 3; round += 1) {
      const exported = resolve(directory, `request-${round}.json`);
      expect(
        await runCli([
          "judgment",
          "export",
          "--run-id",
          "run-cli",
          "--runs-dir",
          directory,
          "--output",
          exported,
        ], output.host),
      ).toBe(0);
      const request = JSON.parse(readFileSync(exported, "utf8")) as Parameters<
        typeof testResponseFor
      >[0];
      const responseFile = resolve(directory, `response-${round}.json`);
      writeFileSync(responseFile, JSON.stringify(testResponseFor(request)));
      const invalid = resolve(directory, "invalid-response.json");
      writeFileSync(invalid, '{"schema":"bogus"}');
      expect(
        await runCli([
          "resume",
          "--run-id",
          "run-cli",
          "--runs-dir",
          directory,
          "--judgment-response",
          invalid,
        ], output.host),
      ).toBe(2);
      expect(
        await runCli([
          "resume",
          "--run-id",
          "run-cli",
          "--runs-dir",
          directory,
          "--judgment-response",
          responseFile,
        ], output.host),
      ).toBe(0);
      const stepSummary = JSON.parse(output.stdout.at(-1)!) as {
        status: string;
      };
      if (round < 2) {
        expect(stepSummary.status).toBe("awaiting-judgment");
      }
    }
    expect(JSON.parse(output.stdout.at(-1)!)).toMatchObject({
      status: "awaiting-review",
    });
    const accepted = await resumePlaybookRun({
      runsDir: directory,
      runId: "run-cli",
      ...canonicalReviewFixture(directory, "run-cli", "accept"),
    });
    expect(accepted.status).toBe("awaiting-judgment");
    const exported = resolve(directory, "request-final.json");
    expect(
      await runCli([
        "judgment",
        "export",
        "--run-id",
        "run-cli",
        "--runs-dir",
        directory,
        "--output",
        exported,
      ], output.host),
    ).toBe(0);
    const finalRequest = JSON.parse(
      readFileSync(exported, "utf8"),
    ) as Parameters<typeof testResponseFor>[0];
    const finalResponseFile = resolve(directory, "response-final.json");
    writeFileSync(finalResponseFile, JSON.stringify(testResponseFor(finalRequest)));
    expect(
      await runCli([
        "resume",
        "--run-id",
        "run-cli",
        "--runs-dir",
        directory,
        "--judgment-response",
        finalResponseFile,
      ], output.host),
    ).toBe(0);
    const completed = JSON.parse(output.stdout.at(-1)!) as { status: string };
    expect(completed.status).toBe("completed");
    expect(await runCli(["route", "--intent", "write copy"], output.host)).toBe(
      0,
    );
    expect(JSON.parse(output.stdout.at(-1)!)).toMatchObject({
      outcome: "skill",
      targetId: "write-copy",
    });
    expect(output.stdout.join("\n")).not.toMatch(
      /sk-|OPENAI_API_KEY|credential/i,
    );
  });

  it("completes the content loop through an injected host callback and a canonical human decision", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "conquistador-host-loop-"));
    temporary.push(directory);
    const input = resolve(directory, "input.json");
    writeFileSync(input, JSON.stringify({
      product: "Conquistador",
      audience: "operators",
      channel: "linkedin",
      goals: "one reviewed artifact",
    }));
    const requested: string[] = [];
    const judgment = createHostJudgmentProvider(
      {
        hostId: "dogfood-host",
        adapterId: "host.callback",
        adapterVersion: "1.0.0",
      },
      async (request, options) => {
        requested.push(request.identity.stepId);
        expect(Object.isFrozen(request)).toBe(true);
        expect(options.idempotencyKey).toBe(request.execution.idempotencyKey);
        return testResponseFor(request, {
          executor: {
            hostId: "dogfood-host",
            adapterId: "host.callback",
            adapterVersion: "1.0.0",
            executionId: `dogfood-${request.identity.stepId}`,
            loadedAssetManifestDigest: request.skill.packageDigest,
          },
        });
      },
      { testOnly: true },
    );
    const output = host({}, judgment);
    const playbook = resolve(
      import.meta.dirname,
      "../fixtures/playbooks/content-intelligence-loop.json",
    );
    expect(await runCli([
      "run",
      "--playbook-file",
      playbook,
      "--input",
      input,
      "--runs-dir",
      directory,
      "--run-id",
      "host-callback-loop",
    ], output.host)).toBe(0);
    expect(JSON.parse(output.stdout.at(-1)!)).toMatchObject({
      status: "awaiting-review",
    });
    expect(requested).toEqual([
      "rank-opportunities",
      "create-artifact",
      "specialist-review",
    ]);

    const reviewed = await resumePlaybookRun({
      runsDir: directory,
      runId: "host-callback-loop",
      ...canonicalReviewFixture(directory, "host-callback-loop", "accept"),
    });
    expect(reviewed.status).toBe("awaiting-judgment");
    expect(await runCli([
      "resume",
      "--run-id",
      "host-callback-loop",
      "--runs-dir",
      directory,
    ], output.host)).toBe(0);
    expect(JSON.parse(output.stdout.at(-1)!)).toMatchObject({
      status: "completed",
    });
    expect(requested).toEqual([
      "rank-opportunities",
      "create-artifact",
      "specialist-review",
      "measure-and-decide",
    ]);

    const runDirectory = resolve(directory, "host-callback-loop");
    expect(readFileSync(resolve(runDirectory, "canonical-review-packet.json"), "utf8"))
      .toContain("review-packet");
    expect(readFileSync(resolve(runDirectory, "artifacts/action-receipt.md"), "utf8"))
      .toMatch(/Human action manifest[\s\S]*Executed: no/);
    expect(readFileSync(resolve(runDirectory, "artifacts/observation-record.md"), "utf8"))
      .toMatch(/Result: unknown/);
    expect(existsSync(resolve(directory, "learning.jsonl"))).toBe(false);
  });

  it("reports missing bearer transport credentials as blocked", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "conquistador-doctor-"));
    temporary.push(directory);
    const path = resolve(directory, "runtime.yaml");
    const initialized = host();
    expect(await runCli(["init", "--config", path], initialized.host)).toBe(0);
    const source = readFileSync(path, "utf8")
      .replace('profile: "local"', 'profile: "single-node"')
      .replace(
        'mode: "local"',
        'mode: "bearer"\n    tokenEnv: "CONQUISTADOR_TOKEN"',
      );
    writeFileSync(path, source);
    const output = host({ OPENAI_API_KEY: "provider-only" });
    expect(await runCli(["doctor", "--config", path], output.host)).toBe(2);
    expect(output.stdout.at(-1)).toContain("CONQUISTADOR_TOKEN");
    expect(output.stdout.at(-1)).not.toContain("provider-only");
  });
});


it("keeps existing unmanaged runtime state separate from the new installed operator", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "conquistador-runs-default-"));
  try {
    expect(defaultRunsDirectory(directory)).toBe(".conquistador-runs");
    mkdirSync(resolve(directory, ".conquistador/runs"), { recursive: true });
    expect(defaultRunsDirectory(directory)).toBe(".conquistador/runs");
    writeFileSync(resolve(directory, ".conquistador/.conquistador-install.json"), "{}");
    expect(defaultRunsDirectory(directory)).toBe(".conquistador-runs");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
