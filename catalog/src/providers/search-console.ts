import type { Catalog } from "../contracts.ts";
import { adapterFor, dispatch, integerInput, record, result, source, stringArray, stringInput } from "./common.ts";
import type { ProviderTransport } from "./transport.ts";

const ORIGIN = "https://www.googleapis.com";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIMENSIONS = new Set(["country", "date", "device", "hour", "page", "query", "searchAppearance"]);

export function createSearchConsoleAdapter(catalog: Catalog, transport: ProviderTransport) {
  return adapterFor(catalog, "search-console", {
    "search-console.analytics.query": async (request, context) => {
      const siteUrl = stringInput(request, "siteUrl");
      if (!(siteUrl.startsWith("sc-domain:") || /^https:\/\//.test(siteUrl)) || siteUrl.length > 500) {
        throw new Error("siteUrl must be an exact Search Console property");
      }
      const startDate = stringInput(request, "startDate");
      const endDate = stringInput(request, "endDate");
      if (!DATE.test(startDate) || !DATE.test(endDate) || Date.parse(startDate) > Date.parse(endDate)) {
        throw new Error("Search Console dates are invalid");
      }
      const dimensions = stringArray(request, "dimensions", 7) ?? [];
      if (dimensions.some((dimension) => !DIMENSIONS.has(dimension))) throw new Error("Search Console dimension is not allowlisted");
      const rowLimit = integerInput(request, "rowLimit", 1_000, 1, 25_000);
      const startRow = integerInput(request, "startRow", 0, 0, 50_000);
      const path = `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
      const response = await dispatch(transport, context, {
        provider: "search-console",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "POST",
        path,
        body: { startDate, endDate, dimensions, rowLimit, startRow, dataState: "final" },
        authentication: "bearer",
      });
      const body = record(response.body);
      if (body.rows !== undefined && !Array.isArray(body.rows)) throw new Error("Search Console rows are invalid");
      if (typeof body.responseAggregationType !== "string") throw new Error("Search Console aggregation type is invalid");
      const rows = Array.isArray(body.rows) ? body.rows.filter((item) => item && typeof item === "object") : [];
      const nextStartRow = rows.length === rowLimit && startRow + rowLimit < 50_000
        ? startRow + rowLimit
        : undefined;
      return result(request, response, {
        rows,
        responseAggregationType: body.responseAggregationType,
        ...(nextStartRow === undefined ? {} : { nextStartRow }),
      }, {
        sourceUrl: source(ORIGIN, path),
        cursor: nextStartRow === undefined ? undefined : String(nextStartRow),
      });
    },
  });
}
