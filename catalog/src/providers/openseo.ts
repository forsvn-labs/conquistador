import type { Catalog } from "../contracts.ts";
import { adapterFor, boundedId, dispatch, record, records, result, source, stringInput } from "./common.ts";
import type { ProviderTransport } from "./transport.ts";

const ORIGIN = "https://openseo.so";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPED_UNKNOWN_CODES = new Set(["ga4_not_connected"]);
const SERP_ROW_KEYS = new Set(["description", "position", "title", "type", "url"]);
const SECRET_KEY = /(?:authorization|api[-_]?key|token|password|secret|cookie|credential)/i;

function redact(value: unknown): Record<string, unknown> {
  const row = record(value);
  return Object.fromEntries(
    Object.entries(row)
      .filter(([name]) => !SECRET_KEY.test(name))
      .map(([name, child]) => [name, child && typeof child === "object" && !Array.isArray(child) ? redact(child) : child]),
  );
}

function dateWindow(request: Parameters<typeof stringInput>[0]): { startDate: string; endDate: string } {
  const startDate = stringInput(request, "startDate");
  const endDate = stringInput(request, "endDate");
  if (!DATE.test(startDate) || !DATE.test(endDate) || Date.parse(startDate) > Date.parse(endDate)) {
    throw new Error("date window must be two exact ascending calendar dates");
  }
  return { startDate, endDate };
}

function positiveInteger(request: Parameters<typeof stringInput>[0], key: string): number {
  const value = request.input[key];
  if (!Number.isInteger(value) || (value as number) <= 0) throw new Error(`${key} must be a positive integer`);
  return value as number;
}

export function createOpenseoAdapter(catalog: Catalog, transport: ProviderTransport) {
  return adapterFor(catalog, "openseo", {
    "openseo.get-serp-results": async (request, context) => {
      const projectId = boundedId(stringInput(request, "projectId"), "projectId");
      const target = stringInput(request, "target");
      if (target.length > 2048 || /\s/.test(target)) throw new Error("target must be one bounded URL or domain");
      const locationCode = positiveInteger(request, "locationCode");
      const languageCode = stringInput(request, "languageCode");
      if (!/^[A-Za-z-]{2,10}$/.test(languageCode)) throw new Error("languageCode must be a bounded language code");
      if (typeof request.maxUnits !== "number" || !Number.isInteger(request.maxUnits) || request.maxUnits <= 0) {
        throw new Error("SERP reads require an explicit finite positive integer OpenSEO credit ceiling before dispatch");
      }
      const ceiling = request.maxUnits;
      const response = await dispatch(transport, context, {
        provider: "openseo",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "POST",
        path: "/v1/get_serp_results",
        body: { projectId, target, locationCode, languageCode },
        authentication: "bearer",
      });
      const body = record(response.body);
      const creditsUsed = body.credits;
      if (typeof creditsUsed !== "number" || !Number.isInteger(creditsUsed) || creditsUsed < 0) {
        throw new Error("OpenSEO response did not report an exact non-negative credit count");
      }
      if (creditsUsed > ceiling) {
        throw new Error(`OpenSEO credits ${creditsUsed} exceed the requested ceiling ${ceiling}`);
      }
      const rows = records(body.results ?? [], "OpenSEO SERP results").map(redact).slice(0, 100);
      return result(request, response, {
        results: rows,
        creditsUsed,
        truncated: body.truncated === true,
      }, {
        sourceUrl: source(ORIGIN, "/v1/get_serp_results"),
        unitsUsed: creditsUsed,
        truncated: body.truncated === true,
      });
    },
    "openseo.get-search-console-performance": async (request, context) => {
      const projectId = boundedId(stringInput(request, "projectId"), "projectId");
      const domain = stringInput(request, "domain");
      if (!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(domain) || domain.includes("..")) {
        throw new Error("domain must be one bounded hostname");
      }
      const window_ = dateWindow(request);
      const response = await dispatch(transport, context, {
        provider: "openseo",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "POST",
        path: "/v1/get_search_console_performance",
        body: { projectId, domain, ...window_ },
        authentication: "bearer",
      });
      const body = record(response.body);
      const rows = records(body.rows ?? [], "OpenSEO Search Console rows").map(redact).slice(0, 1000);
      return result(request, response, {
        rows,
        totals: record(body.totals ?? {}, "OpenSEO Search Console totals"),
        truncated: body.truncated === true,
      }, {
        sourceUrl: source(ORIGIN, "/v1/get_search_console_performance"),
        unitsUsed: 0,
        costUsed: 0,
      });
    },
    "openseo.get-google-analytics-organic-landing-pages": async (request, context) => {
      const projectId = boundedId(stringInput(request, "projectId"), "projectId");
      const propertyId = boundedId(stringInput(request, "propertyId"), "propertyId");
      const window_ = dateWindow(request);
      const response = await dispatch(transport, context, {
        provider: "openseo",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "POST",
        path: "/v1/get_google_analytics_organic_landing_pages",
        body: { projectId, propertyId, ...window_ },
        authentication: "bearer",
      });
      const body = record(response.body);
      if (typeof body.code === "string") {
        if (!TYPED_UNKNOWN_CODES.has(body.code)) throw new Error("OpenSEO typed unknown code is not allowlisted");
        return result(request, response, {
          rows: [],
          typedUnknownCode: body.code,
          truncated: false,
        }, {
          sourceUrl: source(ORIGIN, "/v1/get_google_analytics_organic_landing_pages"),
          unitsUsed: 0,
          costUsed: 0,
          providerStatus: "unknown",
        });
      }
      const rows = records(body.rows ?? [], "OpenSEO GA landing-page rows").map(redact).slice(0, 1000);
      return result(request, response, {
        rows,
        truncated: body.truncated === true,
      }, {
        sourceUrl: source(ORIGIN, "/v1/get_google_analytics_organic_landing_pages"),
        unitsUsed: 0,
        costUsed: 0,
      });
    },
  });
}
