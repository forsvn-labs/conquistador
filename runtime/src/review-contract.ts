import { type Sha256, sha256 } from "./canonical.ts";
import {
  bodyDigest,
  deepFreeze,
  dg,
  exact,
  fail,
  id,
  jsonData,
  noSecret,
  nullableId,
  obj,
  ok,
  strings,
  text,
  utc,
} from "./review-validation.ts";
export const REVIEW_CONTRACT_VERSION =
  "conquistador.review-contract/v1" as const;
export const REVIEW_OUTCOMES = [
  "accept",
  "revise",
  "reject",
  "cancel",
] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
export type WorkState = "finished" | "partial" | "cancelled" | "failed";
export type HumanRole = "operator" | "reviewer" | "release-authority";
export type AuthenticationProof = {
  principalId: string;
  role: HumanRole;
  method: string;
  verifier: string;
  verifiedAt: string;
  authority: string;
  subjectDigest: Sha256;
  proofDigest: Sha256;
};
export type HostAuthenticationVerifier = (
  proof: AuthenticationProof,
  context: {
    authority: string;
    role: HumanRole;
    now: string;
    subjectDigest: Sha256;
  },
) => boolean;
export type TransportAuthentication = {
  principalId: string;
  method: string;
  verifier: string;
  verifiedAt: string;
  subjectBinding: {
    issuer: string;
    subjectDigest: Sha256;
  };
};
export type HumanAuthenticationChallenge = {
  actionPayloadDigest?: Sha256;
  transport: TransportAuthentication;
  principalId: string;
  role: "reviewer" | "operator";
  authority: "content-review" | "consequential-action";
  now: string;
  subjectDigest: Sha256;
};
export type HostHumanAuthenticator = (
  challenge: HumanAuthenticationChallenge,
) => AuthenticationProof | Promise<AuthenticationProof>;
export type ValidationContext = {
  now: string;
  verifyAuthentication: HostAuthenticationVerifier;
  expectedRole?: HumanRole;
};
export type ReviewArtifactBinding = {
  artifactId: string;
  revision: number;
  digest: Sha256;
  state: WorkState;
};
export type ReviewPacketV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  kind: "review-packet";
  packetId: string;
  revisionId: string;
  revision: number;
  producer: {
    module:
      | "portable-plugin"
      | "self-hosted-agent"
      | "tool-module"
      | "eval-lab"
      | "release";
    sourceId: string;
    capabilityId: string;
    playbookId: string | null;
    playbookVersion: string | null;
  };
  identity: {
    sessionId: string;
    runId: string;
    candidateId: string | null;
    evidenceId: string | null;
  };
  artifact: ReviewArtifactBinding;
  strategicBet: string;
  work: { state: WorkState; summary: string; partialReason: string | null };
  materialTactics: string[];
  evidence: Array<{ id: string; digest: Sha256; provenance: string }>;
  unresolvedLimitations: string[];
  proposedNextAction: string;
  actionProposal: null | {
    authority: string;
    operation: string;
    connectionRef: string;
    payload: unknown;
    payloadDigest: Sha256;
  };
  redaction: {
    classification: "public" | "internal" | "confidential" | "secret";
    secretFields: string[];
    applied: true;
  };
  reviewBoundary: {
    humanRequired: true;
    modelCannotDecide: true;
    oneFinalVerdict: true;
    outcomes: readonly ReviewOutcome[];
  };
  createdAt: string;
  digest: Sha256;
};
export type ReviewVerdictV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  kind: "review-verdict";
  verdictId: string;
  outcome: ReviewOutcome;
  packetId: string;
  packetDigest: Sha256;
  artifactId: string;
  artifactRevision: number;
  artifactDigest: Sha256;
  actionPayloadDigest: Sha256 | null;
  sessionId: string;
  runId: string;
  candidateId: string | null;
  evidenceId: string | null;
  authentication: AuthenticationProof;
  decidedAt: string;
  expiryPolicy: "expires";
  expiresAt: string;
  singleUse: true;
  digest: Sha256;
};
export type ActionAuthorizationV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  kind: "action-authorization";
  authorizationId: string;
  verdictId: string;
  verdictDigest: Sha256;
  packetId: string;
  packetDigest: Sha256;
  sessionId: string;
  runId: string;
  candidateId: string | null;
  artifact: ReviewArtifactBinding;
  allowed: {
    authority: string;
    operation: string;
    connectionRef: string;
    payloadDigest: Sha256;
  };
  authentication: AuthenticationProof;
  authorizedAt: string;
  expiresAt: string;
  singleUse: true;
  digest: Sha256;
};
export type ActionReceiptV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  kind: "action-receipt";
  receiptId: string;
  authorizationId: string;
  authorizationDigest: Sha256;
  sessionId: string;
  runId: string;
  candidateId: string | null;
  artifact: ReviewArtifactBinding;
  authority: string;
  operation: string;
  connectionRef: string;
  payloadDigest: Sha256;
  status: "succeeded" | "failed" | "cancelled";
  startedAt: string;
  finishedAt: string;
  redactionApplied: true;
  terminal: true;
  digest: Sha256;
};
export type ResultObservationV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  kind: "result-observation";
  observationId: string;
  receiptId: string;
  receiptDigest: Sha256;
  status: "unknown" | "known";
  measures: Record<string, unknown> | null;
  observedAt: string;
  digest: Sha256;
};
export type LearningRecordV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  kind: "learning-record";
  learningId: string;
  observationId: string;
  observationDigest: Sha256;
  status: "unknown" | "recorded";
  claim: string | null;
  createdAt: string;
  digest: Sha256;
};
export type ReviewRecord =
  | ReviewPacketV1
  | ReviewVerdictV1
  | ActionAuthorizationV1
  | ActionReceiptV1
  | ResultObservationV1
  | LearningRecordV1;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export function validateArtifactBinding(
  v: unknown,
): asserts v is ReviewArtifactBinding {
  obj(v, "artifact");
  exact(v, ["artifactId", "revision", "digest", "state"], "artifact");
  id(v.artifactId, "artifactId");
  ok(
    Number.isInteger(v.revision) && Number(v.revision) > 0,
    "artifact revision invalid",
  );
  dg(v.digest, "artifact digest");
  ok(
    ["finished", "partial", "cancelled", "failed"].includes(v.state as string),
    "artifact state invalid",
  );
}
function auth(v: unknown): asserts v is AuthenticationProof {
  obj(v, "authentication");
  exact(v, [
    "principalId",
    "role",
    "method",
    "verifier",
    "verifiedAt",
    "authority",
    "subjectDigest",
    "proofDigest",
  ], "authentication");
  id(v.principalId, "principalId");
  ok(
    ["operator", "reviewer", "release-authority"].includes(v.role as string),
    "authentication role invalid",
  );
  id(v.method, "method");
  id(v.verifier, "verifier");
  utc(v.verifiedAt, "verifiedAt");
  id(v.authority, "authentication authority");
  dg(v.subjectDigest, "authentication subjectDigest");
  dg(v.proofDigest, "proofDigest");
}
export function seal<T extends object>(body: T): T & { digest: Sha256 } {
  const c = structuredClone(body);
  return deepFreeze({ ...c, digest: sha256(c) }) as T & { digest: Sha256 };
}
export function validateReviewPacket(v: unknown): asserts v is ReviewPacketV1 {
  obj(v, "packet");
  exact(v, [
    "schemaVersion",
    "kind",
    "packetId",
    "revisionId",
    "revision",
    "producer",
    "identity",
    "artifact",
    "strategicBet",
    "work",
    "materialTactics",
    "evidence",
    "unresolvedLimitations",
    "proposedNextAction",
    "actionProposal",
    "redaction",
    "reviewBoundary",
    "createdAt",
    "digest",
  ], "packet");
  ok(
    v.schemaVersion === REVIEW_CONTRACT_VERSION && v.kind === "review-packet",
    "packet schema/kind invalid",
  );
  id(v.packetId, "packetId");
  id(v.revisionId, "revisionId");
  ok(
    Number.isInteger(v.revision) && Number(v.revision) > 0,
    "packet revision invalid",
  );
  obj(v.producer, "producer");
  exact(v.producer, [
    "module",
    "sourceId",
    "capabilityId",
    "playbookId",
    "playbookVersion",
  ], "producer");
  ok(
    [
      "portable-plugin",
      "self-hosted-agent",
      "tool-module",
      "eval-lab",
      "release",
    ].includes(v.producer.module as string),
    "producer module invalid",
  );
  id(v.producer.sourceId, "sourceId");
  id(v.producer.capabilityId, "capabilityId");
  ok(
    (v.producer.playbookId === null) === (v.producer.playbookVersion === null),
    "playbook id/version pairing invalid",
  );
  if (v.producer.playbookId !== null) {
    id(v.producer.playbookId, "playbookId");
    ok(
      typeof v.producer.playbookVersion === "string" &&
        SEMVER.test(v.producer.playbookVersion),
      "playbookVersion invalid",
    );
  }
  obj(v.identity, "identity");
  exact(
    v.identity,
    ["sessionId", "runId", "candidateId", "evidenceId"],
    "identity",
  );
  id(v.identity.sessionId, "sessionId");
  id(v.identity.runId, "runId");
  nullableId(v.identity.candidateId, "candidateId");
  nullableId(v.identity.evidenceId, "evidenceId");
  validateArtifactBinding(v.artifact);
  text(v.strategicBet, "strategicBet");
  obj(v.work, "work");
  exact(v.work, ["state", "summary", "partialReason"], "work");
  ok(v.artifact.state === v.work.state, "artifact/work state mismatch");
  text(v.work.summary, "work summary");
  ok(
    v.work.state === "finished"
      ? v.work.partialReason === null
      : typeof v.work.partialReason === "string" &&
        v.work.partialReason.trim().length > 0,
    "ambiguous partial/cancel/failure state",
  );
  strings(v.materialTactics, "materialTactics");
  ok(Array.isArray(v.evidence), "evidence must be array");
  const ids: string[] = [];
  v.evidence.forEach((e, i) => {
    obj(e, `evidence[${i}]`);
    exact(e, ["id", "digest", "provenance"], `evidence[${i}]`);
    id(e.id, `evidence[${i}].id`);
    dg(e.digest, `evidence[${i}].digest`);
    text(e.provenance, `evidence[${i}].provenance`);
    ids.push(e.id);
  });
  ok(new Set(ids).size === ids.length, "evidence ids must be unique");
  strings(v.unresolvedLimitations, "unresolvedLimitations", true);
  text(v.proposedNextAction, "proposedNextAction");
  if (v.actionProposal !== null) {
    obj(v.actionProposal, "actionProposal");
    exact(v.actionProposal, [
      "authority",
      "operation",
      "connectionRef",
      "payload",
      "payloadDigest",
    ], "actionProposal");
    id(v.actionProposal.authority, "action authority");
    id(v.actionProposal.operation, "operation");
    id(v.actionProposal.connectionRef, "connectionRef");
    dg(v.actionProposal.payloadDigest, "payloadDigest");
    jsonData(v.actionProposal.payload, "action payload");
    ok(
      sha256(v.actionProposal.payload) === v.actionProposal.payloadDigest,
      "action payload digest mismatch",
    );
    noSecret(v.actionProposal.payload, "action payload");
  }
  obj(v.redaction, "redaction");
  exact(
    v.redaction,
    ["classification", "secretFields", "applied"],
    "redaction",
  );
  ok(
    ["public", "internal", "confidential", "secret"].includes(
      v.redaction.classification as string,
    ),
    "redaction class invalid",
  );
  strings(v.redaction.secretFields, "secretFields", true);
  ok(v.redaction.applied === true, "redaction required");
  obj(v.reviewBoundary, "reviewBoundary");
  exact(v.reviewBoundary, [
    "humanRequired",
    "modelCannotDecide",
    "oneFinalVerdict",
    "outcomes",
  ], "reviewBoundary");
  ok(
    v.reviewBoundary.humanRequired === true &&
      v.reviewBoundary.modelCannotDecide === true &&
      v.reviewBoundary.oneFinalVerdict === true,
    "human boundary invalid",
  );
  ok(
    JSON.stringify(v.reviewBoundary.outcomes) ===
      JSON.stringify(REVIEW_OUTCOMES),
    "terminal outcomes invalid",
  );
  utc(v.createdAt, "createdAt");
  noSecret(v, "packet");
  bodyDigest(v as ReviewPacketV1);
}
export function verdictSubjectDigest(
  packet: ReviewPacketV1,
  verdict: Pick<
    ReviewVerdictV1,
    "verdictId" | "outcome" | "decidedAt" | "expiryPolicy" | "expiresAt"
  >,
): Sha256 {
  return sha256({
    transition: "review-verdict",
    verdictId: verdict.verdictId,
    outcome: verdict.outcome,
    packetId: packet.packetId,
    revisionId: packet.revisionId,
    revision: packet.revision,
    packetDigest: packet.digest,
    artifact: packet.artifact,
    actionPayloadDigest: packet.actionProposal?.payloadDigest ?? null,
    identity: packet.identity,
    decidedAt: verdict.decidedAt,
    expiryPolicy: verdict.expiryPolicy,
    expiresAt: verdict.expiresAt,
  });
}
export function authorizationSubjectDigest(
  authorization: Pick<
    ActionAuthorizationV1,
    | "authorizationId"
    | "verdictId"
    | "verdictDigest"
    | "packetId"
    | "packetDigest"
    | "sessionId"
    | "runId"
    | "candidateId"
    | "artifact"
    | "allowed"
    | "authorizedAt"
    | "expiresAt"
  >,
): Sha256 {
  return sha256({
    transition: "action-authorization",
    authorizationId: authorization.authorizationId,
    verdictId: authorization.verdictId,
    verdictDigest: authorization.verdictDigest,
    packetId: authorization.packetId,
    packetDigest: authorization.packetDigest,
    sessionId: authorization.sessionId,
    runId: authorization.runId,
    candidateId: authorization.candidateId,
    artifact: authorization.artifact,
    allowed: authorization.allowed,
    authorizedAt: authorization.authorizedAt,
    expiresAt: authorization.expiresAt,
  });
}
export function validateVerdict(
  v: unknown,
  p: ReviewPacketV1,
  c: ValidationContext,
): asserts v is ReviewVerdictV1 {
  validateReviewPacket(p);
  obj(v, "verdict");
  exact(v, [
    "schemaVersion",
    "kind",
    "verdictId",
    "outcome",
    "packetId",
    "packetDigest",
    "artifactId",
    "artifactRevision",
    "artifactDigest",
    "actionPayloadDigest",
    "sessionId",
    "runId",
    "candidateId",
    "evidenceId",
    "authentication",
    "decidedAt",
    "expiryPolicy",
    "expiresAt",
    "singleUse",
    "digest",
  ], "verdict");
  ok(
    v.schemaVersion === REVIEW_CONTRACT_VERSION && v.kind === "review-verdict",
    "verdict schema/kind invalid",
  );
  id(v.verdictId, "verdictId");
  ok(
    REVIEW_OUTCOMES.includes(v.outcome as ReviewOutcome),
    "verdict outcome invalid",
  );
  ok(
    v.packetId === p.packetId && v.packetDigest === p.digest,
    "verdict packet mismatch",
  );
  ok(
    v.artifactId === p.artifact.artifactId &&
      v.artifactRevision === p.artifact.revision &&
      v.artifactDigest === p.artifact.digest,
    "verdict artifact mismatch",
  );
  ok(
    v.actionPayloadDigest === (p.actionProposal?.payloadDigest ?? null),
    "verdict action mismatch",
  );
  ok(
    v.sessionId === p.identity.sessionId && v.runId === p.identity.runId &&
      v.candidateId === p.identity.candidateId &&
      v.evidenceId === p.identity.evidenceId,
    "verdict identity mismatch",
  );
  auth(v.authentication);
  const subjectDigest = verdictSubjectDigest(p, v as ReviewVerdictV1);
  ok(
    v.authentication.subjectDigest === subjectDigest,
    "verdict authentication subject mismatch",
  );
  const role = c.expectedRole ?? "reviewer";
  ok(
    v.authentication.role === role &&
      v.authentication.authority === "content-review",
    "wrong actor role or authority",
  );
  utc(c.now, "now");
  utc(v.decidedAt, "decidedAt");
  ok(v.expiryPolicy === "expires", "invalid expiry policy");
  utc(v.expiresAt, "expiresAt");
  ok(
    Date.parse(p.createdAt) <= Date.parse(v.decidedAt) &&
      Date.parse(v.decidedAt) <= Date.parse(c.now) &&
      Date.parse(v.decidedAt) <= Date.parse(v.expiresAt) &&
      Date.parse(c.now) <= Date.parse(v.expiresAt),
    "verdict chronology invalid",
  );
  ok(
    Date.parse(v.authentication.verifiedAt) <= Date.parse(v.decidedAt),
    "authentication chronology invalid",
  );
  ok(
    c.verifyAuthentication(v.authentication, {
      authority: "content-review",
      role,
      now: c.now,
      subjectDigest,
    }),
    "host authentication verification failed",
  );
  ok(v.singleUse === true, "verdict single use required");
  noSecret(v, "verdict");
  bodyDigest(v as ReviewVerdictV1);
}
export type QualifiedReviewVerdictV1 = {
  schemaVersion: typeof REVIEW_CONTRACT_VERSION;
  verdictId: string;
  verdictDigest: Sha256;
  packetId: string;
  packetDigest: Sha256;
  artifactDigest: Sha256;
  reviewerPrincipalId: string;
  reviewerAuthSubjectDigest: Sha256;
  candidateId: string | null;
  evidenceId: string | null;
  outcome: ReviewOutcome;
  decidedAt: string;
  expiresAt: string;
  unresolvedLimitations: string[];
};
export function qualifyReviewVerdict(
  v: unknown,
  p: unknown,
  c: ValidationContext,
): QualifiedReviewVerdictV1 {
  validateVerdict(v as ReviewVerdictV1, p as ReviewPacketV1, c);
  const verdict = v as ReviewVerdictV1,
    packet = p as ReviewPacketV1;
  return deepFreeze({
    schemaVersion: REVIEW_CONTRACT_VERSION,
    verdictId: verdict.verdictId,
    verdictDigest: verdict.digest,
    packetId: packet.packetId,
    packetDigest: packet.digest,
    artifactDigest: packet.artifact.digest,
    reviewerPrincipalId: verdict.authentication.principalId,
    reviewerAuthSubjectDigest: verdict.authentication.subjectDigest,
    candidateId: packet.identity.candidateId,
    evidenceId: packet.identity.evidenceId,
    outcome: verdict.outcome,
    decidedAt: verdict.decidedAt,
    expiresAt: verdict.expiresAt,
    unresolvedLimitations: [...packet.unresolvedLimitations],
  });
}
export function validateActionAuthorization(
  a: unknown,
  p: ReviewPacketV1,
  v: ReviewVerdictV1,
  c: ValidationContext,
): asserts a is ActionAuthorizationV1 {
  validateVerdict(v, p, c);
  ok(v.outcome === "accept", "content not accepted");
  ok(p.actionProposal !== null, "no action proposal");
  obj(a, "authorization");
  exact(a, [
    "schemaVersion",
    "kind",
    "authorizationId",
    "verdictId",
    "verdictDigest",
    "packetId",
    "packetDigest",
    "sessionId",
    "runId",
    "candidateId",
    "artifact",
    "allowed",
    "authentication",
    "authorizedAt",
    "expiresAt",
    "singleUse",
    "digest",
  ], "authorization");
  ok(
    a.schemaVersion === REVIEW_CONTRACT_VERSION &&
      a.kind === "action-authorization",
    "authorization schema/kind invalid",
  );
  id(a.authorizationId, "authorizationId");
  ok(
    a.verdictId === v.verdictId && a.verdictDigest === v.digest &&
      a.packetId === p.packetId && a.packetDigest === p.digest,
    "authorization review mismatch",
  );
  ok(
    a.sessionId === p.identity.sessionId && a.runId === p.identity.runId &&
      a.candidateId === p.identity.candidateId,
    "authorization identity mismatch",
  );
  validateArtifactBinding(a.artifact);
  ok(
    JSON.stringify(a.artifact) === JSON.stringify(p.artifact),
    "authorization artifact mismatch",
  );
  obj(a.allowed, "allowed");
  exact(
    a.allowed,
    ["authority", "operation", "connectionRef", "payloadDigest"],
    "allowed",
  );
  id(a.allowed.authority, "allowed authority");
  id(a.allowed.operation, "allowed operation");
  id(a.allowed.connectionRef, "allowed connection");
  dg(a.allowed.payloadDigest, "allowed payload");
  ok(
    a.allowed.authority === p.actionProposal.authority &&
      a.allowed.operation === p.actionProposal.operation &&
      a.allowed.connectionRef === p.actionProposal.connectionRef &&
      a.allowed.payloadDigest === p.actionProposal.payloadDigest,
    "allowed action mismatch",
  );
  auth(a.authentication);
  const subjectDigest = authorizationSubjectDigest(a as ActionAuthorizationV1);
  ok(
    a.authentication.subjectDigest === subjectDigest,
    "authorization authentication subject mismatch",
  );
  ok(
    a.authentication.role === "operator" &&
      a.authentication.authority === "consequential-action",
    "action authentication invalid",
  );
  utc(a.authorizedAt, "authorizedAt");
  utc(a.expiresAt, "expiresAt");
  ok(
    Date.parse(v.decidedAt) <= Date.parse(a.authorizedAt) &&
      Date.parse(a.authorizedAt) <= Date.parse(c.now) &&
      Date.parse(a.authorizedAt) < Date.parse(a.expiresAt) &&
      Date.parse(a.expiresAt) <= Date.parse(v.expiresAt),
    "authorization chronology invalid",
  );
  ok(
    Date.parse(a.authentication.verifiedAt) <= Date.parse(a.authorizedAt),
    "authentication chronology invalid",
  );
  ok(
    c.verifyAuthentication(a.authentication, {
      authority: "consequential-action",
      role: "operator",
      now: c.now,
      subjectDigest,
    }),
    "host authentication verification failed",
  );
  ok(a.singleUse === true, "authorization single use required");
  noSecret(a, "authorization");
  bodyDigest(a as ActionAuthorizationV1);
}
export function validateReceipt(
  r: unknown,
  a: ActionAuthorizationV1,
): asserts r is ActionReceiptV1 {
  obj(r, "receipt");
  exact(r, [
    "schemaVersion",
    "kind",
    "receiptId",
    "authorizationId",
    "authorizationDigest",
    "sessionId",
    "runId",
    "candidateId",
    "artifact",
    "authority",
    "operation",
    "connectionRef",
    "payloadDigest",
    "status",
    "startedAt",
    "finishedAt",
    "redactionApplied",
    "terminal",
    "digest",
  ], "receipt");
  ok(
    r.schemaVersion === REVIEW_CONTRACT_VERSION && r.kind === "action-receipt",
    "receipt schema/kind invalid",
  );
  id(r.receiptId, "receiptId");
  ok(
    r.authorizationId === a.authorizationId &&
      r.authorizationDigest === a.digest,
    "receipt authorization mismatch",
  );
  ok(
    r.sessionId === a.sessionId && r.runId === a.runId &&
      r.candidateId === a.candidateId,
    "receipt identity mismatch",
  );
  validateArtifactBinding(r.artifact);
  ok(
    JSON.stringify(r.artifact) === JSON.stringify(a.artifact),
    "receipt artifact mismatch",
  );
  id(r.authority, "receipt authority");
  id(r.operation, "receipt operation");
  id(r.connectionRef, "receipt connection");
  dg(r.payloadDigest, "receipt payload");
  ok(
    r.authority === a.allowed.authority &&
      r.operation === a.allowed.operation &&
      r.connectionRef === a.allowed.connectionRef &&
      r.payloadDigest === a.allowed.payloadDigest,
    "receipt action mismatch",
  );
  ok(
    ["succeeded", "failed", "cancelled"].includes(r.status as string),
    "receipt status invalid",
  );
  utc(r.startedAt, "startedAt");
  utc(r.finishedAt, "finishedAt");
  ok(
    Date.parse(a.authorizedAt) <= Date.parse(r.startedAt) &&
      Date.parse(r.startedAt) <= Date.parse(a.expiresAt) &&
      Date.parse(r.finishedAt) >= Date.parse(r.startedAt),
    "receipt chronology invalid",
  );
  ok(
    r.redactionApplied === true && r.terminal === true,
    "terminal redacted receipt required",
  );
  noSecret(r, "receipt");
  bodyDigest(r as ActionReceiptV1);
}
export function validateObservation(
  o: unknown,
  r: ActionReceiptV1,
): asserts o is ResultObservationV1 {
  obj(o, "observation");
  exact(o, [
    "schemaVersion",
    "kind",
    "observationId",
    "receiptId",
    "receiptDigest",
    "status",
    "measures",
    "observedAt",
    "digest",
  ], "observation");
  ok(
    o.schemaVersion === REVIEW_CONTRACT_VERSION &&
      o.kind === "result-observation",
    "observation schema/kind invalid",
  );
  id(o.observationId, "observationId");
  ok(
    o.receiptId === r.receiptId && o.receiptDigest === r.digest,
    "observation receipt mismatch",
  );
  ok(
    o.status === "unknown" || o.status === "known",
    "observation status invalid",
  );
  if (o.status === "unknown") {
    ok(o.measures === null, "unknown measures must be null");
  } else {
    ok(r.status === "succeeded", "fabricated observation");
    obj(o.measures, "measures");
    ok(Object.keys(o.measures).length > 0, "known measures required");
    jsonData(o.measures, "measures");
    noSecret(o.measures, "measures");
  }
  utc(o.observedAt, "observedAt");
  ok(
    Date.parse(o.observedAt) >= Date.parse(r.finishedAt),
    "observation chronology invalid",
  );
  bodyDigest(o as ResultObservationV1);
}
export function validateLearning(
  l: unknown,
  o: ResultObservationV1,
): asserts l is LearningRecordV1 {
  obj(l, "learning");
  exact(l, [
    "schemaVersion",
    "kind",
    "learningId",
    "observationId",
    "observationDigest",
    "status",
    "claim",
    "createdAt",
    "digest",
  ], "learning");
  ok(
    l.schemaVersion === REVIEW_CONTRACT_VERSION && l.kind === "learning-record",
    "learning schema/kind invalid",
  );
  id(l.learningId, "learningId");
  ok(
    l.observationId === o.observationId && l.observationDigest === o.digest,
    "learning observation mismatch",
  );
  ok(
    l.status === (o.status === "unknown" ? "unknown" : "recorded"),
    "learning before result",
  );
  if (l.status === "unknown") {
    ok(l.claim === null, "unknown claim must be null");
  } else text(l.claim, "learning claim");
  utc(l.createdAt, "createdAt");
  ok(
    Date.parse(l.createdAt) >= Date.parse(o.observedAt),
    "learning chronology invalid",
  );
  noSecret(l, "learning");
  bodyDigest(l as LearningRecordV1);
}
export type ReviewTransitionSnapshot = {
  schemaVersion: "conquistador.review-transition-state/v1";
  consumedPackets: Array<{ packetKey: Sha256; verdict: ReviewVerdictV1 }>;
  issuedAuthorizations: ActionAuthorizationV1[];
  consumedAuthorizations: Array<{
    authorizationKey: Sha256;
    receipt: ActionReceiptV1;
  }>;
  digest: Sha256;
};
export function packetTransitionKey(packet: ReviewPacketV1): Sha256 {
  return sha256({
    packetId: packet.packetId,
    revisionId: packet.revisionId,
    revision: packet.revision,
    packetDigest: packet.digest,
  });
}
export function validateTransitionSnapshot(
  value: unknown,
): asserts value is ReviewTransitionSnapshot {
  obj(value, "transition snapshot");
  exact(
    value,
    [
      "schemaVersion",
      "consumedPackets",
      "issuedAuthorizations",
      "consumedAuthorizations",
      "digest",
    ],
    "transition snapshot",
  );
  ok(
    value.schemaVersion === "conquistador.review-transition-state/v1",
    "transition snapshot schema invalid",
  );
  ok(Array.isArray(value.consumedPackets), "consumedPackets must be an array");
  ok(
    Array.isArray(value.issuedAuthorizations),
    "issuedAuthorizations must be an array",
  );
  ok(
    Array.isArray(value.consumedAuthorizations),
    "consumedAuthorizations must be an array",
  );
  for (const entry of value.consumedPackets) {
    obj(entry, "consumed packet");
    exact(entry, ["packetKey", "verdict"], "consumed packet");
    dg(entry.packetKey, "packetKey");
    obj(entry.verdict, "consumed verdict");
    exact(entry.verdict, [
      "schemaVersion",
      "kind",
      "verdictId",
      "outcome",
      "packetId",
      "packetDigest",
      "artifactId",
      "artifactRevision",
      "artifactDigest",
      "actionPayloadDigest",
      "sessionId",
      "runId",
      "candidateId",
      "evidenceId",
      "authentication",
      "decidedAt",
      "expiryPolicy",
      "expiresAt",
      "singleUse",
      "digest",
    ], "consumed verdict");
    ok(
      entry.verdict.schemaVersion === REVIEW_CONTRACT_VERSION &&
        entry.verdict.kind === "review-verdict" &&
        REVIEW_OUTCOMES.includes(entry.verdict.outcome as ReviewOutcome),
      "consumed verdict schema/kind/outcome invalid",
    );
    id(entry.verdict.verdictId, "consumed verdictId");
    id(entry.verdict.packetId, "consumed packetId");
    dg(entry.verdict.packetDigest, "consumed packetDigest");
    id(entry.verdict.artifactId, "consumed artifactId");
    ok(
      Number.isInteger(entry.verdict.artifactRevision) &&
        Number(entry.verdict.artifactRevision) > 0,
      "consumed artifact revision invalid",
    );
    dg(entry.verdict.artifactDigest, "consumed artifactDigest");
    if (entry.verdict.actionPayloadDigest !== null) {
      dg(entry.verdict.actionPayloadDigest, "consumed action payload");
    }
    id(entry.verdict.sessionId, "consumed sessionId");
    id(entry.verdict.runId, "consumed runId");
    nullableId(entry.verdict.candidateId, "consumed candidateId");
    nullableId(entry.verdict.evidenceId, "consumed evidenceId");
    auth(entry.verdict.authentication);
    utc(entry.verdict.decidedAt, "consumed decidedAt");
    ok(
      entry.verdict.expiryPolicy === "expires",
      "consumed expiry policy invalid",
    );
    utc(entry.verdict.expiresAt, "consumed expiresAt");
    ok(entry.verdict.singleUse === true, "consumed verdict must be single-use");
    bodyDigest(entry.verdict as ReviewVerdictV1);
  }
  for (const entry of value.consumedAuthorizations) {
    obj(entry, "consumed authorization");
    exact(
      entry,
      ["authorizationKey", "receipt"],
      "consumed authorization",
    );
    dg(entry.authorizationKey, "authorizationKey");
    obj(entry.receipt, "consumed receipt");
    bodyDigest(entry.receipt as ActionReceiptV1);
  }
  for (const authorization of value.issuedAuthorizations) {
    obj(authorization, "issued authorization");
    exact(authorization, [
      "schemaVersion",
      "kind",
      "authorizationId",
      "verdictId",
      "verdictDigest",
      "packetId",
      "packetDigest",
      "sessionId",
      "runId",
      "candidateId",
      "artifact",
      "allowed",
      "authentication",
      "authorizedAt",
      "expiresAt",
      "singleUse",
      "digest",
    ], "issued authorization");
    ok(
      authorization.schemaVersion === REVIEW_CONTRACT_VERSION &&
        authorization.kind === "action-authorization",
      "issued authorization schema/kind invalid",
    );
    id(authorization.authorizationId, "issued authorizationId");
    id(authorization.verdictId, "issued verdictId");
    dg(authorization.verdictDigest, "issued verdictDigest");
    id(authorization.packetId, "issued packetId");
    dg(authorization.packetDigest, "issued packetDigest");
    id(authorization.sessionId, "issued sessionId");
    id(authorization.runId, "issued runId");
    nullableId(authorization.candidateId, "issued candidateId");
    validateArtifactBinding(authorization.artifact);
    obj(authorization.allowed, "issued allowed");
    exact(
      authorization.allowed,
      ["authority", "operation", "connectionRef", "payloadDigest"],
      "issued allowed",
    );
    id(authorization.allowed.authority, "issued authority");
    id(authorization.allowed.operation, "issued operation");
    id(authorization.allowed.connectionRef, "issued connection");
    dg(authorization.allowed.payloadDigest, "issued payload digest");
    auth(authorization.authentication);
    utc(authorization.authorizedAt, "issued authorizedAt");
    utc(authorization.expiresAt, "issued expiresAt");
    ok(
      authorization.singleUse === true,
      "issued authorization must be single-use",
    );
    bodyDigest(authorization as ActionAuthorizationV1);
  }
  const packetKeys = value.consumedPackets.map((entry) => entry.packetKey);
  const authorizationKeys = value.consumedAuthorizations.map((entry) =>
    entry.authorizationKey
  );
  const issuedKeys = value.issuedAuthorizations.map((entry) => entry.digest);
  ok(
    new Set(packetKeys).size === packetKeys.length,
    "packet consumption duplicate",
  );
  ok(
    new Set(authorizationKeys).size === authorizationKeys.length,
    "authorization consumption duplicate",
  );
  ok(
    new Set(issuedKeys).size === issuedKeys.length,
    "issued authorization duplicate",
  );
  ok(
    authorizationKeys.every((key) => issuedKeys.includes(key)),
    "receipt consumption lacks issued authorization",
  );
  bodyDigest(value as ReviewTransitionSnapshot);
}
export class ReviewTransitionState {
  #packets = new Map<Sha256, ReviewVerdictV1>();
  #issuedAuthorizations = new Map<Sha256, ActionAuthorizationV1>();
  #authorizations = new Map<Sha256, ActionReceiptV1>();
  constructor(snapshot?: ReviewTransitionSnapshot) {
    if (!snapshot) return;
    validateTransitionSnapshot(snapshot);
    snapshot.consumedPackets.forEach((entry) =>
      this.#packets.set(entry.packetKey, entry.verdict)
    );
    snapshot.issuedAuthorizations.forEach((entry) =>
      this.#issuedAuthorizations.set(entry.digest, entry)
    );
    snapshot.consumedAuthorizations.forEach((entry) =>
      this.#authorizations.set(entry.authorizationKey, entry.receipt)
    );
  }
  consumeVerdict(p: ReviewPacketV1, v: ReviewVerdictV1, c: ValidationContext) {
    validateVerdict(v, p, c);
    const key = packetTransitionKey(p);
    if (this.#packets.has(key)) fail("packet verdict already consumed");
    this.#packets.set(key, deepFreeze(structuredClone(v)));
    return v;
  }
  authorize(
    a: unknown,
    p: ReviewPacketV1,
    v: ReviewVerdictV1,
    c: ValidationContext,
  ) {
    validateActionAuthorization(a, p, v, c);
    const key = packetTransitionKey(p);
    if (this.#packets.has(key)) fail("packet verdict already consumed");
    this.#packets.set(key, deepFreeze(structuredClone(v)));
    this.#issuedAuthorizations.set(
      (a as ActionAuthorizationV1).digest,
      deepFreeze(structuredClone(a as ActionAuthorizationV1)),
    );
    return a;
  }
  authorizeAccepted(
    a: unknown,
    p: ReviewPacketV1,
    c: ValidationContext,
  ) {
    const verdict = this.consumedVerdict(p);
    validateActionAuthorization(a, p, verdict, c);
    if ([...this.#issuedAuthorizations.values()].some((issued) => issued.packetDigest === p.digest)) {
      fail("accepted packet already has an authorization");
    }
    this.#issuedAuthorizations.set(a.digest, deepFreeze(structuredClone(a)));
    return a;
  }
  issuedAuthorization(digest: Sha256): ActionAuthorizationV1 {
    const authorization = this.#issuedAuthorizations.get(digest);
    if (!authorization) fail("authorization was not issued");
    return authorization;
  }
  consumedVerdict(packet: ReviewPacketV1): ReviewVerdictV1 {
    const verdict = this.#packets.get(packetTransitionKey(packet));
    if (!verdict) fail("packet verdict was not consumed");
    return verdict;
  }
  verdictFor(packet: ReviewPacketV1): ReviewVerdictV1 | undefined {
    return this.#packets.get(packetTransitionKey(packet));
  }
  authorizationWasIssued(authorization: ActionAuthorizationV1): boolean {
    return this.#issuedAuthorizations.get(authorization.digest)?.digest ===
      authorization.digest;
  }
  authorizationWasConsumed(authorization: ActionAuthorizationV1): boolean {
    return this.#authorizations.has(authorization.digest);
  }
  consumedReceipt(authorizationDigest: Sha256): ActionReceiptV1 | undefined {
    return this.#authorizations.get(authorizationDigest);
  }
  recordReceipt(r: unknown, a: ActionAuthorizationV1) {
    validateReceipt(r, a);
    const key = a.digest;
    if (!this.#issuedAuthorizations.has(key)) {
      fail("authorization was not issued");
    }
    if (this.#authorizations.has(key)) {
      fail("authorization already consumed");
    }
    this.#authorizations.set(
      key,
      deepFreeze(structuredClone(r as ActionReceiptV1)),
    );
    return r;
  }
  snapshot(): ReviewTransitionSnapshot {
    const body = {
      schemaVersion: "conquistador.review-transition-state/v1" as const,
      consumedPackets: [...this.#packets.entries()].sort().map(
        ([key, verdict]) => ({ packetKey: key, verdict }),
      ),
      issuedAuthorizations: [...this.#issuedAuthorizations.values()].sort((
        a,
        b,
      ) => a.digest.localeCompare(b.digest)),
      consumedAuthorizations: [...this.#authorizations.entries()].sort().map(
        ([authorizationKey, receipt]) => ({
          authorizationKey,
          receipt,
        }),
      ),
    };
    const snapshot = deepFreeze({ ...body, digest: sha256(body) });
    validateTransitionSnapshot(snapshot);
    return snapshot;
  }
}
export function renderReviewPacketText(p: ReviewPacketV1) {
  validateReviewPacket(p);
  return [
    `# Review Packet ${p.packetId}`,
    `Revision: ${p.revisionId} (${p.revision})`,
    `Producer: ${p.producer.module} / ${p.producer.sourceId}`,
    `State: ${p.work.state}`,
    `Strategic bet: ${p.strategicBet}`,
    `Finished work: ${p.work.summary}`,
    "Material tactics:",
    ...p.materialTactics.map((x) => `- ${x}`),
    "Unresolved limitations:",
    ...(p.unresolvedLimitations.length
      ? p.unresolvedLimitations
      : ["None declared."]).map((x) => `- ${x}`),
    `Proposed next action: ${p.proposedNextAction}`,
    "Human verdict: pending (accept / revise / reject / cancel)",
    "Action authority: separate; no action is authorized by this packet.",
  ].join("\n") + "\n";
}
