import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { sha256, type Sha256 } from "./canonical.ts";
import { validatePlaybookReviewPacket } from "./gates.ts";
import {
  type ReviewPacketV1,
  ReviewTransitionState,
  validateReviewPacket,
} from "./review-contract.ts";

export const ARTIFACT_STATUSES = ["draft", "reviewed", "approved", "acted", "observed"] as const;
export const RELATIONSHIP_KINDS = ["input-of", "decision-for", "action-from", "result-of"] as const;

export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];
export type ArtifactRelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export type ArtifactRelationship = {
  kind: ArtifactRelationshipKind;
  artifactId: string;
};

export type ArtifactSourceContext = {
  parentArtifactIds: string[];
};

export type ArtifactProvenance = {
  playbookId: string;
  playbookVersion: string;
  runId: string;
  stepId: string;
  skillId?: string;
  skillVersion?: string;
  skillPackageDigest?: Sha256;
  skillInterfaceDigest?: Sha256;
  scriptId?: string;
  toolOperationId?: string;
  sourceContext: ArtifactSourceContext;
};

export type ArtifactRevisionEntry = {
  n: number;
  contentDigest: Sha256;
  producedAt: string;
  source: "run" | "human-edit";
};

export type ArtifactRevision = {
  n: number;
  previousContentDigest: Sha256 | null;
  contentDigest: Sha256;
  chain: ArtifactRevisionEntry[];
};

export type ToolReceiptRef = {
  receiptId: string;
  path: string;
} & ({ executed: false } | { catalogReceiptDigest: Sha256; status: import("./operation-bridge.ts").OperationTerminalReceipt["status"] });

export type HumanEdit = {
  at: string;
  previousContentDigest: Sha256;
  nextContentDigest: Sha256;
  summary: string;
  source: "human";
};

export type ArtifactReviewVerdict = {
  packetId: string;
  packetDigest: Sha256;
  outcome: "accept" | "revise" | "reject" | "cancel";
  artifactId: string;
  artifactRevision: number;
  boundContentDigest: Sha256;
  decidedAt: string;
};

export type ArtifactApprovedAction = {
  gateId: string;
  boundPayloadDigest: Sha256;
  decidedAt: string;
  destination: ArtifactDestination;
};

export type ArtifactDestination = {
  channel: string | null;
  publicationId: string | null;
};

export type ObservationWindow = {
  declared: string;
  elapsed: boolean;
};

export type ArtifactResults =
  | { status: "unknown" }
  | { status: "known"; measures: Record<string, unknown> };

export type ArtifactEnvelope = {
  schemaVersion: "conquistador.artifact-envelope/v1";
  id: string;
  identity: {
    artifactId: string;
    schema: string;
    format: "markdown" | "json";
  };
  provenance: ArtifactProvenance;
  revision: ArtifactRevision;
  status: ArtifactStatus;
  relationships: ArtifactRelationship[];
  toolReceipts: ToolReceiptRef[];
  humanEdits: HumanEdit[];
  reviewVerdict: ArtifactReviewVerdict | null;
  approvedAction: ArtifactApprovedAction | null;
  destination: ArtifactDestination | null;
  observationWindow: ObservationWindow | null;
  results: ArtifactResults;
  contentDigest: Sha256;
};

export type AttributionContext = {
  runId: string;
  playbookId: string;
  playbookVersion: string;
  produced: Array<{ artifactId: string; stepId: string }>;
  steps: Array<{
    id: string;
    skillId?: string;
    skillVersion?: string;
    skillPackageDigest?: Sha256;
    skillInterfaceDigest?: Sha256;
    scriptId?: string;
    toolOperationId?: string;
  }>;
};

export type PriorConsumption = {
  path: string;
  artifactId: string;
  contentDigest: Sha256;
  envelope?: ArtifactEnvelope;
  reviewedAs: "approved" | "unreviewed";
  verdict?: "accept" | "revise" | "reject" | "cancel";
  reason: "approved" | "missing-verdict" | "unapproved" | "revised-after-approval" | "stale-approval" | "missing-envelope";
};

const PREFIX = "conquistador.artifacts";
const SHA = /^sha256:[a-f0-9]{64}$/;
const ARTIFACT_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[${PREFIX}] ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: object, allowed: string[], label: string): void {
  const keys = Object.keys(value);
  invariant(keys.every((key) => allowed.includes(key)), `${label} contains an undeclared field`);
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required`);
}

function exactUtc(value: unknown, label: string): asserts value is string {
  invariant(
    typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
    `${label} must be an exact UTC ISO timestamp`,
  );
}

function digest(value: unknown, label: string): asserts value is Sha256 {
  invariant(typeof value === "string" && SHA.test(value), `${label} must be a sha256 digest`);
}

function stringArray(value: unknown, label: string): asserts value is string[] {
  invariant(Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0), `${label} must be a non-empty-string array`);
}

export function splitMarkdown(raw: string): { frontMatter: Record<string, unknown>; body: string } {
  if (!raw.startsWith("---\n")) return { frontMatter: {}, body: raw };
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return { frontMatter: {}, body: raw };
  const yaml = raw.slice(4, end);
  const remainder = raw.slice(end + 5);
  const body = remainder.replace(/^\n/, "").replace(/\n$/, "");
  const frontMatter: Record<string, unknown> = {};
  for (const line of yaml.split("\n")) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    if (!key) continue;
    try {
      frontMatter[key] = JSON.parse(rawValue) as unknown;
    } catch {
      frontMatter[key] = rawValue;
    }
  }
  return { frontMatter, body };
}

export function markdownContentDigest(raw: string): Sha256 {
  return sha256(splitMarkdown(raw).body);
}

export function jsonContentDigest(raw: string): Sha256 {
  const parsed = JSON.parse(raw) as { body?: unknown };
  return sha256(parsed.body ?? parsed);
}

export function readArtifactContentDigest(path: string, format: "markdown" | "json"): Sha256 {
  const raw = readFileSync(path, "utf8");
  return format === "json" ? jsonContentDigest(raw) : markdownContentDigest(raw);
}

export function artifactSidecarPath(artifactFile: string): string {
  return artifactFile.replace(/\.(md|json)$/i, ".meta.json");
}

export function contentDigestOf(body: unknown): Sha256 {
  return sha256(body);
}

function validateSourceContext(value: unknown, label: string): asserts value is ArtifactSourceContext {
  invariant(isObject(value), `${label} is required`);
  exactKeys(value, ["parentArtifactIds"], label);
  stringArray(value.parentArtifactIds, `${label}.parentArtifactIds`);
}

function validateProvenance(value: unknown): asserts value is ArtifactProvenance {
  invariant(isObject(value), "provenance is required");
  exactKeys(
    value,
    ["playbookId", "playbookVersion", "runId", "stepId", "skillId", "skillVersion", "skillPackageDigest", "skillInterfaceDigest", "scriptId", "toolOperationId", "sourceContext"],
    "provenance",
  );
  nonEmpty(value.playbookId, "provenance.playbookId");
  invariant(typeof value.playbookVersion === "string" && SEMVER.test(value.playbookVersion), "provenance.playbookVersion must be exact semver");
  nonEmpty(value.runId, "provenance.runId");
  nonEmpty(value.stepId, "provenance.stepId");
  if (value.skillId !== undefined) nonEmpty(value.skillId, "provenance.skillId");
  if (value.skillVersion !== undefined) {
    invariant(typeof value.skillVersion === "string" && SEMVER.test(value.skillVersion), "provenance.skillVersion must be exact semver");
  }
  if (value.skillPackageDigest !== undefined) digest(value.skillPackageDigest, "provenance.skillPackageDigest");
  if (value.skillInterfaceDigest !== undefined) digest(value.skillInterfaceDigest, "provenance.skillInterfaceDigest");
  if (value.scriptId !== undefined) nonEmpty(value.scriptId, "provenance.scriptId");
  if (value.toolOperationId !== undefined) nonEmpty(value.toolOperationId, "provenance.toolOperationId");
  validateSourceContext(value.sourceContext, "provenance.sourceContext");
}

function validateRevision(value: unknown): asserts value is ArtifactRevision {
  invariant(isObject(value), "revision is required");
  exactKeys(value, ["n", "previousContentDigest", "contentDigest", "chain"], "revision");
  invariant(Number.isInteger(value.n) && Number(value.n) >= 1, "revision.n must be a positive integer");
  if (value.previousContentDigest !== null) digest(value.previousContentDigest, "revision.previousContentDigest");
  digest(value.contentDigest, "revision.contentDigest");
  invariant(Array.isArray(value.chain) && value.chain.length >= 1, "revision.chain is required");
  for (const [index, entry] of value.chain.entries()) {
    invariant(isObject(entry), `revision.chain[${index}] must be an object`);
    exactKeys(entry, ["n", "contentDigest", "producedAt", "source"], `revision.chain[${index}]`);
    invariant(Number.isInteger(entry.n) && Number(entry.n) >= 1, `revision.chain[${index}].n must be a positive integer`);
    digest(entry.contentDigest, `revision.chain[${index}].contentDigest`);
    exactUtc(entry.producedAt, `revision.chain[${index}].producedAt`);
    invariant(entry.source === "run" || entry.source === "human-edit", `revision.chain[${index}].source is invalid`);
  }
}

function validateRelationships(value: unknown): asserts value is ArtifactRelationship[] {
  invariant(Array.isArray(value), "relationships must be an array");
  for (const [index, entry] of value.entries()) {
    invariant(isObject(entry), `relationships[${index}] must be an object`);
    exactKeys(entry, ["kind", "artifactId"], `relationships[${index}]`);
    invariant(typeof entry.kind === "string" && (RELATIONSHIP_KINDS as readonly string[]).includes(entry.kind), `relationships[${index}].kind is invalid`);
    invariant(typeof entry.artifactId === "string" && ARTIFACT_ID.test(entry.artifactId), `relationships[${index}].artifactId is invalid`);
  }
}

function validateToolReceipts(value: unknown): asserts value is ToolReceiptRef[] {
  invariant(Array.isArray(value), "toolReceipts must be an array");
  for (const [index, entry] of value.entries()) {
    invariant(isObject(entry), `toolReceipts[${index}] must be an object`);
    exactKeys(entry, ["receiptId", "path", "executed", "catalogReceiptDigest", "status"], `toolReceipts[${index}]`);
    nonEmpty(entry.receiptId, `toolReceipts[${index}].receiptId`);
    nonEmpty(entry.path, `toolReceipts[${index}].path`);
    if (entry.catalogReceiptDigest !== undefined) {
      digest(entry.catalogReceiptDigest, "tool receipt catalog digest");
      invariant(entry.executed === undefined && ["succeeded", "partial", "failed", "pending", "unknown", "rejected", "expired", "blocked"].includes(entry.status as string), "invalid catalog receipt state");
    } else invariant(entry.executed === false && entry.status === undefined, `toolReceipts[${index}] cannot claim execution`);
  }
}

function validateHumanEdits(value: unknown): asserts value is HumanEdit[] {
  invariant(Array.isArray(value), "humanEdits must be an array");
  for (const [index, entry] of value.entries()) {
    invariant(isObject(entry), `humanEdits[${index}] must be an object`);
    exactKeys(entry, ["at", "previousContentDigest", "nextContentDigest", "summary", "source"], `humanEdits[${index}]`);
    exactUtc(entry.at, `humanEdits[${index}].at`);
    digest(entry.previousContentDigest, `humanEdits[${index}].previousContentDigest`);
    digest(entry.nextContentDigest, `humanEdits[${index}].nextContentDigest`);
    nonEmpty(entry.summary, `humanEdits[${index}].summary`);
    invariant(entry.source === "human", `humanEdits[${index}] must be a human edit; model deltas are forbidden`);
  }
}

function validateVerdict(value: unknown): asserts value is ArtifactReviewVerdict | null {
  if (value === null) return;
  invariant(isObject(value), "reviewVerdict must be an object or null");
  exactKeys(value, ["packetId", "packetDigest", "outcome", "artifactId", "artifactRevision", "boundContentDigest", "decidedAt"], "reviewVerdict");
  nonEmpty(value.packetId, "reviewVerdict.packetId");
  digest(value.packetDigest, "reviewVerdict.packetDigest");
  invariant(["accept", "revise", "reject", "cancel"].includes(value.outcome as string), "reviewVerdict.outcome is invalid");
  invariant(typeof value.artifactId === "string" && ARTIFACT_ID.test(value.artifactId), "reviewVerdict.artifactId is invalid");
  invariant(Number.isInteger(value.artifactRevision) && Number(value.artifactRevision) >= 1, "reviewVerdict.artifactRevision must be a positive integer");
  digest(value.boundContentDigest, "reviewVerdict.boundContentDigest");
  exactUtc(value.decidedAt, "reviewVerdict.decidedAt");
}

function validateApprovedAction(value: unknown): asserts value is ArtifactApprovedAction | null {
  if (value === null) return;
  invariant(isObject(value), "approvedAction must be an object or null");
  exactKeys(value, ["gateId", "boundPayloadDigest", "decidedAt", "destination"], "approvedAction");
  nonEmpty(value.gateId, "approvedAction.gateId");
  digest(value.boundPayloadDigest, "approvedAction.boundPayloadDigest");
  exactUtc(value.decidedAt, "approvedAction.decidedAt");
  validateDestination(value.destination, "approvedAction.destination");
}

function validateDestination(value: unknown, label: string): asserts value is ArtifactDestination {
  invariant(isObject(value), `${label} must be an object`);
  exactKeys(value, ["channel", "publicationId"], label);
  invariant(value.channel === null || (typeof value.channel === "string" && value.channel.trim().length > 0), `${label}.channel is invalid`);
  invariant(value.publicationId === null || (typeof value.publicationId === "string" && value.publicationId.trim().length > 0), `${label}.publicationId is invalid`);
}

function validateObservationWindow(value: unknown): asserts value is ObservationWindow | null {
  if (value === null) return;
  invariant(isObject(value), "observationWindow must be an object or null");
  exactKeys(value, ["declared", "elapsed"], "observationWindow");
  nonEmpty(value.declared, "observationWindow.declared");
  invariant(typeof value.elapsed === "boolean", "observationWindow.elapsed must be boolean");
}

function validateResults(value: unknown): asserts value is ArtifactResults {
  invariant(isObject(value), "results are required");
  if (value.status === "unknown") {
    exactKeys(value, ["status"], "results");
    return;
  }
  invariant(value.status === "known", "results.status must be known or unknown");
  exactKeys(value, ["status", "measures"], "results");
  invariant(isObject(value.measures), "results.measures must be an object");
}

export function validateArtifactEnvelope(value: unknown): asserts value is ArtifactEnvelope {
  invariant(isObject(value), "artifact envelope must be an object");
  exactKeys(
    value,
    [
      "schemaVersion",
      "id",
      "identity",
      "provenance",
      "revision",
      "status",
      "relationships",
      "toolReceipts",
      "humanEdits",
      "reviewVerdict",
      "approvedAction",
      "destination",
      "observationWindow",
      "results",
      "contentDigest",
    ],
    "artifact envelope",
  );
  invariant(value.schemaVersion === "conquistador.artifact-envelope/v1", "schemaVersion must be conquistador.artifact-envelope/v1");
  nonEmpty(value.id, "id");
  invariant(isObject(value.identity), "identity is required");
  exactKeys(value.identity, ["artifactId", "schema", "format"], "identity");
  invariant(typeof value.identity.artifactId === "string" && ARTIFACT_ID.test(value.identity.artifactId), "identity.artifactId is invalid");
  nonEmpty(value.identity.schema, "identity.schema");
  invariant(value.identity.format === "markdown" || value.identity.format === "json", "identity.format is invalid");
  validateProvenance(value.provenance);
  validateRevision(value.revision);
  invariant(typeof value.status === "string" && (ARTIFACT_STATUSES as readonly string[]).includes(value.status), "status is invalid");
  validateRelationships(value.relationships);
  validateToolReceipts(value.toolReceipts);
  validateHumanEdits(value.humanEdits);
  validateVerdict(value.reviewVerdict);
  validateApprovedAction(value.approvedAction);
  if (value.destination !== null) validateDestination(value.destination, "destination");
  validateObservationWindow(value.observationWindow);
  validateResults(value.results);
  digest(value.contentDigest, "contentDigest");
  invariant(value.revision.contentDigest === value.contentDigest, "revision content digest must match envelope contentDigest");
  invariant(value.results.status === "unknown" || value.results.status === "known", "missing results must stay unknown");
}

export function assertAttribution(envelope: ArtifactEnvelope, context: AttributionContext): void {
  validateArtifactEnvelope(envelope);
  invariant(envelope.provenance.runId === context.runId, "run id does not match the run context");
  invariant(envelope.provenance.playbookId === context.playbookId, "playbook id was not produced by this run");
  invariant(envelope.provenance.playbookVersion === context.playbookVersion, "playbook version was not produced by this run");
  const produced = context.produced.find((entry) => entry.artifactId === envelope.identity.artifactId);
  invariant(produced, `artifact ${envelope.identity.artifactId} is not in the run trace`);
  invariant(produced.stepId === envelope.provenance.stepId, "step id did not produce this artifact");
  const step = context.steps.find((entry) => entry.id === envelope.provenance.stepId);
  invariant(step, "producing step is not in the run context");
  if (envelope.provenance.skillId !== undefined) {
    invariant(step.skillId === envelope.provenance.skillId, "skill id was not used by the producing step");
  }
  if (envelope.provenance.scriptId !== undefined) {
    invariant(step.scriptId === envelope.provenance.scriptId, "script id was not used by the producing step");
  }
  if (envelope.provenance.toolOperationId !== undefined) {
    invariant(step.toolOperationId === envelope.provenance.toolOperationId, "tool operation was not used by the producing step");
  }
  if (envelope.provenance.skillVersion !== undefined) {
    invariant(
      typeof step.skillVersion === "string" && step.skillVersion === envelope.provenance.skillVersion,
      "skill version is not in the run context",
    );
  }
}

export function relationshipsFor(input: {
  artifactId: string;
  parents: string[];
  scriptId?: string;
  toolOperationId?: string;
}): ArtifactRelationship[] {
  const relations: ArtifactRelationship[] = input.parents.map((artifactId) => ({ kind: "input-of", artifactId }));
  if (input.scriptId === "select-hypothesis") {
    relations.push({ kind: "decision-for", artifactId: "created-artifact" });
  }
  if (input.toolOperationId === "distribution.create-draft") {
    relations.push({ kind: "action-from", artifactId: "created-artifact" });
  }
  if (input.toolOperationId === "performance.observe-window") {
    relations.push({ kind: "result-of", artifactId: "action-receipt" });
  }
  const seen = new Set<string>();
  return relations.filter((entry) => {
    const key = `${entry.kind}:${entry.artifactId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildArtifactEnvelope(input: {
  artifactId: string;
  schema: string;
  format: "markdown" | "json";
  playbookId: string;
  playbookVersion: string;
  runId: string;
  stepId: string;
  skillId?: string;
  skillVersion?: string;
  skillPackageDigest?: Sha256;
  skillInterfaceDigest?: Sha256;
  scriptId?: string;
  toolOperationId?: string;
  parents: string[];
  contentDigest: Sha256;
  producedAt: string;
  toolReceipts?: ToolReceiptRef[];
  destination?: ArtifactDestination | null;
  observationWindow?: ObservationWindow | null;
  results?: ArtifactResults;
  status?: ArtifactStatus;
}): ArtifactEnvelope {
  const envelope: ArtifactEnvelope = {
    schemaVersion: "conquistador.artifact-envelope/v1",
    id: `${input.runId}.${input.artifactId}`,
    identity: {
      artifactId: input.artifactId,
      schema: input.schema,
      format: input.format,
    },
    provenance: {
      playbookId: input.playbookId,
      playbookVersion: input.playbookVersion,
      runId: input.runId,
      stepId: input.stepId,
      ...(input.skillId ? { skillId: input.skillId } : {}),
      ...(input.skillVersion ? { skillVersion: input.skillVersion } : {}),
      ...(input.skillPackageDigest ? { skillPackageDigest: input.skillPackageDigest } : {}),
      ...(input.skillInterfaceDigest ? { skillInterfaceDigest: input.skillInterfaceDigest } : {}),
      ...(input.scriptId ? { scriptId: input.scriptId } : {}),
      ...(input.toolOperationId ? { toolOperationId: input.toolOperationId } : {}),
      sourceContext: { parentArtifactIds: input.parents },
    },
    revision: {
      n: 1,
      previousContentDigest: null,
      contentDigest: input.contentDigest,
      chain: [{ n: 1, contentDigest: input.contentDigest, producedAt: input.producedAt, source: "run" }],
    },
    status: input.status ?? "draft",
    relationships: relationshipsFor({
      artifactId: input.artifactId,
      parents: input.parents,
      scriptId: input.scriptId,
      toolOperationId: input.toolOperationId,
    }),
    toolReceipts: input.toolReceipts ?? [],
    humanEdits: [],
    reviewVerdict: null,
    approvedAction: null,
    destination: input.destination ?? null,
    observationWindow: input.observationWindow ?? null,
    results: input.results ?? { status: "unknown" },
    contentDigest: input.contentDigest,
  };
  validateArtifactEnvelope(envelope);
  assertAttribution(envelope, {
    runId: input.runId,
    playbookId: input.playbookId,
    playbookVersion: input.playbookVersion,
    produced: [{ artifactId: input.artifactId, stepId: input.stepId }],
    steps: [{
      id: input.stepId,
      skillId: input.skillId,
      skillVersion: input.skillVersion,
      skillPackageDigest: input.skillPackageDigest,
      skillInterfaceDigest: input.skillInterfaceDigest,
      scriptId: input.scriptId,
      toolOperationId: input.toolOperationId,
    }],
  });
  return envelope;
}

export function writeEnvelope(path: string, envelope: ArtifactEnvelope): void {
  validateArtifactEnvelope(envelope);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`);
}

export function readEnvelope(path: string): ArtifactEnvelope {
  const envelope = JSON.parse(readFileSync(path, "utf8")) as unknown;
  validateArtifactEnvelope(envelope);
  return envelope;
}

export function patchEnvelope(path: string, patch: Partial<Pick<ArtifactEnvelope, "status" | "reviewVerdict" | "approvedAction" | "observationWindow" | "results" | "destination">>): ArtifactEnvelope {
  const envelope = readEnvelope(path);
  const next = { ...envelope, ...patch };
  writeEnvelope(path, next);
  return next;
}

export function applyHumanEdit(options: {
  artifactFile: string;
  envelopeFile?: string;
  newBody: unknown;
  summary: string;
  now: string;
}): ArtifactEnvelope {
  const envelopeFile = options.envelopeFile ?? artifactSidecarPath(options.artifactFile);
  const envelope = readEnvelope(envelopeFile);
  const previous = envelope.contentDigest;
  const format = envelope.identity.format;
  const raw = readFileSync(options.artifactFile, "utf8");
  let nextDigest: Sha256;
  if (format === "json") {
    const parsed = JSON.parse(raw) as { provenance: unknown; body: unknown };
    parsed.body = options.newBody;
    writeFileSync(options.artifactFile, `${JSON.stringify(parsed, null, 2)}\n`);
    nextDigest = sha256(options.newBody);
  } else {
    const { frontMatter } = splitMarkdown(raw);
    const body = typeof options.newBody === "string" ? options.newBody : JSON.stringify(options.newBody, null, 2);
    nextDigest = sha256(body);
    const rendered = `---\n${Object.entries(frontMatter).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join("\n")}\n---\n\n${body}\n`;
    writeFileSync(options.artifactFile, rendered);
  }
  const next: ArtifactEnvelope = {
    ...envelope,
    status: "draft",
    contentDigest: nextDigest,
    revision: {
      n: envelope.revision.n + 1,
      previousContentDigest: previous,
      contentDigest: nextDigest,
      chain: [
        ...envelope.revision.chain,
        { n: envelope.revision.n + 1, contentDigest: nextDigest, producedAt: options.now, source: "human-edit" },
      ],
    },
    humanEdits: [
      ...envelope.humanEdits,
      {
        at: options.now,
        previousContentDigest: previous,
        nextContentDigest: nextDigest,
        summary: options.summary,
        source: "human",
      },
    ],
  };
  writeEnvelope(envelopeFile, next);
  return next;
}

type BoundVerdict = {
  artifactId: string;
  outcome?: "accept" | "revise" | "reject" | "cancel";
  boundContentDigest?: Sha256;
};

function boundVerdictFromRun(
  runDirectory: string,
  artifactId: string,
  envelope: ArtifactEnvelope | undefined,
): BoundVerdict {
  if (!envelope?.reviewVerdict) return { artifactId };
  const legacyPath = resolve(runDirectory, "review-packet.json");
  const canonicalPath = resolve(runDirectory, "canonical-review-packet.json");
  const statePath = resolve(runDirectory, "state.json");
  if (
    !existsSync(legacyPath) || !existsSync(canonicalPath) ||
    !existsSync(statePath)
  ) return { artifactId };
  try {
    const legacy = JSON.parse(readFileSync(legacyPath, "utf8")) as unknown;
    validatePlaybookReviewPacket(legacy);
    const canonical = JSON.parse(
      readFileSync(canonicalPath, "utf8"),
    ) as unknown;
    validateReviewPacket(canonical);
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      reviewTransitions?: ConstructorParameters<typeof ReviewTransitionState>[0];
    };
    if (!state.reviewTransitions) return { artifactId };
    const transitions = new ReviewTransitionState(state.reviewTransitions);
    const verdict = transitions.consumedVerdict(canonical as ReviewPacketV1);
    const projection = envelope.reviewVerdict;
    const bound = legacy.boundArtifacts.find((entry) =>
      entry.artifactId === artifactId
    );
    const approvedRevision = envelope.revision.chain.find((entry) =>
      entry.n === projection.artifactRevision
    );
    const canonicalBindsLegacy = canonical.identity.runId === legacy.runId &&
      canonical.identity.sessionId === legacy.sessionId &&
      canonical.artifact.artifactId === "review-bundle" &&
      canonical.artifact.revision === 1 &&
      canonical.artifact.digest === sha256(legacy.boundArtifacts) &&
      canonical.evidence.some((entry) =>
        entry.id === "legacy-packet-projection" &&
        entry.digest === legacy.digest
      );
    const transitionBindsPacket = verdict.packetId === canonical.packetId &&
      verdict.packetDigest === canonical.digest &&
      verdict.artifactId === canonical.artifact.artifactId &&
      verdict.artifactRevision === canonical.artifact.revision &&
      verdict.artifactDigest === canonical.artifact.digest;
    const projectionIsExact = projection.packetId === verdict.packetId &&
      projection.packetDigest === verdict.packetDigest &&
      projection.outcome === verdict.outcome &&
      projection.decidedAt === verdict.decidedAt &&
      projection.artifactId === artifactId &&
      projection.boundContentDigest === bound?.contentDigest &&
      approvedRevision?.contentDigest === projection.boundContentDigest;
    if (!canonicalBindsLegacy || !transitionBindsPacket || !projectionIsExact) {
      return { artifactId };
    }
    return {
      artifactId,
      outcome: verdict.outcome,
      boundContentDigest: bound?.contentDigest,
    };
  } catch {
    return { artifactId };
  }
}

function consumptionFrom(input: {
  path: string;
  artifactId: string;
  contentDigest: Sha256;
  envelope?: ArtifactEnvelope;
  outcome?: "accept" | "revise" | "reject" | "cancel";
  boundContentDigest?: Sha256;
}): PriorConsumption {
  const outcome = input.outcome;
  const bound = input.boundContentDigest;
  if (outcome === "accept" && bound === input.contentDigest) {
    return { ...input, reviewedAs: "approved", verdict: "accept", reason: "approved" };
  }
  if (outcome === "accept" && bound && bound !== input.contentDigest) {
    return { ...input, reviewedAs: "unreviewed", verdict: "accept", reason: "revised-after-approval" };
  }
  if (outcome === "accept" && !bound) {
    return { ...input, reviewedAs: "unreviewed", verdict: "accept", reason: "stale-approval" };
  }
  if (outcome === "revise" || outcome === "reject" || outcome === "cancel") {
    return { ...input, reviewedAs: "unreviewed", verdict: outcome, reason: "unapproved" };
  }
  if (!input.envelope) {
    return { ...input, reviewedAs: "unreviewed", reason: "missing-envelope" };
  }
  return { ...input, reviewedAs: "unreviewed", reason: "missing-verdict" };
}

function consumeArtifactFile(artifactFile: string, runDirectory: string): PriorConsumption {
  const sidecar = artifactSidecarPath(artifactFile);
  const envelope = existsSync(sidecar) ? readEnvelope(sidecar) : undefined;
  const format = envelope?.identity.format ?? (artifactFile.endsWith(".json") ? "json" : "markdown");
  const contentDigest = readArtifactContentDigest(artifactFile, format);
  const artifactId = envelope?.identity.artifactId ?? basename(artifactFile).replace(/\.(md|json)$/i, "");
  const bound = boundVerdictFromRun(runDirectory, artifactId, envelope);
  return consumptionFrom({
    path: artifactFile,
    artifactId,
    contentDigest,
    envelope,
    outcome: bound.outcome,
    boundContentDigest: bound.boundContentDigest,
  });
}

export function consumePriorArtifact(path: string): PriorConsumption {
  invariant(typeof path === "string" && path.trim().length > 0, "prior artifact path is required");
  invariant(existsSync(path), "prior artifact path was not found");
  if (statSync(path).isDirectory()) {
    const created = resolve(path, "artifacts/created-artifact.md");
    invariant(existsSync(created), "run directory has no created-artifact to consume");
    return consumeArtifactFile(created, path);
  }
  const runDir = basename(dirname(path)) === "artifacts" ? resolve(path, "../..") : dirname(path);
  return consumeArtifactFile(path, runDir);
}

export function tryConsumePriorInput(value: unknown): PriorConsumption | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (!existsSync(value)) return undefined;
  return consumePriorArtifact(value);
}
