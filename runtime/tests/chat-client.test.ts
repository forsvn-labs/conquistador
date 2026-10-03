import { buildReviewPacketFixture } from "../fixtures/review-contract-fixture.ts";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { DEFAULT_SKILLS_ROOT } from "../src/skill-assets.ts";
import { runChat } from "../src/chat-client.ts";
import { parseCli } from "../src/cli.ts";
import { ApiV1 } from "../src/api.ts";
import { DurableServedRuntime } from "../src/served-runtime.ts";
const servers: Server[] = [];
const roots: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>((done) => server.close(() => done())); }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
async function listen(server: Server) {
  servers.push(server); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw Error("no address");
  return `http://127.0.0.1:${address.port}`;
}
const inputs = { intent: "content intelligence loop", product: "P", audience: "A", channel: "C", goals: "G" };
function output() { const lines: string[] = []; return { lines, host: { env: {}, stdout: (line: string) => lines.push(line) } }; }
it("parses structured chat flags and refuses unknown or duplicate flags", () => {
  expect(parseCli(["chat", "--intent", inputs.intent, "--goals", "G"])).toEqual({ command: "chat", intent: inputs.intent, goals: "G" });
  expect(() => parseCli(["chat", "--approve", "yes"])).toThrow();
  expect(() => parseCli(["chat", "--url", "a", "--url", "b"])).toThrow();
});
it("requires missing fields and routes skills to their contained source without connecting", async () => {
  const { lines, host } = output();
  expect(await runChat({ intent: inputs.intent }, host)).toBe(2);
  expect(lines.join()).toContain("Missing --product");
  lines.length = 0;
  expect(await runChat({ intent: "write copy" }, host)).toBe(2);
  expect(lines.join()).toContain(join(DEFAULT_SKILLS_ROOT, "conquistador/commands/copy/COMMAND.md"));
  expect(lines.join()).toContain("install skill:copy ABS_DEST");
});
it("collects missing fields and exercises actual durable API without a provider or fabricated generation", async () => {
  const root = mkdtempSync(join(tmpdir(), "chat-test-")); roots.push(root);
  const runtime = new DurableServedRuntime({ dataDir: root, instanceId: "chat-test" });
  const api = new ApiV1(runtime);
  const paths: string[] = [];
  const url = await listen(createServer(async (req, res) => {
    paths.push(req.url!); const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const response = await api.handle({ method: req.method as "GET" | "POST", path: req.url!, authentication: { principalId: "local-operator", method: "local-test", verifier: "unit-test", verifiedAt: "2026-09-14T00:00:00Z", subjectBinding: { issuer: "unit-test", subjectDigest: `sha256:${"0".repeat(64)}` } }, ...(chunks.length ? { body: JSON.parse(Buffer.concat(chunks).toString()) } : {}) });
    res.writeHead(response.status, { "content-type": "application/json" }); res.end(JSON.stringify(response.body));
  }));
  const { lines, host } = output(); const answers = Object.values(inputs); let prompts = 0;
  expect(await runChat({ url }, { ...host, prompt: async () => { prompts++; return answers.shift()!; } })).toBe(2);
  expect(prompts).toBe(5);
  expect(lines.join()).toContain("Event 1: input.accepted");
  expect(lines.join()).toContain("No review packet available");
  expect(paths).toHaveLength(3);
  expect(paths.some((path) => /decision|action/.test(path))).toBe(false);
  await runtime.shutdown();
});
it("does not forward a token through redirects and never prints the token", async () => {
  let reached = false;
  const destination = await listen(createServer((_req, res) => { reached = true; res.end("{}"); }));
  const url = await listen(createServer((_req, res) => { res.writeHead(307, { location: destination }); res.end(); }));
  const { lines, host } = output();
  expect(await runChat({ ...inputs, url }, { ...host, env: { CONQUISTADOR_CHAT_TOKEN: "test-only-token" } })).toBe(2);
  expect(reached).toBe(false); expect(lines.join()).not.toContain("test-only-token");
});
it("bounds error bodies and aborts a pending response", async () => {
  const url = await listen(createServer((_req, res) => { res.writeHead(500); res.end("x".repeat(1_048_577)); }));
  const { lines, host } = output();
  expect(await runChat({ ...inputs, url }, host)).toBe(2); expect(lines.join()).toContain("Response exceeds");
  const stalled = await listen(createServer(() => {})); const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20);
  try { expect(await runChat({ ...inputs, url: stalled }, { ...host, signal: controller.signal })).toBe(130); }
  finally { clearTimeout(timer); }
});
it("rejects remote plaintext and URL credentials before any request", async () => {
  for (const url of ["http://example.com", "https://user:pass@example.com", "https://example.com/path"]) {
    const { host } = output(); expect(await runChat({ ...inputs, url }, host)).toBe(2);
  }
});
it("aborting after session creation sends authenticated cancellation without a decision", async () => {
  const paths: string[] = []; const auth: string[] = []; const controller = new AbortController();
  const url = await listen(createServer((req, res) => {
    paths.push(req.url!); auth.push(req.headers.authorization ?? "");
    if (req.url === "/api/v1/sessions") { res.writeHead(201); res.end(JSON.stringify({ id: "session-cancel" })); }
    else if (req.url?.endsWith("/cancel")) { res.writeHead(202); res.end("{}"); }
    else { controller.abort(); }
  }));
  const { lines, host } = output();
  expect(await runChat({ ...inputs, url }, { ...host, signal: controller.signal, env: { CONQUISTADOR_CHAT_TOKEN: "test-token" } })).toBe(130);
  expect(paths).toEqual(["/api/v1/sessions", "/api/v1/sessions/session-cancel/messages", "/api/v1/sessions/session-cancel/cancel"]);
  expect(auth.every((value) => value === "Bearer test-token")).toBe(true);
  expect(lines.join()).toContain("Cancellation requested");
});
it("renders a validated protocol fixture as reviewable work, never as approval", async () => {
  const packet = buildReviewPacketFixture({ sessionId: "session-fixture" });
  const url = await listen(createServer((req, res) => {
    if (req.url === "/api/v1/sessions") { res.writeHead(201); res.end(JSON.stringify({ id: "session-fixture" })); }
    else if (req.url?.endsWith("/messages")) { res.writeHead(202); res.end(JSON.stringify({ reviewPacket: packet })); }
    else { res.end(JSON.stringify({ events: [{ sessionId: "session-fixture", sequence: 1, type: "review.packet", payload: {} }] })); }
  }));
  const { lines, host } = output(); expect(await runChat({ ...inputs, url }, host)).toBe(0);
  expect(lines.join()).toContain(`Artifact reference: ${packet.artifact.artifactId}`);
  expect(lines.join()).toContain("Human review required");
  expect(lines.join()).toContain("not independent verification");
});
