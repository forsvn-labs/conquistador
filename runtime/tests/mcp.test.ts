import { buildReviewPacketFixture } from "../fixtures/review-contract-fixture.ts";
import { PassThrough, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMcpStdio } from "../src/mcp.ts";

afterEach(() => vi.unstubAllGlobals());
function client() {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = "";
  output.on("data", chunk => { text += String(chunk); });
  const done = runMcpStdio({ input, output, token: "unit-service-token" });
  const send = (method: string, params = {}, id?: number) => input.write(JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params }) + "\n");
  const messages = () => text.trim().split("\n").filter(Boolean).map(s => JSON.parse(s));
  const response = async (id: number) => { await vi.waitFor(() => expect(messages().some(m => m.id === id)).toBe(true)); return messages().find(m => m.id === id); };
  const init = async () => { send("initialize", { protocolVersion: "2025-11-25", clientInfo: { name: "test", version: "0" }, capabilities: {} }, 1); await response(1); send("notifications/initialized"); };
  return { input, output, send, response, init, done, messages };
}
describe("local MCP protocol fixtures (no live providers)", () => {
  it("negotiates tools and returns owned artifact contents without authority tools", async () => {
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
      expect(init.redirect).toBe("error");
      expect(init.headers).toMatchObject({ authorization: "Bearer unit-service-token" });
      return Response.json({ artifactId: "created-artifact", format: "markdown", digest: "sha256:" + "a".repeat(64), body: "A useful draft body" });
    });
    vi.stubGlobal("fetch", fetcher);
    const c = client(); await c.init();
    c.send("tools/list", {}, 2);
    const listed = await c.response(2);
    expect(listed.result.tools.map((t: {name:string}) => t.name)).toEqual(["conquistador_run", "conquistador_artifact", "conquistador_artifacts", "conquistador_cancel"]);
    c.send("tools/call", { name: "conquistador_artifact", arguments: { sessionId: "session-1", artifactId: "created-artifact" } }, 3);
    expect((await c.response(3)).result.content[0].text).toContain("A useful draft body");
    expect(String(fetcher.mock.calls[0][0])).toBe("http://127.0.0.1:4317/api/v1/sessions/session-1/artifacts/created-artifact");
    c.input.end(); await c.done;
  });
  it("returns validated pending-review metadata from a local protocol fixture", async () => {
    const packet = buildReviewPacketFixture({ sessionId: "unit-session" });
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const path = new URL(String(url)).pathname; paths.push(path);
      return path.endsWith("/sessions") ? Response.json({ id: "unit-session" }, { status: 201 }) : Response.json({ reviewPacket: packet }, { status: 202 });
    }));
    const c = client(); await c.init();
    c.send("tools/call", { name: "conquistador_run", arguments: { intent: "content intelligence loop", product: "P", audience: "A", channel: "C", goals: "G" } }, 2);
    const result = await c.response(2);
    expect(result.result.isError).toBeUndefined();
    expect(JSON.parse(result.result.content[0].text)).toMatchObject({ sessionId: "unit-session", pendingHumanReview: true, packetId: packet.packetId });
    expect(paths).toEqual(["/api/v1/sessions", "/api/v1/sessions/unit-session/messages"]);
    c.input.end(); await c.done;
  });

  it("rejects path injection and unknown authority tools without dispatch", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const c = client(); await c.init();
    c.send("tools/call", { name: "conquistador_artifact", arguments: { sessionId: "../private", artifactId: "created-artifact" } }, 2);
    expect((await c.response(2)).result.isError).toBe(true);
    c.send("tools/call", { name: "authorize_action", arguments: {} }, 3);
    expect((await c.response(3)).error.code).toBe(-32602);
    expect(fetcher).not.toHaveBeenCalled(); c.input.end(); await c.done;
  });
  it("bounds and suppresses private upstream errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("PRIVATE unit-service-token".repeat(60000), { status: 500 })));
    const c = client(); await c.init();
    c.send("tools/call", { name: "conquistador_artifact", arguments: { sessionId: "session-1", artifactId: "created-artifact" } }, 2);
    const result = await c.response(2); expect(result.result.isError).toBe(true); expect(JSON.stringify(result)).not.toContain("PRIVATE"); expect(JSON.stringify(result)).not.toContain("unit-service-token");
    c.input.end(); await c.done;
  });
  it("cancels an interrupted owned run with service authentication and rejects active ID replay", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit) => {
      const path = new URL(String(url)).pathname; calls.push(path);
      expect(init.headers).toMatchObject({ authorization: "Bearer unit-service-token" });
      if (path.endsWith("/sessions")) return Response.json({ id: "unit-session" }, { status: 201 });
      if (path.endsWith("/cancel")) return Response.json({ cancelled: true }, { status: 202 });
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new Error("unit interrupted")), { once: true });
      });
    }));
    const c = client(); await c.init();
    const args = { name: "conquistador_run", arguments: { intent: "content intelligence loop", product: "P", audience: "A", channel: "C", goals: "G" } };
    c.send("tools/call", args, 2);
    await vi.waitFor(() => expect(calls.some(p => p.endsWith("/messages"))).toBe(true));
    c.send("tools/call", args, 2);
    expect((await c.response(2)).error.code).toBe(-32600);
    c.send("notifications/cancelled", { requestId: 2 });
    await vi.waitFor(() => expect(calls.some(p => p.endsWith("/cancel"))).toBe(true));
    expect(calls.filter(p => p.endsWith("/sessions"))).toHaveLength(1);
    c.input.end(); await c.done;
    expect(c.messages().some(m => m.result?.isError)).toBe(true);
  });

  it("rejects inherited property names and nonfinite numeric IDs", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const c = client(); await c.init();
    for (const [id, key] of [[2, "constructor"], [3, "__proto__"]] as const) {
      c.send("tools/call", { name: "conquistador_cancel", arguments: JSON.parse(`{"sessionId":"unit-session","${key}":"bad"}`) }, id);
      expect((await c.response(id)).result.isError).toBe(true);
    }
    c.input.write('{"jsonrpc":"2.0","method":"ping","id":1e400}\n');
    await vi.waitFor(() => expect(c.messages().some(m => m.id === null && m.error?.code === -32600)).toBe(true));
    expect(fetcher).not.toHaveBeenCalled(); c.input.end(); await c.done;
  });
  it("bounds handlers when output does not drain", async () => {
    const input = new PassThrough();
    const writes = vi.fn();
    const output = new Writable({ write(_chunk, _encoding, _callback) { writes(); } });
    const done = runMcpStdio({ input, output });
    input.write(Array.from({ length: 100 }, (_, id) => JSON.stringify({ jsonrpc: "2.0", method: "ping", id }) + "\n").join(""));
    await done;
    expect(output.destroyed).toBe(true); expect(input.destroyed).toBe(true);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(output.writableLength).toBeLessThan(4096);
  });
  it("cancels active generation when stdout closes", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit) => {
      const path = new URL(String(url)).pathname; calls.push(path);
      expect(init.headers).toMatchObject({ authorization: "Bearer unit-service-token" });
      if (path.endsWith("/sessions")) return Response.json({ id: "unit-session" }, { status: 201 });
      if (path.endsWith("/cancel")) return Response.json({}, { status: 202 });
      return new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
    }));
    const c = client(); await c.init();
    c.send("tools/call", { name: "conquistador_run", arguments: { intent: "content intelligence loop", product: "P", audience: "A", channel: "C", goals: "G" } }, 2);
    await vi.waitFor(() => expect(calls.some(p => p.endsWith("/messages"))).toBe(true));
    c.output.destroy(); await c.done;
    expect(calls.some(p => p.endsWith("/cancel"))).toBe(true);
  });

  it("rejects unsafe service origins before dispatch", async () => {
    for (const url of ["http://example.org", "https://user:pass@example.org", "https://example.org/path", "https://example.org/?x", "https://example.org\\escape"]) await expect(runMcpStdio({ url })).rejects.toThrow();
  });
  it("rejects oversized input and requires initialization", async () => {
    const c = client(); c.send("tools/list", {}, 1); expect((await c.response(1)).error.code).toBe(-32600);
    const failure = expect(c.done).rejects.toThrow(/1 MiB/); c.input.write("x".repeat(1_048_577)); await failure;
  });
});
