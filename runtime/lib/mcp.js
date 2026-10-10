import { randomUUID } from "node:crypto";
import { validateReviewPacket } from "./review-contract.js";
import { routeIntent } from "./router.js";
const LIMIT = 1_048_576;
const SESSION = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x) ? x : {};
const schema = (properties, required) => ({ type: "object", properties, required, additionalProperties: false });
const string = { type: "string", minLength: 1, maxLength: 16384 };
const session = { type: "string", pattern: SESSION.source, maxLength: 160 };
const TOOLS = [
    { name: "conquistador_run", description: "Generate a draft for human review using one supported outcome. Does not approve or publish. Local/provider evidence remains separately classified.", inputSchema: schema(Object.fromEntries(["intent", "product", "audience", "channel", "goals"].map(k => [k, string])), ["intent", "product", "audience", "channel", "goals"]) },
    { name: "conquistador_artifact", description: "Read an owned draft artifact body and verified content digest by ID. Authority documents are excluded.", inputSchema: schema({ sessionId: session, artifactId: { type: "string", pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", maxLength: 160 } }, ["sessionId", "artifactId"]) },
    { name: "conquistador_artifacts", description: "List owned draft artifact IDs for reading. Excludes authority documents.", inputSchema: schema({ sessionId: session }, ["sessionId"]) },
    { name: "conquistador_cancel", description: "Cancel owned session work. This cannot undo external actions.", inputSchema: schema({ sessionId: session }, ["sessionId"]) },
];
/** Narrow stdio MCP adapter. Only a service token crosses this boundary. */
export async function runMcpStdio(options = {}) {
    const rawUrl = options.url ?? "http://127.0.0.1:4317";
    const origin = new URL(rawUrl);
    if (rawUrl.includes("\\") || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
        !(origin.protocol === "https:" || origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
        throw new Error("MCP requires an HTTPS origin or loopback HTTP origin without credentials, path, query, or fragment");
    const input = options.input ?? process.stdin;
    const output = options.output ?? process.stdout;
    const pending = new Map();
    const tasks = new Set();
    let initialized = false;
    let ready = false;
    let stopped = false;
    const waitingWrites = new Set();
    let queuedOutputBytes = 0;
    const stop = () => {
        if (stopped)
            return;
        stopped = true;
        for (const work of pending.values())
            work.controller.abort();
        for (const reject of waitingWrites)
            reject();
        input.destroy();
        output.destroy();
    };
    const send = async (value) => {
        const frame = `${JSON.stringify(value)}\n`;
        const bytes = Buffer.byteLength(frame);
        if (stopped || output.destroyed || queuedOutputBytes + bytes > 2 * LIMIT) {
            stop();
            throw new Error("MCP output unavailable or over limit");
        }
        queuedOutputBytes += bytes;
        await new Promise((resolve, reject) => {
            let settled = false;
            const finish = (failed = false) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                waitingWrites.delete(abort);
                queuedOutputBytes -= bytes;
                if (failed)
                    reject(new Error("MCP output unavailable"));
                else
                    resolve();
            };
            const abort = () => finish(true);
            const timer = setTimeout(stop, 3000);
            waitingWrites.add(abort);
            try {
                output.write(frame, error => { finish(Boolean(error)); if (error)
                    stop(); });
            }
            catch {
                finish(true);
                stop();
            }
        });
    };
    const error = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });
    async function request(path, body, signal) {
        const response = await fetch(new URL(path, origin), {
            method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(600_000)]),
            headers: { "content-type": "application/json", ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const reader = response.body?.getReader();
        const chunks = [];
        let size = 0;
        try {
            if (reader)
                for (;;) {
                    const next = await reader.read();
                    if (next.done)
                        break;
                    size += next.value.byteLength;
                    if (size > LIMIT) {
                        await reader.cancel();
                        throw new Error("response too large");
                    }
                    chunks.push(next.value);
                }
        }
        finally {
            reader?.releaseLock();
        }
        if (!response.ok)
            throw new Error("service request failed");
        return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    }
    async function cancel(work) {
        work.controller.abort();
        if (work.sessionId) {
            try {
                await request(`/api/v1/sessions/${work.sessionId}/cancel`, {}, AbortSignal.timeout(3000));
            }
            catch { /* Cancellation remains unconfirmed; never claim it succeeded. */ }
        }
    }
    async function tool(name, args, work) {
        const definition = TOOLS.find(t => t.name === name);
        if (!definition || Object.keys(args).some(k => !Object.hasOwn(definition.inputSchema.properties, k)) || definition.inputSchema.required.some(k => typeof args[k] !== "string" || !String(args[k]).trim() || Buffer.byteLength(String(args[k])) > 16384))
            throw new Error("invalid tool arguments");
        if (name !== "conquistador_run") {
            if (!SESSION.test(String(args.sessionId)) || String(args.sessionId).length > 160)
                throw new Error("invalid session");
            const base = `/api/v1/sessions/${args.sessionId}`;
            if (name === "conquistador_artifacts")
                return request(`${base}/artifacts`, undefined, work.controller.signal);
            if (name === "conquistador_cancel")
                return request(`${base}/cancel`, {}, work.controller.signal);
            if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(String(args.artifactId)) || String(args.artifactId).length > 160)
                throw new Error("invalid artifact");
            const artifact = await request(`${base}/artifacts/${args.artifactId}`, undefined, work.controller.signal);
            if (artifact.artifactId !== args.artifactId || !["markdown", "json"].includes(String(artifact.format)) || typeof artifact.digest !== "string" || !("body" in artifact))
                throw new Error("invalid artifact response");
            return artifact;
        }
        const route = routeIntent(String(args.intent));
        if (route.outcome !== "playbook")
            return { available: false, reason: "Choose one supported served playbook outcome; standalone skills run in the agent host." };
        const created = await request("/api/v1/sessions", {}, work.controller.signal);
        if (typeof created.id !== "string" || !SESSION.test(created.id) || created.id.length > 160)
            throw new Error("invalid session response");
        work.sessionId = created.id;
        if (work.controller.signal.aborted)
            throw new Error("cancelled");
        const response = await request(`/api/v1/sessions/${created.id}/messages`, { id: `mcp-${randomUUID()}`, content: JSON.stringify(args) }, work.controller.signal);
        // Return only draft review metadata. Never expose proofs, authorization, or receipts.
        validateReviewPacket(response.reviewPacket);
        const packet = record(response.reviewPacket);
        const identity = record(packet.identity);
        if (identity.sessionId !== created.id)
            throw new Error("invalid review response");
        return { sessionId: created.id, pendingHumanReview: true, packetId: packet.packetId, artifact: packet.artifact, work: packet.work, unresolvedLimitations: packet.unresolvedLimitations };
    }
    async function handle(raw) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            await error(null, -32700, "Invalid JSON");
            return;
        }
        const message = record(parsed);
        const id = message.id;
        if (message.jsonrpc !== "2.0" || typeof message.method !== "string" || (id !== undefined && typeof id !== "string" && typeof id !== "number") || (typeof id === "number" && !Number.isFinite(id))) {
            await error(null, -32600, "Invalid request");
            return;
        }
        const params = record(message.params);
        if (id === undefined) {
            if (message.method === "notifications/initialized" && initialized)
                ready = true;
            if (message.method === "notifications/cancelled") {
                const work = pending.get(params.requestId);
                if (work)
                    await cancel(work);
            }
            return;
        }
        if (pending.has(id)) {
            await error(id, -32600, "Duplicate active request ID");
            return;
        }
        if (message.method === "initialize" && !initialized) {
            if (typeof params.protocolVersion !== "string" || !params.clientInfo || !params.capabilities) {
                await error(id, -32602, "Invalid initialization");
                return;
            }
            initialized = true;
            await send({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "conquistador", version: "0.5.0" } } });
            return;
        }
        if (message.method === "ping") {
            await send({ jsonrpc: "2.0", id, result: {} });
            return;
        }
        if (!ready) {
            await error(id, -32600, "Initialize the connection first");
            return;
        }
        if (message.method === "tools/list") {
            await send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
            return;
        }
        if (message.method !== "tools/call") {
            await error(id, -32601, "Method not found");
            return;
        }
        if (typeof params.name !== "string" || !TOOLS.some(t => t.name === params.name)) {
            await error(id, -32602, "Unknown tool");
            return;
        }
        if (pending.size >= 8) {
            await error(id, -32600, "Too many active requests");
            return;
        }
        const work = { controller: new AbortController() };
        pending.set(id, work);
        try {
            const result = await tool(params.name, record(params.arguments), work);
            await send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
        }
        catch {
            await cancel(work);
            await send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: `Request could not complete; check service readiness, authentication, arguments, or integrity.${work.sessionId ? ` Session: ${work.sessionId}. Cancellation requested; final state must be checked.` : ""}` }] } });
        }
        finally {
            pending.delete(id);
        }
    }
    output.once("error", stop);
    output.once("close", stop);
    options.signal?.addEventListener("abort", stop, { once: true });
    process.once("SIGINT", stop);
    let buffer = Buffer.alloc(0);
    try {
        for await (const chunk of input) {
            if (stopped)
                break;
            buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
            for (;;) {
                if (stopped)
                    break;
                const newline = buffer.indexOf(10);
                if (newline < 0)
                    break;
                if (newline > LIMIT)
                    throw new Error("MCP request exceeds 1 MiB");
                const line = buffer.subarray(0, newline).toString("utf8");
                buffer = buffer.subarray(newline + 1);
                if (tasks.size >= 16) {
                    stop();
                    break;
                }
                const task = handle(line).catch(() => stop());
                tasks.add(task);
                void task.then(() => tasks.delete(task));
            }
            if (buffer.length > LIMIT)
                throw new Error("MCP request exceeds 1 MiB");
        }
    }
    catch (error) {
        if (!stopped)
            throw error;
    }
    finally {
        process.removeListener("SIGINT", stop);
        options.signal?.removeEventListener("abort", stop);
        await Promise.all([...pending.values()].map(cancel));
        await Promise.allSettled([...tasks]);
        output.removeListener("error", stop);
        output.removeListener("close", stop);
    }
}
