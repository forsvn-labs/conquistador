import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { Gateway } from "../src/gateway.ts";
import type { Adapter, Catalog, OperationContract } from "../src/contracts.ts";
import {
  createGithubAdapter,
  createGoogleAnalyticsAdapter,
  createPostHogAdapter,
  createSearchConsoleAdapter,
  createSemrushAdapter,
  createTypefullyAdapter,
} from "../src/providers/index.ts";
import type { ProviderHttpRequest, ProviderHttpResponse, ProviderTransport } from "../src/providers/transport.ts";
import {
  FOR_149_LIVE_REOPEN,
  FOR_149_OPERATION_COUNT,
  FOR_149_PROHIBITED_OPERATION_ID,
  FOR_149_PROVIDER_IDS,
  assertNoLiveOrSupportPromotion,
  buildSixProviderMatrix,
  sixProviderOperations,
} from "../src/six-provider-matrix.ts";
import { catalog, connection, request, root } from "./helpers.ts";

class ExhaustedTransport implements ProviderTransport {
  async request(_value: ProviderHttpRequest, _credential: unknown): Promise<ProviderHttpResponse> {
    throw new Error("ordinary gateway must fail closed before provider dispatch");
  }
}

function sixProviderAdapters(value: Catalog, transport: ProviderTransport): Adapter[] {
  return [
    createGithubAdapter(value, transport),
    createGoogleAnalyticsAdapter(value, transport),
    createSearchConsoleAdapter(value, transport),
    createPostHogAdapter(value, transport),
    createSemrushAdapter(value, transport),
    createTypefullyAdapter(value, transport),
  ];
}

function implementedOperationIds(value: Catalog): string[] {
  const ids: string[] = [];

  for (const adapter of sixProviderAdapters(value, new ExhaustedTransport())) {
    for (const operationId of adapter.manifest.operationIds) ids.push(operationId);
  }

  ids.sort();

  return ids;
}

function sampleInput(item: OperationContract) {
  switch (item.id) {
    case "github.repository.get":
    case "github.release.list":
    case "github.issue.list":
      return { owner: "forsvn-labs", repository: "conquistador" };
    case "github.signal.aggregate":
      return { owner: "forsvn-labs", repository: "conquistador", windowDays: 7 };
    case "google-analytics.report.query":
      return {
        propertyId: "1234",
        dateRanges: [{ startDate: "2026-08-01", endDate: "2026-08-10" }],
        metrics: ["sessions"],
      };
    case "search-console.analytics.query":
      return { siteUrl: "sc-domain:example.com", startDate: "2026-08-01", endDate: "2026-08-10" };
    case "posthog.insight.read":
      return { projectId: "42", insightId: "7" };
    case "posthog.query.run":
      return { projectId: "42", queryKind: "TrendsQuery", queryBody: { kind: "TrendsQuery" } };
    case "semrush.report.query":
      return { report: "keyword-metrics", database: "US", keywords: ["founder"] };
    case "typefully.post.list":
      return { socialSetId: "42" };
    case "typefully.draft.create":
      return { socialSetId: "42", content: "Draft only" };
    case "typefully.post.schedule":
      return {
        socialSetId: "42",
        content: "Later",
        scheduleAt: "2026-08-12T02:00:00.000Z",
        timezone: "UTC",
        destination: "x",
      };
    case "typefully.post.publish":
      return { socialSetId: "42", content: "Now", destination: "x" };
    case "typefully.post.delete":
      return { postId: "9" };
    default:
      throw new Error(`missing sample input for ${item.id}`);
  }
}

function gatewayFor(item: OperationContract): Gateway {
  const value = catalog();
  const adapters = sixProviderAdapters(value, new ExhaustedTransport());
  const selected = adapters.find((adapter) => adapter.manifest.provider === item.provider);

  if (!selected) throw new Error(`missing adapter for ${item.provider}`);

  const reference = connection(item.provider, item.authScopes);

  return new Gateway({
    catalog: value,
    adapters: { [selected.manifest.id]: selected },
    connections: { [reference.id]: reference },
    resolveConnection: async () => {
      throw new Error("must not resolve a host connection for an unsupported cell");
    },
  });
}

describe("FOR-149 six-provider honest matrix", () => {
  it("records fixture-verified code-owned cells without live or support promotion", () => {
    const value = catalog();
    const matrix = buildSixProviderMatrix(value);

    expect(matrix.issue).toBe("FOR-149");
    expect(matrix.catalogStatus).toBe("candidate-operations-not-supported");
    expect(matrix.liveProofStatus).toBe("deferred-missing-hung-credentials");
    expect(matrix.supportClaimStatus).toBe("none-claimed");
    expect(matrix.reopenLiveWhen).toBe(FOR_149_LIVE_REOPEN);
    expect(matrix.operations).toHaveLength(FOR_149_OPERATION_COUNT);
    expect(new Set(matrix.operations.map((cell) => cell.provider))).toEqual(new Set(FOR_149_PROVIDER_IDS));
    expect(matrix.operations.filter((cell) => cell.actionClass === "prohibited")).toEqual([
      expect.objectContaining({
        operationId: FOR_149_PROHIBITED_OPERATION_ID,
        catalogStage: "researched",
        ordinaryGatewayAvailability: "prohibited",
        liveProof: "not-run",
        supportClaim: "forbidden",
      }),
    ]);
    expect(matrix.operations.every((cell) => cell.liveProof === "not-run" && cell.supportClaim === "forbidden")).toBe(true);
    expect(
      matrix.operations
        .filter((cell) => cell.actionClass !== "prohibited")
        .every((cell) => cell.catalogStage === "fixture-verified" && cell.ordinaryGatewayAvailability === "unsupported"),
    ).toBe(true);
    assertNoLiveOrSupportPromotion(value.operations);
  });

  it("matches the committed matrix fixture", () => {
    const rendered = `${JSON.stringify(buildSixProviderMatrix(catalog()), null, 2)}\n`;
    const committed = readFileSync(resolve(root, "fixtures/v1/six-provider-matrix-v1.json"), "utf8");

    expect(rendered).toBe(committed);
  });

  it("implements every non-prohibited frozen operation and omits delete", () => {
    const value = catalog();

    const expected = sixProviderOperations(value.operations)
      .filter((item) => item.actionClass !== "prohibited")
      .map((item) => item.id)
      .sort();

    const implemented = implementedOperationIds(value);

    expect(implemented).toEqual(expected);
    expect(implemented).not.toContain(FOR_149_PROHIBITED_OPERATION_ID);
  });

  it("keeps unproved operations unavailable on the ordinary gateway", async () => {
    const value = catalog();

    for (const item of sixProviderOperations(value.operations)) {
      if (item.actionClass === "prohibited") {
        const adapters = sixProviderAdapters(value, new ExhaustedTransport());
        const typefully = adapters.find((adapter) => adapter.manifest.provider === "typefully");

        if (!typefully) throw new Error("missing Typefully adapter");

        const reference = connection("typefully", item.authScopes);

        const gateway = new Gateway({
          catalog: value,
          adapters: { [typefully.manifest.id]: typefully },
          connections: { [reference.id]: reference },
          resolveConnection: async () => {
            throw new Error("must not resolve a prohibited operation");
          },
        });

        const outcome = await gateway.execute(request(item, sampleInput(item)));

        expect(outcome.ok).toBe(false);
        expect(outcome.error?.code).toBe("prohibited");
        continue;
      }

      const outcome = await gatewayFor(item).execute(request(item, sampleInput(item)));

      expect(outcome.ok, `${item.id} should fail closed`).toBe(false);
      expect(outcome.error?.code, `${item.id}: ${outcome.error?.message ?? "no error"}`).toBe("unsupported");
    }
  });
});
