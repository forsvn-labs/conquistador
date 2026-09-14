import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Catalog, ProviderOnboardingRecord, Receipt } from "../src/contracts.ts";
import { sha256 } from "../src/canonical.ts";
import { createReceipt } from "../src/receipt.ts";
import { onboardingDemandDigest, onboardingResearchDigest, promoteProviderOnboarding, transitionProviderOnboardingFailure, validateProviderOnboardingRecord } from "../src/onboarding.ts";
import { candidateBuildId, catalog, root, sha } from "./helpers.ts";

const fixturePath = resolve(root, "fixtures/v1/onboarding/search-console.analytics.query.cataloged.json");

function publicRecord(): ProviderOnboardingRecord {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ProviderOnboardingRecord;
}

function unknownRecord(provider = "future-provider", operationId = "future-provider.signals.read"): ProviderOnboardingRecord {
  const operation: ProviderOnboardingRecord["operation"] = {
    provider,
    operationId,
    capabilityId: "signals.read",
    actionClass: "observe",
    providerApiVersion: "v1",
    authScopes: ["signals.readonly"],
    rateLimit: "provider documented limit",
    quotaUnit: "request",
    monetaryUnit: "USD",
    budget: { mode: "non-metered", maximumUnitsPerRun: null, maximumCostPerRun: null },
  };
  const fields = {
    playbookId: "playbook:content-intelligence-loop",
    playbookVersion: "1.0.0",
    stepId: "pull-signals",
    requestedOutcome: "Pull bounded signals",
    requestedCapability: "signals.read",
    recordedAt: "2026-08-20T00:00:00.000Z",
    ownerRef: "EXTS-194",
  } as const;
  return {
    schemaVersion: "conquistador.provider-onboarding/v1",
    id: `${operationId}.onboarding`,
    maturity: "unknown",
    supportCellId: `${provider}.pending-cell`,
    demand: { ...fields, digest: onboardingDemandDigest(fields, operation) },
    operation,
    supportOwner: "Buildence:Tool-Module",
    nextProofOwner: "Buildence:EXTS-194",
    failure: { state: "none", reasonCodes: [], fallback: "human-action-manifest", retry: { strategy: "none", maximumAttempts: 0, backoff: "none" } },
  };
}

function researched(record = publicRecord()): ProviderOnboardingRecord {
  const researchFields = {
    apiSources: ["https://example.com/api/v1"],
    termsSources: ["https://example.com/terms"],
    authSources: ["https://example.com/auth"],
    checkedAt: "2026-08-20T01:00:00.000Z",
    providerApiVersion: record.operation.providerApiVersion,
  };
  return {
    ...structuredClone(record),
    maturity: "researched",
    research: { ...researchFields, digest: onboardingResearchDigest(researchFields, record.operation) },
  };
}

function fixtureVerified(value: Catalog, record = researched()): ProviderOnboardingRecord {
  const operation = value.operations.find((entry) => entry.id === record.operation.operationId)!;
  const proof = operation.supportCells.find((cell) => cell.id === record.supportCellId)!.evidence.find((entry) => entry.kind === "fixture")!;
  proof.checkedAt = "2026-08-20T01:30:00.000Z";
  return {
    ...structuredClone(record), maturity: "fixture-verified",
    fixtureProof: { fixtureId: proof.id, digest: proof.digest, adapterVersion: proof.adapterVersion, providerVersion: proof.providerVersion, checkedAt: proof.checkedAt },
  };
}

function withLiveCatalog(value = catalog()): Catalog {
  value.status = "candidate-bound";
  const operation = value.operations.find((entry) => entry.id === "search-console.analytics.query")!;
  operation.supportCells[0].evidence.push({
    id: "search-console.analytics.query.live", kind: "live", candidateBuildId,
    providerVersion: operation.providerApiVersion, adapterVersion: "1.0.0",
    checkedAt: "2026-08-20T02:00:00.000Z", digest: sha("b"), terminalReceiptId: "receipt.search-console-live",
  });
  operation.supportCells[0].state = "live-verified";
  return value;
}

function liveVerified(value: Catalog): ProviderOnboardingRecord {
  const base = fixtureVerified(value);
  const receipt = createReceipt({
    schemaVersion: "conquistador.receipt/v1", id: "receipt.search-console-live", candidateBuildId,
    requestId: "request.search-console-live", capabilityId: base.operation.capabilityId,
    operationId: base.operation.operationId, adapterId: "search-console.adapter", adapterVersion: "1.0.0",
    provider: base.operation.provider, actionClass: base.operation.actionClass, requestDigest: sha("c"),
    destinationDigests: [], startedAt: "2026-08-20T01:59:00.000Z", finishedAt: "2026-08-20T02:00:00.000Z",
    status: "succeeded", providerStatus: "succeeded", unitsUsed: 1, costUsed: 0, sourceUrls: [], retryCount: 0,
  });
  return {
    ...base, maturity: "live-verified",
    liveProof: { candidateBuildId, adapterId: "search-console.adapter", adapterVersion: "1.0.0", receipt: receipt as Receipt, supervisorId: "operator-1", authenticatedHuman: true, authenticationMethod: "webauthn", acceptedAt: "2026-08-20T02:05:00.000Z", humanAcceptanceId: "acceptance.live-1" },
  };
}

describe("demand-driven provider onboarding", () => {
  it("validates the public fixture and reproduces its demand digest", () => {
    const record = publicRecord();
    expect(() => validateProviderOnboardingRecord(record, catalog())).not.toThrow();
    const { digest, ...fields } = record.demand;
    expect(onboardingDemandDigest(fields, record.operation)).toBe(digest);
  });

  it("requires exact playbook and step demand even while unknown", () => {
    const record = unknownRecord();
    expect(() => validateProviderOnboardingRecord(record, catalog())).not.toThrow();
    record.demand.stepId = "";
    expect(() => validateProviderOnboardingRecord(record, catalog())).toThrow(/stepId/);
  });

  it("allows unknown before admission but requires an exact catalog snapshot from cataloged onward", () => {
    const record = unknownRecord();
    record.maturity = "cataloged";
    expect(() => validateProviderOnboardingRecord(record, catalog())).toThrow(/exact catalog operation/);
    const admitted = publicRecord();
    admitted.operation.authScopes = ["wrong.scope"];
    const { digest: _digest, ...demand } = admitted.demand;
    admitted.demand.digest = onboardingDemandDigest(demand, admitted.operation);
    expect(() => validateProviderOnboardingRecord(admitted, catalog())).toThrow(/snapshot differs/);
  });

  it("keeps official API, terms, and auth research at researched only", () => {
    const record = researched();
    expect(() => validateProviderOnboardingRecord(record, catalog())).not.toThrow();
    record.maturity = "fixture-verified";
    expect(() => validateProviderOnboardingRecord(record, catalog())).toThrow(/fixtureProof is required at fixture-verified and above/);
    record.maturity = "supported";
    expect(() => validateProviderOnboardingRecord(record, catalog())).toThrow(/fixtureProof is required at fixture-verified and above/);
  });

  it("requires fixture proof matching the exact operation support evidence", () => {
    const value = catalog();
    const record = fixtureVerified(value);
    expect(() => validateProviderOnboardingRecord(record, value)).not.toThrow();
    record.fixtureProof!.digest = sha("d");
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/fixture proof does not match/);
  });

  it("requires an exact candidate-bound succeeded redacted terminal receipt and human supervisor", () => {
    const value = withLiveCatalog();
    const record = liveVerified(value);
    expect(() => validateProviderOnboardingRecord(record, value)).not.toThrow();
    (record.liveProof as unknown as { authenticatedHuman: boolean }).authenticatedHuman = false;
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/authenticated human/);
    record.liveProof!.authenticatedHuman = true;
    record.liveProof!.authenticationMethod = "";
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/authenticationMethod/);
    record.liveProof!.authenticationMethod = "webauthn";
    record.liveProof!.candidateBuildId = "d".repeat(64);
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/receipt differs/);
  });

  it("requires exact release matrix dimensions, human acceptance, and a clear failure state", () => {
    const value = withLiveCatalog();
    const operation = value.operations.find((entry) => entry.id === "search-console.analytics.query")!;
    operation.supportCells[0].state = "supported";
    operation.supportCells[0].platform = "darwin-25.6.0-node-22.23.2";
    operation.supportCells[0].architecture = "arm64";
    operation.supportCells[0].evidence.push({ id: "release.search-console-1", kind: "release-matrix", providerVersion: operation.providerApiVersion, adapterVersion: "1.0.0", checkedAt: "2026-08-20T03:00:00.000Z", digest: sha("e"), humanAcceptanceId: "acceptance.support-1" });
    const record: ProviderOnboardingRecord = {
      ...liveVerified(value), maturity: "supported",
      supportProof: { releaseMatrixId: "release.search-console-1", digest: sha("e"), platform: operation.supportCells[0].platform, architecture: "arm64", checkedAt: "2026-08-20T03:00:00.000Z", acceptedBy: "release-owner", authenticatedHuman: true, authenticationMethod: "webauthn", acceptedAt: "2026-08-20T03:05:00.000Z", humanAcceptanceId: "acceptance.support-1" },
    };
    expect(() => validateProviderOnboardingRecord(record, value)).not.toThrow();
    const releaseEvidence = operation.supportCells[0].evidence.find((entry) => entry.kind === "release-matrix")!;
    record.supportProof!.checkedAt = "2026-08-20T02:00:00.000Z";
    releaseEvidence.checkedAt = record.supportProof!.checkedAt;
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/liveProof.acceptedAt must not be after supportProof.checkedAt/);
    record.supportProof!.checkedAt = "2026-08-20T03:00:00.000Z";
    releaseEvidence.checkedAt = record.supportProof!.checkedAt;
    (record.supportProof as unknown as { authenticatedHuman: boolean }).authenticatedHuman = false;
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/authenticated human/);
    record.supportProof!.authenticatedHuman = true;
    record.failure = { ...record.failure, state: "blocked", reasonCodes: ["provider-unavailable"], evidence: "incident:1", assertedAt: "2026-08-20T03:01:00.000Z" };
    expect(() => validateProviderOnboardingRecord(record, value)).toThrow(/cannot become supported/);
  });

  it("promotes immutably by one step and rejects skips, drift, and premature proof", () => {
    const value = catalog();
    const previous = publicRecord();
    const next = researched(previous);
    const promoted = promoteProviderOnboarding(previous, next, value);
    expect(promoted.maturity).toBe("researched");
    expect(Object.isFrozen(promoted)).toBe(true);
    const skipped = fixtureVerified(value, researched(previous));
    expect(() => promoteProviderOnboarding(previous, skipped, value)).toThrow(/transition/);
    const drifted = researched(previous);
    drifted.supportOwner = "someone-else";
    expect(() => promoteProviderOnboarding(previous, drifted, value)).toThrow(/supportOwner cannot drift/);
    const premature = publicRecord();
    premature.research = researched().research;
    expect(() => validateProviderOnboardingRecord(premature, value)).toThrow(/research may appear only/);
  });

  it("enforces chronological demand, research, fixture, receipt, live acceptance, and support evidence", () => {
    const futureDemand = researched();
    futureDemand.demand.recordedAt = "2026-08-20T01:30:00.000Z";
    const { digest: _digest, ...demandFields } = futureDemand.demand;
    futureDemand.demand.digest = onboardingDemandDigest(demandFields, futureDemand.operation);
    expect(() => validateProviderOnboardingRecord(futureDemand, catalog())).toThrow(/demand.recordedAt must not be after research.checkedAt/);

    const fixtureCatalog = catalog();
    const outOfOrderFixture = fixtureVerified(fixtureCatalog);
    const fixtureEvidence = fixtureCatalog.operations.find((entry) => entry.id === outOfOrderFixture.operation.operationId)!.supportCells[0].evidence.find((entry) => entry.kind === "fixture")!;
    fixtureEvidence.checkedAt = "2026-08-20T00:30:00.000Z";
    outOfOrderFixture.fixtureProof!.checkedAt = fixtureEvidence.checkedAt;
    expect(() => validateProviderOnboardingRecord(outOfOrderFixture, fixtureCatalog)).toThrow(/research.checkedAt must not be after fixtureProof.checkedAt/);

    const liveCatalog = withLiveCatalog();
    const earlyAcceptance = liveVerified(liveCatalog);
    earlyAcceptance.liveProof!.acceptedAt = "2026-08-20T01:59:30.000Z";
    expect(() => validateProviderOnboardingRecord(earlyAcceptance, liveCatalog)).toThrow(/receipt.finishedAt must not be after liveProof.acceptedAt/);
  });

  it("transitions failure state immutably while preserving policy and clears before promotion", () => {
    const value = catalog();
    const clear = publicRecord();
    const blocked: ProviderOnboardingRecord = {
      ...structuredClone(clear),
      failure: {
        ...clear.failure,
        state: "blocked",
        reasonCodes: ["official-research-unavailable"],
        evidence: "issue:EXTS-149",
        assertedAt: "2026-08-20T04:00:00.000Z",
      },
    };
    const asserted = transitionProviderOnboardingFailure(clear, blocked, value);
    expect(asserted.failure.state).toBe("blocked");
    expect(Object.isFrozen(asserted)).toBe(true);
    expect(() => promoteProviderOnboarding(blocked, { ...researched(blocked), failure: structuredClone(blocked.failure) }, value)).toThrow(/cannot promote while failure is asserted/);

    const cleared = transitionProviderOnboardingFailure(blocked, clear, value);
    expect(cleared.failure.state).toBe("none");
    expect(promoteProviderOnboarding(cleared as ProviderOnboardingRecord, researched(clear), value).maturity).toBe("researched");

    const degraded = structuredClone(blocked);
    degraded.failure.state = "degraded";
    expect(transitionProviderOnboardingFailure(clear, degraded, value).failure.state).toBe("degraded");
    expect(transitionProviderOnboardingFailure(degraded, clear, value).failure.state).toBe("none");

    const drifted = structuredClone(blocked);
    drifted.supportOwner = "different-owner";
    expect(() => transitionProviderOnboardingFailure(clear, drifted, value)).toThrow(/cannot drift/);
    const policyDrift = structuredClone(blocked);
    policyDrift.failure.fallback = "fail-closed";
    expect(() => transitionProviderOnboardingFailure(clear, policyDrift, value)).toThrow(/fallback policy cannot drift/);

    const invalidBounded = structuredClone(blocked);
    invalidBounded.failure.retry = { strategy: "bounded", maximumAttempts: 0, backoff: "none" };
    expect(() => validateProviderOnboardingRecord(invalidBounded, value)).toThrow(/bounded retry policy needs positive attempts and backoff/);
  });

  it("uses canonical semantic equality and treats scopes and official source groups as sets", () => {
    const value = catalog();
    const catalogOperation = value.operations.find((entry) => entry.id === "search-console.analytics.query")!;
    catalogOperation.authScopes = ["scope.second", "webmasters.readonly"];
    const previous = publicRecord();
    previous.operation.authScopes = ["webmasters.readonly", "scope.second"];
    const { digest: _digest, ...demandFields } = previous.demand;
    previous.demand.digest = onboardingDemandDigest(demandFields, previous.operation);
    expect(() => validateProviderOnboardingRecord(previous, value)).not.toThrow();

    const next = researched(previous);
    next.operation = { ...next.operation, authScopes: [...next.operation.authScopes].reverse() };
    next.research!.apiSources = ["https://example.com/api/second", ...next.research!.apiSources];
    const { digest: _researchDigest, ...researchFields } = next.research!;
    next.research!.digest = onboardingResearchDigest(researchFields, next.operation);
    const reordered = structuredClone(next);
    reordered.research!.apiSources.reverse();
    const { digest: reorderedDigest, ...reorderedFields } = reordered.research!;
    expect(onboardingResearchDigest(reorderedFields, reordered.operation)).toBe(reorderedDigest);
    expect(promoteProviderOnboarding(previous, reordered, value).maturity).toBe("researched");

    const substituted = structuredClone(previous);
    substituted.operation.authScopes = ["webmasters.readonly", "scope.substituted"];
    const { digest: _old, ...substitutedDemand } = substituted.demand;
    substituted.demand.digest = onboardingDemandDigest(substitutedDemand, substituted.operation);
    expect(() => validateProviderOnboardingRecord(substituted, value)).toThrow(/snapshot differs/);
  });

  it("advances one provider operation independently without an all-provider gate", () => {
    const value = catalog();
    const first = publicRecord();
    const second = unknownRecord("other-provider", "other-provider.signal.read");
    const before = structuredClone(second);
    expect(promoteProviderOnboarding(first, researched(first), value).maturity).toBe("researched");
    expect(second).toEqual(before);
    expect(() => validateProviderOnboardingRecord(second, value)).not.toThrow();
  });

  it("rejects surplus fields, duplicate sources, floating versions, wildcard scopes, and forged demand", () => {
    const record = researched();
    (record as unknown as Record<string, unknown>).allProvidersComplete = true;
    expect(() => validateProviderOnboardingRecord(record, catalog())).toThrow(/undeclared fields/);
    delete (record as unknown as Record<string, unknown>).allProvidersComplete;
    record.research!.termsSources = [...record.research!.apiSources];
    expect(() => validateProviderOnboardingRecord(record, catalog())).toThrow(/research sources must be unique/);
    const unknown = unknownRecord();
    unknown.operation.providerApiVersion = "latest";
    expect(() => validateProviderOnboardingRecord(unknown, catalog())).toThrow(/must not float/);
    unknown.operation.providerApiVersion = "v1";
    unknown.operation.authScopes = ["signals.*"];
    expect(() => validateProviderOnboardingRecord(unknown, catalog())).toThrow(/wildcard/);
    const forged = publicRecord();
    forged.demand.requestedOutcome = "Different outcome";
    expect(() => validateProviderOnboardingRecord(forged, catalog())).toThrow(/demand digest/);
  });
});
