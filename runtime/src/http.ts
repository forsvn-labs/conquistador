import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { ApiV1 } from "./api.ts";
import { validateConfig } from "./config.ts";
import type { ConquistadorConfig } from "./contracts.ts";
import type {
  HostHumanAuthenticator,
  HumanAuthenticationChallenge,
  TransportAuthentication,
} from "./review-contract.ts";
import {
  canonicalOidcPrincipalId,
  canonicalOidcSubjectBinding,
} from "./principal.ts";
import { sha256 } from "./canonical.ts";

type OidcAuth = Extract<ConquistadorConfig["server"]["auth"], { mode: "oidc" }>;

export type VerifiedOidcIdentity = { issuer: string; subject: string };
export type OidcVerifier = (
  token: string,
  config: OidcAuth,
) => VerifiedOidcIdentity | Promise<VerifiedOidcIdentity>;

export type HttpServerOptions = {
  api: ApiV1;
  config: ConquistadorConfig;
  env?: Record<string, string | undefined>;
  verifyOidc?: OidcVerifier;
  authenticateHumanReview?: (
    challenge: HumanAuthenticationChallenge,
    request: IncomingMessage,
  ) => ReturnType<HostHumanAuthenticator>;
};

class HttpFailure extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpFailure";
    this.status = status;
    this.code = code;
  }
}

function bearerToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  const match = typeof authorization === "string" ? /^Bearer ([^\s]+)$/.exec(authorization) : null;
  if (!match) throw new HttpFailure(401, "unauthenticated", "transport authentication is required");
  return match[1];
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function isLoopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function normalizedAddress(address: string | undefined): string {
  return address?.startsWith("::ffff:") ? address.slice("::ffff:".length) : (address ?? "");
}

function enforceProxyBoundary(request: IncomingMessage, config: ConquistadorConfig): void {
  if (isLoopback(config.server.bind) || config.server.bind === "localhost") return;
  const remote = normalizedAddress(request.socket.remoteAddress);
  const trusted = config.server.trustedProxies.map(normalizedAddress);
  if (!trusted.includes(remote) || request.headers["x-forwarded-proto"] !== "https") {
    throw new HttpFailure(403, "proxy-boundary", "single-node requests require the configured TLS proxy boundary");
  }
}

async function principalFor(
  request: IncomingMessage,
  auth: ConquistadorConfig["server"]["auth"],
  bearerSecret: string | undefined,
  verifyOidc: OidcVerifier | undefined,
): Promise<TransportAuthentication> {
  const verifiedAt = new Date().toISOString();
  if (auth.mode === "local") {
    if (!isLoopback(request.socket.remoteAddress)) {
      throw new HttpFailure(403, "forbidden", "local authentication requires a loopback transport");
    }
    return {
      principalId: "local-operator",
      method: "loopback",
      verifier: "conquistador-http-local",
      verifiedAt,
      subjectBinding: {
        issuer: "conquistador:local",
        subjectDigest: sha256({
          issuer: "conquistador:local",
          subject: "local-operator",
        }),
      },
    };
  }
  const token = bearerToken(request);
  if (auth.mode === "bearer") {
    if (!bearerSecret || !constantTimeEqual(token, bearerSecret)) {
      throw new HttpFailure(401, "unauthenticated", "transport authentication is required");
    }
    return {
      principalId: "bearer-operator",
      method: "bearer-token",
      verifier: "conquistador-http-bearer",
      verifiedAt,
      subjectBinding: {
        issuer: "conquistador:bearer",
        subjectDigest: sha256({
          issuer: "conquistador:bearer",
          subject: "bearer-operator",
        }),
      },
    };
  }
  let identity: VerifiedOidcIdentity;
  try {
    identity = await verifyOidc!(token, auth);
  } catch {
    throw new HttpFailure(401, "unauthenticated", "transport authentication is required");
  }
  if (
    !identity || typeof identity.issuer !== "string" ||
    identity.issuer !== auth.issuer || typeof identity.subject !== "string" ||
    !identity.subject.trim()
  ) {
    throw new HttpFailure(401, "unauthenticated", "transport authentication is required");
  }
  try {
    const subjectBinding = canonicalOidcSubjectBinding(
      identity.issuer,
      identity.subject,
    );
    return {
      principalId: canonicalOidcPrincipalId(identity.issuer, identity.subject),
      method: "oidc",
      verifier: "conquistador-http-oidc",
      verifiedAt,
      subjectBinding,
    };
  } catch {
    throw new HttpFailure(401, "unauthenticated", "transport authentication is required");
  }
}

async function readJson(request: IncomingMessage, bodyBytes: number): Promise<unknown> {
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    const declared = Number(contentLength);
    if (!Number.isInteger(declared) || declared < 0) {
      throw new HttpFailure(400, "invalid", "content-length is invalid");
    }
    if (declared > bodyBytes) throw new HttpFailure(413, "body-too-large", "request body exceeds the configured limit");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > bodyBytes) {
      throw new HttpFailure(413, "body-too-large", "request body exceeds the configured limit");
    }
    chunks.push(bytes);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpFailure(400, "invalid", "request body must be valid JSON");
  }
}

function writeJson(response: ServerResponse, status: number, body: unknown, origin?: string): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
  });
  response.end(payload);
}

function allowedOrigin(request: IncomingMessage, configured: readonly string[]): string | undefined {
  const origin = request.headers.origin;
  if (origin === undefined) return;
  if (typeof origin !== "string" || !configured.includes(origin)) {
    throw new HttpFailure(403, "origin-forbidden", "request origin is not allowed");
  }
  return origin;
}

/**
 * Creates the Conquistador-owned HTTP boundary. The caller owns listen/close and
 * supplies OIDC verification as a replaceable host capability.
 */
export function createHttpServer(options: HttpServerOptions): Server {
  validateConfig(options.config);
  const config = structuredClone(options.config);
  const env = options.env ?? process.env;
  const auth = config.server.auth;
  const bearerSecret = auth.mode === "bearer" ? env[auth.tokenEnv] : undefined;
  if (auth.mode === "bearer" && !bearerSecret) {
    throw new Error(`[conquistador.http] bearer secret is missing from ${auth.tokenEnv}`);
  }
  if (auth.mode === "oidc" && !options.verifyOidc) {
    throw new Error("[conquistador.http] OIDC mode requires a host verifier");
  }

  return createServer(async (request, response) => {
    let origin: string | undefined;
    try {
      if (config.server.auth.mode === "local") {
        const host = request.headers.host;
        if (!host || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/.test(host)) {
          throw new HttpFailure(403, "host-forbidden", "local authentication requires a loopback Host header");
        }
      }
      origin = allowedOrigin(request, config.server.allowedOrigins);
      enforceProxyBoundary(request, config);
      if (request.method === "OPTIONS") {
        const requestedMethod = request.headers["access-control-request-method"];
        if (!origin || !["GET", "POST"].includes(String(requestedMethod))) {
          throw new HttpFailure(403, "origin-forbidden", "CORS preflight is not allowed");
        }
        response.writeHead(204, {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET, POST",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-max-age": "600",
          vary: "Origin",
          "cache-control": "no-store",
        });
        response.end();
        return;
      }
      if (request.method !== "GET" && request.method !== "POST") {
        throw new HttpFailure(405, "method-not-allowed", "only GET and POST are supported");
      }
      const path = request.url ?? "/";
      const pathname = new URL(path, "http://conquistador.invalid").pathname;
      const publicRoute = request.method === "GET" && (pathname === "/health" || pathname === "/ready");
      const authentication = publicRoute
        ? undefined
        : await principalFor(request, auth, bearerSecret, options.verifyOidc);
      const body = request.method === "POST"
        ? await readJson(request, config.limits.bodyBytes)
        : undefined;
      const result = await options.api.handle({
        method: request.method,
        path,
        ...(authentication ? { authentication } : {}),
        ...(authentication && options.authenticateHumanReview
          ? {
            authenticateHumanReview: (
              challenge: HumanAuthenticationChallenge,
            ) => options.authenticateHumanReview!(challenge, request),
          }
          : {}),
        ...(body !== undefined ? { body } : {}),
      });
      writeJson(response, result.status, result.body, origin);
    } catch (error) {
      const failure = error instanceof HttpFailure
        ? error
        : new HttpFailure(500, "internal", "request failed without exposing internal detail");
      writeJson(response, failure.status, { error: { code: failure.code, message: failure.message } }, origin);
    }
  });
}
