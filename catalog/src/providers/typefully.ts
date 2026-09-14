import type { AdapterContext, CapabilityRequest, Catalog } from "../contracts.ts";
import {
  adapterFor,
  boundedId,
  dispatch,
  integerInput,
  optionalString,
  boundedCursor,
  record,
  result,
  source,
  stringArray,
  stringInput,
} from "./common.ts";
import type { ProviderHttpResponse, ProviderTransport } from "./transport.ts";

const ORIGIN = "https://api.typefully.com";
const DESTINATIONS = new Set(["x", "linkedin", "threads", "bluesky", "mastodon"]);
const STATUSES = new Set(["draft", "scheduled", "published", "failed"]);

export type TypefullyAdapterOptions = {
  maximumPublishPolls?: number;
  wait?: () => Promise<void>;
};

function socialSetPath(request: CapabilityRequest): string {
  const socialSetId = boundedId(stringInput(request, "socialSetId"), "socialSetId");
  return `/v2/social-sets/${socialSetId}/drafts`;
}

function idempotencyHeaders(request: CapabilityRequest): Record<string, string> {
  if (!request.idempotencyKey) throw new Error("Typefully mutation requires idempotency");
  return { "idempotency-key": request.idempotencyKey };
}

function contentBody(request: CapabilityRequest, destination: string, publishAt?: string) {
  if (!DESTINATIONS.has(destination)) throw new Error("Typefully destination is not allowlisted");
  const content = stringInput(request, "content");
  if (content.length > 25_000) throw new Error("Typefully content is too large");
  const mediaIds = stringArray(request, "mediaIds", 4) ?? [];
  return {
    platforms: {
      [destination]: {
        enabled: true,
        posts: [{ text: content, ...(mediaIds.length ? { media_ids: mediaIds } : {}) }],
      },
    },
    share: true,
    ...(publishAt ? { publish_at: publishAt } : {}),
  };
}

function privateUrl(body: Record<string, unknown>): string {
  return typeof body.private_url === "string"
    ? body.private_url
    : typeof body.share_url === "string"
      ? body.share_url
      : "";
}

function requiredId(body: Record<string, unknown>): string {
  return boundedId(String(body.id ?? ""), "draftId");
}

function requiredUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return value;
}

function publishedUrl(body: Record<string, unknown>, destination: string): string {
  const exact = body[`${destination}_published_url`];
  if (typeof exact === "string") return exact;
  const platforms = body.platforms;
  if (platforms && typeof platforms === "object" && !Array.isArray(platforms)) {
    const platform = (platforms as Record<string, unknown>)[destination];
    if (platform && typeof platform === "object" && !Array.isArray(platform)) {
      const url = (platform as Record<string, unknown>).published_url;
      if (typeof url === "string") return url;
    }
  }
  return "";
}

async function create(
  transport: ProviderTransport,
  request: CapabilityRequest,
  context: AdapterContext,
  body: unknown,
): Promise<ProviderHttpResponse> {
  return dispatch(transport, context, {
    provider: "typefully",
    operationId: request.operationId,
    origin: ORIGIN,
    method: "POST",
    path: socialSetPath(request),
    body,
    headers: idempotencyHeaders(request),
    authentication: "bearer",
  });
}

export function createTypefullyAdapter(
  catalog: Catalog,
  transport: ProviderTransport,
  options: TypefullyAdapterOptions = {},
) {
  const maximumPublishPolls = options.maximumPublishPolls ?? 3;
  const wait = options.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 1_000)));
  return adapterFor(catalog, "typefully", {
    "typefully.post.list": async (request, context) => {
      const path = socialSetPath(request);
      const limit = integerInput(request, "pageSize", 10, 1, 50);
      const offset = boundedCursor(optionalString(request, "cursor"), 0);
      const status = optionalString(request, "status");
      if (status && !STATUSES.has(status)) throw new Error("Typefully status is not allowlisted");
      const response = await dispatch(transport, context, {
        provider: "typefully",
        operationId: request.operationId,
        origin: ORIGIN,
        method: "GET",
        path,
        query: { limit: String(limit), offset: String(offset), ...(status ? { status } : {}) },
        authentication: "bearer",
      });
      const body = record(response.body);
      const posts = Array.isArray(body.results) ? body.results.filter((item) => item && typeof item === "object") : [];
      const count = Number(body.count ?? posts.length);
      const next = offset + posts.length < count ? offset + posts.length : undefined;
      return result(request, response, { posts, ...(next === undefined ? {} : { nextCursor: String(next) }) }, {
        sourceUrl: source(ORIGIN, path),
        cursor: next === undefined ? undefined : String(next),
      });
    },

    "typefully.draft.create": async (request, context) => {
      const response = await create(transport, request, context, contentBody(request, "x"));
      const body = record(response.body);
      const draftId = requiredId(body);
      if (body.status !== "draft") throw new Error("Typefully draft did not remain a draft");
      const previewUrl = requiredUrl(privateUrl(body), "Typefully preview URL");
      return result(request, response, {
        draftId,
        status: "draft",
        previewUrl,
      }, { sourceUrl: source(ORIGIN, socialSetPath(request)), providerResourceId: draftId });
    },

    "typefully.post.schedule": async (request, context) => {
      const destination = stringInput(request, "destination");
      const scheduleAt = stringInput(request, "scheduleAt");
      const timezone = stringInput(request, "timezone");
      if (new Date(scheduleAt).toISOString() !== scheduleAt || timezone.length > 100) {
        throw new Error("Typefully schedule needs an exact UTC timestamp and timezone");
      }
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
      } catch {
        throw new Error("Typefully timezone is invalid");
      }
      const response = await create(transport, request, context, contentBody(request, destination, scheduleAt));
      const body = record(response.body);
      const postId = requiredId(body);
      if (body.status !== "scheduled") throw new Error("Typefully post was not scheduled");
      const scheduledAt = String(body.scheduled_date ?? "");
      if (Number.isNaN(Date.parse(scheduledAt))) throw new Error("Typefully scheduled timestamp is invalid");
      const previewUrl = requiredUrl(privateUrl(body), "Typefully preview URL");
      return result(request, response, {
        postId,
        status: "scheduled",
        scheduledAt,
        previewUrl,
      }, { sourceUrl: source(ORIGIN, socialSetPath(request)), providerResourceId: postId });
    },

    "typefully.post.publish": async (request, context) => {
      const destination = stringInput(request, "destination");
      if (!Number.isInteger(request.maxUnits) || request.maxUnits! < 1) {
        throw new Error("Typefully publish requires a finite request ceiling");
      }
      const allowedPolls = Math.min(maximumPublishPolls, request.maxUnits! - 1);
      let unitsUsed = 1;
      let response = await create(transport, request, context, contentBody(request, destination, "now"));
      let body = record(response.body);
      const draftId = boundedId(String(body.id), "draftId");
      const detailPath = `${socialSetPath(request)}/${draftId}`;
      for (let attempt = 0; body.publish_state === "in_progress" && attempt < allowedPolls; attempt += 1) {
        await wait();
        response = await dispatch(transport, context, {
          provider: "typefully",
          operationId: request.operationId,
          origin: ORIGIN,
          method: "GET",
          path: detailPath,
          query: { exclude_comment_markers: "true" },
          authentication: "bearer",
        });
        unitsUsed += 1;
        body = record(response.body);
      }
      const pending = body.publish_state === "in_progress";
      const finalStatus = String(body.status ?? "");
      const publishedAt = pending ? "" : String(body.published_at ?? "");
      const publicUrl = pending ? "" : publishedUrl(body, destination);
      if (!pending) {
        if (finalStatus !== "published" || Number.isNaN(Date.parse(publishedAt))) {
          throw new Error("Typefully publish did not reach a successful terminal state");
        }
        requiredUrl(publicUrl, "Typefully public URL");
      }
      return result(request, response, {
        postId: draftId,
        status: pending ? "publishing" : finalStatus,
        publishedAt,
        publicUrl,
      }, {
        sourceUrl: source(ORIGIN, detailPath),
        providerResourceId: draftId,
        providerStatus: pending ? "pending" : "succeeded",
        unitsUsed,
      });
    },
  });
}
