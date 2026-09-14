import { sha256 } from "./canonical.ts";
import type { ModelConfig, ProviderGenerateResult } from "./contracts.ts";
import { type HostJudgmentProvider, type JudgmentProviderBinding, type JudgmentRequestV1, type JudgmentResponseV1 } from "./judgment.ts";
import type { ModelProvider } from "./providers.ts";
export declare const SERVED_JUDGMENT_BINDING: JudgmentProviderBinding;
export type ServedJudgmentLimits = Readonly<{
    maximumTokensPerRun: number;
    timeoutSeconds: number;
}>;
export declare function createServedJudgmentProvider(provider: ModelProvider, model: ModelConfig, binding?: JudgmentProviderBinding, limits?: ServedJudgmentLimits): HostJudgmentProvider;
export declare function judgmentResponseFromGeneration(request: Readonly<JudgmentRequestV1>, binding: JudgmentProviderBinding, model: ModelConfig, generated: ProviderGenerateResult, observed: {
    startedAt: string;
    finishedAt: string;
    promptTemplateDigest: ReturnType<typeof sha256>;
    settingsDigest: ReturnType<typeof sha256>;
}): JudgmentResponseV1;
