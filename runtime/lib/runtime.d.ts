import type { AuthenticatedReviewVerdictRequest, RuntimeEvent } from "./contracts.ts";
import type { RuntimeCorpus } from "./corpus.ts";
import type { ModelProvider } from "./providers.ts";
import { type HostAuthenticationVerifier, type ReviewPacketV1, type ReviewVerdictV1 } from "./review-contract.ts";
export declare class RuntimeFailure extends Error {
    readonly code: "invalid" | "not-found" | "forbidden" | "conflict" | "cancelled" | "deadline-exceeded" | "provider-failure";
    constructor(code: RuntimeFailure["code"], message: string);
}
export type SessionView = {
    schemaVersion: "conquistador.session/v1";
    id: string;
    principalId: string;
    state: "idle" | "running" | "awaiting-review" | "terminal";
    createdAt: string;
    updatedAt: string;
};
export declare class InMemoryRuntime {
    #private;
    constructor(options: {
        provider: ModelProvider;
        corpus: RuntimeCorpus;
        now?: () => Date;
        timeoutMilliseconds?: number;
        maximumSessions?: number;
        maximumQueuedMessages?: number;
        maximumTokensPerRun?: number;
        verifyAuthentication?: HostAuthenticationVerifier;
    });
    ready(): boolean;
    createSession(input: {
        principalId: string;
    }): Readonly<SessionView>;
    getSession(id: string, principalId: string): Readonly<SessionView>;
    sendMessage(sessionId: string, message: {
        id: string;
        content: string;
        principalId: string;
    }): Promise<ReviewPacketV1>;
    events(sessionId: string, after: number, principalId: string): ReadonlyArray<Readonly<RuntimeEvent>>;
    cancel(sessionId: string, principalId: string): void;
    decideReview(sessionId: string, reviewPacketId: string, request: AuthenticatedReviewVerdictRequest): Promise<Readonly<ReviewVerdictV1>>;
    reviewVerdict(sessionId: string, principalId: string): Readonly<ReviewVerdictV1> | undefined;
}
