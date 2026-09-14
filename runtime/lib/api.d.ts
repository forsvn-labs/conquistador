import type { AuthenticatedReviewVerdictRequest, RuntimeEvent } from "./contracts.ts";
import { type SessionView } from "./runtime.ts";
import type { ActionAuthorizationV1, HostHumanAuthenticator, ReviewPacketV1, ReviewVerdictV1, TransportAuthentication } from "./review-contract.ts";
export type SessionRuntime = {
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
    reviewVerdict(sessionId: string, principalId: string): Readonly<ReviewVerdictV1> | undefined;
    listArtifacts?(sessionId: string, principalId: string): Record<string, unknown>;
    readArtifact?(sessionId: string, artifactId: string, principalId: string): Record<string, unknown>;
    actionState?(sessionId: string, principalId: string): Record<string, unknown>;
    authorizeAction?(sessionId: string, packetId: string, request: Omit<AuthenticatedReviewVerdictRequest, "outcome">): Promise<Readonly<ActionAuthorizationV1>>;
    importActionReceipt?(sessionId: string, receipt: unknown, request: Pick<AuthenticatedReviewVerdictRequest, "transport" | "authenticateHuman">): Promise<Record<string, unknown>>;
    ready(): boolean;
};
export type ApiRequest = {
    method: "GET" | "POST";
    path: string;
    authentication?: TransportAuthentication;
    authenticateHumanReview?: HostHumanAuthenticator;
    body?: unknown;
};
export type ApiResponse = {
    status: number;
    body: unknown;
};
export declare class ApiV1 {
    #private;
    constructor(runtime: SessionRuntime);
    handle(request: ApiRequest): Promise<ApiResponse>;
}
