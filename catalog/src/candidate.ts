import { deepFreeze, sha256 } from "./canonical.ts";
import type { ActionClass, Sha256, SupportCell } from "./contracts.ts";
import { invariant, requireSha256 } from "./validate.ts";

export type ToolCandidateOperation = {
  id: string;
  provider: string;
  providerApiVersion: string;
};

export type ToolCandidateBasis = {
  schemaVersion: "conquistador.tool-candidate/v1";
  productVersion: "1.0.0";
  sourceCommit: string;
  sourceTree: string;
  catalogDigest: Sha256;
  moduleSourceDigest: Sha256;
  fixtureDigest: Sha256;
  adapterVersion: string;
  operations: ToolCandidateOperation[];
};

export type ToolCandidateBuild = ToolCandidateBasis & {
  candidateBuildId: string;
};

export type CandidateSelectionOperation = {
  id: string;
  provider: string;
  providerApiVersion: string;
  actionClass: ActionClass;
  supportCells: readonly SupportCell[];
};

export function selectCandidateOperations(
  operations: readonly CandidateSelectionOperation[],
  adapterVersion: string,
): ToolCandidateOperation[] {
  const selected: ToolCandidateOperation[] = [];
  for (const operation of operations) {
    if (operation.actionClass === "prohibited") continue;
    const qualifyingCells = operation.supportCells.filter((cell) => cell.state === "fixture-verified");
    if (qualifyingCells.length === 0) continue;
    const verified = qualifyingCells.some((cell) =>
      cell.evidence.some((evidence) =>
        evidence.kind === "fixture" &&
        evidence.adapterVersion === adapterVersion &&
        evidence.providerVersion === operation.providerApiVersion,
      ),
    );
    if (!verified) {
      throw new Error(`[tool-candidate] ${operation.id} lacks exact fixture evidence`);
    }
    selected.push({
      id: operation.id,
      provider: operation.provider,
      providerApiVersion: operation.providerApiVersion,
    });
  }
  return selected.sort((left, right) => left.id.localeCompare(right.id));
}

const GIT_OBJECT = /^[0-9a-f]{40}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const BASIS_KEYS = [
  "schemaVersion",
  "productVersion",
  "sourceCommit",
  "sourceTree",
  "catalogDigest",
  "moduleSourceDigest",
  "fixtureDigest",
  "adapterVersion",
  "operations",
] as const;
const OPERATION_KEYS = ["id", "provider", "providerApiVersion"] as const;

function rejectUndeclaredFields(value: object, allowed: readonly string[], label: string): void {
  invariant(Object.keys(value).every((key) => allowed.includes(key)), `${label} includes undeclared fields`);
}

function validateBasis(basis: ToolCandidateBasis): void {
  rejectUndeclaredFields(basis, BASIS_KEYS, "tool candidate basis");
  invariant(basis.schemaVersion === "conquistador.tool-candidate/v1", "tool candidate schema must be v1");
  invariant(basis.productVersion === "1.0.0", "tool candidate product version must be 1.0.0");
  invariant(GIT_OBJECT.test(basis.sourceCommit), "tool candidate source commit must be exact");
  invariant(GIT_OBJECT.test(basis.sourceTree), "tool candidate source tree must be exact");
  requireSha256(basis.catalogDigest, "tool candidate catalog digest");
  requireSha256(basis.moduleSourceDigest, "tool candidate module source digest");
  requireSha256(basis.fixtureDigest, "tool candidate fixture digest");
  invariant(SEMVER.test(basis.adapterVersion), "tool candidate adapter version must be exact semver");
  invariant(basis.operations.length > 0, "tool candidate needs exact operations");
  invariant(
    new Set(basis.operations.map((operation) => operation.id)).size === basis.operations.length,
    "tool candidate operations must be unique",
  );
  for (const operation of basis.operations) {
    rejectUndeclaredFields(operation, OPERATION_KEYS, "tool candidate operation");
    invariant(ID.test(operation.id), "tool candidate operation ID is invalid");
    invariant(ID.test(operation.provider), "tool candidate provider ID is invalid");
    invariant(
      operation.providerApiVersion.trim().length > 0 &&
        !/^(?:latest|default|auto)$/i.test(operation.providerApiVersion),
      "tool candidate provider API version must be exact",
    );
  }
  invariant(
    basis.operations.every((operation, index) =>
      index === 0 || basis.operations[index - 1].id.localeCompare(operation.id) < 0,
    ),
    "tool candidate operations must be sorted by ID",
  );
}

function normalizeBasis(basis: ToolCandidateBasis): ToolCandidateBasis {
  return {
    ...structuredClone(basis),
    operations: structuredClone(basis.operations).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function createToolCandidate(basis: ToolCandidateBasis): Readonly<ToolCandidateBuild> {
  const normalized = normalizeBasis(basis);
  validateBasis(normalized);
  return deepFreeze({
    ...normalized,
    candidateBuildId: sha256(normalized).slice("sha256:".length),
  });
}

export function verifyToolCandidate(candidate: ToolCandidateBuild): Readonly<ToolCandidateBuild> {
  rejectUndeclaredFields(candidate, [...BASIS_KEYS, "candidateBuildId"], "tool candidate");
  invariant(/^[0-9a-f]{64}$/.test(candidate.candidateBuildId), "tool candidate build ID must be 64 lowercase hex");
  const { candidateBuildId, ...basis } = structuredClone(candidate);
  const expected = createToolCandidate(basis);
  invariant(expected.candidateBuildId === candidateBuildId, "tool candidate build ID differs from immutable inputs");
  return deepFreeze(structuredClone(candidate));
}
