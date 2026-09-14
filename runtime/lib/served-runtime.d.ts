import type { OperationBridge } from "./operation-bridge.ts";
import type { AuthenticatedReviewVerdictRequest, RuntimeEvent } from "./contracts.ts";
import type { JudgmentProvider } from "./judgment.ts";
import { type ActionAuthorizationV1, type HostAuthenticationVerifier, type ReviewPacketV1, type ReviewVerdictV1 } from "./review-contract.ts";
import { type SessionView } from "./runtime.ts";
export type PlaybookInputs = {
    product: string;
    audience: string;
    channel: string;
    goals: string;
};
export type ServedPlaybookRequest = {
    playbookId: string;
    inputs: PlaybookInputs;
};
export type DurableServedRuntimeOptions = {
    dataDir: string;
    instanceId: string;
    judgment?: JudgmentProvider;
    operationBridge?: OperationBridge;
    now?: () => Date;
    maximumSessions?: number;
    maximumQueuedMessages?: number;
    maximumTokensPerRun?: number;
    verifyAuthentication?: HostAuthenticationVerifier;
};
export declare function parseServedPlaybookRequest(content: string): ServedPlaybookRequest;
export declare class DurableServedRuntime {
    #private;
    constructor(options: DurableServedRuntimeOptions);
    ready(): boolean;
    shutdown(): Promise<void>;
    createSession(input: {
        principalId: string;
    }): Readonly<SessionView>;
    sendMessage(sessionId: string, message: {
        id: string;
        content: string;
        principalId: string;
    }): Promise<ReviewPacketV1>;
    events(sessionId: string, after: number, principalId: string): ReadonlyArray<Readonly<RuntimeEvent>>;
    cancel(sessionId: string, principalId: string): void;
    decideReview(sessionId: string, reviewPacketId: string, request: AuthenticatedReviewVerdictRequest): Promise<Readonly<ReviewVerdictV1>>;
    listArtifacts(sessionId: string, principalId: string): Record<string, unknown>;
    readArtifact(sessionId: string, artifactId: string, principalId: string): Record<string, unknown>;
    actionState(sessionId: string, principalId: string): Record<string, unknown>;
    authorizeAction(sessionId: string, packetId: string, request: Omit<AuthenticatedReviewVerdictRequest, "outcome">): Promise<Readonly<ActionAuthorizationV1>>;
    importActionReceipt(sessionId: string, receipt: unknown, request: Pick<AuthenticatedReviewVerdictRequest, "transport" | "authenticateHuman">): Promise<Record<string, unknown>>;
    reviewVerdict(sessionId: string, principalId: string): Readonly<ReviewVerdictV1> | undefined;
}
