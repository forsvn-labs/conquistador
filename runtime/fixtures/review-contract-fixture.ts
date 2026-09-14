import { sha256, type Sha256 } from "../src/canonical.ts";
import {
  renderReviewPacketText,
  REVIEW_CONTRACT_VERSION,
  type ReviewPacketV1,
  seal,
  validateReviewPacket,
} from "../src/review-contract.ts";
import {
  createReviewEvent,
  type ReviewEventV1,
  validateReviewEventStream,
} from "../src/review-events.ts";

const FIXTURE_TIMES = [
  "2026-08-21T00:00:00.000Z",
  "2026-08-21T00:01:00.000Z",
  "2026-08-21T00:02:00.000Z",
  "2026-08-21T00:03:00.000Z",
] as const;

export type ReviewPacketFixtureOptions = {
  packetId?: string;
  revisionId?: string;
  producerModule?: ReviewPacketV1["producer"]["module"];
  sourceId?: string;
  capabilityId?: string;
  sessionId?: string;
  runId?: string;
  artifactId?: string;
  artifactBody?: string;
  artifactDigest?: Sha256;
  evidence?: ReviewPacketV1["evidence"];
  unresolvedLimitations?: string[];
  actionProposal?: ReviewPacketV1["actionProposal"];
  createdAt?: string;
};

export function buildReviewPacketFixture(
  options: ReviewPacketFixtureOptions = {},
): ReviewPacketV1 {
  const artifactBody = options.artifactBody ?? "Fixture artifact work.";
  const packet = seal({
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "review-packet",
    packetId: options.packetId ?? "packet-1",
    revisionId: options.revisionId ?? "packet-1.r1",
    revision: 1,
    producer: {
      module: options.producerModule ?? "self-hosted-agent",
      sourceId: options.sourceId ?? "fixture-source",
      capabilityId: options.capabilityId ?? "fixture-capability",
      playbookId: null,
      playbookVersion: null,
    },
    identity: {
      sessionId: options.sessionId ?? "session-1",
      runId: options.runId ?? "run-1",
      candidateId: null,
      evidenceId: null,
    },
    artifact: {
      artifactId: options.artifactId ?? "artifact-1",
      revision: 1,
      digest: options.artifactDigest ?? sha256(artifactBody),
      state: "finished",
    },
    strategicBet: "Exact authority prevents replay.",
    work: { state: "finished", summary: artifactBody, partialReason: null },
    materialTactics: [
      "Bind exact source and artifact identity.",
      "Keep action authority separate.",
    ],
    evidence: options.evidence ?? [{
      id: "fixture-evidence",
      digest: sha256("evidence"),
      provenance: "deterministic implementation fixture",
    }],
    unresolvedLimitations: options.unresolvedLimitations ?? [
      "Structural fixture only; no candidate, provider, model, or human review exists.",
    ],
    proposedNextAction: "Await a separately authenticated human review.",
    actionProposal: options.actionProposal === undefined
      ? {
        authority: "provider.fixture",
        operation: "draft",
        connectionRef: "connection.fixture",
        payload: { body: "fixture", items: [1, 2] },
        payloadDigest: sha256({ body: "fixture", items: [1, 2] }),
      }
      : options.actionProposal,
    redaction: { classification: "internal", secretFields: [], applied: true },
    reviewBoundary: {
      humanRequired: true,
      modelCannotDecide: true,
      oneFinalVerdict: true,
      outcomes: ["accept", "revise", "reject", "cancel"],
    },
    createdAt: options.createdAt ?? FIXTURE_TIMES[0],
  });
  validateReviewPacket(packet);
  return packet;
}

export function buildReviewEventFixture(
  packet: ReviewPacketV1,
  eventIdPrefix = "event",
): ReviewEventV1[] {
  const events: ReviewEventV1[] = [
    createReviewEvent(packet, {
      eventId: `${eventIdPrefix}-presented`,
      sequence: 1,
      eventType: "packet.presented",
      source: { kind: "host", id: "fixture-host" },
      actor: { kind: "system", id: null },
      payload: {
        format: "plain-text",
        presentationDigest: sha256(renderReviewPacketText(packet)),
        canonicalTextAvailable: true,
      },
      redaction: { classification: "internal", secretFields: [], applied: true },
      createdAt: packet.createdAt,
    }),
    createReviewEvent(packet, {
      eventId: `${eventIdPrefix}-annotation`,
      sequence: 2,
      eventType: "annotation.created",
      source: { kind: "companion", id: "fixture-companion" },
      actor: { kind: "agent", id: "fixture-agent" },
      payload: { body: "Check this claim.", anchor: "work.summary" },
      redaction: { classification: "internal", secretFields: [], applied: true },
      createdAt: FIXTURE_TIMES[1],
    }),
    createReviewEvent(packet, {
      eventId: `${eventIdPrefix}-suggestion`,
      sequence: 3,
      eventType: "suggestion.created",
      source: { kind: "companion", id: "fixture-companion" },
      actor: { kind: "agent", id: "fixture-agent" },
      payload: {
        body: "Propose only.",
        anchor: "work.summary",
        replacement: "Fixture artifact work.",
      },
      redaction: { classification: "internal", secretFields: [], applied: true },
      createdAt: FIXTURE_TIMES[2],
    }),
    createReviewEvent(packet, {
      eventId: `${eventIdPrefix}-companion-failed`,
      sequence: 4,
      eventType: "companion.failed",
      source: { kind: "companion", id: "fixture-companion" },
      actor: { kind: "system", id: null },
      payload: {
        code: "render-failed",
        message: "Optional rendering failed.",
        fallback: "plain-text",
        canonicalReviewAvailable: true,
        hostVerdictRequired: true,
      },
      redaction: { classification: "internal", secretFields: [], applied: true },
      createdAt: FIXTURE_TIMES[3],
    }),
  ];
  validateReviewEventStream(events, packet);
  return events;
}
