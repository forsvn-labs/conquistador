/**
 * Loopback server for a judging session. It serves judge.html and saves each verdict to the chosen
 * private file as soon as the judge makes a choice. It binds to 127.0.0.1 only and accepts writes
 * only with the session header, which a cross-site page cannot send without a CORS preflight.
 */
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";

import { loadJudgingSession, readVerdictsFile, requirePrivatePath, upsertVerdict, writeVerdictsFile } from "./blind-judging.ts";
import type { HumanVerdict } from "./contracts.ts";

const MAX_BODY = 64 * 1024;

export async function startJudgingServer(input: { sessionDir: string; verdictsPath?: string; port?: number }): Promise<{ url: string; verdictsPath: string; close: () => Promise<void> }> {
  const sessionDir = resolve(input.sessionDir);
  const session = loadJudgingSession(sessionDir);
  const verdictsPath = requirePrivatePath(input.verdictsPath ?? join(sessionDir, "verdicts.json"), "verdict file");
  const page = readFileSync(join(sessionDir, "judge.html"));
  // Validate the existing file once, so a bad file fails at start instead of mid-session.
  let verdicts: HumanVerdict[] = [];
  for (const verdict of readVerdictsFile(verdictsPath)) verdicts = upsertVerdict(session, verdicts, verdict);
  let writes = Promise.resolve();

  const send = (response: ServerResponse, status: number, body: string, type = "application/json; charset=utf-8") => {
    response.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
    response.end(body);
  };
  const readBody = (request: IncomingMessage) =>
    new Promise<string>((done, fail) => {
      let size = 0;
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) { fail(new Error("request body is too large")); request.destroy(); return; }
        chunks.push(chunk);
      });
      request.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
      request.on("error", fail);
    });

  let port = 0;
  const server = createServer(async (request, response) => {
    const host = request.headers.host ?? "";
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(response, 403, '{"error":"loopback host required"}');
    const path = new URL(request.url ?? "/", `http://${host}`).pathname;
    if (request.method === "GET" && (path === "/" || path === "/judge.html")) return send(response, 200, page.toString("utf8"), "text/html; charset=utf-8");
    if (path !== "/api/verdicts") return send(response, 404, '{"error":"not found"}');
    // Reads need no header: without CORS headers, another site cannot read the response.
    if (request.method === "GET") return send(response, 200, JSON.stringify(verdicts));
    if (request.headers["x-blind-judging-session"] !== session.sessionId) return send(response, 403, '{"error":"session header required"}');
    if (request.method !== "PUT") return send(response, 405, '{"error":"use GET or PUT"}');
    try {
      const incoming = JSON.parse(await readBody(request)) as HumanVerdict;
      const next = upsertVerdict(session, verdicts, incoming);
      const write = writes.then(() => writeVerdictsFile(verdictsPath, next));
      writes = write.catch(() => undefined);
      await write;
      verdicts = next;
      return send(response, 200, JSON.stringify({ saved: incoming.blindPairId, count: verdicts.length }));
    } catch (error) {
      return send(response, 400, JSON.stringify({ error: error instanceof Error ? error.message.replace(/^\[eval-lab\] /, "") : "invalid verdict" }));
    }
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(input.port ?? 0, "127.0.0.1", () => done());
  });
  const address = server.address();
  port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}/`,
    verdictsPath,
    close: () => new Promise<void>((done) => { server.closeAllConnections(); server.close(() => done()); }),
  };
}
