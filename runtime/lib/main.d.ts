import { type ChatHost } from "./chat-client.ts";
import { type CliCommand } from "./cli.ts";
import type { JudgmentProvider } from "./judgment.ts";
export type CliHost = {
    env: Record<string, string | undefined>;
    stdout: (value: string) => void;
    stderr: (value: string) => void;
    /** Optional embedding-only callback; the CLI never reads provider credentials. */
    judgment?: JudgmentProvider;
    prompt?: ChatHost["prompt"];
    signal?: AbortSignal;
};
export declare function executeCli(command: CliCommand, host: CliHost): Promise<number>;
export declare function runCli(argv: string[], host?: CliHost): Promise<number>;
