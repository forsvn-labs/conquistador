import type { AdapterContext, CapabilityRequest, Catalog } from "../contracts.ts";
import {
  adapterFor,
  boundedId,
  dispatch,
  header,
  integerInput,
  optionalString,
  boundedCursor,
  record,
  records,
  result,
  source,
  stringArray,
  stringInput,
} from "./common.ts";
import type { ProviderHttpResponse, ProviderTransport } from "./transport.ts";

const ORIGIN = "https://api.github.com";
const HEADERS = {
  "x-github-api-version": "2022-11-28",
  "user-agent": "Conquistador-Tool-Module/1.0.0",
};

function repositoryPath(request: CapabilityRequest): string {
  const owner = boundedId(stringInput(request, "owner"), "owner");
  const repository = boundedId(stringInput(request, "repository"), "repository");
  return `/repos/${owner}/${repository}`;
}

function nextPage(response: ProviderHttpResponse): string | undefined {
  const link = header(response, "link");
  const next = link?.split(",").find((part) => /rel="next"/.test(part));
  const match = next?.match(/[?&]page=(\d{1,8})(?:[>&]|$)/);
  return match?.[1];
}

function safeRelease(value: Record<string, unknown>): Record<string, unknown> {
  return {
    id: value.id,
    tagName: value.tag_name,
    name: value.name,
    draft: value.draft,
    prerelease: value.prerelease,
    publishedAt: value.published_at,
    htmlUrl: value.html_url,
  };
}

function safeIssue(value: Record<string, unknown>): Record<string, unknown> {
  return {
    id: value.id,
    number: value.number,
    title: value.title,
    state: value.state,
    labels: value.labels,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    htmlUrl: value.html_url,
  };
}

async function get(
  transport: ProviderTransport,
  request: CapabilityRequest,
  context: AdapterContext,
  path: string,
  query?: Record<string, string>,
): Promise<ProviderHttpResponse> {
  return dispatch(transport, context, {
    provider: "github",
    operationId: request.operationId,
    origin: ORIGIN,
    method: "GET",
    path,
    query,
    headers: HEADERS,
    authentication: "bearer",
  });
}

export function createGithubAdapter(
  catalog: Catalog,
  transport: ProviderTransport,
  options: { now?: () => Date } = {},
) {
  return adapterFor(catalog, "github", {
    "github.repository.get": async (request, context) => {
      const path = repositoryPath(request);
      const response = await get(transport, request, context, path);
      const body = record(response.body);
      const visibility = body.visibility ?? (body.private === true ? "private" : "public");
      if (typeof visibility !== "string" || !new Set(["public", "private", "internal"]).has(visibility)) {
        throw new Error("GitHub repository visibility is invalid");
      }
      return result(request, response, {
        repository: {
          id: body.id,
          name: body.name,
          fullName: body.full_name,
          description: body.description,
          defaultBranch: body.default_branch,
          archived: body.archived,
          disabled: body.disabled,
          fork: body.fork,
          htmlUrl: body.html_url,
        },
        visibility,
        topics: Array.isArray(body.topics) ? body.topics.filter((item): item is string => typeof item === "string") : [],
        timestamps: {
          createdAt: body.created_at,
          updatedAt: body.updated_at,
          pushedAt: body.pushed_at,
        },
      }, { sourceUrl: source(ORIGIN, path), providerResourceId: String(body.id ?? "") || undefined });
    },

    "github.release.list": async (request, context) => {
      const path = `${repositoryPath(request)}/releases`;
      const pageSize = integerInput(request, "pageSize", 30, 1, 100);
      const page = boundedCursor(optionalString(request, "cursor"));
      const response = await get(transport, request, context, path, { per_page: String(pageSize), page: String(page) });
      const releases = records(response.body).map(safeRelease);
      const cursor = nextPage(response);
      return result(request, response, { releases, ...(cursor ? { nextCursor: cursor } : {}) }, {
        sourceUrl: source(ORIGIN, path),
        cursor,
      });
    },

    "github.issue.list": async (request, context) => {
      const path = `${repositoryPath(request)}/issues`;
      const pageSize = integerInput(request, "pageSize", 30, 1, 100);
      const page = boundedCursor(optionalString(request, "cursor"));
      const state = optionalString(request, "state") ?? "open";
      if (!new Set(["open", "closed", "all"]).has(state)) throw new Error("state is not allowlisted");
      const labels = stringArray(request, "labels", 20) ?? [];
      const response = await get(transport, request, context, path, {
        state,
        per_page: String(pageSize),
        page: String(page),
        ...(labels.length ? { labels: labels.join(",") } : {}),
      });
      const issues = records(response.body).filter((item) => !item.pull_request).map(safeIssue);
      const cursor = nextPage(response);
      return result(request, response, { issues, ...(cursor ? { nextCursor: cursor } : {}) }, {
        sourceUrl: source(ORIGIN, path),
        cursor,
      });
    },

    "github.signal.aggregate": async (request, context) => {
      const path = repositoryPath(request);
      const windowDays = integerInput(request, "windowDays", 30, 1, 365);
      const now = options.now?.() ?? new Date();
      const end = now.toISOString();
      const start = new Date(now.getTime() - windowDays * 86_400_000).toISOString();
      const [repository, issues, releases] = await Promise.all([
        get(transport, request, context, path),
        get(transport, request, context, `${path}/issues`, { state: "all", since: start, per_page: "100", page: "1" }),
        get(transport, request, context, `${path}/releases`, { per_page: "100", page: "1" }),
      ]);
      const repositoryBody = record(repository.body);
      const rawIssueRows = records(issues.body);
      const rawReleaseRows = records(releases.body);
      const issueRows = rawIssueRows.filter((item) => !item.pull_request);
      const releaseRows = rawReleaseRows.filter((item) => {
        const publishedAt = typeof item.published_at === "string" ? Date.parse(item.published_at) : Number.NaN;
        return Number.isFinite(publishedAt) && publishedAt >= Date.parse(start);
      });
      return result(request, repository, {
        stars: Number(repositoryBody.stargazers_count ?? 0),
        forks: Number(repositoryBody.forks_count ?? 0),
        issues: issueRows.length,
        releases: releaseRows.length,
        window: {
          start,
          end,
          days: windowDays,
          issueLimit: 100,
          releaseLimit: 100,
          truncated: rawIssueRows.length === 100 || rawReleaseRows.length === 100,
        },
      }, {
        sourceUrl: source(ORIGIN, path),
        unitsUsed: 3,
        complete: rawIssueRows.length < 100 && rawReleaseRows.length < 100,
        truncated: rawIssueRows.length === 100 || rawReleaseRows.length === 100,
      });
    },
  });
}
