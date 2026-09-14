import { describe, expect, it } from "vitest";

import type { AdapterContext, CapabilityRequest } from "../src/contracts.ts";
import {
  ProviderTransportError,
  type ProviderHttpRequest,
  type ProviderHttpResponse,
  type ProviderTransport,
} from "../src/providers/transport.ts";
import {
  createGithubAdapter,
  createGoogleAnalyticsAdapter,
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

class FailingTransport implements ProviderTransport {
  constructor(private readonly error: ProviderTransportError) {}

  async request(_value: ProviderHttpRequest, receivedCredential: unknown): Promise<ProviderHttpResponse> {
    expect(receivedCredential).toBe(credential);
    throw this.error;
  }
}

function response(body: unknown, headers: Record<string, string> = {}): ProviderHttpResponse {
  return { status: 200, headers, body };
}

function context(provider: string): AdapterContext {
  const item = catalog().operations.find((entry) => entry.provider === provider && entry.actionClass !== "prohibited");

  if (!item) throw new Error(`missing ${provider} operation`);

  return {
    connection: connection(provider, item.authScopes),
    credential,
    deadlineAt: "2026-08-12T00:00:00.000Z",
  };
}

function capabilityRequest(id: string, input: Record<string, unknown>): CapabilityRequest {
  return request(operation(id), input);
}

describe("FOR-149 adapter bound failures", () => {
  it("rejects GitHub pagination, window, and state overflow before dispatch", async () => {
    const transport = new FixtureTransport([]);
    const adapter = createGithubAdapter(catalog(), transport);
    const github = context("github");

    await expect(
      adapter.handlers["github.release.list"](
        capabilityRequest("github.release.list", { owner: "forsvn-labs", repository: "conquistador", pageSize: 101 }),
        github,
      ),
    ).rejects.toThrow(/integer from 1 to 100/);
    await expect(
      adapter.handlers["github.signal.aggregate"](
        capabilityRequest("github.signal.aggregate", { owner: "forsvn-labs", repository: "conquistador", windowDays: 366 }),
        github,
      ),
    ).rejects.toThrow(/integer from 1 to 365/);
    await expect(
      adapter.handlers["github.issue.list"](
        capabilityRequest("github.issue.list", { owner: "forsvn-labs", repository: "conquistador", state: "unknown" }),
        github,
      ),
    ).rejects.toThrow(/allowlisted/);
    expect(transport.requests).toHaveLength(0);
  });

  it("projects GitHub rows through the allowlist and drops credential-shaped fields", async () => {
    const transport = new FixtureTransport([
      response({
        id: 1,
        name: "conquistador",
        visibility: "private",
        topics: ["founder"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-08-10T00:00:00Z",
        pushed_at: "2026-08-10T00:00:00Z",
        secret_token: credential,
      }),
    ]);

    const adapter = createGithubAdapter(catalog(), transport);

    const value = await adapter.handlers["github.repository.get"](
      capabilityRequest("github.repository.get", { owner: "forsvn-labs", repository: "conquistador" }),
      context("github"),
    );

    expect(JSON.stringify(value)).not.toContain(credential);
    expect(value.data).toMatchObject({ visibility: "private" });
  });

  it("maps GitHub transport failures without retaining provider bodies", async () => {
    const adapter = createGithubAdapter(catalog(), new FailingTransport(new ProviderTransportError("rate-limit", 429, true, "30")));

    await expect(
      adapter.handlers["github.repository.get"](
        capabilityRequest("github.repository.get", { owner: "a", repository: "b" }),
        context("github"),
      ),
    ).rejects.toMatchObject({ kind: "rate-limit", status: 429, retryAfter: "30" });
  });

  it("enforces Analytics Data and Search Console ceilings before dispatch", async () => {
    const ga = createGoogleAnalyticsAdapter(catalog(), new FixtureTransport([]));
    const sc = createSearchConsoleAdapter(catalog(), new FixtureTransport([]));

    await expect(
      ga.handlers["google-analytics.report.query"](
        capabilityRequest("google-analytics.report.query", {
          propertyId: "1",
          dateRanges: [
            { startDate: "2026-08-01", endDate: "2026-08-02" },
            { startDate: "2026-08-03", endDate: "2026-08-04" },
            { startDate: "2026-08-05", endDate: "2026-08-06" },
            { startDate: "2026-08-07", endDate: "2026-08-08" },
            { startDate: "2026-08-09", endDate: "2026-08-10" },
          ],
          metrics: ["sessions"],
        }),
        context("google-analytics"),
      ),
    ).rejects.toThrow(/1 to 4 ranges/);
    await expect(
      ga.handlers["google-analytics.report.query"](
        capabilityRequest("google-analytics.report.query", {
          propertyId: "1",
          dateRanges: [{ startDate: "2026-08-01", endDate: "2026-08-10" }],
          metrics: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11"],
        }),
        context("google-analytics"),
      ),
    ).rejects.toThrow(/bounded string array/);
    await expect(
      sc.handlers["search-console.analytics.query"](
        capabilityRequest("search-console.analytics.query", {
          siteUrl: "sc-domain:example.com",
          startDate: "2026-08-01",
          endDate: "2026-08-10",
          dimensions: ["not-allowlisted"],
        }),
        context("search-console"),
      ),
    ).rejects.toThrow(/not allowlisted/);
    await expect(
      sc.handlers["search-console.analytics.query"](
        capabilityRequest("search-console.analytics.query", {
          siteUrl: "sc-domain:example.com",
          startDate: "2026-08-01",
          endDate: "2026-08-10",
          startRow: 50_001,
        }),
        context("search-console"),
      ),
    ).rejects.toThrow(/integer from 0 to 50000/);
  });

  it("rejects PostHog HogQL, kind mismatch, and oversized query bodies", async () => {
    const adapter = createPostHogAdapter(catalog(), new FixtureTransport([]), { region: "us" });
    const posthog = context("posthog");

    await expect(
      adapter.handlers["posthog.query.run"](
        capabilityRequest("posthog.query.run", { projectId: "42", queryKind: "HogQLQuery", queryBody: { kind: "HogQLQuery" } }),
        posthog,
      ),
    ).rejects.toThrow(/allowlisted/);
    await expect(
      adapter.handlers["posthog.query.run"](
        capabilityRequest("posthog.query.run", { projectId: "42", queryKind: "TrendsQuery", queryBody: { kind: "FunnelsQuery" } }),
        posthog,
      ),
    ).rejects.toThrow(/allowlisted kind/);
    await expect(
      adapter.handlers["posthog.query.run"](
        capabilityRequest("posthog.query.run", {
          projectId: "42",
          queryKind: "TrendsQuery",
          queryBody: { kind: "TrendsQuery", padding: "x".repeat(64_001) },
        }),
        posthog,
      ),
    ).rejects.toThrow(/size/);
  });

  it("hard-caps Semrush units and columns before any request", async () => {
    const transport = new FixtureTransport([]);
    const adapter = createSemrushAdapter(catalog(), transport);
    const semrush = context("semrush");

    const underBudget = capabilityRequest("semrush.report.query", {
      report: "keyword-metrics",
      database: "US",
      keywords: ["founder"],
    });

    underBudget.maxUnits = 19;
    await expect(adapter.handlers["semrush.report.query"](underBudget, semrush)).rejects.toThrow(/20-unit/);
    await expect(
      adapter.handlers["semrush.report.query"](
        capabilityRequest("semrush.report.query", {
          report: "keyword-metrics",
          database: "US",
          keywords: ["one", "two"],
        }),
        semrush,
      ),
    ).rejects.toThrow(/bounded string array|exactly one bounded keyword/);
    await expect(
      adapter.handlers["semrush.report.query"](
        capabilityRequest("semrush.report.query", {
          report: "keyword-metrics",
          database: "US",
          keywords: ["founder"],
          columns: ["not-a-column"],
        }),
        semrush,
      ),
    ).rejects.toThrow(/not allowlisted/);
    expect(transport.requests).toHaveLength(0);
  });

  it("keeps Typefully draft, schedule, and publish distinct and fail-closed", async () => {
    const transport = new FixtureTransport([
      response({ id: 12, status: "draft", publish_state: "in_progress", private_url: "https://typefully.com/?d=12" }),
      response({ id: 12, status: "draft", publish_state: "in_progress", private_url: "https://typefully.com/?d=12" }),
      response({ id: 12, status: "draft", publish_state: "in_progress", private_url: "https://typefully.com/?d=12" }),
    ]);

    const adapter = createTypefullyAdapter(catalog(), transport, { maximumPublishPolls: 2, wait: async () => {} });
    const typefully = context("typefully");

    const pending = await adapter.handlers["typefully.post.publish"](
      capabilityRequest("typefully.post.publish", { socialSetId: "42", content: "Now", destination: "linkedin" }),
      typefully,
    );

    expect(pending.providerStatus).toBe("pending");
    expect(pending.data).toMatchObject({ status: "publishing", publicUrl: "" });
    expect(pending.unitsUsed).toBe(3);

    const noIdempotency = capabilityRequest("typefully.draft.create", { socialSetId: "42", content: "Draft" });

    delete noIdempotency.idempotencyKey;
    await expect(adapter.handlers["typefully.draft.create"](noIdempotency, typefully)).rejects.toThrow(/idempotency/);
    await expect(
      adapter.handlers["typefully.draft.create"](
        capabilityRequest("typefully.draft.create", {
          socialSetId: "42",
          content: "Draft",
          mediaIds: ["a", "b", "c", "d", "e"],
        }),
        typefully,
      ),
    ).rejects.toThrow(/bounded string array/);
    await expect(
      adapter.handlers["typefully.post.list"](
        capabilityRequest("typefully.post.list", { socialSetId: "42", pageSize: 51 }),
        typefully,
      ),
    ).rejects.toThrow(/integer from 1 to 50/);
    await expect(
      adapter.handlers["typefully.post.schedule"](
        capabilityRequest("typefully.post.schedule", {
          socialSetId: "42",
          content: "Later",
          scheduleAt: "2026-08-12T02:00:00.000Z",
          timezone: "Not/A_Zone",
          destination: "x",
        }),
        typefully,
      ),
    ).rejects.toThrow(/timezone is invalid/);
  });
});
