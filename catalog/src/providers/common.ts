import { defineAdapter } from "../adapter.ts";
import type {
  Adapter,
  AdapterContext,
  CapabilityRequest,
  CapabilityResult,
  Catalog,
} from "../contracts.ts";
import type { ProviderHttpRequest, ProviderHttpResponse, ProviderId, ProviderTransport } from "./transport.ts";

export function adapterFor(
  catalog: Catalog,
  provider: ProviderId,
  handlers: Adapter["handlers"],
): Readonly<Adapter> {
  const operations = catalog.operations.filter(
    (item) => item.provider === provider && item.actionClass !== "prohibited",
  );
  return defineAdapter(
    {
      schemaVersion: "conquistador.adapter-manifest/v1",
      id: `${provider}.adapter`,
      provider,
      version: "1.0.0",
      sdkVersion: "1.0.0",
      operationIds: operations.map((item) => item.id),
      capabilityIds: [...new Set(operations.map((item) => item.capabilityId))],
      credentialInjection: "host-only",
      transport: "audited-adapter-only",
    },
    handlers,
    catalog,
  );
}

export async function dispatch(
  transport: ProviderTransport,
  context: AdapterContext,
  request: Omit<ProviderHttpRequest, "deadlineAt" | "signal">,
): Promise<ProviderHttpResponse> {
  return transport.request(
    { ...request, deadlineAt: context.deadlineAt, signal: context.signal },
    context.credential,
  );
}

export function record(value: unknown, label = "provider response"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

export function records(value: unknown, label = "provider response"): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`${label} must be an object array`);
  }
  return value as Record<string, unknown>[];
}

export function stringInput(request: CapabilityRequest, key: string): string {
  const value = request.input[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}

export function optionalString(request: CapabilityRequest, key: string): string | undefined {
  const value = request.input[key];
  if (value === undefined) return;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}

export function integerInput(
  request: CapabilityRequest,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = request.input[key] ?? fallback;
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

export function stringArray(
  request: CapabilityRequest,
  key: string,
  maximumItems: number,
): string[] | undefined {
  const value = request.input[key];
  if (value === undefined) return;
  if (
    !Array.isArray(value) ||
    value.length > maximumItems ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(`${key} must be a bounded string array`);
  }
  return value as string[];
}

export function boundedId(value: string, label: string): string {
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(value) || value === "." || value === "..") {
    throw new Error(`${label} is not a bounded provider identifier`);
  }
  return value;
}

export function boundedCursor(value: string | undefined, fallback = 1): number {
  if (value === undefined) return fallback;
  if (!/^\d{1,8}$/.test(value)) throw new Error("cursor must be a bounded decimal offset");
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor)) throw new Error("cursor is outside the supported range");
  return cursor;
}

export function header(response: ProviderHttpResponse, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = response.headers[name.toLowerCase()];
    if (value) return value.slice(0, 256);
  }
}

export function result(
  request: CapabilityRequest,
  response: ProviderHttpResponse,
  data: Record<string, unknown>,
  options: {
    sourceUrl: string;
    unitsUsed?: number;
    costUsed?: number;
    providerStatus?: CapabilityResult["providerStatus"];
    complete?: boolean;
    cursor?: string;
    truncated?: boolean;
    providerResourceId?: string;
  },
): CapabilityResult {
  const requestId = header(response, "x-github-request-id", "x-request-id", "x-posthog-request-id");
  const observedDate = header(response, "date");
  // HTTP Date uses IMF-fixdate. Capability results require canonical UTC ISO.
  const freshnessAt = observedDate === undefined ? new Date().toISOString() : new Date(observedDate).toISOString();
  return {
    schemaVersion: "conquistador.capability-result/v1",
    requestId: request.id,
    operationId: request.operationId,
    ...(requestId ? { providerRequestId: requestId } : {}),
    ...(options.providerResourceId ? { providerResourceId: options.providerResourceId } : {}),
    data,
    sourceUrls: [options.sourceUrl],
    freshnessAt,
    pagination: {
      complete: options.complete ?? !options.cursor,
      ...(options.cursor ? { cursor: options.cursor } : {}),
      truncated: options.truncated ?? Boolean(options.cursor),
    },
    unitsUsed: options.unitsUsed ?? 1,
    costUsed: options.costUsed ?? 0,
    providerStatus: options.providerStatus ?? "succeeded",
  };
}

export function source(origin: string, path: string): string {
  return new URL(path, origin).toString();
}
