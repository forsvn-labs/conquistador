import type { OperationBridge } from "./operation-bridge.ts";
import { ApiV1 } from "./api.ts";
import type { ConquistadorConfig } from "./contracts.ts";
import { type HttpServerOptions } from "./http.ts";
import type { JudgmentProvider } from "./judgment.ts";
import type { HostAuthenticationVerifier } from "./review-contract.ts";
import { DurableServedRuntime } from "./served-runtime.ts";
export declare function loadConfigFile(path: string): ConquistadorConfig;
export type Readiness = Readonly<{
    ready: boolean;
    blockers: readonly string[];
}>;
export declare function inspectReadiness(config: ConquistadorConfig, env?: Record<string, string | undefined>): Readiness;
export declare function buildService(options: {
    config: ConquistadorConfig;
    env?: Record<string, string | undefined>;
    skillsRoot?: string;
    verifyOidc?: HttpServerOptions["verifyOidc"];
    authenticateHumanReview?: HttpServerOptions["authenticateHumanReview"];
    verifyAuthentication?: HostAuthenticationVerifier;
    judgment?: JudgmentProvider;
    operationBridge?: OperationBridge;
}): {
    api: ApiV1;
    corpus: Readonly<{
        descriptor: import("./contracts.ts").CorpusDescriptor;
        resolve(prompt: string): import("./corpus.ts").CorpusSelection;
    }>;
    runtime: DurableServedRuntime;
    server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    shutdown(): Promise<void>;
};
