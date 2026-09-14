import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, digestValue, type PromptfooExecutionManifest } from "./live-manifest.ts";
import {
  type ExecutionSummary,
  type RepetitionReceipt,
  verifyRepetitionReceipt,
} from "./live-runner.ts";
import { invariant } from "./validate.ts";

export type PublicExecutionEvidence = {
  schemaVersion: "conquistador.promptfoo-public-execution-evidence/v1";
  executionId: string;
  generatedAt: string;
  bindingDigest: string;
  candidate: { candidateId: string; sourceCommit: string; sourceTree: string };
  evalCase: { id: string; partition: string; class: string; inputDigest: string };
  providerCell: { id: string; provider: string; model: string; modelVersion: string; promptfooVersion: string; promptfooRuntimeDigest: string };
  counts: {
    plannedRepetitions: 3;
    promptfooProcessResults: number;
    completedCandidateExecutions: number;
    brokenCandidateExecutions: number;
    pendingRepetitions: number;
    humanVerdicts: 0;
  };
  observedCostUsd: number | null;
  observedCostMicroUsd: number | null;
  repetitions: Array<{
    repetition: 1 | 2 | 3;
    status: "inconclusive" | "broken";
    receiptDigest: string;
    traceDigest: string;
    rawResultDigest: string | null;
    outputDigest: string | null;
    observedCostUsd: number | null;
    observedCostMicroUsd: number | null;
  }>;
  redaction: {
    rawOutputsCommitted: false;
    stdoutCommitted: false;
    stderrCommitted: false;
    credentialsCommitted: false;
    privateStateReferencedByDigestOnly: true;
  };
  gates: {
    exts156: "OPEN";
    g2: "INCOMPLETE";
    humanVerdict: "pending";
    releaseEligible: false;
    authority: "none";
  };
  evidenceDigest: string;
};

function json<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

function verifySummary(summary: ExecutionSummary, manifest: PromptfooExecutionManifest, receipts: RepetitionReceipt[]): void {
  invariant(summary.executionMode === "live", "test-fixture execution cannot become public live evidence");
  invariant(receipts.every((receipt) => receipt.executionMode === "live" && receipt.providerCallStarted), "test-fixture receipt cannot become public live evidence");
  const completed = receipts.filter((receipt) => receipt.run.schemaVersion === "conquistador.run/v1").length;
  const broken = receipts.length - completed;
  const observedCosts = receipts.map((receipt) => receipt.observedCostUsd).filter((cost): cost is number => cost !== null);
  const observedCostsMicroUsd = receipts.map((receipt) => receipt.observedCostMicroUsd).filter((cost): cost is number => cost !== null);
  invariant(summary.executionId === manifest.executionId && summary.bindingDigest === manifest.bindingDigest, "execution summary crosses manifest bindings");
  invariant(summary.candidateBuildId === manifest.candidate.candidateId, "execution summary crosses Candidate Builds");
  invariant(summary.caseId === manifest.case.id && summary.providerCellId === manifest.providerCell.id, "execution summary crosses case or provider bindings");
  invariant(receipts.every((receipt) => receipt.promptfooRuntimeDigest === summary.promptfooRuntimeDigest), "execution summary crosses Promptfoo runtime identities");
  invariant(summary.providerCallsStarted === receipts.length, "execution summary process count differs from receipts");
  invariant(summary.completedCandidateExecutions === completed, "execution summary completed count differs from receipts");
  invariant(summary.brokenCandidateExecutions === broken, "execution summary broken count differs from receipts");
  invariant(summary.testFixtureExecutions === 0, "execution summary includes test fixtures");
  invariant(summary.pendingRepetitions === 3 - receipts.length, "execution summary pending count differs from receipts");
  invariant(summary.humanVerdicts === 0 && !summary.releaseEligible && summary.authority === "none", "execution summary claims forbidden authority");
  invariant(canonicalJson(summary.receiptDigests) === canonicalJson(receipts.map((receipt) => receipt.receiptDigest)), "execution summary receipt digests differ");
  const observedCostUsd = observedCosts.length ? observedCosts.reduce((sum, cost) => sum + cost, 0) : null;
  const observedCostMicroUsd = observedCostsMicroUsd.length ? observedCostsMicroUsd.reduce((sum, cost) => sum + cost, 0) : null;
  invariant(summary.observedCostUsd === observedCostUsd, "execution summary observed cost differs from receipts");
  invariant(summary.observedCostMicroUsd === observedCostMicroUsd, "execution summary micro-USD cost differs from receipts");
}

export function exportPublicExecutionEvidence(input: {
  stateDirectory: string;
  ledgerPath: string;
}): PublicExecutionEvidence {
  const stateDirectory = resolve(input.stateDirectory);
  const manifest = json<PromptfooExecutionManifest>(resolve(stateDirectory, "manifest.json"));
  const summary = json<ExecutionSummary>(resolve(stateDirectory, "summary.json"));
  const ledger = json<any>(input.ledgerPath);
  const selected = ledger.candidateSelector?.selectedCandidate;
  invariant(ledger.release?.state === "NO-GO", "public execution evidence cannot weaken release NO-GO");
  invariant(ledger.candidateSelector?.releaseCandidateStatus === "BOUND", "public execution evidence requires a BOUND candidate");
  invariant(
    selected?.candidateId === manifest.candidate.candidateId &&
      selected?.sourceCommit === manifest.candidate.sourceCommit &&
      selected?.sourceTree === manifest.candidate.sourceTree,
    "execution is stale for the currently selected candidate",
  );
  const receipts = ([1, 2, 3] as const).flatMap((repetition) => {
    const path = resolve(stateDirectory, `repetition-${repetition}.json`);
    return existsSync(path) ? [json<RepetitionReceipt>(path)] : [];
  });
  invariant(receipts.length > 0, "no genuine execution receipt exists to export");
  receipts.forEach((receipt) => verifyRepetitionReceipt(receipt, manifest));
  verifySummary(summary, manifest, receipts);
  const finished = receipts.map((receipt) => receipt.run.finishedAt).sort();
  const body = {
    schemaVersion: "conquistador.promptfoo-public-execution-evidence/v1" as const,
    executionId: manifest.executionId,
    generatedAt: finished.at(-1)!,
    bindingDigest: manifest.bindingDigest,
    candidate: {
      candidateId: manifest.candidate.candidateId,
      sourceCommit: manifest.candidate.sourceCommit,
      sourceTree: manifest.candidate.sourceTree,
    },
    evalCase: {
      id: manifest.case.id,
      partition: manifest.case.partition,
      class: manifest.case.class,
      inputDigest: manifest.case.inputDigest,
    },
    providerCell: {
      id: manifest.providerCell.id,
      provider: manifest.providerCell.provider,
      model: manifest.providerCell.model,
      modelVersion: manifest.providerCell.modelVersion,
      promptfooVersion: manifest.harness.promptfooVersion,
      promptfooRuntimeDigest: summary.promptfooRuntimeDigest,
    },
    counts: {
      plannedRepetitions: 3 as const,
      promptfooProcessResults: receipts.length,
      completedCandidateExecutions: summary.completedCandidateExecutions,
      brokenCandidateExecutions: summary.brokenCandidateExecutions,
      pendingRepetitions: summary.pendingRepetitions,
      humanVerdicts: 0 as const,
    },
    observedCostUsd: summary.observedCostUsd,
    observedCostMicroUsd: summary.observedCostMicroUsd,
    repetitions: receipts.map((receipt) => ({
      repetition: receipt.repetition,
      status: receipt.run.status as "inconclusive" | "broken",
      receiptDigest: receipt.receiptDigest,
      traceDigest: receipt.run.traceDigest,
      rawResultDigest: receipt.rawResultDigest,
      outputDigest: receipt.outputDigest,
      observedCostUsd: receipt.observedCostUsd,
      observedCostMicroUsd: receipt.observedCostMicroUsd,
    })),
    redaction: {
      rawOutputsCommitted: false as const,
      stdoutCommitted: false as const,
      stderrCommitted: false as const,
      credentialsCommitted: false as const,
      privateStateReferencedByDigestOnly: true as const,
    },
    gates: {
      exts156: "OPEN" as const,
      g2: "INCOMPLETE" as const,
      humanVerdict: "pending" as const,
      releaseEligible: false as const,
      authority: "none" as const,
    },
  };
  return { ...body, evidenceDigest: digestValue(body) };
}
