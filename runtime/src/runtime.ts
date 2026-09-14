import { randomUUID } from "node:crypto";

import { deepFreeze, redact, sha256 } from "./canonical.ts";
import type {
  AuthenticatedReviewVerdictRequest,
  EventPayloadMap,
  RuntimeEvent,
} from "./contracts.ts";
import type { RuntimeCorpus } from "./corpus.ts";
import type { ModelProvider } from "./providers.ts";
import { isCanonicalId } from "./principal.ts";
import {
  type HostAuthenticationVerifier,
  type ReviewPacketV1,
  type ReviewVerdictV1,
  renderReviewPacketText,
  REVIEW_CONTRACT_VERSION,
  ReviewTransitionState,
  seal,
  validateReviewPacket,
  verdictSubjectDigest,
} from "./review-contract.ts";
import {
  createReviewEvent,
  validateReviewEventStream,
} from "./review-events.ts";

export class RuntimeFailure extends Error {
  readonly code: "invalid" | "not-found" | "forbidden" | "conflict" | "cancelled" | "deadline-exceeded" | "provider-failure";

  constructor(code: RuntimeFailure["code"], message: string) {
    super(message);
    this.name = "RuntimeFailure";
    this.code = code;
  }
}

export type SessionView = {
  schemaVersion: "conquistador.session/v1";
  id: string;
  principalId: string;
  state: "idle" | "running" | "awaiting-review" | "terminal";
  createdAt: string;
  updatedAt: string;
};

type QueueItem = {
  message: { id: string; content: string; principalId: string };
  resolve: (packet: ReviewPacketV1) => void;
  reject: (error: RuntimeFailure) => void;
};

type SessionRecord = SessionView & {
  events: RuntimeEvent[];
  queue: QueueItem[];
  active?: { controller: AbortController; messageId: string };
  reviews: Map<
    string,
    { packet: ReviewPacketV1; state: ReviewTransitionState }
  >;
  usedMessageIds: Set<string>;
};

export class InMemoryRuntime {
  readonly #provider: ModelProvider;
  readonly #corpus: RuntimeCorpus;
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #now: () => Date;
  readonly #timeoutMilliseconds: number;
  readonly #maximumSessions: number;
  readonly #maximumQueuedMessages: number;
  readonly #maximumTokensPerRun: number;
  readonly #verifyAuthentication: HostAuthenticationVerifier;

  constructor(options: {
    provider: ModelProvider;
    corpus: RuntimeCorpus;
    now?: () => Date;
    timeoutMilliseconds?: number;
    maximumSessions?: number;
    maximumQueuedMessages?: number;
    maximumTokensPerRun?: number;
    verifyAuthentication?: HostAuthenticationVerifier;
  }) {
    this.#provider = options.provider;
    this.#corpus = options.corpus;
    this.#now = options.now ?? (() => new Date());
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? 600_000;
    this.#maximumSessions = options.maximumSessions ?? 4;
    this.#maximumQueuedMessages = options.maximumQueuedMessages ?? 20;
    this.#maximumTokensPerRun = options.maximumTokensPerRun ?? 8_000;
    this.#verifyAuthentication = options.verifyAuthentication ?? (() => false);
    if (!Number.isInteger(this.#maximumTokensPerRun) || this.#maximumTokensPerRun <= 0) {
      throw new RuntimeFailure("invalid", "run token ceiling must be a positive integer");
    }
  }

  ready(): boolean {
    return true;
  }

  createSession(input: { principalId: string }): Readonly<SessionView> {
    if (!isCanonicalId(input.principalId)) {
      throw new RuntimeFailure(
        "invalid",
        "authenticated principal must be a canonical principal ID",
      );
    }
    const active = [...this.#sessions.values()].filter((session) => session.state !== "terminal").length;
    if (active >= this.#maximumSessions) throw new RuntimeFailure("conflict", "active session ceiling reached");
    const timestamp = this.#now().toISOString();
    const session: SessionRecord = {
      schemaVersion: "conquistador.session/v1",
      id: `session-${randomUUID()}`,
      principalId: input.principalId,
      state: "idle",
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
      queue: [],
      reviews: new Map(),
      usedMessageIds: new Set(),
    };
    this.#sessions.set(session.id, session);
    return this.#view(session);
  }

  getSession(id: string, principalId: string): Readonly<SessionView> {
    return this.#view(this.#owned(id, principalId));
  }

  sendMessage(
    sessionId: string,
    message: { id: string; content: string; principalId: string },
  ): Promise<ReviewPacketV1> {
    const session = this.#owned(sessionId, message.principalId);
    if (session.state === "terminal") throw new RuntimeFailure("conflict", "session is terminal");
    if (session.state === "awaiting-review") throw new RuntimeFailure("conflict", "final review decision is required");
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(message.id) || !message.content.trim()) {
      throw new RuntimeFailure("invalid", "message needs a stable ID and non-empty content");
    }
    if (session.usedMessageIds.has(message.id)) {
      throw new RuntimeFailure("conflict", "message ID was already used");
    }
    if (session.queue.length >= this.#maximumQueuedMessages) {
      throw new RuntimeFailure("conflict", "session queue ceiling reached");
    }
    session.usedMessageIds.add(message.id);
    return new Promise<ReviewPacketV1>((resolvePromise, reject) => {
      session.queue.push({ message: structuredClone(message), resolve: resolvePromise, reject });
      void this.#drain(session);
    });
  }

  events(sessionId: string, after: number, principalId: string): ReadonlyArray<Readonly<RuntimeEvent>> {
    const session = this.#owned(sessionId, principalId);
    if (!Number.isInteger(after) || after < 0) throw new RuntimeFailure("invalid", "event cursor is invalid");
    return deepFreeze(structuredClone(session.events.filter((event) => event.sequence > after)));
  }

  cancel(sessionId: string, principalId: string): void {
    const session = this.#owned(sessionId, principalId);
    if (!session.active) throw new RuntimeFailure("conflict", "session has no active turn");
    session.active.controller.abort();
  }

  async decideReview(
    sessionId: string,
    reviewPacketId: string,
    request: AuthenticatedReviewVerdictRequest,
  ): Promise<Readonly<ReviewVerdictV1>> {
    const session = this.#owned(sessionId, request.transport.principalId);
    const review = session.reviews.get(reviewPacketId);
    if (!review) throw new RuntimeFailure("not-found", "review packet was not found");
    if (review.state.verdictFor(review.packet)) {
      throw new RuntimeFailure("conflict", "review packet was already decided");
    }
    if (request.packetDigest !== review.packet.digest) {
      throw new RuntimeFailure("forbidden", "review decision digest differs from the packet");
    }
    if (!["accept", "revise", "reject", "cancel"].includes(request.outcome)) {
      throw new RuntimeFailure("invalid", "review decision is invalid");
    }
    const decidedAt = this.#now().toISOString();
    const basis = {
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "review-verdict" as const,
      verdictId: `${reviewPacketId}.verdict`,
      outcome: request.outcome,
      packetId: review.packet.packetId,
      packetDigest: review.packet.digest,
      artifactId: review.packet.artifact.artifactId,
      artifactRevision: review.packet.artifact.revision,
      artifactDigest: review.packet.artifact.digest,
      actionPayloadDigest: review.packet.actionProposal?.payloadDigest ?? null,
      sessionId: review.packet.identity.sessionId,
      runId: review.packet.identity.runId,
      candidateId: review.packet.identity.candidateId,
      evidenceId: review.packet.identity.evidenceId,
      decidedAt,
      expiryPolicy: "expires" as const,
      expiresAt: new Date(Date.parse(decidedAt) + 3_600_000).toISOString(),
      singleUse: true as const,
    };
    const subjectDigest = verdictSubjectDigest(review.packet, basis);
    let authentication;
    try {
      authentication = await request.authenticateHuman({
        transport: request.transport,
        principalId: request.transport.principalId,
        role: "reviewer",
        authority: "content-review",
        now: decidedAt,
        subjectDigest,
      });
    } catch {
      throw new RuntimeFailure(
        "forbidden",
        "explicit host-verified human review authority is required",
      );
    }
    const verdict = seal({
      ...basis,
      authentication,
    });
    try {
      review.state.consumeVerdict(review.packet, verdict, {
        now: decidedAt,
        expectedRole: "reviewer",
        verifyAuthentication: (proof, context) =>
          proof.principalId === request.transport.principalId &&
          this.#verifyAuthentication(proof, context),
      });
    } catch {
      throw new RuntimeFailure(
        "forbidden",
        "host human authentication proof failed canonical validation",
      );
    }
    session.state = "terminal";
    session.updatedAt = verdict.decidedAt;
    this.#rejectQueued(session, "session became terminal before queued work started");
    this.#emit(session, "final.result", { reviewVerdict: verdict });
    return verdict;
  }

  reviewVerdict(sessionId: string, principalId: string): Readonly<ReviewVerdictV1> | undefined {
    const session = this.#owned(sessionId, principalId);
    const verdict = [...session.reviews.values()]
      .map((review) => review.state.verdictFor(review.packet))
      .find((candidate) => candidate !== undefined);
    return verdict ? deepFreeze(structuredClone(verdict)) : undefined;
  }

  async #drain(session: SessionRecord): Promise<void> {
    if (session.active) return;
    const item = session.queue.shift();
    if (!item) return;
    const controller = new AbortController();
    session.active = { controller, messageId: item.message.id };
    session.state = "running";
    session.updatedAt = this.#now().toISOString();
    this.#emit(session, "input.accepted", {
      messageId: item.message.id,
      messageDigest: sha256(item.message.content),
    });
    this.#emit(session, "progress", { messageId: item.message.id, stage: "producing" });
    try {
      const selection = this.#corpus.resolve(item.message.content);
      const generated = await this.#provider.generate({
        prompt: item.message.content,
        system: `${selection.systemInstructions}\n\nProduce finished Conquistador work and stop at one final human review boundary.`,
        maxOutputTokens: this.#maximumTokensPerRun,
        deadlineAt: new Date(this.#now().getTime() + this.#timeoutMilliseconds).toISOString(),
        signal: controller.signal,
      });
      const safeText = String(redact(generated.text));
      this.#emit(session, "evidence", {
        messageId: item.message.id,
        provider: generated.provider,
        providerCellId: generated.providerCellId,
        providerRequestId: generated.providerRequestId,
        usage: generated.usage,
      });
      const evidenceBinding = {
          provider: generated.provider,
          providerCellId: generated.providerCellId,
          ...(generated.providerRequestId ? { providerRequestId: generated.providerRequestId } : {}),
          usage: generated.usage,
      };
      const createdAt = this.#now().toISOString();
      const packet = seal({
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "review-packet" as const,
        packetId: `${item.message.id}.review`,
        revisionId: `${item.message.id}.review.r1`,
        revision: 1,
        producer: {
          module: "self-hosted-agent" as const,
          sourceId: "self-hosted-api",
          capabilityId: selection.job,
          playbookId: null,
          playbookVersion: null,
        },
        identity: {
          sessionId: session.id,
          runId: item.message.id,
          candidateId: null,
          evidenceId: null,
        },
        artifact: {
          artifactId: `${item.message.id}.artifact`,
          revision: 1,
          digest: sha256(safeText),
          state: "finished" as const,
        },
        strategicBet: String(redact(item.message.content)),
        work: { state: "finished" as const, summary: safeText, partialReason: null },
        materialTactics: [
          "Produce the bounded requested artifact and stop for human review.",
        ],
        evidence: [{
          id: `${item.message.id}.provider-evidence`,
          digest: sha256(evidenceBinding),
          provenance: "self-hosted provider completion metadata",
        }],
        unresolvedLimitations: ["No human verdict has been recorded."],
        proposedNextAction: "Record one host-verified human verdict.",
        actionProposal: null,
        redaction: { classification: "internal" as const, secretFields: [], applied: true as const },
        reviewBoundary: {
          humanRequired: true as const,
          modelCannotDecide: true as const,
          oneFinalVerdict: true as const,
          outcomes: ["accept", "revise", "reject", "cancel"] as const,
        },
        createdAt,
      });
      validateReviewPacket(packet);
      const presentationEvent = createReviewEvent(packet, {
        eventId: `${packet.packetId}.presentation.1`,
        sequence: 1,
        eventType: "packet.presented",
        source: { kind: "host", id: "self-hosted-api" },
        actor: { kind: "system", id: null },
        payload: {
          format: "plain-text",
          presentationDigest: sha256(renderReviewPacketText(packet)),
          canonicalTextAvailable: true,
        },
        redaction: { classification: "internal", secretFields: [], applied: true },
        createdAt,
      });
      validateReviewEventStream([presentationEvent], packet);
      session.reviews.set(packet.packetId, {
        packet,
        state: new ReviewTransitionState(),
      });
      session.state = "awaiting-review";
      session.updatedAt = packet.createdAt;
      this.#emit(session, "review.packet", { reviewPacket: packet, presentationEvent });
      item.resolve(packet);
      this.#rejectQueued(session, "final review decision is required");
    } catch (error) {
      const upstreamCode = error && typeof error === "object" ? (error as { code?: string }).code : undefined;
      const code = upstreamCode === "cancelled" || upstreamCode === "deadline-exceeded"
        ? upstreamCode
        : "provider-failure";
      const failure = new RuntimeFailure(code, ({
        cancelled: "turn was cancelled",
        "deadline-exceeded": "turn deadline was exceeded",
        "provider-failure": "provider failed without exposing provider detail",
      } as const)[code]);
      session.state = "idle";
      session.updatedAt = this.#now().toISOString();
      this.#emit(session, "failure", { messageId: item.message.id, code, retryable: code !== "cancelled" });
      item.reject(failure);
    } finally {
      session.active = undefined;
      if (session.state === "idle") void this.#drain(session);
    }
  }

  #rejectQueued(session: SessionRecord, message: string): void {
    const abandoned = session.queue.splice(0);
    for (const item of abandoned) {
      item.reject(new RuntimeFailure("conflict", message));
    }
  }

  #owned(id: string, principalId: string): SessionRecord {
    const session = this.#sessions.get(id);
    if (!session) throw new RuntimeFailure("not-found", "session was not found");
    if (session.principalId !== principalId) throw new RuntimeFailure("forbidden", "session principal differs from transport identity");
    return session;
  }

  #emit<Type extends RuntimeEvent["type"]>(session: SessionRecord, type: Type, payload: EventPayloadMap[Type]): void {
    const event = deepFreeze({
      schemaVersion: "conquistador.event/v1" as const,
      id: `${session.id}.event.${session.events.length + 1}`,
      sessionId: session.id,
      sequence: session.events.length + 1,
      type,
      createdAt: this.#now().toISOString(),
      payload: structuredClone(payload),
    }) as RuntimeEvent;
    session.events.push(event);
  }

  #view(session: SessionRecord): Readonly<SessionView> {
    return deepFreeze({
      schemaVersion: session.schemaVersion,
      id: session.id,
      principalId: session.principalId,
      state: session.state,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  }
}
