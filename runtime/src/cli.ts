export const PUBLIC_COMMANDS = [
  "init",
  "chat",
  "mcp",
  "serve",
  "doctor",
  "run",
  "resume",
  "judgment",
  "status",
  "route",
  "eval",
  "backup",
  "restore",
  "migrate",
  "data",
  "version",
] as const;

type PublicCommand = (typeof PUBLIC_COMMANDS)[number];

export type CliCommand =
  | { command: "init"; config?: string }
  | ({ command: "chat" } & import("./chat-client.ts").ChatOptions)
  | { command: "mcp"; url?: string }
  | { command: "serve"; config?: string }
  | { command: "doctor"; config?: string }
  | {
    command: "run";
    playbook?: string;
    playbookFile?: string;
    input: string;
    runsDir?: string;
    runId?: string;
  }
  | {
    command: "resume";
    runId: string;
    runsDir?: string;
    judgmentResponse?: string;
  }
  | {
    command: "judgment";
    action: "export";
    runId: string;
    runsDir?: string;
    output: string;
  }
  | { command: "status"; runId: string; runsDir?: string }
  | { command: "route"; intent: string }
  | { command: "eval"; url?: string }
  | { command: "backup"; action: "create" | "verify"; file: string }
  | { command: "restore"; file: string }
  | { command: "migrate"; mode: "check" | "apply" }
  | { command: "data"; action: "export"; scope: string; file: string }
  | {
    command: "data";
    action: "erase";
    scope: string;
    confirm: string;
    recoverability: "backup" | "decline";
  }
  | { command: "version" };

function option(
  argv: string[],
  name: string,
  required = true,
): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    if (required) throw new Error(`[conquistador.cli] ${name} is required`);
    return;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`[conquistador.cli] ${name} needs a value`);
  }
  return value;
}

function exactFlags(argv: string[], flags: string[]): void {
  if (argv.length % 2 !== 0) {
    throw new Error("[conquistador.cli] flags require exact value pairs");
  }
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag.startsWith("--") || !flags.includes(flag)) {
      throw new Error(`[conquistador.cli] unknown argument: ${flag}`);
    }
    if (seen.has(flag)) {
      throw new Error(`[conquistador.cli] duplicate flag: ${flag}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`[conquistador.cli] ${flag} needs a value`);
    }
    seen.add(flag);
  }
}

export function parseCli(argv: string[]): CliCommand {
  const command = (argv[0] ?? "chat") as PublicCommand;
  if (!(PUBLIC_COMMANDS as readonly string[]).includes(command)) {
    throw new Error(`[conquistador.cli] unsupported command: ${command}`);
  }
  const rest = argv.slice(1);
  if (command === "version") {
    if (rest.length) {
      throw new Error("[conquistador.cli] version accepts no arguments");
    }
    return { command };
  }
  if (["init", "serve", "doctor"].includes(command)) {
    exactFlags(rest, ["--config"]);
    return {
      command,
      ...(option(rest, "--config", false)
        ? { config: option(rest, "--config") }
        : {}),
    } as CliCommand;
  }
  if (command === "run") {
    exactFlags(rest, [
      "--playbook",
      "--playbook-file",
      "--input",
      "--runs-dir",
      "--run-id",
    ]);
    const playbook = option(rest, "--playbook", false);
    const playbookFile = option(rest, "--playbook-file", false);
    if (Boolean(playbook) === Boolean(playbookFile)) {
      throw new Error(
        "[conquistador.cli] run requires exactly one of --playbook or --playbook-file",
      );
    }
    return {
      command,
      ...(playbook ? { playbook } : {}),
      ...(playbookFile ? { playbookFile } : {}),
      input: option(rest, "--input")!,
      ...(option(rest, "--runs-dir", false)
        ? { runsDir: option(rest, "--runs-dir", false) }
        : {}),
      ...(option(rest, "--run-id", false)
        ? { runId: option(rest, "--run-id", false) }
        : {}),
    };
  }
  if (command === "resume") {
    exactFlags(rest, ["--run-id", "--runs-dir", "--judgment-response"]);
    return {
      command,
      runId: option(rest, "--run-id")!,
      ...(option(rest, "--runs-dir", false)
        ? { runsDir: option(rest, "--runs-dir", false) }
        : {}),
      ...(option(rest, "--judgment-response", false)
        ? { judgmentResponse: option(rest, "--judgment-response") }
        : {}),
    };
  }
  if (command === "judgment") {
    const action = rest[0];
    if (action !== "export") {
      throw new Error("[conquistador.cli] judgment action must be export");
    }
    const flags = rest.slice(1);
    exactFlags(flags, ["--run-id", "--runs-dir", "--output"]);
    return {
      command,
      action: "export",
      runId: option(flags, "--run-id")!,
      ...(option(flags, "--runs-dir", false)
        ? { runsDir: option(flags, "--runs-dir", false) }
        : {}),
      output: option(flags, "--output")!,
    };
  }
  if (command === "status") {
    exactFlags(rest, ["--run-id", "--runs-dir"]);
    return {
      command,
      runId: option(rest, "--run-id")!,
      ...(option(rest, "--runs-dir", false)
        ? { runsDir: option(rest, "--runs-dir", false) }
        : {}),
    };
  }
  if (command === "route") {
    exactFlags(rest, ["--intent"]);
    return { command, intent: option(rest, "--intent")! };
  }
  if (command === "mcp") {
    exactFlags(rest, ["--url"]);
    return { command, url: option(rest, "--url", false) };
  }
  if (command === "chat") {
    const names = ["url", "intent", "product", "audience", "channel", "goals"];
    exactFlags(rest, [...names.map((name) => `--${name}`), "--timeout-ms"]);
    return { command, ...(option(rest, "--timeout-ms", false) ? { timeoutMs: option(rest, "--timeout-ms") } : {}), ...Object.fromEntries(names.flatMap((name) => {
      const value = option(rest, `--${name}`, false);
      return value === undefined ? [] : [[name, value]];
    })) };
  }
  if (command === "eval") {
    exactFlags(rest, ["--url"]);
    return {
      command,
      ...(option(rest, "--url", false) ? { url: option(rest, "--url") } : {}),
    } as CliCommand;
  }
  if (command === "backup") {
    const action = rest[0];
    if (
      !(["create", "verify"] as const).includes(action as "create" | "verify")
    ) {
      throw new Error(
        "[conquistador.cli] backup action must be create or verify",
      );
    }
    const flags = rest.slice(1);
    exactFlags(flags, ["--file"]);
    return {
      command,
      action: action as "create" | "verify",
      file: option(flags, "--file")!,
    };
  }
  if (command === "restore") {
    exactFlags(rest, ["--file"]);
    return { command, file: option(rest, "--file")! };
  }
  if (command === "migrate") {
    if (rest.length !== 1 || !["--check", "--apply"].includes(rest[0])) {
      throw new Error(
        "[conquistador.cli] migrate requires exactly --check or --apply",
      );
    }
    return { command, mode: rest[0] === "--check" ? "check" : "apply" };
  }
  if (command === "data") {
    const action = rest[0];
    const flags = rest.slice(1);
    if (action === "export") {
      exactFlags(flags, ["--scope", "--file"]);
      return {
        command,
        action,
        scope: option(flags, "--scope")!,
        file: option(flags, "--file")!,
      };
    }
    if (action === "erase") {
      exactFlags(flags, ["--scope", "--confirm", "--recoverability"]);
      const scope = option(flags, "--scope")!;
      const confirm = option(flags, "--confirm")!;
      const recoverability = option(flags, "--recoverability")!;
      if (scope !== confirm) {
        throw new Error(
          "[conquistador.cli] erase confirmation must equal the exact scope",
        );
      }
      if (
        !(["backup", "decline"] as const).includes(
          recoverability as "backup" | "decline",
        )
      ) {
        throw new Error(
          "[conquistador.cli] recoverability must be backup or decline",
        );
      }
      return {
        command,
        action,
        scope,
        confirm,
        recoverability: recoverability as "backup" | "decline",
      };
    }
    throw new Error("[conquistador.cli] data action must be export or erase");
  }
  throw new Error(`[conquistador.cli] unsupported command: ${command}`);
}

export function cliHelp(version = "1.0.0"): string {
  return `Conquistador ${version}

Usage:
  conquistador install [--project PATH] Install the complete operator in a project
  conquistador operator --help         Manage and verify a project operator
  conquistador setup doctor --path ABS [--json]  Check installed files; no host activation proof
  conquistador                         Show help
  conquistador setup                   Install, inspect, update or uninstall a host package
  conquistador connections --help      Inspect Executor, help install it, connect accounts
  conquistador jobs --help             Prepare a host for explicit durable jobs
  conquistador integrations status     Inspect pinned integration dependencies
  conquistador integrations check-updates
                                        Check upstream releases without changing versions
  conquistador init                    Create runtime configuration
  conquistador chat [--url URL] [--intent TEXT] [--product TEXT]
                    [--audience TEXT] [--channel TEXT] [--goals TEXT] [--timeout-ms N]
  conquistador mcp [--url URL]         Local methods over stdio; URL selects runtime bridge
  conquistador serve [--config FILE]   Start the service
  conquistador doctor [--config FILE]  Read-only diagnostics
  conquistador run --playbook ID|--playbook-file FILE --input FILE
  conquistador resume --run-id ID [--judgment-response FILE]
   conquistador judgment export --run-id ID --output FILE
  conquistador status --run-id ID
   conquistador route --intent TEXT
   conquistador eval [--url URL]        Reserved; use the Eval Lab SDK
   conquistador backup create|verify --file FILE
                                        Local state backup under <data-root>/backups/
   conquistador restore --file FILE     Verify first, then repair local state exactly
   conquistador migrate --check|--apply
   conquistador data export --scope all|session:ID|memory --file FILE
   conquistador data erase --scope all|session:ID --confirm SCOPE
     --recoverability backup|decline
   conquistador version

Lifecycle commands read conquistador.config.yaml (or $CONQUISTADOR_CONFIG) and
operate only inside the configured data root. Backups, exports, and erase
receipts are redacted; chat submits one served turn; eval remains reserved. Chat prompts for missing inputs
on terminals and uses CONQUISTADOR_CHAT_TOKEN only for service authentication.

Normal work ends at one final review. Publishing, spend, credentials, and
external mutations remain human-owned.
`;
}
