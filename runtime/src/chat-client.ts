import { DEFAULT_SKILLS_ROOT } from "./skill-assets.ts";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { loadRouterContract, routeIntent } from "./router.ts";
import { validateReviewPacket } from "./review-contract.ts";

export type ChatOptions = { url?: string; intent?: string; product?: string; audience?: string; channel?: string; goals?: string; timeoutMs?: string };
export type ChatHost = {
  env: Record<string, string | undefined>;
  stdout: (text: string) => void;
  prompt?: (question: string, signal: AbortSignal) => Promise<string>;
  signal?: AbortSignal;
};
const LIMIT = 1_048_576;
const fields = ["intent", "product", "audience", "channel", "goals"] as const;
const questions = {
  intent: "What outcome do you want? ", product: "What product or offer is this for? ",
  audience: "Who is the audience? ", channel: "Which channel will you use? ", goals: "What should this achieve? ",
};
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function safe(value: unknown, token?: string): string {
  let text = typeof value === "string" ? value : "unknown";
  if (token) text = text.split(token).join("[redacted]");
  return text.replace(/[\x00-\x1f\x7f-\x9f]/g, " ").slice(0, 2000);
}

export async function terminalChatPrompt(question: string, signal: AbortSignal): Promise<string> {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try { return await reader.question(question, { signal }); }
  finally { reader.close(); }
}

/** One bounded turn against the served API. Never submits review or action decisions. */
export async function runChat(options: ChatOptions, host: ChatHost): Promise<number> {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  const signal = host.signal ? AbortSignal.any([controller.signal, host.signal]) : controller.signal;
  let sessionId: string | undefined;
  const token = host.env.CONQUISTADOR_CHAT_TOKEN;
  const print = (text: string) => host.stdout(safe(text, token));
  let origin: URL | undefined;
  try {
    const timeoutMs = Number(options.timeoutMs ?? "600000");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000) throw new Error("Use --timeout-ms between 1 and 3600000.");
    const url = new URL(options.url ?? "http://127.0.0.1:4317");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
      throw new Error("Use an HTTPS origin or loopback HTTP origin, without credentials, path, query, or fragment.");
    }
    origin = url;
    const input: Record<string, string> = {};
    for (const field of fields) {
      const supplied = options[field]?.trim();
      input[field] = supplied || (host.prompt ? (await host.prompt(questions[field], signal)).trim() : "");
      if (!input[field]) throw new Error(`Missing --${field}; pass it explicitly or use an interactive terminal.`);
      if (Buffer.byteLength(input[field]) > 16_384) throw new Error(`--${field} exceeds 16384 bytes.`);
      if (field === "intent") {
        const route = routeIntent(input.intent);
        if (route.outcome === "skill") {
          print(`This outcome uses a standalone skill, not a served playbook. Open ${resolve(DEFAULT_SKILLS_ROOT, route.targetId, "SKILL.md")} in your agent host. From the distribution root: node tools/install.mjs install skill:${route.targetId} ABS_DEST`);
          return 2;
        }
        if (route.outcome === "abstain") {
          const examples = loadRouterContract().routes.filter((item) => item.target.kind === "playbook").map((item) => item.phrases[0]);
          print(`No single executable playbook selected (${route.reason}). Try one supported outcome: ${examples.join("; ")}.`);
          return 2;
        }
      }
    }
    async function request(path: string, body?: unknown) {
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
      const response = await fetch(new URL(path, url), {
        method: body === undefined ? "GET" : "POST", redirect: "error", signal: requestSignal,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > LIMIT) { await reader.cancel(); throw new Error("Response exceeds 1 MiB."); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      return { status: response.status, data: object(data) };
    }
    const created = await request("/api/v1/sessions", {});
    if (created.status !== 201 || typeof created.data.id !== "string" || !/^[a-z0-9.-]+$/.test(created.data.id)) {
      print(`Session creation failed (HTTP ${created.status}). Check serve readiness and authentication; no output is available.`);
      return 2;
    }
    sessionId = created.data.id;
    print(`Session: ${sessionId}`);
    const base = `/api/v1/sessions/${sessionId}`;
    const result = await request(`${base}/messages`, { id: `chat-${randomUUID()}`, content: JSON.stringify(input) });
    const events = await request(`${base}/events?after=0`);
    if (events.status !== 200 || !Array.isArray(events.data.events)) throw new Error("Event history is unavailable.");
    let previous = 0;
    for (const raw of events.data.events) {
      const event = object(raw);
      if (event.sessionId !== sessionId || !Number.isSafeInteger(event.sequence) || Number(event.sequence) <= previous) throw new Error("Invalid event ordering or session binding.");
      previous = Number(event.sequence);
      const payload = object(event.payload);
      const detail = event.type === "failure" || event.type === "warning" ? `: ${safe(payload.code)}` : "";
      print(`Event ${previous}: ${safe(event.type)}${detail}`);
    }
    if (result.status !== 202) {
      print(`No review packet available (HTTP ${result.status}). The operator must inspect session ${sessionId} and its persisted run for missing judgment/provider setup. Do not treat this as generated or approved output.`);
      return 2;
    }
    validateReviewPacket(result.data.reviewPacket);
    const packet = result.data.reviewPacket;
    if (packet.identity.sessionId !== sessionId) throw new Error("Review packet session mismatch.");
    print(`Work state: ${packet.work.state}. ${packet.work.summary}`);
    print(`Artifact reference: ${packet.artifact.artifactId}, revision ${packet.artifact.revision}, digest ${packet.artifact.digest}`);
    print(`Review packet: ${packet.packetId}. Evidence entries: ${packet.evidence.length}; these are server claims, not independent verification.`);
    for (const limitation of packet.unresolvedLimitations) print(`Limitation: ${limitation}`);
    print("Human review required: use the authenticated operator review flow for this packet. Chat has not approved or executed an action.");
    return 0;
  } catch (error) {
    if (sessionId && origin) {
      try {
        const cancelled = await fetch(new URL(`/api/v1/sessions/${sessionId}/cancel`, origin), {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(3_000),
          headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: "{}",
        });
        await cancelled.body?.cancel();
        print(cancelled.status === 202 ? `Cancellation requested for session ${sessionId}; inspect its final state before retrying.` : `Cancellation unconfirmed for session ${sessionId}; the operator must inspect and stop any remaining work.`);
      } catch { print(`Cancellation unconfirmed for session ${sessionId}; the operator must inspect and stop any remaining work.`); }
    }
    if (signal.aborted) print("Chat interrupted; no approval was submitted.");
    else print(`Chat could not complete. ${error instanceof Error && /^(Missing --|--\w+ exceeds|Use --timeout-ms|Use an HTTPS|Response exceeds|Event history|Invalid event|Review packet session)/.test(error.message) ? error.message : "Check service readiness, credentials, response format, and the configured request deadline."}`);
    return signal.aborted ? 130 : 2;
  } finally { process.removeListener("SIGINT", interrupt); }
}
