import type { Catalog } from "../contracts.ts";
import { adapterFor, dispatch, integerInput, record, result, source, stringArray, stringInput } from "./common.ts";
import type { ProviderTransport } from "./transport.ts";

const ORIGIN = "https://api.semrush.com";
const PATH = "/apis/v4/keywords/v1/metrics";
const UNITS = 20;
const FIELDS = new Set([
  "competitive_density",
  "cpc",
  "intents",
  "keyword_difficulty",
  "number_of_results",
  "search_volume",
  "serp_features",
  "trends",
]);

export function createSemrushAdapter(catalog: Catalog, transport: ProviderTransport) {
  return adapterFor(catalog, "semrush", {
    "semrush.report.query": async (request, context) => {
      if (stringInput(request, "report") !== "keyword-metrics") {
        throw new Error("Semrush v4 only keyword-metrics is allowlisted in 1.0.0");
      }
      const country = stringInput(request, "database").toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) throw new Error("database must be a two-letter country code");
      const keywords = stringArray(request, "keywords", 1) ?? [];
      if (keywords.length !== 1 || keywords[0].length > 255) throw new Error("keyword-metrics requires exactly one bounded keyword");
      const columns = stringArray(request, "columns", 8) ?? [...FIELDS];
      if (columns.some((column) => !FIELDS.has(column))) throw new Error("Semrush column is not allowlisted");
      if (request.input.domain !== undefined) throw new Error("keyword-metrics does not accept domain");
      if (integerInput(request, "limit", 1, 1, 1) !== 1 || integerInput(request, "offset", 0, 0, 0) !== 0) {
        throw new Error("keyword-metrics is a single bounded report");
      }
      if (typeof request.maxUnits !== "number" || request.maxUnits < UNITS) {
        throw new Error("Semrush unit ceiling is below the exact 20-unit request price");
      }
      const response = await dispatch(transport, context, {
        provider: "semrush",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "GET",
        path: PATH,
        query: { keyword: keywords[0], country, format: "json" },
        authentication: "semrush-apikey",
      });
      const body = record(response.body);
      const meta = record(body.meta ?? {}, "Semrush metadata");
      if (meta.success !== true) throw new Error("Semrush response did not report success");
      const data = record(body.data, "Semrush data");
      const row = Object.fromEntries(columns.map((column) => [column, data[column]]));
      return result(request, response, { rows: [row], unitsUsed: UNITS }, {
        sourceUrl: source(ORIGIN, PATH),
        unitsUsed: UNITS,
        providerResourceId: typeof meta.request_id === "string" ? meta.request_id : undefined,
      });
    },
  });
}
