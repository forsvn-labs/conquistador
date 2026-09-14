import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  createToolCandidate,
  selectCandidateOperations,
  verifyToolCandidate,
  type ToolCandidateBasis,
} from "../src/candidate.ts";
import type { ToolCandidateBuild } from "../src/candidate.ts";
import type { Catalog, EvidenceKind, SupportCell, VerificationState } from "../src/contracts.ts";
import { root } from "./helpers.ts";

const basis: ToolCandidateBasis = {
  schemaVersion: "conquistador.tool-candidate/v1",
  productVersion: "1.0.0",
  sourceCommit: "a".repeat(40),
  sourceTree: "b".repeat(40),
  catalogDigest: `sha256:${"c".repeat(64)}`,
  moduleSourceDigest: `sha256:${"d".repeat(64)}`,
  fixtureDigest: `sha256:${"e".repeat(64)}`,
  adapterVersion: "1.0.0",
  operations: [
    {
      id: "github.repository.get",
      provider: "github",
      providerApiVersion: "github-rest-2022-11-28",
    },
  ],
};

// Raw identity binds every committed catalog blob. The builder gets twice the
// observed cold-I/O time in this worktree; the test gets five more seconds for
// its independent batch digest and assertions. The child-process timeout is
// the hard regression guard because synchronous work can block Vitest's timer.
const CANDIDATE_BUILD_TIMEOUT_MS = 20_000;
const RAW_IDENTITY_TEST_TIMEOUT_MS = 25_000;

describe("Tool Module candidate identity", () => {
  it("derives the documented 64-hex build ID from exact immutable inputs", () => {
    const candidate = createToolCandidate(basis);
    expect(candidate.candidateBuildId).toBe(
      "53c79a46bfc975078d33cc8d24611feedec2c9a4ea3ada09a35688abc592e5cf",
    );
    expect(candidate).toMatchObject(basis);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(() => verifyToolCandidate(candidate)).not.toThrow();
  });

  it("binds the CLI record to raw committed catalog and fixture bytes", () => {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root }).toString().trim();
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).toString().trim();
    const candidate = JSON.parse(execFileSync(
      process.execPath,
      ["--experimental-strip-types", "tools/candidate-build.ts", "--commit", commit],
      { cwd: root, timeout: CANDIDATE_BUILD_TIMEOUT_MS },
    ).toString()) as ToolCandidateBuild;
    const catalogRoots = [
      "catalog",
      "01-business/conquistador/catalog",
      ["01-business", "forsvn", "conquistador", "catalog"].join("/"),
    ];
    let catalogRoot = catalogRoots[0];
    for (const candidateRoot of catalogRoots) {
      try {
        execFileSync("git", ["cat-file", "-e", `${commit}:${candidateRoot}/operations/v1.json`], {
          cwd: repoRoot,
          stdio: "ignore",
        });
        catalogRoot = candidateRoot;
        break;
      } catch {
        continue;
      }
    }
    const moduleEntries = execFileSync(
      "git",
      ["ls-tree", "-r", "-z", "--full-tree", commit, "--", catalogRoot],
      { cwd: repoRoot },
    ).toString().split("\0").filter(Boolean).map((row) => {
      const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(row);
      if (!match) throw new Error(`unexpected committed catalog entry: ${row}`);
      return { objectId: match[2], path: match[3] };
    }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    const uniqueObjectIds = [...new Set(moduleEntries.map((entry) => entry.objectId))];
    const batch = execFileSync("git", ["cat-file", "--batch"], {
      cwd: repoRoot,
      input: Buffer.from(`${uniqueObjectIds.join("\n")}\n`, "utf8"),
      maxBuffer: 64 * 1024 * 1024,
    });
    const blobs = new Map<string, Buffer>();
    let offset = 0;
    for (const expectedId of uniqueObjectIds) {
      const lineEnd = batch.indexOf(0x0a, offset);
      const match = /^([0-9a-f]{40}) blob (\d+)$/.exec(batch.toString("utf8", offset, lineEnd));
      if (!match || match[1] !== expectedId) throw new Error(`unexpected batch identity for ${expectedId}`);
      const size = Number(match[2]);
      offset = lineEnd + 1;
      blobs.set(expectedId, batch.subarray(offset, offset + size));
      offset += size;
      if (batch[offset] !== 0x0a) throw new Error(`unexpected batch boundary for ${expectedId}`);
      offset += 1;
    }
    if (offset !== batch.length) throw new Error("unexpected trailing batch bytes");
    const rawDigests = new Map(moduleEntries.map(({ objectId, path }) => [
      path,
      `sha256:${createHash("sha256").update(blobs.get(objectId)!).digest("hex")}`,
    ]));
    const rawDigest = (path: string) => {
      const digest = rawDigests.get(path);
      if (!digest) throw new Error(`committed catalog path is missing: ${path}`);
      return digest;
    };
    const moduleSourceDigest = `sha256:${createHash("sha256").update(
      moduleEntries.map(({ path }) => `${path}\0${rawDigest(path)}\n`).join(""),
    ).digest("hex")}`;

    // The candidate admits exactly the operations the committed catalog
    // proves with fixture-verified cells carrying exact adapter evidence.
    const committedCatalog = JSON.parse(execFileSync(
      "git",
      ["show", `${commit}:${catalogRoot}/operations/v1.json`],
      { cwd: repoRoot },
    ).toString()) as Catalog;
    const selected = selectCandidateOperations(
      committedCatalog.operations,
      "1.0.0",
    );

    expect(candidate).toMatchObject({
      sourceCommit: commit,
      catalogDigest: rawDigest(`${catalogRoot}/operations/v1.json`),
      fixtureDigest: rawDigest(`${catalogRoot}/fixtures/v1/conformance.json`),
      moduleSourceDigest,
      adapterVersion: "1.0.0",
    });
    expect(candidate.operations).toEqual(selected);
    const ids = candidate.operations.map((operation) => operation.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    const openseoSelected = ids.filter((id) => id.startsWith("openseo."));
    const openseoFixtureVerified = committedCatalog.operations.filter((item) =>
      item.provider === "openseo" && item.supportCells.some((cell) => cell.state === "fixture-verified")
    ).length;
    expect(openseoSelected.length).toBe(openseoFixtureVerified);
  }, RAW_IDENTITY_TEST_TIMEOUT_MS);

  it("rejects floating identities, duplicate operations, and changed evidence inputs", () => {
    expect(() => createToolCandidate({ ...basis, sourceCommit: "latest" })).toThrow(/source commit/);
    expect(() => createToolCandidate({
      ...basis,
      operations: [...basis.operations, basis.operations[0]],
    })).toThrow(/unique/);

    const candidate = createToolCandidate(basis);
    expect(() => verifyToolCandidate({
      ...candidate,
      moduleSourceDigest: `sha256:${"f".repeat(64)}`,
    })).toThrow(/build ID differs/);
  });

  it("rejects undeclared candidate and operation fields from parsed JSON", () => {
    const candidate = createToolCandidate(basis);
    expect(() => verifyToolCandidate({
      ...candidate,
      injected: "ignored-by-types",
    } as ToolCandidateBuild)).toThrow(/undeclared fields/);
    expect(() => createToolCandidate({
      ...basis,
      operations: [{
        ...basis.operations[0],
        injected: "ignored-by-types",
      } as unknown as ToolCandidateBasis["operations"][number]],
    } as ToolCandidateBasis)).toThrow(/undeclared fields/);
  });
});

describe("candidate operation selection", () => {
  const evidence = (overrides: Partial<{
    kind: EvidenceKind;
    adapterVersion: string;
    providerVersion: string;
  }> = {}): SupportCell["evidence"][number] => ({
    id: "ev-1",
    kind: "fixture",
    providerVersion: "posthog-2026-08-10",
    adapterVersion: "1.0.0",
    checkedAt: "2026-08-11T10:44:32.000Z",
    digest: `sha256:${"1".repeat(64)}` as const,
    ...overrides,
  });
  const cell = (
    state: VerificationState,
    evidenceOverrides?: Parameters<typeof evidence>[0],
  ): SupportCell => ({
    id: "cell-1",
    platform: "darwin",
    architecture: "arm64",
    state,
    evidence: [evidence(evidenceOverrides)],
  });
  const operation = (overrides: Partial<Parameters<typeof selectCandidateOperations>[0][number]> = {}) => ({
    id: "posthog.insight.read",
    provider: "posthog",
    providerApiVersion: "posthog-2026-08-10",
    actionClass: "observe" as const,
    supportCells: [cell("fixture-verified")],
    ...overrides,
  });

  it("includes exactly fixture-verified non-prohibited operations, sorted and unique", () => {
    const selected = selectCandidateOperations(
      [
        operation({ id: "zeta.op", actionClass: "prohibited" }),
        operation({ id: "mid.researched", supportCells: [cell("researched")] }),
        operation({ id: "alpha.op" }),
      ],
      "1.0.0",
    );
    expect(selected).toEqual([
      { id: "alpha.op", provider: "posthog", providerApiVersion: "posthog-2026-08-10" },
    ]);
  });

  it("fails closed when a falsely fixture-verified operation lacks exact matching evidence", () => {
    for (const supportCells of [
      [cell("fixture-verified", { kind: "research" })],
      [cell("fixture-verified", { adapterVersion: "9.9.9" })],
      [cell("fixture-verified", { providerVersion: "posthog-2020-01-01" })],
      [cell("fixture-verified", { kind: "research" }), cell("fixture-verified", { adapterVersion: "0.0.1" })],
    ]) {
      expect(() => selectCandidateOperations([operation({ supportCells })], "1.0.0")).toThrow(
        /\[tool-candidate\] posthog\.insight\.read lacks exact fixture evidence/,
      );
    }
  });

  it("does not let higher verification states substitute for a fixture-verified cell", () => {
    const perfectFixture = {};
    for (const state of ["live-verified", "supported"] as const) {
      expect(selectCandidateOperations([operation({ supportCells: [cell(state, perfectFixture)] })], "1.0.0")).toEqual([]);
    }
  });

  it("does not leak exact evidence from a non-qualifying cell into a failing fixture-verified cell", () => {
    const supportCells = [
      cell("fixture-verified", { providerVersion: "posthog-2020-01-01" }),
      cell("researched"),
    ];
    expect(() => selectCandidateOperations([operation({ supportCells })], "1.0.0")).toThrow(
      /\[tool-candidate\] posthog\.insight\.read lacks exact fixture evidence/,
    );
  });

  it("fails closed on a fixture-verified cell with no evidence at all", () => {
    const empty: SupportCell = { ...cell("fixture-verified"), evidence: [] };
    expect(() => selectCandidateOperations([operation({ supportCells: [empty] })], "1.0.0")).toThrow(
      /\[tool-candidate\] posthog\.insight\.read lacks exact fixture evidence/,
    );
  });

  it("admits an operation when any one qualifying cell carries exact evidence among otherwise wrong cells", () => {
    const supportCells = [
      cell("fixture-verified", { adapterVersion: "0.0.1" }),
      cell("researched"),
      cell("fixture-verified"),
    ];
    expect(selectCandidateOperations([operation({ supportCells })], "1.0.0")).toEqual([
      { id: "posthog.insight.read", provider: "posthog", providerApiVersion: "posthog-2026-08-10" },
    ]);
  });

  it("selects without mutating the input operation order or support cells", () => {
    const first = operation({ id: "zeta.op" });
    const second = operation({ id: "alpha.op" });
    const input = [first, second];
    const frozenCells = Object.freeze([...first.supportCells]);
    const observed: Parameters<typeof selectCandidateOperations>[0] = [
      { ...first, supportCells: frozenCells },
      second,
    ];
    const selected = selectCandidateOperations(observed, "1.0.0");
    expect(selected.map((entry) => entry.id)).toEqual(["alpha.op", "zeta.op"]);
    expect(input.map((entry) => entry.id)).toEqual(["zeta.op", "alpha.op"]);
    expect(Object.isFrozen(frozenCells)).toBe(true);
  });
});
