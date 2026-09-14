import type { Catalog } from "../contracts.ts";
import { adapterFor, boundedId, dispatch, integerInput, record, records, result, source, stringArray, stringInput } from "./common.ts";
import type { ProviderTransport } from "./transport.ts";

const ORIGIN = "https://analyticsdata.googleapis.com";
const DATE = /^(?:\d{4}-\d{2}-\d{2}|today|yesterday|\d{1,3}daysAgo)$/;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;

export function createGoogleAnalyticsAdapter(catalog: Catalog, transport: ProviderTransport) {
  return adapterFor(catalog, "google-analytics", {
    "google-analytics.report.query": async (request, context) => {
      const propertyId = boundedId(stringInput(request, "propertyId"), "propertyId");
      const dateRanges = records(request.input.dateRanges, "dateRanges").map((range) => {
        if (typeof range.startDate !== "string" || typeof range.endDate !== "string" || !DATE.test(range.startDate) || !DATE.test(range.endDate)) {
          throw new Error("dateRanges must use exact Analytics Data dates");
        }
        return { startDate: range.startDate, endDate: range.endDate };
      });
      if (dateRanges.length < 1 || dateRanges.length > 4) throw new Error("dateRanges must contain 1 to 4 ranges");
      const dimensions = stringArray(request, "dimensions", 9) ?? [];
      const metrics = stringArray(request, "metrics", 10) ?? [];
      if (metrics.length === 0 || [...dimensions, ...metrics].some((name) => !FIELD.test(name))) {
        throw new Error("dimensions and metrics must be bounded Analytics Data fields");
      }
      const limit = integerInput(request, "limit", 1_000, 1, 10_000);
      const offset = integerInput(request, "offset", 0, 0, 1_000_000);
      const path = `/v1beta/properties/${propertyId}:runReport`;
      const response = await dispatch(transport, context, {
        provider: "google-analytics",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "POST",
        path,
        body: {
          dateRanges,
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          limit: String(limit),
          offset: String(offset),
          returnPropertyQuota: true,
        },
        authentication: "bearer",
      });
      const body = record(response.body);
      if (body.rows !== undefined && !Array.isArray(body.rows)) throw new Error("Analytics Data rows are invalid");
      const rows = Array.isArray(body.rows) ? body.rows.filter((item) => item && typeof item === "object") : [];
      const rowCount = Number(body.rowCount ?? rows.length);
      if (!Number.isInteger(rowCount) || rowCount < rows.length) throw new Error("Analytics Data rowCount is invalid");
      const nextOffset = offset + rows.length < rowCount ? offset + rows.length : undefined;
      return result(request, response, {
        rows,
        rowCount,
        metadata: record(body.metadata ?? {}, "metadata"),
        ...(nextOffset !== undefined ? { nextOffset } : {}),
      }, {
        sourceUrl: source(ORIGIN, path),
        cursor: nextOffset === undefined ? undefined : String(nextOffset),
      });
    },
  });
}
