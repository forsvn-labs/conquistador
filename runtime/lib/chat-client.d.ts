export type ChatOptions = {
    url?: string;
    intent?: string;
    product?: string;
    audience?: string;
    channel?: string;
    goals?: string;
    timeoutMs?: string;
};
export type ChatHost = {
    env: Record<string, string | undefined>;
    stdout: (text: string) => void;
    prompt?: (question: string, signal: AbortSignal) => Promise<string>;
    signal?: AbortSignal;
};
export declare function terminalChatPrompt(question: string, signal: AbortSignal): Promise<string>;
/** One bounded turn against the served API. Never submits review or action decisions. */
export declare function runChat(options: ChatOptions, host: ChatHost): Promise<number>;
