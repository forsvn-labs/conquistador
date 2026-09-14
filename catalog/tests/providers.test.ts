import { describe, expect, it } from "vitest";

import type { AdapterContext, CapabilityRequest } from "../src/contracts.ts";
import {
  ProviderTransportError,
  FetchProviderTransport,
  type ProviderHttpRequest,
  type ProviderHttpResponse,
  type ProviderTransport,
} from "../src/providers/transport.ts";
import {
  createGithubAdapter,
  createGoogleAnalyticsAdapter,
  createOpenseoAdapter,
  createPostHogAdapter,
  createSearchConsoleAdapter,
  createSemrushAdapter,
  createTypefullyAdapter,
} from "../src/providers/index.ts";
import { catalog, connection, operation, request } from "./helpers.ts";

const credential = "opaque-live-secret-material";

class FixtureTransport implements ProviderTransport {
  readonly requests: ProviderHttpRequest[] = [];

  constructor(private readonly responses: ProviderHttpResponse[]) {}

  async request(value: ProviderHttpRequest, receivedCredential: unknown): Promise<ProviderHttpResponse> {
    expect(receivedCredential).toBe(credential);
    this.requests.push(structuredClone({ ...value, signal: undefined }));
    const response = this.responses.shift();
    if (!response) throw new Error("fixture response queue exhausted");
    return response;
  }
}

function response(body: unknown, headers: Record<string, string> = {}): ProviderHttpResponse {
  return { status: 200, headers, body };
}

function context(provider: string): AdapterContext {
  return {
    connection: connection(provider, operationIds(provider).flatMap((id) => operation(id).authScopes)),
    credential,
    deadlineAt: "2026-08-12T00:00:00.000Z",
  };
}

function operationIds(provider: string): string[] {
  return catalog().operations
    .filter((item) => item.provider === provider && item.actionClass !== "prohibited")
    .map((item) => item.id);
}

function capabilityRequest(id: string, input: Record<string, unknown>): CapabilityRequest {
  return request(operation(id), input);
}

describe("seven-provider audited adapter inventory", () => {
  it("implements every non-prohibited frozen v1 operation and no delete", () => {
    const value = catalog();
    const transport = new FixtureTransport([]);
    const adapters = [
      createGithubAdapter(value, transport),
      createGoogleAnalyticsAdapter(value, transport),
      createSearchConsoleAdapter(value, transport),
      createPostHogAdapter(value, transport),
      createSemrushAdapter(value, transport),
      createTypefullyAdapter(value, transport),
      createOpenseoAdapter(value, transport),
    ];
    expect(adapters.flatMap((adapter) => adapter.manifest.operationIds).sort()).toEqual(
      value.operations.filter((item) => item.actionClass !== "prohibited").map((item) => item.id).sort(),
    );
    expect(adapters.flatMap((adapter) => adapter.manifest.operationIds)).not.toContain("typefully.post.delete");
  });
});

describe("GitHub fixtures", () => {
  it("maps repository, bounded release, and bounded issue reads without credential leakage", async () => {
    const transport = new FixtureTransport([
      response({ name: "conquistador", visibility: "private", topics: ["founder"], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-08-10T00:00:00Z", pushed_at: "2026-08-10T00:00:00Z" }, { "x-github-request-id": "gh-1" }),
      response([{ id: 1, tag_name: "v1.0.0" }], { link: "<https://api.github.com/repositories/1/releases?page=3>; rel=\"next\"" }),
      response([{ id: 2, title: "Issue", pull_request: { url: "ignored" } }, { id: 3, title: "Real issue" }], { link: "<https://api.github.com/repositories/1/issues?page=4>; rel=\"next\"" }),
    ]);
    const adapter = createGithubAdapter(catalog(), transport);
    const github = context("github");

    const repository = await adapter.handlers["github.repository.get"](
      capabilityRequest("github.repository.get", { owner: "forsvn-labs", repository: "conquistador" }),
      github,
    );
    const releases = await adapter.handlers["github.release.list"](
      capabilityRequest("github.release.list", { owner: "forsvn-labs", repository: "conquistador", pageSize: 25, cursor: "2" }),
      github,
    );
    const issues = await adapter.handlers["github.issue.list"](
      capabilityRequest("github.issue.list", { owner: "forsvn-labs", repository: "conquistador", state: "open", labels: ["bug"], pageSize: 50, cursor: "3" }),
      github,
    );

    expect(repository.data).toMatchObject({ visibility: "private", topics: ["founder"] });
    expect(releases.data).toMatchObject({ releases: [{ id: 1 }], nextCursor: "3" });
    expect(issues.data).toMatchObject({ issues: [{ id: 3 }], nextCursor: "4" });
    expect(transport.requests.map((item) => [item.method, item.origin, item.path])).toEqual([
      ["GET", "https://api.github.com", "/repos/forsvn-labs/conquistador"],
      ["GET", "https://api.github.com", "/repos/forsvn-labs/conquistador/releases"],
      ["GET", "https://api.github.com", "/repos/forsvn-labs/conquistador/issues"],
    ]);
    expect(JSON.stringify(transport.requests)).not.toContain(credential);
    expect(transport.requests[1].query).toMatchObject({ per_page: "25", page: "2" });
  });

  it("aggregates only bounded issue and release windows", async () => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    const transport = new FixtureTransport([
      response({ stargazers_count: 20, forks_count: 4 }),
      response([{ id: 1 }, { id: 2, pull_request: {} }]),
      response([
        { id: 3, published_at: "2026-08-05T00:00:00.000Z" },
        { id: 4, published_at: "2026-08-04T23:59:59.999Z" },
      ]),
    ]);
    const adapter = createGithubAdapter(catalog(), transport, { now: () => now });
    const value = await adapter.handlers["github.signal.aggregate"](
      capabilityRequest("github.signal.aggregate", { owner: "forsvn-labs", repository: "conquistador", windowDays: 7 }),
      context("github"),
    );
    expect(value.data).toMatchObject({ stars: 20, forks: 4, issues: 1, releases: 1 });
    expect(value.data.window).toEqual({
      start: "2026-08-05T00:00:00.000Z",
      end: "2026-08-12T00:00:00.000Z",
      days: 7,
      issueLimit: 100,
      releaseLimit: 100,
      truncated: false,
    });
    expect(value.unitsUsed).toBe(3);
    expect(transport.requests).toHaveLength(3);
    expect(transport.requests[1].query).toEqual({
      state: "all",
      since: "2026-08-05T00:00:00.000Z",
      per_page: "100",
      page: "1",
    });
    expect(transport.requests[2].query).toEqual({ per_page: "100", page: "1" });
  });
});

describe("Google fixtures", () => {
  it("maps Analytics Data and Search Console pagination with provider ceilings", async () => {
    const gaTransport = new FixtureTransport([
      response({ rows: [{ dimensionValues: [{ value: "/" }], metricValues: [{ value: "12" }] }], rowCount: 3, metadata: { currencyCode: "USD" } }),
    ]);
    const ga = createGoogleAnalyticsAdapter(catalog(), gaTransport);
    const gaResult = await ga.handlers["google-analytics.report.query"](
      capabilityRequest("google-analytics.report.query", { propertyId: "1234", dateRanges: [{ startDate: "2026-08-01", endDate: "2026-08-10" }], dimensions: ["pagePath"], metrics: ["sessions"], limit: 1, offset: 1 }),
      context("google-analytics"),
    );
    expect(gaTransport.requests[0]).toMatchObject({ method: "POST", origin: "https://analyticsdata.googleapis.com", path: "/v1beta/properties/1234:runReport" });
    expect(gaTransport.requests[0].body).toMatchObject({ limit: "1", offset: "1", metrics: [{ name: "sessions" }] });
    expect(gaResult.data).toMatchObject({ rowCount: 3, nextOffset: 2 });

    const scTransport = new FixtureTransport([
      response({ rows: [{ keys: ["query"], clicks: 1 }], responseAggregationType: "byProperty" }),
    ]);
    const sc = createSearchConsoleAdapter(catalog(), scTransport);
    const scResult = await sc.handlers["search-console.analytics.query"](
      capabilityRequest("search-console.analytics.query", { siteUrl: "sc-domain:example.com", startDate: "2026-08-01", endDate: "2026-08-10", dimensions: ["query"], rowLimit: 1, startRow: 10 }),
      context("search-console"),
    );
    expect(scTransport.requests[0]).toMatchObject({ method: "POST", origin: "https://www.googleapis.com", path: "/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query" });
    expect(scResult.data).toMatchObject({ nextStartRow: 11, responseAggregationType: "byProperty" });
  });
});

describe("PostHog fixtures", () => {
  it("reads one insight and permits only allowlisted analytical query kinds", async () => {
    const transport = new FixtureTransport([
      response({ id: 7, name: "Activation", result: { data: [1] }, last_refresh: "2026-08-11T00:00:00Z" }),
      response({ results: [{ count: 3 }], timings: [{ k: "query", t: 0.1 }], next: "cursor-2" }),
    ]);
    const adapter = createPostHogAdapter(catalog(), transport, { region: "eu" });
    const insight = await adapter.handlers["posthog.insight.read"](
      capabilityRequest("posthog.insight.read", { projectId: "42", insightId: "7" }),
      context("posthog"),
    );
    const query = await adapter.handlers["posthog.query.run"](
      capabilityRequest("posthog.query.run", { projectId: "42", queryKind: "TrendsQuery", queryBody: { kind: "TrendsQuery", series: [] } }),
      context("posthog"),
    );
    expect(insight.data).toMatchObject({ lastRefresh: "2026-08-11T00:00:00Z" });
    expect(query.data).toMatchObject({ results: [{ count: 3 }], nextCursor: "cursor-2" });
    expect(transport.requests.map((item) => [item.origin, item.path])).toEqual([
      ["https://eu.posthog.com", "/api/projects/42/insights/7/"],
      ["https://eu.posthog.com", "/api/projects/42/query/"],
    ]);

    await expect(adapter.handlers["posthog.query.run"](
      capabilityRequest("posthog.query.run", { projectId: "42", queryKind: "HogQLQuery", queryBody: { kind: "HogQLQuery", query: "select *" } }),
      context("posthog"),
    )).rejects.toThrow(/allowlisted/);
  });
});

describe("Semrush fixtures", () => {
  it("hard-caps the exact v4 keyword-metrics report before dispatch", async () => {
    const transport = new FixtureTransport([
      response({ meta: { request_id: "sem-1", success: true }, data: { search_volume: "100" } }),
    ]);
    const adapter = createSemrushAdapter(catalog(), transport);
    const value = await adapter.handlers["semrush.report.query"](
      capabilityRequest("semrush.report.query", { report: "keyword-metrics", database: "US", keywords: ["founder marketing"], columns: ["search_volume"], limit: 1, offset: 0 }),
      context("semrush"),
    );
    expect(transport.requests[0]).toMatchObject({ method: "GET", origin: "https://api.semrush.com", path: "/apis/v4/keywords/v1/metrics", query: { keyword: "founder marketing", country: "US", format: "json" } });
    expect(value.data).toMatchObject({ rows: [{ search_volume: "100" }], unitsUsed: 20 });
    expect(value.unitsUsed).toBe(20);

    await expect(adapter.handlers["semrush.report.query"](
      capabilityRequest("semrush.report.query", { report: "domain-organic", database: "US", domain: "example.com", limit: 100 }),
      context("semrush"),
    )).rejects.toThrow(/only keyword-metrics/);
    expect(transport.requests).toHaveLength(1);
  });
});

describe("OpenSEO fixtures", () => {
  it("binds one exact SERP target behind a finite credit ceiling and redacts rows", async () => {
    const transport = new FixtureTransport([
      response({ credits: 2, truncated: false, results: [{ position: 1, url: "https://example.invalid/", title: "Synthetic fixture product", secret_token: "drop-me" }] }, { date: "2026-08-25T00:00:00.000Z" }),
    ]);
    const adapter = createOpenseoAdapter(catalog(), transport);
    const value = await adapter.handlers["openseo.get-serp-results"](
      capabilityRequest("openseo.get-serp-results", { projectId: "fixture-project", target: "https://example.invalid/", locationCode: 2840, languageCode: "en" }),
      context("openseo"),
    );
    expect(transport.requests[0]).toMatchObject({
      method: "POST",
      origin: "https://openseo.so",
      path: "/v1/get_serp_results",
      body: { projectId: "fixture-project", target: "https://example.invalid/", locationCode: 2840, languageCode: "en" },
    });
    expect(value.data).toMatchObject({ results: [{ position: 1, url: "https://example.invalid/" }], creditsUsed: 2, truncated: false });
    expect(value.unitsUsed).toBe(2);
    expect(JSON.stringify(value)).not.toContain("drop-me");
    expect(JSON.stringify(transport.requests)).not.toContain(credential);

    await expect(adapter.handlers["openseo.get-serp-results"](
      { ...capabilityRequest("openseo.get-serp-results", { projectId: "fixture-project", target: "https://example.invalid/", locationCode: 2840, languageCode: "en" }), maxUnits: undefined },
      context("openseo"),
    )).rejects.toThrow(/credit ceiling/);
    expect(transport.requests).toHaveLength(1);

    const overBudget = createOpenseoAdapter(catalog(), new FixtureTransport([response({ credits: 9, results: [] })]));
    await expect(overBudget.handlers["openseo.get-serp-results"](
      capabilityRequest("openseo.get-serp-results", { projectId: "fixture-project", target: "https://example.invalid/", locationCode: 2840, languageCode: "en" }),
      context("openseo"),
    )).rejects.toThrow(/exceed the requested ceiling/);
  });

  it("keeps the owned reads at exactly zero credits and ga4_not_connected a typed unknown", async () => {
    const transport = new FixtureTransport([
      response({ rows: [{ key: "teleg ai", clicks: 0 }], totals: { clicks: 1, impressions: 175 }, truncated: false }),
      response({ rows: [{ landingPage: "/", sessions: 12 }], truncated: false }),
    ]);
    const adapter = createOpenseoAdapter(catalog(), transport);
    const performance = await adapter.handlers["openseo.get-search-console-performance"](
      capabilityRequest("openseo.get-search-console-performance", { projectId: "fixture-project", domain: "example.invalid", startDate: "2026-07-24", endDate: "2026-08-20" }),
      context("openseo"),
    );
    expect(performance.data).toMatchObject({ rows: [{ key: "teleg ai" }], totals: { clicks: 1 } });
    expect(performance.unitsUsed).toBe(0);
    expect(performance.costUsed).toBe(0);

    const landing = await adapter.handlers["openseo.get-google-analytics-organic-landing-pages"](
      capabilityRequest("openseo.get-google-analytics-organic-landing-pages", { projectId: "fixture-project", propertyId: "unbound-ga4-property", startDate: "2026-07-24", endDate: "2026-08-20" }),
      context("openseo"),
    );
    expect(landing.data).toMatchObject({ rows: [{ landingPage: "/" }], truncated: false });
    expect(landing.unitsUsed).toBe(0);
    expect(landing.providerStatus).toBe("succeeded");

    const unknown = createOpenseoAdapter(catalog(), new FixtureTransport([
      response({ code: "ga4_not_connected", retryAfterSeconds: null, rows: [] }),
    ]));
    const typedUnknown = await unknown.handlers["openseo.get-google-analytics-organic-landing-pages"](
      capabilityRequest("openseo.get-google-analytics-organic-landing-pages", { projectId: "fixture-project", propertyId: "unbound-ga4-property", startDate: "2026-07-24", endDate: "2026-08-20" }),
      context("openseo"),
    );
    expect(typedUnknown.data).toMatchObject({ rows: [], typedUnknownCode: "ga4_not_connected" });
    expect(typedUnknown.unitsUsed).toBe(0);
    expect(typedUnknown.providerStatus).toBe("unknown");

    const unlisted = createOpenseoAdapter(catalog(), new FixtureTransport([
      response({ code: "ga4_exploded", rows: [] }),
    ]));
    await expect(unlisted.handlers["openseo.get-google-analytics-organic-landing-pages"](
      capabilityRequest("openseo.get-google-analytics-organic-landing-pages", { projectId: "fixture-project", propertyId: "unbound-ga4-property", startDate: "2026-07-24", endDate: "2026-08-20" }),
      context("openseo"),
    )).rejects.toThrow(/not allowlisted/);

    expect(transport.requests.map((item) => item.path)).toEqual([
      "/v1/get_search_console_performance",
      "/v1/get_google_analytics_organic_landing_pages",
    ]);
    expect(JSON.stringify(transport.requests)).not.toContain(credential);
  });

  it("fails closed on malformed windows and payloads before any result exists", async () => {
    const adapter = createOpenseoAdapter(catalog(), new FixtureTransport([]));
    await expect(adapter.handlers["openseo.get-search-console-performance"](
      capabilityRequest("openseo.get-search-console-performance", { projectId: "fixture-project", domain: "example.invalid", startDate: "2026-08-20", endDate: "2026-07-24" }),
      context("openseo"),
    )).rejects.toThrow(/ascending calendar dates/);
    await expect(adapter.handlers["openseo.get-search-console-performance"](
      capabilityRequest("openseo.get-search-console-performance", { projectId: "fixture-project", domain: "not a hostname", startDate: "2026-07-24", endDate: "2026-08-20" }),
      context("openseo"),
    )).rejects.toThrow(/hostname/);
    const malformed = createOpenseoAdapter(catalog(), new FixtureTransport([response({ rows: "nope" })]));
    await expect(malformed.handlers["openseo.get-search-console-performance"](
      capabilityRequest("openseo.get-search-console-performance", { projectId: "fixture-project", domain: "example.invalid", startDate: "2026-07-24", endDate: "2026-08-20" }),
      context("openseo"),
    )).rejects.toThrow(/rows/);
    const badCredits = createOpenseoAdapter(catalog(), new FixtureTransport([response({ credits: "two", results: [] })]));
    await expect(badCredits.handlers["openseo.get-serp-results"](
      capabilityRequest("openseo.get-serp-results", { projectId: "fixture-project", target: "https://example.invalid/", locationCode: 2840, languageCode: "en" }),
      context("openseo"),
    )).rejects.toThrow(/credit count/);
  });
});

describe("Typefully fixtures", () => {
  it("keeps draft, schedule, and asynchronous publish semantically distinct", async () => {
    const transport = new FixtureTransport([
      response({ id: 10, status: "draft", private_url: "https://typefully.com/?d=10" }),
      response({ id: 11, status: "scheduled", scheduled_date: "2026-08-12T02:00:00Z", private_url: "https://typefully.com/?d=11" }),
      response({ id: 12, status: "draft", publish_state: "in_progress", private_url: "https://typefully.com/?d=12" }),
      response({ id: 12, status: "published", publish_state: "finished", published_at: "2026-08-11T10:00:00Z", linkedin_published_url: "https://linkedin.com/feed/update/12" }),
      response({ results: [{ id: 9, status: "draft" }], count: 3, limit: 1, offset: 1 }),
    ]);
    const adapter = createTypefullyAdapter(catalog(), transport, { maximumPublishPolls: 2, wait: async () => {} });
    const typefully = context("typefully");
    const draft = await adapter.handlers["typefully.draft.create"](
      capabilityRequest("typefully.draft.create", { socialSetId: "42", content: "Review this", mediaIds: ["media-1"] }),
      typefully,
    );
    const scheduled = await adapter.handlers["typefully.post.schedule"](
      capabilityRequest("typefully.post.schedule", { socialSetId: "42", content: "Later", scheduleAt: "2026-08-12T02:00:00.000Z", timezone: "Asia/Ho_Chi_Minh", destination: "x" }),
      typefully,
    );
    const published = await adapter.handlers["typefully.post.publish"](
      capabilityRequest("typefully.post.publish", { socialSetId: "42", content: "Now", destination: "linkedin" }),
      typefully,
    );
    const listed = await adapter.handlers["typefully.post.list"](
      capabilityRequest("typefully.post.list", { socialSetId: "42", status: "draft", pageSize: 1, cursor: "1" }),
      typefully,
    );
    expect(draft).toMatchObject({ providerStatus: "succeeded", data: { draftId: "10", status: "draft" } });
    expect(scheduled).toMatchObject({ providerStatus: "succeeded", data: { postId: "11", status: "scheduled" } });
    expect(published).toMatchObject({ providerStatus: "succeeded", data: { postId: "12", status: "published", publicUrl: "https://linkedin.com/feed/update/12" } });
    expect(published.unitsUsed).toBe(2);
    expect(listed.data).toMatchObject({ posts: [{ id: 9 }], nextCursor: "2" });
    expect(transport.requests.map((item) => item.body && (item.body as Record<string, unknown>).publish_at)).toEqual([undefined, "2026-08-12T02:00:00.000Z", "now", undefined, undefined]);
    expect(JSON.stringify(transport.requests)).not.toContain(credential);
  });
});

describe("transport failures", () => {
  it("rejects malformed upstream payloads before they become capability results", async () => {
    const github = createGithubAdapter(catalog(), new FixtureTransport([response([])]));
    await expect(github.handlers["github.repository.get"](
      capabilityRequest("github.repository.get", { owner: "a", repository: "b" }),
      context("github"),
    )).rejects.toThrow(/object/);

    const ga = createGoogleAnalyticsAdapter(catalog(), new FixtureTransport([
      response({ rows: [], rowCount: "not-a-number", metadata: {} }),
    ]));
    await expect(ga.handlers["google-analytics.report.query"](
      capabilityRequest("google-analytics.report.query", { propertyId: "1", dateRanges: [{ startDate: "2026-08-01", endDate: "2026-08-10" }], metrics: ["sessions"] }),
      context("google-analytics"),
    )).rejects.toThrow(/rowCount/);

    const searchConsole = createSearchConsoleAdapter(catalog(), new FixtureTransport([
      response({ rows: {}, responseAggregationType: "byProperty" }),
    ]));
    await expect(searchConsole.handlers["search-console.analytics.query"](
      capabilityRequest("search-console.analytics.query", { siteUrl: "sc-domain:example.com", startDate: "2026-08-01", endDate: "2026-08-10" }),
      context("search-console"),
    )).rejects.toThrow(/rows/);

    const posthog = createPostHogAdapter(catalog(), new FixtureTransport([response({ id: 1, result: {} })]));
    await expect(posthog.handlers["posthog.insight.read"](
      capabilityRequest("posthog.insight.read", { projectId: "1", insightId: "1" }),
      context("posthog"),
    )).rejects.toThrow(/freshness/);

    const semrush = createSemrushAdapter(catalog(), new FixtureTransport([
      response({ meta: { success: false }, data: {} }),
    ]));
    await expect(semrush.handlers["semrush.report.query"](
      capabilityRequest("semrush.report.query", { report: "keyword-metrics", database: "US", keywords: ["x"] }),
      context("semrush"),
    )).rejects.toThrow(/success/);

    const typefully = createTypefullyAdapter(catalog(), new FixtureTransport([
      response({ id: 1, status: "published", private_url: "https://typefully.com/?d=1" }),
    ]));
    await expect(typefully.handlers["typefully.draft.create"](
      capabilityRequest("typefully.draft.create", { socialSetId: "1", content: "draft" }),
      context("typefully"),
    )).rejects.toThrow(/remain a draft/);
  });

  it("types rate limiting, revoked authorization, timeout, and provider errors without response bodies", () => {
    expect(new ProviderTransportError("rate-limit", 429, true, "30")).toMatchObject({ kind: "rate-limit", status: 429, retryable: true, retryAfter: "30" });
    expect(new ProviderTransportError("revoked-auth", 401, false)).toMatchObject({ kind: "revoked-auth", status: 401, retryable: false });
    expect(new ProviderTransportError("timeout", undefined, true)).toMatchObject({ kind: "timeout", retryable: true });
    expect(new ProviderTransportError("provider", 500, true).message).not.toContain("provider response");
  });

  it("maps live HTTP failures without retaining provider bodies or credentials", async () => {
    const baseRequest: ProviderHttpRequest = {
      provider: "github",
      operationId: "github.repository.get",
      origin: "https://api.github.com",
      method: "GET",
      path: "/repos/forsvn-labs/conquistador",
      authentication: "bearer",
      deadlineAt: "2099-01-01T00:00:00.000Z",
    };
    const fetchResponse = (status: number, headers: Record<string, string> = {}) =>
      (async () => new Response(JSON.stringify({ echoed: credential }), { status, headers })) as typeof fetch;

    await expect(new FetchProviderTransport(fetchResponse(429, { "retry-after": "30" })).request(baseRequest, credential))
      .rejects.toMatchObject({ kind: "rate-limit", status: 429, retryable: true, retryAfter: "30" });
    await expect(new FetchProviderTransport(fetchResponse(401)).request(baseRequest, credential))
      .rejects.toMatchObject({ kind: "revoked-auth", status: 401, retryable: false });
    const providerFailure = await new FetchProviderTransport(fetchResponse(500)).request(baseRequest, credential)
      .catch((error: unknown) => error);
    expect(providerFailure).toMatchObject({ kind: "provider", status: 500, retryable: true });
    expect(JSON.stringify(providerFailure)).not.toContain(credential);

    await expect(new FetchProviderTransport(fetchResponse(200)).request(
      { ...baseRequest, deadlineAt: "2020-01-01T00:00:00.000Z" },
      credential,
    )).rejects.toMatchObject({ kind: "timeout" });
    await expect(new FetchProviderTransport(fetchResponse(200)).request(
      { ...baseRequest, origin: "https://attacker.invalid" },
      credential,
    )).rejects.toMatchObject({ kind: "provider", retryable: false });
    await expect(new FetchProviderTransport(fetchResponse(200), 10).request(baseRequest, credential))
      .rejects.toMatchObject({ kind: "invalid-response", retryable: false });
  });
});
