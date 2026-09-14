import type { CandidateBuild, EvalCase, ProviderCell } from "./contracts.ts";
import { invariant, validateCandidateBuild, validateEvalCase, validateProviderCell } from "./validate.ts";

export type ExactSelection = {
  buildId: string;
  sourceCommit: string;
  publicTreeDigest: string;
  portablePluginDigest: string;
  runtimeDigest: string;
  toolModuleDigest: string;
  evalLabDigest: string;
  caseId: string;
  providerCellId: string;
  provider: string;
  model: string;
  modelVersion: string;
  adapterVersion: string;
  promptTemplateDigest: string;
  toolManifestDigest: string;
};

export function selectExactCandidate(
  build: unknown,
  evalCase: unknown,
  provider: unknown,
  expected?: Partial<ExactSelection>,
): ExactSelection {
  validateCandidateBuild(build);
  validateEvalCase(evalCase);
  validateProviderCell(provider);

  const selection: ExactSelection = {
    buildId: build.id,
    sourceCommit: build.source.commit,
    publicTreeDigest: build.stage.publicTreeDigest,
    portablePluginDigest: build.stage.portablePlugin.digest,
    runtimeDigest: build.modules.runtime.digest,
    toolModuleDigest: build.modules.toolModule.digest,
    evalLabDigest: build.modules.evalLab.digest,
    caseId: evalCase.id,
    providerCellId: provider.id,
    provider: provider.provider,
    model: provider.model,
    modelVersion: provider.modelVersion,
    adapterVersion: provider.adapter.version,
    promptTemplateDigest: provider.promptTemplateDigest,
    toolManifestDigest: provider.toolManifestDigest,
  };
  for (const [field, value] of Object.entries(expected ?? {})) {
    invariant(selection[field as keyof ExactSelection] === value, `${field} differs from the requested candidate cell`);
  }
  return selection;
}
