import type { Catalog } from "../contracts.ts";
import { adapterFor, boundedId, dispatch, record, result, source, stringInput } from "./common.ts";
import type { ProviderTransport } from "./transport.ts";

const QUERY_KINDS = new Set(["TrendsQuery", "FunnelsQuery", "RetentionQuery"]);

export type PostHogAdapterOptions = { region?: "us" | "eu" };

export function createPostHogAdapter(
  catalog: Catalog,
  transport: ProviderTransport,
  options: PostHogAdapterOptions = {},
) {
  const origin = options.region === "eu" ? "https://eu.posthog.com" : "https://us.posthog.com";
  return adapterFor(catalog, "posthog", {
    "posthog.insight.read": async (request, context) => {
      const projectId = boundedId(stringInput(request, "projectId"), "projectId");
      const insightId = boundedId(stringInput(request, "insightId"), "insightId");
      const path = `/api/projects/${projectId}/insights/${insightId}/`;
      const response = await dispatch(transport, context, {
        provider: "posthog",
        operationId: request.operationId,
        origin,
        method: "GET",
        path,
        authentication: "bearer",
      });
      const body = record(response.body);
      const lastRefresh = body.last_refresh ?? body.last_modified_at ?? body.updated_at;
      if (typeof lastRefresh !== "string" || Number.isNaN(Date.parse(lastRefresh))) {
        throw new Error("PostHog insight freshness is invalid");
      }
      const insightResult = body.result && typeof body.result === "object" && !Array.isArray(body.result)
        ? body.result as Record<string, unknown>
        : { value: body.result ?? null };
      return result(request, response, {
        insight: {
          id: body.id,
          shortId: body.short_id,
          name: body.name,
          description: body.description,
          filters: body.filters,
          query: body.query,
        },
        result: insightResult,
        lastRefresh,
      }, { sourceUrl: source(origin, path), providerResourceId: String(body.id ?? insightId) });
    },

    "posthog.query.run": async (request, context) => {
      const projectId = boundedId(stringInput(request, "projectId"), "projectId");
      const queryKind = stringInput(request, "queryKind");
      if (!QUERY_KINDS.has(queryKind)) throw new Error("PostHog query kind is not allowlisted");
      const queryBody = record(request.input.queryBody, "queryBody");
      if (queryBody.kind !== queryKind || JSON.stringify(queryBody).length > 64_000) {
        throw new Error("PostHog query body must match the allowlisted kind and size");
      }
      const path = `/api/projects/${projectId}/query/`;
      const response = await dispatch(transport, context, {
        provider: "posthog",
        operationId: request.operationId,
        origin,
        method: "POST",
        path,
        body: { query: queryBody },
        authentication: "bearer",
      });
      const body = record(response.body);
      const results = Array.isArray(body.results)
        ? body.results.filter((item) => item && typeof item === "object")
        : [];
      const nextCursor = typeof body.next === "string" && /^[A-Za-z0-9._:-]{1,512}$/.test(body.next)
        ? body.next
        : undefined;
      return result(request, response, {
        results,
        metadata: {
          timings: body.timings,
          hogql: body.hogql,
          columns: body.columns,
          modifiers: body.modifiers,
        },
        ...(nextCursor ? { nextCursor } : {}),
      }, { sourceUrl: source(origin, path), cursor: nextCursor });
    },
  });
}
