export type Sha256 = `sha256:${string}`;

export type ArtifactIdentity = {
  name: string;
  version: string;
  digest: Sha256;
};

export type CandidateBuild = {
  schemaVersion: "conquistador.candidate-build/v1";
  id: string;
  source: {
    commit: string;
    tree: string;
    ledgerDigest: Sha256;
    projector: ArtifactIdentity;
  };
  stage: {
    publicTreeDigest: Sha256;
    portablePlugin: ArtifactIdentity;
    npmInput: ArtifactIdentity;
    ociInputs: ArtifactIdentity[];
  };
  modules: {
    runtime: ArtifactIdentity;
    toolModule: ArtifactIdentity;
    evalLab: ArtifactIdentity;
  };
  createdAt: string;
};

export type ProviderCell = {
  schemaVersion: "conquistador.provider-cell/v1";
  id: string;
  provider: string;
  model: string;
  modelVersion: string;
  adapter: ArtifactIdentity;
  promptTemplateDigest: Sha256;
  toolManifestDigest: Sha256;
  settingsDigest: Sha256;
  calibrationDigest: Sha256;
};

export type EvalCase = {
  schemaVersion: "conquistador.eval-case/v1";
  id: string;
  outcomeId: string;
  partition: "normal" | "boundary" | "deep" | "parent" | "parity" | "calibration";
  class: string;
  fixtureIds: string[];
  assertionIds: string[];
  dimensionIds: string[];
  promptDigest: Sha256;
  repetitionCount: 3;
  externalActionPolicy: "deny";
};

export type Fixture = {
  schemaVersion: "conquistador.fixture/v1";
  id: string;
  path: string;
  digest: Sha256;
  license: string;
  provenance: string;
  sensitivity: "public" | "synthetic" | "private-redacted";
  immutable: true;
};

export type Assertion = {
  schemaVersion: "conquistador.assertion/v1";
  id: string;
  kind: "deterministic" | "model" | "media" | "artifact" | "human";
  description: string;
  hardFailure: boolean;
};

export type Dimension = {
  schemaVersion: "conquistador.dimension/v1";
  id: string;
  rubricVersion: string;
  description: string;
  minimumScore: number;
  medianFloor: number;
};

export type AssertionResult = {
  assertionId: string;
  status: "pass" | "fail" | "inconclusive";
  evidenceDigests: Sha256[];
};

export type DimensionResult = {
  dimensionId: string;
  score: number;
};

export type Run = {
  schemaVersion: "conquistador.run/v1";
  id: string;
  caseId: string;
  candidateBuildId: string;
  providerCellId: string;
  repetition: 1 | 2 | 3;
  status: "pass" | "fail" | "inconclusive";
  startedAt: string;
  finishedAt: string;
  traceDigest: Sha256;
  artifactDigests: Sha256[];
  assertionResults: AssertionResult[];
  dimensionResults: DimensionResult[];
  externalActions: never[];
  terminalMarker: true;
};

export type BrokenRun = {
  schemaVersion: "conquistador.broken-run/v1";
  id: string;
  caseId: string;
  candidateBuildId: string;
  providerCellId: string;
  repetition: 1 | 2 | 3;
  status: "broken";
  startedAt: string;
  finishedAt: string;
  cause: string;
  traceDigest: Sha256;
  terminalMarker: true;
};

export type JudgeResult = {
  schemaVersion: "conquistador.judge-result/v1";
  id: string;
  runId: string;
  assertionId: string;
  graderType: "model" | "media" | "artifact";
  graderCellId: string;
  calibrationDigest: Sha256;
  verdict: "pass" | "fail" | "inconclusive";
  evidenceDigests: Sha256[];
};

export type BlindPair = {
  schemaVersion: "conquistador.blind-pair/v1";
  id: string;
  caseId: string;
  armA: { label: "A"; artifactDigest: Sha256 };
  armB: { label: "B"; artifactDigest: Sha256 };
  assignmentDigest: Sha256;
  presentedAt: string;
};

export type HumanVerdict = {
  schemaVersion: "conquistador.human-verdict/v1";
  id: string;
  blindPairId: string;
  reviewer: string;
  reviewerRevision: string;
  artifactDigests: [Sha256, Sha256];
  verdict: "A" | "B" | "tie" | "reject-both";
  rationale: string;
  recordedAt: string;
  assignmentDigest: Sha256;
};

export type Experiment = {
  schemaVersion: "conquistador.experiment/v1";
  id: string;
  candidateBuildId: string;
  baselineDigest: Sha256;
  mutablePaths: string[];
  maxRuns: number;
  maxBudgetUsd: number;
  stopConditions: string[];
  benchmarkDigest: Sha256;
};

export type Decision = {
  schemaVersion: "conquistador.decision/v1";
  id: string;
  experimentId: string;
  verdict: "keep" | "discard" | "inconclusive";
  baselineDigest: Sha256;
  proposalDigest: Sha256;
  evidenceRunIds: string[];
  rationale: string;
  decidedAt: string;
};

export type ClaimVerdictRefV1 = {
  schemaVersion: "conquistador.claim-verdict-ref/v1";
  verdictId: string;
  verdictDigest: Sha256;
  packetId: string;
  packetDigest: Sha256;
  artifactDigest: Sha256;
  reviewerPrincipalId: string;
  reviewerAuthSubjectDigest: Sha256;
  candidateBuildId: string;
  evidenceCellId: string;
  outcome: "accept" | "revise" | "reject" | "cancel";
  decidedAt: string;
  expiresAt: string;
  unresolvedLimitations: string[];
};

export type ReleaseClaim = {
  schemaVersion: "conquistador.release-claim/v1";
  id: string;
  candidateBuildId: string;
  evidenceDigest: Sha256;
  status: "incomplete" | "evidence-complete" | "no-go";
  incompleteCells: string[];
  brokenRunIds: string[];
  humanVerdicts: ClaimVerdictRefV1[];
  authority: "none";
  generatedAt: string;
};

export type AnyRun = Run | BrokenRun;
