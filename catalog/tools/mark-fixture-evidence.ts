import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { sha256 } from "../src/canonical.ts";
import type { Catalog, OperationContract, SupportEvidence } from "../src/contracts.ts";
import { FOR_149_LIVE_REOPEN } from "../src/six-provider-matrix.ts";

type Fixtures = {
  checkedAt: string;
  adapterVersion: string;
  platform: string;
  architecture: string;
  suite: string;
  globalAssertions: string[];
  operations: { id: string; assertions: string[] }[];
};

const root = resolve(import.meta.dirname, "..");
const catalogPath = resolve(root, "operations/v1.json");
const fixtures = JSON.parse(
  readFileSync(resolve(root, "fixtures/v1/conformance.json"), "utf8"),
) as Fixtures;
const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;

function fixtureEvidence(operation: OperationContract): SupportEvidence {
  const fixture = fixtures.operations.find((item) => item.id === operation.id);
  if (!fixture) throw new Error(`missing fixture definition for ${operation.id}`);
  return {
    id: `${operation.id}.fixture`,
    kind: "fixture",
    providerVersion: operation.providerApiVersion,
    adapterVersion: fixtures.adapterVersion,
    checkedAt: fixtures.checkedAt,
    digest: sha256({
      operationId: operation.id,
      providerVersion: operation.providerApiVersion,
      adapterVersion: fixtures.adapterVersion,
      checkedAt: fixtures.checkedAt,
      suite: fixtures.suite,
      assertions: [...fixtures.globalAssertions, ...fixture.assertions],
    }),
  };
}

const openseoEvidenceGaps: Record<string, string> = {
  "openseo.get-serp-results": "paid live proof unrun; requires explicit provider/spend approval from the operator",
  "openseo.get-search-console-performance": "operation-level evidence promotion incomplete; candidate-bound live proof is absent",
  "openseo.get-google-analytics-organic-landing-pages": "ga4_not_connected is a typed unknown, not success or live proof; candidate-bound live success is absent",
};

for (const operation of catalog.operations) {
  operation.retry = "no automatic retry; expose typed retryability and bounded Retry-After guidance";
  operation.supportCells = operation.supportCells.map((cell) => ({
    ...cell,
    evidence: cell.evidence.map((evidence) => evidence.kind === "research"
      ? {
          ...evidence,
          digest: sha256({
            operationId: operation.id,
            officialSources: operation.officialSources,
            checkedAt: operation.checkedAt,
            providerApiVersion: operation.providerApiVersion,
            provenance: operation.provenance,
          }),
        }
      : evidence),
  }));
  if (operation.actionClass === "prohibited") {
    operation.knownGaps = [
      "intentionally prohibited: delete has no adapter, fixture promotion, live proof, or support path",
      "support claim forbidden",
    ];
    continue;
  }
  if (!fixtures.operations.some((item) => item.id === operation.id)) {
    operation.knownGaps = [
      "no fixture suite bound yet; cell stays below fixture-verified",
      "candidate-bound live evidence pending",
      ...(operation.id === "openseo.get-serp-results" ? [openseoEvidenceGaps[operation.id]] : []),
      ...(operation.id === "openseo.get-search-console-performance" ? [openseoEvidenceGaps[operation.id]] : []),
      ...(operation.id === "openseo.get-google-analytics-organic-landing-pages" ? [openseoEvidenceGaps[operation.id]] : []),
      "support claim forbidden",
    ];
    continue;
  }
  const fixture = fixtureEvidence(operation);
  operation.supportCells = operation.supportCells.map((cell) => ({
    ...cell,
    platform: fixtures.platform,
    architecture: fixtures.architecture,
    state: "fixture-verified",
    evidence: [...cell.evidence.filter((item) => item.kind !== "fixture"), fixture],
  }));
  operation.knownGaps = [
    "candidate-bound live evidence pending",
    ...(operation.provider === "openseo" && openseoEvidenceGaps[operation.id] ? [openseoEvidenceGaps[operation.id]] : []),
    ...(operation.provider !== "openseo" ? [FOR_149_LIVE_REOPEN] : []),
    "support claim forbidden",
    ...(operation.provider === "github"
      ? ["1.0.0 remains pinned to GitHub REST 2022-11-28; newer provider versions require a new evidence cell"]
      : []),
    ...(operation.id === "posthog.query.run"
      ? ["1.0.0 query allowlist excludes HogQLQuery and every unlisted query kind"]
      : []),
    ...(operation.id === "semrush.report.query"
      ? ["1.0.0 report allowlist is keyword-metrics only at exactly 20 API units per request"]
      : []),
    ...(operation.id === "typefully.draft.create"
      ? ["1.0.0 external draft creation targets X because the frozen input contract has no destination field"]
      : []),
  ];
}

const rendered = `${JSON.stringify(catalog, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (rendered !== readFileSync(catalogPath, "utf8")) {
    throw new Error("fixture evidence is stale; run npm run fixtures:mark");
  }
  console.log(`fixture evidence check: ${fixtures.operations.length} operations bound; no live or support promotion`);
} else {
  writeFileSync(catalogPath, rendered);
}
