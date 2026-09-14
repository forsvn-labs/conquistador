import { type Sha256, sha256 } from "./canonical.ts";
import {
  type ActionAuthorizationV1,
  REVIEW_OUTCOMES,
  type ReviewPacketV1,
  ReviewTransitionState,
  type ReviewVerdictV1,
  validateActionAuthorization,
  validateVerdict,
  type ValidationContext,
} from "./review-contract.ts";

export type BoundArtifact = {
  artifactId: string;
  path: string;
  contentDigest: Sha256;
};

export type PlaybookReviewPacket = {
  schemaVersion: "conquistador.review-packet/v1";
  id: string;
  sessionId: string;
  messageId: string;
  runId: string;
  gateId: string;
  requestedOutcome: string;
  completed: string;
  deliverables: Array<
    { kind: "artifact" | "text"; content: string; digest: Sha256 }
  >;
  evidence: unknown[];
  assumptions: string[];
  unknowns: string[];
  quality: Array<{ id: string; status: "passed" | "warning" | "failed" }>;
  learningProposals: unknown[];
  actionProposals: Array<Record<string, unknown>>;
  humanRequired: true;
  modelCannotSatisfy: true;
  actionGateSeparate: true;
  outcomes: ["accept", "revise", "reject", "cancel"];
  boundArtifacts: BoundArtifact[];
  createdAt: string;
  digest: Sha256;
};

export type ActionGateRecord = {
  schemaVersion: "conquistador.action-gate/v1";
  id: string;
  runId: string;
  gateId: string;
  afterGate: string;
  requiresReviewOutcome: "accept";
  humanRequired: true;
  modelCannotSatisfy: true;
  mutationClass: "draft" | "publish" | "spend" | "account-change";
  fallback: "human-action-manifest";
  reviewPacketId: string;
  reviewPacketDigest: Sha256;
  reviewOutcome: "accept";
  boundArtifacts: BoundArtifact[];
  boundPayloadDigest: Sha256;
  executed: false;
  liveCall: false;
  credentialsUsed: false;
  createdAt: string;
  digest: Sha256;
};

export type GateEvaluation =
  | { ok: true }
  | {
    ok: false;
    code: "unreviewed" | "stale-approval" | "missing-binding";
    detail: string;
  };

const REVIEW_PREFIX = "conquistador.review-packet";
const ACTION_PREFIX = "conquistador.action-gate";
const SHA = /^sha256:[a-f0-9]{64}$/;

function invariant(
  prefix: string,
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(`[${prefix}] ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  prefix: string,
  value: object,
  allowed: string[],
  label: string,
): void {
  const keys = Object.keys(value);
  invariant(
    prefix,
    keys.every((key) => allowed.includes(key)),
    `${label} contains an undeclared field`,
  );
}

function nonEmpty(
  prefix: string,
  value: unknown,
  label: string,
): asserts value is string {
  invariant(
    prefix,
    typeof value === "string" && value.trim().length > 0,
    `${label} is required`,
  );
}

function exactUtc(
  prefix: string,
  value: unknown,
  label: string,
): asserts value is string {
  invariant(
    prefix,
    typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString() === value,
    `${label} must be an exact UTC ISO timestamp`,
  );
}

function digest(
  prefix: string,
  value: unknown,
  label: string,
): asserts value is Sha256 {
  invariant(
    prefix,
    typeof value === "string" && SHA.test(value),
    `${label} must be a sha256 digest`,
  );
}

function omitDeclaredKeys(
  value: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const basis = { ...value };
  for (const key of keys) delete basis[key];
  return basis;
}

function validateBoundArtifacts(
  prefix: string,
  value: unknown,
  label: string,
): asserts value is BoundArtifact[] {
  invariant(
    prefix,
    Array.isArray(value) && value.length > 0,
    `${label} are required`,
  );
  for (const [index, entry] of value.entries()) {
    invariant(prefix, isObject(entry), `${label}[${index}] must be an object`);
    exactKeys(
      prefix,
      entry,
      ["artifactId", "path", "contentDigest"],
      `${label}[${index}]`,
    );
    nonEmpty(prefix, entry.artifactId, `${label}[${index}].artifactId`);
    nonEmpty(prefix, entry.path, `${label}[${index}].path`);
    digest(prefix, entry.contentDigest, `${label}[${index}].contentDigest`);
  }
}

export function validatePlaybookReviewPacket(
  value: unknown,
): asserts value is PlaybookReviewPacket {
  const prefix = REVIEW_PREFIX;
  invariant(prefix, isObject(value), "review packet must be an object");
  exactKeys(
    prefix,
    value,
    [
      "schemaVersion",
      "id",
      "sessionId",
      "messageId",
      "runId",
      "gateId",
      "requestedOutcome",
      "completed",
      "deliverables",
      "evidence",
      "assumptions",
      "unknowns",
      "quality",
      "learningProposals",
      "actionProposals",
      "humanRequired",
      "modelCannotSatisfy",
      "actionGateSeparate",
      "outcomes",
      "boundArtifacts",
      "createdAt",
      "digest",
    ],
    "review packet",
  );
  invariant(
    prefix,
    value.schemaVersion === "conquistador.review-packet/v1",
    "schemaVersion must be conquistador.review-packet/v1",
  );
  nonEmpty(prefix, value.id, "id");
  nonEmpty(prefix, value.sessionId, "sessionId");
  nonEmpty(prefix, value.messageId, "messageId");
  nonEmpty(prefix, value.runId, "runId");
  nonEmpty(prefix, value.gateId, "gateId");
  nonEmpty(prefix, value.requestedOutcome, "requestedOutcome");
  nonEmpty(prefix, value.completed, "completed");
  invariant(
    prefix,
    Array.isArray(value.deliverables),
    "deliverables must be an array",
  );
  invariant(prefix, Array.isArray(value.evidence), "evidence must be an array");
  invariant(
    prefix,
    Array.isArray(value.assumptions),
    "assumptions must be an array",
  );
  invariant(prefix, Array.isArray(value.unknowns), "unknowns must be an array");
  invariant(prefix, Array.isArray(value.quality), "quality must be an array");
  invariant(
    prefix,
    Array.isArray(value.learningProposals),
    "learningProposals must be an array",
  );
  invariant(
    prefix,
    Array.isArray(value.actionProposals),
    "actionProposals must be an array",
  );
  invariant(
    prefix,
    value.humanRequired === true,
    "review gates require a human",
  );
  invariant(
    prefix,
    value.modelCannotSatisfy === true,
    "model output cannot satisfy a review gate",
  );
  invariant(
    prefix,
    value.actionGateSeparate === true,
    "the action gate must remain a separate contract",
  );
  invariant(
    prefix,
    JSON.stringify(value.outcomes) === JSON.stringify(REVIEW_OUTCOMES),
    "outcomes must be accept, revise, reject, cancel",
  );
  validateBoundArtifacts(prefix, value.boundArtifacts, "boundArtifacts");
  exactUtc(prefix, value.createdAt, "createdAt");
  digest(prefix, value.digest, "digest");
  invariant(
    prefix,
    sha256(omitDeclaredKeys(value, ["digest"])) === value.digest,
    "review packet digest does not bind its declared content",
  );
}

export function validateActionGateRecord(
  value: unknown,
): asserts value is ActionGateRecord {
  const prefix = ACTION_PREFIX;
  invariant(prefix, isObject(value), "action gate must be an object");
  exactKeys(
    prefix,
    value,
    [
      "schemaVersion",
      "id",
      "runId",
      "gateId",
      "afterGate",
      "requiresReviewOutcome",
      "humanRequired",
      "modelCannotSatisfy",
      "mutationClass",
      "fallback",
      "reviewPacketId",
      "reviewPacketDigest",
      "reviewOutcome",
      "boundArtifacts",
      "boundPayloadDigest",
      "executed",
      "liveCall",
      "credentialsUsed",
      "createdAt",
      "digest",
    ],
    "action gate",
  );
  invariant(
    prefix,
    value.schemaVersion === "conquistador.action-gate/v1",
    "schemaVersion must be conquistador.action-gate/v1",
  );
  nonEmpty(prefix, value.id, "id");
  nonEmpty(prefix, value.runId, "runId");
  nonEmpty(prefix, value.gateId, "gateId");
  nonEmpty(prefix, value.afterGate, "afterGate");
  invariant(
    prefix,
    value.gateId !== value.afterGate,
    "review and action gates must remain separate",
  );
  invariant(
    prefix,
    value.requiresReviewOutcome === "accept",
    "an action gate requires an accepted review",
  );
  invariant(
    prefix,
    value.humanRequired === true,
    "action gates require a human",
  );
  invariant(
    prefix,
    value.modelCannotSatisfy === true,
    "model output cannot satisfy an action gate",
  );
  invariant(
    prefix,
    ["draft", "publish", "spend", "account-change"].includes(
      value.mutationClass as string,
    ),
    "mutationClass is invalid",
  );
  invariant(
    prefix,
    value.fallback === "human-action-manifest",
    "unverified actions must fall back to a human action manifest",
  );
  nonEmpty(prefix, value.reviewPacketId, "reviewPacketId");
  digest(prefix, value.reviewPacketDigest, "reviewPacketDigest");
  invariant(
    prefix,
    value.reviewOutcome === "accept",
    "action gate reviewOutcome must be accept",
  );
  validateBoundArtifacts(prefix, value.boundArtifacts, "boundArtifacts");
  digest(prefix, value.boundPayloadDigest, "boundPayloadDigest");
  invariant(
    prefix,
    value.executed === false,
    "the action gate cannot claim execution",
  );
  invariant(
    prefix,
    value.liveCall === false,
    "the action gate cannot claim a live call",
  );
  invariant(
    prefix,
    value.credentialsUsed === false,
    "the action gate cannot claim credentials",
  );
  exactUtc(prefix, value.createdAt, "createdAt");
  digest(prefix, value.digest, "digest");
  invariant(
    prefix,
    sha256(omitDeclaredKeys(value, ["digest"])) === value.digest,
    "action gate digest does not bind its declared content",
  );
}

export function actionPayloadDigest(payload: {
  mutationClass: string;
  operationId: string;
  artifactContentDigests: Record<string, Sha256>;
}): Sha256 {
  return sha256({
    mutationClass: payload.mutationClass,
    operationId: payload.operationId,
    artifactContentDigests: payload.artifactContentDigests,
  });
}

export function createReviewPacket(input: {
  runId: string;
  gateId: string;
  requestedOutcome: string;
  deliverables: PlaybookReviewPacket["deliverables"];
  boundArtifacts: BoundArtifact[];
  actionProposals: Array<Record<string, unknown>>;
  createdAt: string;
}): PlaybookReviewPacket {
  const basis = {
    schemaVersion: "conquistador.review-packet/v1" as const,
    id: `${input.runId}.review`,
    sessionId: input.runId,
    messageId: "specialist-review",
    runId: input.runId,
    gateId: input.gateId,
    requestedOutcome: input.requestedOutcome,
    completed:
      "One Review Packet is ready for a human accept, revise, or reject decision.",
    deliverables: input.deliverables,
    evidence: [] as unknown[],
    assumptions: [
      "Judgment steps completed only through validated judgment responses.",
    ],
    unknowns: ["Observed results remain unknown until a later cycle."],
    quality: [{ id: "graph-ran", status: "passed" as const }],
    learningProposals: [] as unknown[],
    actionProposals: input.actionProposals,
    humanRequired: true as const,
    modelCannotSatisfy: true as const,
    actionGateSeparate: true as const,
    outcomes: [...REVIEW_OUTCOMES] as ["accept", "revise", "reject", "cancel"],
    boundArtifacts: input.boundArtifacts,
    createdAt: input.createdAt,
  };
  const packet = { ...basis, digest: sha256(basis) };
  validatePlaybookReviewPacket(packet);
  return packet;
}

export function createActionGateRecord(input: {
  runId: string;
  gateId: string;
  afterGate: string;
  mutationClass: ActionGateRecord["mutationClass"];
  packet: PlaybookReviewPacket;
  canonicalPacket: ReviewPacketV1;
  verdict: ReviewVerdictV1;
  authorization: ActionAuthorizationV1;
  transitions: ReviewTransitionState;
  context: ValidationContext;
  operationId: string;
  createdAt: string;
}): ActionGateRecord {
  validatePlaybookReviewPacket(input.packet);
  validateVerdict(input.verdict, input.canonicalPacket, input.context);
  validateActionAuthorization(
    input.authorization,
    input.canonicalPacket,
    input.verdict,
    input.context,
  );
  invariant(
    ACTION_PREFIX,
    input.verdict.outcome === "accept",
    "action gate requires an accepted review",
  );
  invariant(
    ACTION_PREFIX,
    input.packet.runId === input.canonicalPacket.identity.runId,
    "legacy delivery packet does not match canonical review run",
  );
  invariant(
    ACTION_PREFIX,
    input.transitions.verdictFor(input.canonicalPacket)?.digest ===
      input.verdict.digest,
    "canonical verdict was not consumed by transition state",
  );
  invariant(
    ACTION_PREFIX,
    input.transitions.authorizationWasIssued(input.authorization),
    "canonical authorization was not issued by transition state",
  );
  const boundPayloadDigest = actionPayloadDigest({
    mutationClass: input.mutationClass,
    operationId: input.operationId,
    artifactContentDigests: Object.fromEntries(
      input.packet.boundArtifacts.map((
        entry,
      ) => [entry.artifactId, entry.contentDigest]),
    ),
  });
  invariant(
    ACTION_PREFIX,
    input.authorization.allowed.payloadDigest === boundPayloadDigest,
    "action gate payload is not the exact authorized payload",
  );
  const basis = {
    schemaVersion: "conquistador.action-gate/v1" as const,
    id: `${input.runId}.action`,
    runId: input.runId,
    gateId: input.gateId,
    afterGate: input.afterGate,
    requiresReviewOutcome: "accept" as const,
    humanRequired: true as const,
    modelCannotSatisfy: true as const,
    mutationClass: input.mutationClass,
    fallback: "human-action-manifest" as const,
    reviewPacketId: input.canonicalPacket.packetId,
    reviewPacketDigest: input.canonicalPacket.digest,
    reviewOutcome: "accept" as const,
    boundArtifacts: input.packet.boundArtifacts,
    boundPayloadDigest,
    executed: false as const,
    liveCall: false as const,
    credentialsUsed: false as const,
    createdAt: input.createdAt,
  };
  const record = { ...basis, digest: sha256(basis) };
  validateActionGateRecord(record);
  return record;
}

export function evaluateReviewApproval(
  packet: PlaybookReviewPacket,
  currentContentDigests: Record<string, Sha256>,
): GateEvaluation {
  validatePlaybookReviewPacket(packet);
  if (!packet.boundArtifacts.length) {
    return {
      ok: false,
      code: "missing-binding",
      detail: "review packet has no bound artifact hashes",
    };
  }
  for (const bound of packet.boundArtifacts) {
    const current = currentContentDigests[bound.artifactId];
    if (!current) {
      return {
        ok: false,
        code: "stale-approval",
        detail: `artifact ${bound.artifactId} is missing`,
      };
    }
    if (current !== bound.contentDigest) {
      return {
        ok: false,
        code: "stale-approval",
        detail: `artifact ${bound.artifactId} changed after the bound review`,
      };
    }
  }
  return { ok: true };
}

export function evaluateActionGate(input: {
  packet: PlaybookReviewPacket;
  canonicalPacket: ReviewPacketV1;
  verdict: ReviewVerdictV1;
  authorization: ActionAuthorizationV1;
  transitions: ReviewTransitionState;
  context: ValidationContext;
  gate: ActionGateRecord;
  currentContentDigests: Record<string, Sha256>;
  currentPayloadDigest: Sha256;
}): GateEvaluation {
  validatePlaybookReviewPacket(input.packet);
  validateActionGateRecord(input.gate);
  validateVerdict(input.verdict, input.canonicalPacket, input.context);
  validateActionAuthorization(
    input.authorization,
    input.canonicalPacket,
    input.verdict,
    input.context,
  );
  if (
    input.gate.reviewPacketId !== input.canonicalPacket.packetId ||
    input.gate.reviewPacketDigest !== input.canonicalPacket.digest ||
    input.packet.runId !== input.canonicalPacket.identity.runId
  ) {
    return {
      ok: false,
      code: "unreviewed",
      detail: "action gate is not bound to this exact review packet",
    };
  }
  if (
    input.verdict.outcome !== "accept" || input.gate.reviewOutcome !== "accept"
  ) {
    return {
      ok: false,
      code: "unreviewed",
      detail: "action gate requires an accepted review",
    };
  }
  if (
    input.transitions.verdictFor(input.canonicalPacket)?.digest !==
      input.verdict.digest ||
    !input.transitions.authorizationWasIssued(input.authorization)
  ) {
    return {
      ok: false,
      code: "unreviewed",
      detail:
        "canonical verdict and authorization are not present in transition state",
    };
  }
  if (
    input.authorization.allowed.payloadDigest !==
      input.gate.boundPayloadDigest
  ) {
    return {
      ok: false,
      code: "unreviewed",
      detail: "action gate payload is not the exact authorized payload",
    };
  }
  const review = evaluateReviewApproval(
    input.packet,
    input.currentContentDigests,
  );
  if (!review.ok) return review;
  const bound = evaluateReviewApproval({
    ...input.packet,
    boundArtifacts: input.gate.boundArtifacts,
  }, input.currentContentDigests);
  if (!bound.ok) return bound;
  if (input.gate.boundPayloadDigest !== input.currentPayloadDigest) {
    return {
      ok: false,
      code: "stale-approval",
      detail: "action payload changed after the bound approval",
    };
  }
  return { ok: true };
}
