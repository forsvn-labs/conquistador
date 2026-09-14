import { runMcpStdio } from "./mcp.ts";
import { runChat, terminalChatPrompt, type ChatHost } from "./chat-client.ts";
import { constants, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { type CliCommand, cliHelp, parseCli } from "./cli.ts";
import {
  applyMigrations,
  checkMigration,
  createLocalBackup,
  dataRoot,
  ensureLocalStateRoot,
  eraseScope,
  exportData,
  restoreBackup,
  verifyBackupContainer,
} from "./local-state.ts";
import { routeIntent } from "./router.ts";
import {
  loadPlaybookRun,
  playbookFixturePath,
  resumePlaybookRun,
  runSummary,
  startPlaybookRun,
} from "./runner.ts";
import type { JudgmentProvider } from "./judgment.ts";
import { buildService, inspectReadiness, loadConfigFile } from "./service.ts";

function distributionVersion(): string {
  const manifest = resolve(import.meta.dirname, "../../package.json");
  if (!existsSync(manifest)) return "1.0.0";
  const value: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  if (value && typeof value === "object" && "name" in value && value.name === "@forsvn/conquistador" && "version" in value && typeof value.version === "string" && /^\d+\.\d+\.\d+$/.test(value.version)) return value.version;
  throw new Error("[conquistador.cli] invalid distribution identity");
}
const VERSION = distributionVersion();
const DEFAULT_CONFIG = "conquistador.config.yaml";

export type CliHost = {
  env: Record<string, string | undefined>;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
  /** Optional embedding-only callback; the CLI never reads provider credentials. */
  judgment?: JudgmentProvider;
  prompt?: ChatHost["prompt"];
  signal?: AbortSignal;
};

function configPath(
  command: Extract<CliCommand, { command: "init" | "serve" | "doctor" }>,
): string {
  return resolve(command.config ?? DEFAULT_CONFIG);
}

function lifecycleConfig(host: CliHost) {
  return loadConfigFile(resolve(host.env.CONQUISTADOR_CONFIG ?? DEFAULT_CONFIG));
}

const MAX_JUDGMENT_RESPONSE_BYTES = 2_000_000;

function readBoundedJson(path: string): unknown {
  const raw = readFileSync(path, "utf8");
  if (Buffer.byteLength(raw, "utf8") > MAX_JUDGMENT_RESPONSE_BYTES) {
    throw new Error(
      `[conquistador.cli] judgment response exceeds ${MAX_JUDGMENT_RESPONSE_BYTES} bytes`,
    );
  }
  return JSON.parse(raw) as unknown;
}

function unavailable(command: CliCommand): never {
  throw new Error(
    `[conquistador.cli] ${command.command} is reserved but unavailable in the runtime foundation build`,
  );
}

export async function executeCli(
  command: CliCommand,
  host: CliHost,
): Promise<number> {
  if (command.command === "mcp") {
    await runMcpStdio({ url: command.url, token: host.env.CONQUISTADOR_CHAT_TOKEN });
    return 0;
  }
  if (command.command === "chat") return runChat(command, host);
  if (command.command === "version") {
    host.stdout(VERSION);
    return 0;
  }
  if (command.command === "init") {
    const destination = configPath(command);
    const example = resolve(
      import.meta.dirname,
      "../config/conquistador.config.example.yaml",
    );
    copyFileSync(example, destination, constants.COPYFILE_EXCL);
    host.stdout(`Created ${destination}`);
    return 0;
  }
  if (command.command === "doctor") {
    const config = loadConfigFile(configPath(command));
    const credentialPresent = Boolean(
      host.env[config.models.primary.credentialEnv],
    );
    const readiness = inspectReadiness(config, host.env);
    host.stdout(JSON.stringify({
      status: readiness.ready ? "ready" : "blocked",
      config: "valid",
      profile: config.server.profile,
      provider: config.models.primary.provider,
      model: config.models.primary.model,
      credentialEnv: config.models.primary.credentialEnv,
      credentialPresent,
      blockers: readiness.blockers,
    }));
    return readiness.ready ? 0 : 2;
  }
  if (command.command === "serve") {
    const config = loadConfigFile(configPath(command));
    const service = buildService({ config, env: host.env });
    await new Promise<void>((resolvePromise, reject) => {
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      service.server.once("error", fail);
      service.server.listen(config.server.port, config.server.bind, () => {
        host.stdout(
          `Conquistador ${VERSION} listening on ${config.server.bind}:${config.server.port}`,
        );
      });
      const shutdown = () => {
        process.removeListener("SIGTERM", shutdown);
        process.removeListener("SIGINT", shutdown);
        void service.shutdown().then(() => {
          if (settled) return;
          settled = true;
          resolvePromise();
        }, (error: unknown) => {
          fail(error instanceof Error ? error : new Error("shutdown failed"));
        });
      };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    });
    return 0;
  }
  if (command.command === "run") {
    const playbookPath = command.playbookFile
      ? resolve(command.playbookFile)
      : playbookFixturePath(command.playbook!);
    const playbook = JSON.parse(readFileSync(playbookPath, "utf8")) as unknown;
    const parsed = JSON.parse(
      readFileSync(resolve(command.input), "utf8"),
    ) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("[conquistador.cli] input must be a JSON object");
    }
    const inputs = parsed as Record<string, unknown>;
    const snapshot = await startPlaybookRun({
      playbook,
      inputs,
      runsDir: command.runsDir ?? ".conquistador/runs",
      runId: command.runId,
      judgment: host.judgment,
    });
    host.stdout(JSON.stringify(runSummary(snapshot)));
    return snapshot.status === "failed" ? 2 : 0;
  }
  if (command.command === "resume") {
    let judgmentResponse: unknown;
    if (command.judgmentResponse) {
      judgmentResponse = readBoundedJson(command.judgmentResponse);
    }
    const snapshot = await resumePlaybookRun({
      runsDir: command.runsDir ?? ".conquistador/runs",
      runId: command.runId,
      ...(judgmentResponse !== undefined ? { judgmentResponse } : {}),
      ...(judgmentResponse === undefined && host.judgment
        ? { judgment: host.judgment }
        : {}),
    });
    host.stdout(JSON.stringify(runSummary(snapshot)));
    return snapshot.status === "failed" ? 2 : 0;
  }
  if (command.command === "judgment" && command.action === "export") {
    const snapshot = loadPlaybookRun(
      command.runsDir ?? ".conquistador/runs",
      command.runId,
    );
    const pending = Object.entries(snapshot.state.judgments ?? {}).find(
      ([, record]) => record.state === "pending",
    );
    if (!pending) {
      throw new Error(
        "[conquistador.cli] run has no pending judgment request to export",
      );
    }
    const [stepId, record] = pending;
    const source = resolve(snapshot.directory, record.requestPath);
    const request = JSON.parse(readFileSync(source, "utf8")) as unknown;
    if (
      !request ||
      typeof request !== "object" ||
      (request as { requestId?: string }).requestId !== record.requestId ||
      (request as { requestDigest?: string }).requestDigest !==
        record.requestDigest
    ) {
      throw new Error("[conquistador.cli] persisted judgment request is corrupt");
    }
    writeFileSync(command.output, `${JSON.stringify(request, null, 2)}\n`, {
      mode: 0o600,
    });
    host.stdout(JSON.stringify({
      status: "exported",
      runId: snapshot.runId,
      stepId,
      requestId: record.requestId,
      requestDigest: record.requestDigest,
      output: command.output,
    }));
    return 0;
  }
  if (command.command === "status") {
    const snapshot = loadPlaybookRun(
      command.runsDir ?? ".conquistador/runs",
      command.runId,
    );
    host.stdout(JSON.stringify(runSummary(snapshot)));
    return 0;
  }
  if (command.command === "route") {
    host.stdout(JSON.stringify(routeIntent(command.intent)));
    return 0;
  }
  if (command.command === "backup") {
    const config = lifecycleConfig(host);
    const root = dataRoot(config.data.dir);
    if (command.action === "create") {
      ensureLocalStateRoot(root, {
        instanceId: config.instance.id,
        now: new Date().toISOString(),
      });
      const { container } = createLocalBackup(root, {
        file: command.file,
        now: new Date().toISOString(),
        maxContainerBytes: config.limits.bodyBytes * 256,
      });
      host.stdout(JSON.stringify({
        status: "created",
        file: command.file,
        fileCount: container.fileCount,
        totalBytes: container.totalBytes,
        manifestDigest: container.manifestDigest,
      }));
      return 0;
    }
    const container = verifyBackupContainer(command.file, {
      root,
      expectedInstanceId: config.instance.id,
      maxContainerBytes: config.limits.bodyBytes * 256,
    });
    host.stdout(JSON.stringify({
      status: "valid",
      instanceId: container.instanceId,
      createdAt: container.createdAt,
      fileCount: container.fileCount,
      totalBytes: container.totalBytes,
      manifestDigest: container.manifestDigest,
    }));
    return 0;
  }
  if (command.command === "restore") {
    const config = lifecycleConfig(host);
    const root = dataRoot(config.data.dir);
    const result = restoreBackup(root, {
      file: command.file,
      now: new Date().toISOString(),
      expectedInstanceId: config.instance.id,
    });
    host.stdout(JSON.stringify({
      status: "restored",
      restoredFiles: result.restoredFiles,
      manifestDigest: result.manifestDigest,
    }));
    return 0;
  }
  if (command.command === "migrate") {
    const config = lifecycleConfig(host);
    const root = dataRoot(config.data.dir);
    if (command.mode === "check") {
      const check = checkMigration(root);
      host.stdout(JSON.stringify(check));
      return check.blockers.length === 0 ? 0 : 2;
    }
    const result = applyMigrations(root, { now: new Date().toISOString() });
    host.stdout(JSON.stringify({
      status: "applied",
      applied: result.applied,
      from: result.check.from,
      to: result.check.to,
    }));
    return 0;
  }
  if (command.command === "data" && command.action === "export") {
    const config = lifecycleConfig(host);
    const root = dataRoot(config.data.dir);
    ensureLocalStateRoot(root, {
      instanceId: config.instance.id,
      now: new Date().toISOString(),
    });
    const { container } = exportData(root, {
      scope: command.scope,
      file: command.file,
      now: new Date().toISOString(),
    });
    host.stdout(JSON.stringify({
      status: "exported",
      scope: container.scope,
      fileCount: container.fileCount,
      totalBytes: container.totalBytes,
      manifestDigest: container.manifestDigest,
    }));
    return 0;
  }
  if (command.command === "data" && command.action === "erase") {
    const config = lifecycleConfig(host);
    const root = dataRoot(config.data.dir);
    const receipt = eraseScope(root, {
      scope: command.scope,
      confirm: command.confirm,
      recoverability: command.recoverability,
      now: new Date().toISOString(),
    });
    host.stdout(JSON.stringify({
      status: "erased",
      receiptId: receipt.id,
      scope: receipt.detail.scope,
      removedFiles: receipt.detail.removedFiles,
      terminal: receipt.terminal ?? false,
    }));
    return 0;
  }
  return unavailable(command);
}

export async function runCli(
  argv: string[],
  host: CliHost = {
    env: process.env,
    ...(process.stdin.isTTY ? { prompt: terminalChatPrompt } : {}),
    stdout: (value) => process.stdout.write(`${value}\n`),
    stderr: (value) => process.stderr.write(`${value}\n`),
  },
): Promise<number> {
  try {
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      host.stdout(cliHelp(VERSION));
      return 0;
    }
    return await executeCli(parseCli(argv), host);
  } catch (error) {
    host.stderr(
      error instanceof Error
        ? error.message
        : "[conquistador.cli] command failed",
    );
    return 2;
  }
}
