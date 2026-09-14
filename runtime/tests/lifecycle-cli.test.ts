import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ensureLocalStateRoot,
  readLifecycleReceipts,
  verifyBackupContainer,
  verifyExportContainer,
} from "../src/local-state.ts";
import { type CliHost, runCli } from "../src/main.ts";
import { startPlaybookRun } from "../src/runner.ts";
import { testJudgmentProvider } from "./judgment-fixture.ts";

const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function host(env: Record<string, string | undefined> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const value: CliHost = {
    env,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  };
  return { host: value, stdout, stderr };
}

function workspace(): {
  directory: string;
  dataDir: string;
  configPath: string;
} {
  const directory = mkdtempSync(resolve(tmpdir(), "conquistador-lifecycle-"));
  temporary.push(directory);
  const dataDir = resolve(directory, "data");
  const configPath = resolve(directory, "conquistador.config.yaml");
  writeFileSync(
    configPath,
    readFileSync(
      resolve(import.meta.dirname, "../config/conquistador.config.example.yaml"),
      "utf8",
    ).replace('dir: "./.conquistador-data"', `dir: "${dataDir}"`),
  );
  return { directory, dataDir, configPath };
}

async function seedRun(dataDir: string, runId: string) {
  mkdirSync(resolve(dataDir, "sessions"), { recursive: true });
  ensureLocalStateRoot(dataDir, {
    instanceId: "local-founder",
    now: "2026-08-21T00:00:00.000Z",
  });
  const playbook = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../fixtures/playbooks/content-intelligence-loop.json"),
      "utf8",
    ),
  );
  const inputs = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../fixtures/inputs/content-intelligence-loop.json"),
      "utf8",
    ),
  );
  return startPlaybookRun({
    playbook,
    inputs,
    runsDir: resolve(dataDir, "sessions"),
    runId,
    now: () => new Date("2026-08-21T00:00:00.000Z"),
    judgment: testJudgmentProvider(),
  });
}

describe("public black-box local lifecycle flow", () => {
  it("runs backup, verify, mutate, restore, migration, export, and exact-scope erase end to end", async () => {
    const { dataDir, configPath } = workspace();
    const seeded = await seedRun(dataDir, "run-flow");
    expect(seeded.status).toBe("awaiting-review");
    const artifact = resolve(
      dataDir,
      "sessions/run-flow/artifacts/created-artifact.md",
    );
    const pristine = readFileSync(artifact, "utf8");

    const output = host({ CONQUISTADOR_CONFIG: configPath });

    expect(
      await runCli(["backup", "create", "--file", "backups/flow.json"], output.host),
    ).toBe(0);
    const created = JSON.parse(output.stdout.at(-1)!) as {
      status: string;
      fileCount: number;
      manifestDigest: string;
    };
    expect(created.status).toBe("created");
    expect(created.fileCount).toBeGreaterThan(0);

    expect(
      await runCli(["backup", "verify", "--file", "backups/flow.json"], output.host),
    ).toBe(0);
    expect((JSON.parse(output.stdout.at(-1)!) as { status: string }).status).toBe(
      "valid",
    );

    writeFileSync(artifact, "mutated after backup\n");
    rmSync(resolve(dataDir, "sessions/run-flow/receipts"), {
      recursive: true,
      force: true,
    });

    expect(
      await runCli(["restore", "--file", "backups/flow.json"], output.host),
    ).toBe(0);
    expect(readFileSync(artifact, "utf8")).toBe(pristine);
    expect(existsSync(resolve(dataDir, "sessions/run-flow/receipts"))).toBe(true);

    expect(await runCli(["migrate", "--check"], output.host)).toBe(0);
    const check = JSON.parse(output.stdout.at(-1)!) as {
      blockers: unknown[];
      pending: unknown[];
      to: string;
    };
    expect(check.blockers).toEqual([]);
    expect(check.pending).toEqual([]);
    expect(check.to).toBe("conquistador.local-state/v1");
    expect(await runCli(["migrate", "--apply"], output.host)).toBe(0);
    expect((JSON.parse(output.stdout.at(-1)!) as { applied: number }).applied).toBe(0);
    expect(await runCli(["migrate", "--apply"], output.host)).toBe(0);

    expect(
      await runCli(
        ["data", "export", "--scope", "all", "--file", "backups/export.json"],
        output.host,
      ),
    ).toBe(0);
    const exported = verifyExportContainer(
      resolve(dataDir, "backups/export.json"),
      { expectedInstanceId: "local-founder" },
    );
    expect(exported.readme).toContain("no running service");

    expect(
      await runCli(
        [
          "data",
          "erase",
          "--scope",
          "session:run-flow",
          "--confirm",
          "session:run-flow",
          "--recoverability",
          "backup",
        ],
        output.host,
      ),
    ).toBe(0);
    expect(existsSync(resolve(dataDir, "sessions/run-flow"))).toBe(false);
    expect(existsSync(resolve(dataDir, "backups/flow.json"))).toBe(true);
    expect(existsSync(resolve(dataDir, "instance.json"))).toBe(true);
    const receipts = readLifecycleReceipts(dataDir);
    const eraseReceipts = receipts.filter((receipt) => receipt.op === "erase.apply");
    expect(eraseReceipts).toHaveLength(1);
    expect(eraseReceipts[0]!.terminal).toBe(true);
    expect(JSON.stringify(eraseReceipts[0])).not.toContain("created-artifact");
    const ops = receipts.map((receipt) => receipt.op);
    expect(ops).toContain("backup.create");
    expect(ops).toContain("restore.apply");
    expect(ops).toContain("export.create");

    const stored = verifyBackupContainer(resolve(dataDir, "backups/flow.json"));
    for (const file of stored.files) {
      expect(file.content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    }
    expect(output.stdout.join("\n")).not.toMatch(/sk-|OPENAI_API_KEY/);
  }, 30_000);

  it("fails closed on escape, mismatch, and reserved surfaces", async () => {
    const { dataDir, configPath } = workspace();
    await seedRun(dataDir, "run-guard");
    const output = host({ CONQUISTADOR_CONFIG: configPath });

    expect(
      await runCli(["backup", "create", "--file", "../escape.json"], output.host),
    ).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/escapes the configured data root|backups/);

    expect(
      await runCli(
        [
          "data",
          "erase",
          "--scope",
          "session:run-guard",
          "--confirm",
          "session:other",
          "--recoverability",
          "decline",
        ],
        output.host,
      ),
    ).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/confirmation must equal/);
    expect(existsSync(resolve(dataDir, "sessions/run-guard"))).toBe(true);

    expect(
      await runCli(
        [
          "data",
          "erase",
          "--scope",
          "session:../../etc",
          "--confirm",
          "session:../../etc",
          "--recoverability",
          "decline",
        ],
        output.host,
      ),
    ).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/exact run id/);

    expect(await runCli(["chat"], output.host)).toBe(2);
    expect(output.stdout.at(-1)).toContain("Missing --intent");
    expect(await runCli(["eval"], output.host)).toBe(2);

    expect(
      await runCli(["backup", "verify", "--file", "backups/missing.json"], output.host),
    ).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/is missing/);
  });
});
