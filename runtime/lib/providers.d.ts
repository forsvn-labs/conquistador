import type { ModelConfig, ProviderGenerateRequest, ProviderGenerateResult, ProviderId } from "./contracts.ts";
export type ProviderCell = {
    id: string;
    provider: ProviderId;
    transport: string;
    endpoint: string;
    credentialEnv: string;
    state: "fixture-verified" | "live-verified" | "supported";
    officialSources: string[];
    checkedAt: string;
    liveEvidence: null | {
        candidateBuildId: string;
        receiptId: string;
    };
};
type TransportRequest = {
    url: string;
    method: "POST";
    headers: Record<string, string>;
    body: Record<string, unknown>;
    signal?: AbortSignal;
};
type TransportResponse = {
    status: number;
    headers?: Record<string, string>;
    json: unknown;
};
export type ProviderTransport = (request: TransportRequest) => Promise<TransportResponse>;
export type ModelProvider = {
    id: string;
    generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult>;
};
export declare class ProviderFailure extends Error {
    readonly code: "cancelled" | "deadline-exceeded" | "provider-failure";
    readonly retryable: boolean;
    constructor(code: ProviderFailure["code"], message: string, retryable?: boolean);
}
export declare const providerCells: readonly ProviderCell[];
export declare function createProvider(config: ModelConfig, options?: {
    env?: Record<string, string | undefined>;
    transport?: ProviderTransport;
    sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
    now?: () => Date;
}): ModelProvider;
export {};
