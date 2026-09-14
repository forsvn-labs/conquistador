import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createToolCandidate, selectCandidateOperations, verifyToolCandidate, type ToolCandidateBuild } from "../src/candidate.ts";
import { canonicalJson, sha256 } from "../src/canonical.ts";
import { validateCatalog } from "../src/validate.ts";

const ADAPTER_VERSION = "1.0.0";

const CATALOG_ROOTS = [
  "catalog",
  "01-business/conquistador/catalog",
  ["01-business", "forsvn", "conquistador", "catalog"].join("/"),
] as const;

function repoRoot(): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: resolve(import.meta.dirname, ".."),
  })
    .toString()
    .trim();
}

function bytesDigest(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function fail(message: string): never {
  throw new Error(`[tool-candidate] ${message}`);
}

type ExactGitCommit = {
  commit: string;
  tree: string;
};

function git(arguments_: string[]): Buffer {
  try {
    return execFileSync("git", arguments_, {
      cwd: repoRoot(),
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail(`git ${arguments_.join(" ")} failed`);
  }
}

function committedBlobs(objectIds: string[]): Map<string, Buffer> {
  const unique = [...new Set(objectIds)];

  const raw = execFileSync("git", ["cat-file", "--batch"], {
    cwd: repoRoot(),
    input: Buffer.from(`${unique.join("\n")}\n`, "utf8"),
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const blobs = new Map<string, Buffer>();
  let offset = 0;

  for (const expectedId of unique) {
    const lineEnd = raw.indexOf(0x0a, offset);

    if (lineEnd < 0) fail(`git cat-file batch header is truncated for ${expectedId}`);
    const match = /^([0-9a-f]{40}) blob (\d+)$/.exec(raw.toString("utf8", offset, lineEnd));

    if (!match || match[1] !== expectedId) fail(`git cat-file batch identity differs for ${expectedId}`);
    const size = Number(match[2]);
    offset = lineEnd + 1;

    if (!Number.isSafeInteger(size) || offset + size >= raw.length) fail(`git cat-file batch payload is invalid for ${expectedId}`);
    blobs.set(expectedId, raw.subarray(offset, offset + size));
    offset += size;

    if (raw[offset] !== 0x0a) fail(`git cat-file batch boundary is invalid for ${expectedId}`);
    offset += 1;
  }

  if (offset !== raw.length) fail(`git cat-file batch returned trailing bytes`);

  return blobs;
}

function exactCommit(commit: string): ExactGitCommit {
  if (!/^[0-9a-f]{40}$/.test(commit)) fail("--commit must be one exact 40-hex Git commit");
  const resolved = git(["rev-parse", `${commit}^{commit}`]).toString().trim();

  if (resolved !== commit) fail("source commit did not resolve exactly");

  return { commit, tree: git(["rev-parse", `${commit}^{tree}`]).toString().trim() };
}

function committedFile(commit: string, path: string): Buffer {
  return git(["show", `${commit}:${path}`]);
}

function committedCatalogRoot(commit: string): string {
  for (const catalogRoot of CATALOG_ROOTS) {
    try {
      execFileSync("git", ["cat-file", "-e", `${commit}:${catalogRoot}/operations/v1.json`], {
        cwd: repoRoot(),
        stdio: "ignore",
      });

      return catalogRoot;
    } catch {
      continue;
    }
  }

  fail("committed catalog operations/v1.json was not found under catalog/ or the historical FORSVN paths");
}

function committedModuleDigest(commit: string, catalogRoot: string): `sha256:${string}` {
  const entries = git([
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    commit,
    "--",
    catalogRoot,
  ])
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(row);

      if (!match) fail(`candidate source inventory contains a non-regular or malformed entry`);

      return { objectId: match[2], path: match[3] };
    })
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

  if (entries.length === 0) fail("candidate source inventory is empty");
  const blobs = committedBlobs(entries.map((entry) => entry.objectId));

  return sha256(entries.map(({ objectId, path }) => `${path}\0${bytesDigest(blobs.get(objectId)!)}\n`).join(""));
}

function build(commitInput: string): Readonly<ToolCandidateBuild> {
  const source = exactCommit(commitInput);
  const catalogRoot = committedCatalogRoot(source.commit);
  const catalogBytes = committedFile(source.commit, `${catalogRoot}/operations/v1.json`);
  const fixtureBytes = committedFile(source.commit, `${catalogRoot}/fixtures/v1/conformance.json`);
  const parsed: unknown = JSON.parse(catalogBytes.toString("utf8"));
  validateCatalog(parsed);
  const operations = selectCandidateOperations(parsed.operations, ADAPTER_VERSION);

  return createToolCandidate({
    schemaVersion: "conquistador.tool-candidate/v1",
    productVersion: "1.0.0",
    sourceCommit: source.commit,
    sourceTree: source.tree,
    catalogDigest: bytesDigest(catalogBytes),
    moduleSourceDigest: committedModuleDigest(source.commit, catalogRoot),
    fixtureDigest: bytesDigest(fixtureBytes),
    adapterVersion: ADAPTER_VERSION,
    operations,
  });
}

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}

const commit = parseFlag("--commit");

const checkPath = parseFlag("--check");

if (checkPath) {
  const parsedCandidate: unknown = JSON.parse(readFileSync(resolve(checkPath), "utf8"));

  // SAFETY: --check reads a candidate record previously emitted by this builder; verifyToolCandidate rejects undeclared fields and digest drift.
  const candidate = parsedCandidate as ToolCandidateBuild;
  verifyToolCandidate(candidate);
  const expected = build(candidate.sourceCommit);

  if (canonicalJson(candidate) !== canonicalJson(expected)) fail("candidate record differs from committed source");
  console.log(`tool candidate check: ${candidate.candidateBuildId} (${candidate.operations.length} operations)`);
} else if (commit) {
  console.log(JSON.stringify(build(commit), null, 2));
} else {
  fail("usage: candidate-build --commit <40-hex> | --check <candidate.json>");
}
