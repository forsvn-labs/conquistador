export type ProviderId =
  | "github"
  | "google-analytics"
  | "search-console"
  | "posthog"
  | "semrush"
  | "typefully"
  | "openseo";

export type ProviderHttpRequest = {
  provider: ProviderId;
  operationId: string;
  origin: string;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  authentication: "bearer" | "semrush-apikey";
  deadlineAt: string;
  signal?: AbortSignal;
};

export type ProviderHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export interface ProviderTransport {
  request(request: ProviderHttpRequest, credential: unknown): Promise<ProviderHttpResponse>;
}

export type ProviderFailureKind =
  | "rate-limit"
  | "revoked-auth"
  | "timeout"
  | "cancelled"
  | "invalid-response"
  | "provider";

export class ProviderTransportError extends Error {
  readonly kind: ProviderFailureKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfter?: string;
  constructor(
    kind: ProviderFailureKind,
    status?: number,
    retryable = false,
    retryAfter?: string,
  ) {
    super(`provider transport failed (${kind})`);
    this.name = "ProviderTransportError";
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

const ALLOWED_ORIGINS: Record<ProviderId, ReadonlySet<string>> = {
  github: new Set(["https://api.github.com"]),
  "google-analytics": new Set(["https://analyticsdata.googleapis.com"]),
  "search-console": new Set(["https://www.googleapis.com"]),
  posthog: new Set(["https://us.posthog.com", "https://eu.posthog.com"]),
  semrush: new Set(["https://api.semrush.com"]),
  typefully: new Set(["https://api.typefully.com"]),
  openseo: new Set(["https://openseo.so"]),
};

const SAFE_RESPONSE_HEADERS = new Set([
  "date",
  "link",
  "retry-after",
  "x-github-request-id",
  "x-request-id",
  "x-posthog-request-id",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-ratelimit-user-limit",
  "x-ratelimit-user-remaining",
  "x-ratelimit-user-reset",
  "x-ratelimit-socialset-limit",
  "x-ratelimit-socialset-remaining",
  "x-ratelimit-socialset-reset",
]);

function credentialValue(credential: unknown): string {
  if (typeof credential !== "string" || credential.length < 8 || credential.length > 8192) {
    throw new ProviderTransportError("revoked-auth", undefined, false);
  }
  return credential;
}

function validateRequest(request: ProviderHttpRequest): void {
  if (!ALLOWED_ORIGINS[request.provider].has(request.origin)) {
    throw new ProviderTransportError("provider", undefined, false);
  }
  if (
    !request.path.startsWith("/") ||
    request.path.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/u.test(request.path) ||
    request.path.includes("..") ||
    request.path.includes("?") ||
    request.path.includes("#")
  ) {
    throw new ProviderTransportError("provider", undefined, false);
  }
  if (!Number.isFinite(Date.parse(request.deadlineAt))) {
    throw new ProviderTransportError("timeout", undefined, false);
  }
}

function failure(response: Response): ProviderTransportError {
  if (response.status === 401 || response.status === 403) {
    return new ProviderTransportError("revoked-auth", response.status, false);
  }
  if (response.status === 429) {
    return new ProviderTransportError("rate-limit", 429, true, response.headers.get("retry-after") ?? undefined);
  }
  if (response.status === 408 || response.status === 504) {
    return new ProviderTransportError("timeout", response.status, true);
  }
  return new ProviderTransportError("provider", response.status, response.status >= 500);
}

function safeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of headers) {
    const normalized = name.toLowerCase();
    if (SAFE_RESPONSE_HEADERS.has(normalized)) result[normalized] = value;
  }
  return result;
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ProviderTransportError("invalid-response", response.status, false);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ProviderTransportError) throw error;
    throw new ProviderTransportError("provider", response.status, true);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total).toString("utf8");
}

export class FetchProviderTransport implements ProviderTransport {
  private readonly fetcher: typeof fetch;
  private readonly maximumResponseBytes: number;
  constructor(
    fetcher: typeof fetch = fetch,
    maximumResponseBytes = 1_000_000,
  ) {
    this.fetcher = fetcher;
    this.maximumResponseBytes = maximumResponseBytes;
  }

  async request(request: ProviderHttpRequest, credential: unknown): Promise<ProviderHttpResponse> {
    validateRequest(request);
    if (request.signal?.aborted) throw new ProviderTransportError("cancelled", undefined, false);
    const remaining = Date.parse(request.deadlineAt) - Date.now();
    if (remaining <= 0) throw new ProviderTransportError("timeout", undefined, true);

    const url = new URL(request.path, request.origin);
    if (url.origin !== request.origin || url.username || url.password) {
      throw new ProviderTransportError("provider", undefined, false);
    }
    for (const [name, value] of Object.entries(request.query ?? {})) url.searchParams.set(name, value);
    const secret = credentialValue(credential);
    const authorization = request.authentication === "semrush-apikey"
      ? `Apikey ${secret}`
      : `Bearer ${secret}`;
    const signal = AbortSignal.any([
      ...(request.signal ? [request.signal] : []),
      AbortSignal.timeout(Math.min(remaining, 60_000)),
    ]);

    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: request.method,
        headers: {
          accept: "application/json",
          ...(request.body === undefined ? {} : { "content-type": "application/json" }),
          ...request.headers,
          authorization,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        redirect: "error",
        signal,
      });
    } catch (error) {
      if (request.signal?.aborted) throw new ProviderTransportError("cancelled", undefined, false);
      if (error instanceof ProviderTransportError) throw error;
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError" || name === "TimeoutError") {
        throw new ProviderTransportError("timeout", undefined, true);
      }
      throw new ProviderTransportError("provider", undefined, true);
    }
    if (!response.ok) throw failure(response);

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > this.maximumResponseBytes) {
      throw new ProviderTransportError("invalid-response", response.status, false);
    }
    const text = await readBoundedText(response, this.maximumResponseBytes);
    let body: unknown;
    try {
      body = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      throw new ProviderTransportError("invalid-response", response.status, false);
    }
    return { status: response.status, headers: safeHeaders(response.headers), body };
  }
}
