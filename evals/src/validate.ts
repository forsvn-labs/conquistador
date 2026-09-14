import type { CandidateBuild, EvalCase, ProviderCell, Sha256 } from "./contracts.ts";

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const GIT_OBJECT = /^[0-9a-f]{40}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[eval-lab] ${message}`);
}

export function requireSha256(value: unknown, label: string): asserts value is Sha256 {
  invariant(typeof value === "string" && SHA256.test(value), `${label} must be sha256:<64 lowercase hex>`);
}

function requireArtifact(value: unknown, label: string): void {
  invariant(Boolean(value) && typeof value === "object", `${label} is required`);
  const artifact = value as Record<string, unknown>;
  invariant(typeof artifact.name === "string" && artifact.name.length > 0, `${label}.name is required`);
  invariant(typeof artifact.version === "string" && SEMVER.test(artifact.version), `${label}.version must be exact semver`);
  requireSha256(artifact.digest, `${label}.digest`);
}

export function validateCandidateBuild(value: unknown): asserts value is CandidateBuild {
  invariant(Boolean(value) && typeof value === "object", "Candidate Build is required");
  const build = value as CandidateBuild;
  invariant(build.schemaVersion === "conquistador.candidate-build/v1", "Candidate Build schema is not v1");
  invariant(typeof build.id === "string" && /^[0-9a-f]{64}$/.test(build.id), "Candidate Build id must be the exact projector SHA-256 ID");
  invariant(GIT_OBJECT.test(build.source?.commit ?? ""), "source.commit must be an exact 40-character Git object");
  invariant(GIT_OBJECT.test(build.source?.tree ?? ""), "source.tree must be an exact 40-character Git object");
  requireSha256(build.source?.ledgerDigest, "source.ledgerDigest");
  requireArtifact(build.source?.projector, "source.projector");
  requireSha256(build.stage?.publicTreeDigest, "stage.publicTreeDigest");
  requireArtifact(build.stage?.portablePlugin, "stage.portablePlugin");
  requireArtifact(build.stage?.npmInput, "stage.npmInput");
  invariant(Array.isArray(build.stage?.ociInputs) && build.stage.ociInputs.length === 2, "stage.ociInputs must bind amd64 and arm64 inputs");
  build.stage.ociInputs.forEach((artifact, index) => requireArtifact(artifact, `stage.ociInputs[${index}]`));
  invariant(
    build.stage.ociInputs.some((artifact) => artifact.name.includes("amd64")) &&
      build.stage.ociInputs.some((artifact) => artifact.name.includes("arm64")),
    "stage.ociInputs must identify amd64 and arm64",
  );
  requireArtifact(build.modules?.runtime, "modules.runtime");
  requireArtifact(build.modules?.toolModule, "modules.toolModule");
  requireArtifact(build.modules?.evalLab, "modules.evalLab");
  invariant(
    typeof build.createdAt === "string" &&
      !Number.isNaN(Date.parse(build.createdAt)) &&
      new Date(build.createdAt).toISOString() === build.createdAt,
    "createdAt must be an exact UTC ISO timestamp",
  );
}

export function validateProviderCell(value: unknown): asserts value is ProviderCell {
  invariant(Boolean(value) && typeof value === "object", "Provider Cell is required");
  const cell = value as ProviderCell;
  invariant(cell.schemaVersion === "conquistador.provider-cell/v1", "Provider Cell schema is not v1");
  invariant(typeof cell.id === "string" && cell.id.length > 0, "Provider Cell id is required");
  invariant(typeof cell.provider === "string" && cell.provider.length > 0, "provider is required");
  invariant(typeof cell.model === "string" && cell.model.length > 0 && !/[\s*]/.test(cell.model), "model must be an exact provider model ID");
  invariant(
    typeof cell.modelVersion === "string" &&
      cell.modelVersion.length > 0 &&
      !/^(?:latest|default|auto)$/i.test(cell.modelVersion) &&
      !/[\s*]/.test(cell.modelVersion),
    "modelVersion must be exact and non-floating",
  );
  requireArtifact(cell.adapter, "adapter");
  requireSha256(cell.promptTemplateDigest, "promptTemplateDigest");
  requireSha256(cell.toolManifestDigest, "toolManifestDigest");
  requireSha256(cell.settingsDigest, "settingsDigest");
  requireSha256(cell.calibrationDigest, "calibrationDigest");
}

export function validateEvalCase(value: unknown): asserts value is EvalCase {
  invariant(Boolean(value) && typeof value === "object", "Eval Case is required");
  const evalCase = value as EvalCase;
  invariant(evalCase.schemaVersion === "conquistador.eval-case/v1", "Eval Case schema is not v1");
  invariant(typeof evalCase.id === "string" && evalCase.id.length > 0, "Eval Case id is required");
  invariant(typeof evalCase.outcomeId === "string" && evalCase.outcomeId.length > 0, "outcomeId is required");
  invariant(evalCase.repetitionCount === 3, "every Eval Case must plan exactly three repetitions");
  invariant(evalCase.externalActionPolicy === "deny", "external actions must be denied");
  invariant(Array.isArray(evalCase.assertionIds) && evalCase.assertionIds.length > 0, "assertionIds are required");
  invariant(Array.isArray(evalCase.dimensionIds), "dimensionIds are required");
  requireSha256(evalCase.promptDigest, "promptDigest");
}
