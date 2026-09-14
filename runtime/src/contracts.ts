import type { Sha256 } from "./canonical.ts";
import type { ParentJob } from "./routing-manifest.ts";
import type {
  HostHumanAuthenticator,
  ReviewOutcome,
  ReviewPacketV1,
  ReviewVerdictV1,
  TransportAuthentication,
} from "./review-contract.ts";
import type { ReviewPresentationEventV1 } from "./review-events.ts";

export type ProviderId = "openai" | "anthropic" | "vercel-ai-gateway";

export type ModelConfig = {
  billingMode?: "host-covered";
  provider: ProviderId;
  model: string;
  credentialEnv: string;
};

export type ConquistadorConfig = {
  schemaVersion: "conquistador.config/v1";
  instance: { id: string };
  models: { primary: ModelConfig; fast: ModelConfig; judge: ModelConfig };
  server: {
    profile: "local" | "single-node";
    bind: string;
    port: number;
    publicUrl?: string;
    auth:
      | { mode: "local" }
      | { mode: "bearer"; tokenEnv: string }
      | { mode: "oidc"; issuer: string; audience: string; jwksUrl: string };
    allowedOrigins: string[];
    trustedProxies: string[];
  };
  data: {
    dir: string;
    sessionRetentionDays: number;
    traceRetentionDays: number;
    artifactPolicy: "accepted-only" | "reviewed";
    backupPolicy: "operator";
  };
  memory: { mode: "off" | "review-promoted"; scopePolicy: "instance-workspace-project" };
  sandbox: { mode: "disabled"; projectRoots: string[] };
  limits: {
    activeSessions: number;
    internalSpecialists: number;
    tokensPerRun: number;
    timeoutSeconds: number;
    queuedMessages: number;
    bodyBytes: number;
  };
  tools: { catalogPath?: string; actionPolicy: "human-bound" };
};

export type CorpusDescriptor = {
  schemaVersion: "conquistador.corpus/v1";
  defaultAgent: "conquistador";
  jobs: readonly ParentJob[];
  skillIds: string[];
  digest: Sha256;
};

export type ProviderGenerateRequest = {
  prompt: string;
  system?: string;
  maxOutputTokens: number;
  deadlineAt: string;
  signal?: AbortSignal;
};

export type ProviderGenerateResult = {
  provider: ProviderId;
  providerCellId: string;
  providerRequestId?: string;
  text: string;
  usage: { inputTokens: number; outputTokens: number };
};

export type EventType =
  | "input.accepted"
  | "progress"
  | "evidence"
  | "review.packet"
  | "approval.request"
  | "final.result"
  | "learning.proposal"
  | "warning"
  | "failure";

type RuntimeEventBase = {
  schemaVersion: "conquistador.event/v1";
  id: string;
  sessionId: string;
  sequence: number;
  createdAt: string;
};

export type EventPayloadMap = {
  "input.accepted": { messageId: string; messageDigest: Sha256 };
  progress: { messageId: string; stage: "producing" };
  evidence: {
    messageId: string;
    provider: ProviderId;
    providerCellId: string;
    providerRequestId?: string;
    usage: { inputTokens: number; outputTokens: number };
  };
  "review.packet": {
    reviewPacket: ReviewPacketV1;
    presentationEvent: ReviewPresentationEventV1;
  };
  "approval.request": { id: string; summary: string };
  "final.result": { reviewVerdict: ReviewVerdictV1 };
  "learning.proposal": { proposal: unknown };
  warning: { code: string; message: string };
  failure: { messageId: string; code: "cancelled" | "deadline-exceeded" | "provider-failure"; retryable: boolean };
};

export type RuntimeEvent = {
  [Type in EventType]: RuntimeEventBase & { type: Type; payload: EventPayloadMap[Type] }
}[EventType];

export type ReviewVerdictRequest = {
  outcome: ReviewOutcome;
  packetDigest: Sha256;
};

export type AuthenticatedReviewVerdictRequest = ReviewVerdictRequest & {
  transport: TransportAuthentication;
  authenticateHuman: HostHumanAuthenticator;
};
