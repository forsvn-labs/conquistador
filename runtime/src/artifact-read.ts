import { constants, closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { jsonContentDigest, markdownContentDigest, splitMarkdown, validateArtifactEnvelope } from "./artifacts.ts";
import { sha256 } from "./canonical.ts";
import type { RunSnapshot } from "./runner.ts";
import { RuntimeFailure } from "./runtime.ts";

const LIMIT = 524_288;
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
// Authority documents are available only through the separate operator interface.
export const AUTHORITY_ARTIFACTS = new Set(["approved-action", "action-receipt", "review-bundle"]);
function boundedFile(directory: string, name: string): string {
  for (const path of [directory, resolve(directory, "artifacts")]) {
    if (!lstatSync(path).isDirectory()) throw new Error("unsafe directory");
  }
  const fd = openSync(resolve(directory, "artifacts", name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > LIMIT) throw new Error("unsafe artifact size");
    const bytes = Buffer.alloc(LIMIT + 1);
    // A bounded read also handles a file that grows after fstat.
    const count = readSync(fd, bytes, 0, bytes.length, 0);
    const raw = bytes.subarray(0, count);
    if (raw.length > bytes.length - 1) throw new Error("unsafe artifact size");
    return raw.toString("utf8");
  } finally { closeSync(fd); }
}
export function readOwnedArtifact(run: RunSnapshot, artifactId: string): Record<string, unknown> {
  if (artifactId.length > 160 || !ID.test(artifactId) || AUTHORITY_ARTIFACTS.has(artifactId)) throw new RuntimeFailure("invalid", "artifact is not available through this interface");
  const record = run.state.artifacts[artifactId];
  if (!record) throw new RuntimeFailure("not-found", "artifact not found");
  try {
    const envelopeRaw = boundedFile(run.directory, `${artifactId}.meta.json`);
    const envelope: unknown = JSON.parse(envelopeRaw);
    validateArtifactEnvelope(envelope);
    const format = envelope.identity.format;
    const filename = `${artifactId}.${format === "json" ? "json" : "md"}`;
    if (record.path !== `artifacts/${filename}` || record.envelopePath !== `artifacts/${artifactId}.meta.json` || envelope.identity.artifactId !== artifactId || envelope.provenance.runId !== run.state.runId) throw new Error("identity mismatch");
    const raw = boundedFile(run.directory, filename);
    const digest = format === "json" ? jsonContentDigest(raw) : markdownContentDigest(raw);
    if (sha256(raw) !== record.digest || digest !== record.contentDigest || digest !== envelope.revision.contentDigest) throw new Error("digest mismatch");
    const body = format === "json" ? (JSON.parse(raw).body ?? JSON.parse(raw)) : splitMarkdown(raw).body;
    return { artifactId, format, revision: envelope.revision.n, digest, body };
  } catch { throw new RuntimeFailure("conflict", "artifact is unavailable or failed integrity validation"); }
}
