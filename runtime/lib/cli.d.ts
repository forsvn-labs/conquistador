export declare const PUBLIC_COMMANDS: readonly ["init", "chat", "mcp", "serve", "doctor", "run", "resume", "judgment", "status", "route", "eval", "backup", "restore", "migrate", "data", "version"];
export type CliCommand = {
    command: "init";
    config?: string;
} | ({
    command: "chat";
} & import("./chat-client.ts").ChatOptions) | {
    command: "mcp";
    url?: string;
} | {
    command: "serve";
    config?: string;
} | {
    command: "doctor";
    config?: string;
} | {
    command: "run";
    playbook?: string;
    playbookFile?: string;
    input: string;
    runsDir?: string;
    runId?: string;
} | {
    command: "resume";
    runId: string;
    runsDir?: string;
    judgmentResponse?: string;
} | {
    command: "judgment";
    action: "export";
    runId: string;
    runsDir?: string;
    output: string;
} | {
    command: "status";
    runId: string;
    runsDir?: string;
} | {
    command: "route";
    intent: string;
} | {
    command: "eval";
    url?: string;
} | {
    command: "backup";
    action: "create" | "verify";
    file: string;
} | {
    command: "restore";
    file: string;
} | {
    command: "migrate";
    mode: "check" | "apply";
} | {
    command: "data";
    action: "export";
    scope: string;
    file: string;
} | {
    command: "data";
    action: "erase";
    scope: string;
    confirm: string;
    recoverability: "backup" | "decline";
} | {
    command: "version";
};
export declare function parseCli(argv: string[]): CliCommand;
export declare function cliHelp(version?: string): string;
