import type {
  AuthenticatedReviewVerdictRequest,
  ReviewVerdictRequest,
  RuntimeEvent,
} from "./contracts.ts";
import { RuntimeFailure, type SessionView } from "./runtime.ts";
import type {
  ActionAuthorizationV1,
  HostHumanAuthenticator,
  ReviewPacketV1,
  ReviewVerdictV1,
  TransportAuthentication,
} from "./review-contract.ts";

export type SessionRuntime = {
  createSession(input: { principalId: string }): Readonly<SessionView>;
  sendMessage(
    sessionId: string,
    message: { id: string; content: string; principalId: string },
  ): Promise<ReviewPacketV1>;
  events(
    sessionId: string,
    after: number,
    principalId: string,
  ): ReadonlyArray<Readonly<RuntimeEvent>>;
  cancel(sessionId: string, principalId: string): void;
  decideReview(
    sessionId: string,
    reviewPacketId: string,
    request: AuthenticatedReviewVerdictRequest,
  ): Promise<Readonly<ReviewVerdictV1>>;
  reviewVerdict(
    sessionId: string,
    principalId: string,
  ): Readonly<ReviewVerdictV1> | undefined;
  listArtifacts?(sessionId: string, principalId: string): Record<string, unknown>;
  readArtifact?(sessionId: string, artifactId: string, principalId: string): Record<string, unknown>;
  actionState?(sessionId: string, principalId: string): Record<string, unknown>;
  authorizeAction?(sessionId: string, packetId: string, request: Omit<AuthenticatedReviewVerdictRequest, "outcome">): Promise<Readonly<ActionAuthorizationV1>>;
  importActionReceipt?(sessionId: string, receipt: unknown, request: Pick<AuthenticatedReviewVerdictRequest, "transport" | "authenticateHuman">): Promise<Record<string, unknown>>;
  ready(): boolean;
};

export type ApiRequest = {
  method: "GET" | "POST";
  path: string;
  authentication?: TransportAuthentication;
  authenticateHumanReview?: HostHumanAuthenticator;
  body?: unknown;
};

export type ApiResponse = { status: number; body: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function exactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((key) => !fields.includes(key))
  ) throw new RuntimeFailure("invalid", `${label} fields are not closed`);
}

function errorStatus(error: RuntimeFailure): number {
  return ({
    invalid: 400,
    "not-found": 404,
    forbidden: 403,
    conflict: 409,
    cancelled: 409,
    "deadline-exceeded": 504,
    "provider-failure": 502,
  } as const)[error.code];
}

export class ApiV1 {
  readonly #runtime: SessionRuntime;

  constructor(runtime: SessionRuntime) {
    this.#runtime = runtime;
  }

  async handle(request: ApiRequest): Promise<ApiResponse> {
    const parsed = new URL(request.path, "http://conquistador.invalid");
    if (request.method === "GET" && parsed.pathname === "/health") {
      return { status: 200, body: { status: "ok", version: "1.0.0" } };
    }
    if (request.method === "GET" && parsed.pathname === "/ready") {
      if (!this.#runtime.ready()) {
        return { status: 503, body: { status: "stopping", protocol: "v1" } };
      }
      return { status: 200, body: { status: "ready", protocol: "v1" } };
    }
    if (!request.authentication) {
      return { status: 401, body: { error: { code: "unauthenticated", message: "transport authentication is required" } } };
    }
    const principalId = request.authentication.principalId;
    const body = record(request.body);
    try {
      if (request.method === "POST" && parsed.pathname === "/api/v1/sessions") {
        const session = this.#runtime.createSession({ principalId });
        return { status: 201, body: session };
      }

      const messageMatch = /^\/api\/v1\/sessions\/([^/]+)\/messages$/.exec(parsed.pathname);
      if (request.method === "POST" && messageMatch) {
        if (typeof body.id !== "string" || typeof body.content !== "string") {
          throw new RuntimeFailure("invalid", "message id and content are required");
        }
        const reviewPacket = await this.#runtime.sendMessage(messageMatch[1], {
          id: body.id,
          content: body.content,
          principalId,
        });
        return { status: 202, body: { reviewPacket } };
      }

      const eventsMatch = /^\/api\/v1\/sessions\/([^/]+)\/events$/.exec(parsed.pathname);
      if (request.method === "GET" && eventsMatch) {
        const after = Number(parsed.searchParams.get("after") ?? "0");
        return { status: 200, body: { events: this.#runtime.events(eventsMatch[1], after, principalId) } };
      }

      const cancelMatch = /^\/api\/v1\/sessions\/([^/]+)\/cancel$/.exec(parsed.pathname);
      if (request.method === "POST" && cancelMatch) {
        this.#runtime.cancel(cancelMatch[1], principalId);
        return { status: 202, body: { status: "cancelling" } };
      }

      const reviewMatch = /^\/api\/v1\/sessions\/([^/]+)\/reviews\/([^/]+)\/decision$/.exec(parsed.pathname);
      if (request.method === "POST" && reviewMatch) {
        exactFields(body, ["outcome", "packetDigest"], "review verdict request");
        if (
          !["accept", "revise", "reject", "cancel"].includes(String(body.outcome)) ||
          typeof body.packetDigest !== "string"
        ) throw new RuntimeFailure("invalid", "exact review outcome and packet digest are required");
        if (!request.authenticateHumanReview) {
          throw new RuntimeFailure(
            "forbidden",
            "explicit host-verified human review authority is required",
          );
        }
        const verdictRequest: AuthenticatedReviewVerdictRequest = {
          transport: request.authentication,
          authenticateHuman: request.authenticateHumanReview,
          outcome: body.outcome as ReviewVerdictRequest["outcome"],
          packetDigest: body.packetDigest as ReviewVerdictRequest["packetDigest"],
        };
        return {
          status: 200,
          body: await this.#runtime.decideReview(
            reviewMatch[1],
            reviewMatch[2],
            verdictRequest,
          ),
        };
      }

      const artifactsMatch = /^\/api\/v1\/sessions\/([^/]+)\/artifacts$/.exec(parsed.pathname);
      if (request.method === "GET" && artifactsMatch && this.#runtime.listArtifacts) {
        return { status: 200, body: this.#runtime.listArtifacts(artifactsMatch[1], principalId) };
      }
      const artifactMatch = /^\/api\/v1\/sessions\/([^/]+)\/artifacts\/([a-z][a-z0-9-]*)$/.exec(parsed.pathname);
      if (request.method === "GET" && artifactMatch && this.#runtime.readArtifact) {
        return { status: 200, body: this.#runtime.readArtifact(artifactMatch[1], artifactMatch[2], principalId) };
      }
      const actionMatch = /^\/api\/v1\/sessions\/([^/]+)\/actions$/.exec(parsed.pathname);
      if (request.method === "GET" && actionMatch && this.#runtime.actionState) {
        return { status: 200, body: this.#runtime.actionState(actionMatch[1], principalId) };
      }
      const authorizeMatch = /^\/api\/v1\/sessions\/([^/]+)\/reviews\/([^/]+)\/authorize-action$/.exec(parsed.pathname);
      if (request.method === "POST" && authorizeMatch && this.#runtime.authorizeAction) {
        exactFields(body, ["packetDigest"], "action authorization request");
        if (typeof body.packetDigest !== "string" || !request.authenticateHumanReview) throw new RuntimeFailure("forbidden", "exact packet and separate human action authority are required");
        return { status: 200, body: await this.#runtime.authorizeAction(authorizeMatch[1], authorizeMatch[2], {
          transport: request.authentication, authenticateHuman: request.authenticateHumanReview,
          packetDigest: body.packetDigest as ReviewVerdictRequest["packetDigest"],
        }) };
      }
      const receiptMatch = /^\/api\/v1\/sessions\/([^/]+)\/actions\/receipt$/.exec(parsed.pathname);
      if (request.method === "POST" && receiptMatch && this.#runtime.importActionReceipt) {
        exactFields(body, ["receipt"], "action receipt request");
        if (!request.authenticateHumanReview) throw new RuntimeFailure("forbidden", "human receipt import authority is required");
        return { status: 200, body: await this.#runtime.importActionReceipt(receiptMatch[1], body.receipt, {
          transport: request.authentication, authenticateHuman: request.authenticateHumanReview,
        }) };
      }

      const resultMatch = /^\/api\/v1\/sessions\/([^/]+)\/result$/.exec(parsed.pathname);
      if (request.method === "GET" && resultMatch) {
        const result = this.#runtime.reviewVerdict(resultMatch[1], principalId);
        return result
          ? { status: 200, body: result }
          : { status: 202, body: { status: "pending" } };
      }
      return { status: 404, body: { error: { code: "not-found", message: "route was not found" } } };
    } catch (error) {
      const failure = error instanceof RuntimeFailure
        ? error
        : new RuntimeFailure("provider-failure", "request failed without exposing internal detail");
      return {
        status: errorStatus(failure),
        body: { error: { code: failure.code, message: failure.message } },
      };
    }
  }
}
