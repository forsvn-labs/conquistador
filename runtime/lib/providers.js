import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deepFreeze, redact } from "./canonical.js";
export class ProviderFailure extends Error {
    code;
    retryable;
    constructor(code, message, retryable = false) {
        super(message);
        this.name = "ProviderFailure";
        this.code = code;
        this.retryable = retryable;
    }
}
const matrix = JSON.parse(readFileSync(resolve(import.meta.dirname, "../providers/v1.json"), "utf8"));
if (matrix.schemaVersion !== "conquistador.provider-matrix/v1") {
    throw new Error("[conquistador.provider] provider matrix schema is not v1");
}
export const providerCells = deepFreeze([...matrix.cells].sort((left, right) => left.id.localeCompare(right.id)));
function cellFor(provider) {
    return providerCells.find((cell) => cell.provider === provider);
}
async function defaultTransport(request) {
    const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: request.signal,
    });
    let json;
    try {
        json = await response.json();
    }
    catch {
        json = {};
    }
    return { status: response.status, json };
}
function defaultSleep(milliseconds, signal) {
    return new Promise((resolvePromise, reject) => {
        if (signal?.aborted) {
            reject(new ProviderFailure("cancelled", "provider request was cancelled"));
            return;
        }
        const timer = setTimeout(resolvePromise, milliseconds);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new ProviderFailure("cancelled", "provider request was cancelled"));
        }, { once: true });
    });
}
function object(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function textFromOpenAi(value) {
    const response = object(value);
    if (typeof response.output_text === "string")
        return response.output_text;
    if (!Array.isArray(response.output))
        return "";
    return response.output
        .flatMap((item) => (Array.isArray(object(item).content) ? object(item).content : []))
        .map((item) => object(item))
        .filter((item) => item.type === "output_text" && typeof item.text === "string")
        .map((item) => item.text)
        .join("");
}
function textFromAnthropic(value) {
    const response = object(value);
    if (!Array.isArray(response.content))
        return "";
    return response.content
        .map((item) => object(item))
        .filter((item) => item.type === "text" && typeof item.text === "string")
        .map((item) => item.text)
        .join("");
}
function usage(value, provider) {
    const record = object(object(value).usage);
    const input = provider === "anthropic" ? record.input_tokens : (record.input_tokens ?? record.prompt_tokens);
    const output = provider === "anthropic" ? record.output_tokens : (record.output_tokens ?? record.completion_tokens);
    return {
        inputTokens: Number.isFinite(input) && Number(input) >= 0 ? Number(input) : 0,
        outputTokens: Number.isFinite(output) && Number(output) >= 0 ? Number(output) : 0,
    };
}
function transportRequest(config, cell, credential, request) {
    if (config.provider === "anthropic") {
        return {
            url: cell.endpoint,
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": credential,
                "anthropic-version": "2023-06-01",
            },
            body: {
                model: config.model,
                max_tokens: request.maxOutputTokens,
                ...(request.system ? { system: request.system } : {}),
                messages: [{ role: "user", content: request.prompt }],
            },
            signal: request.signal,
        };
    }
    return {
        url: cell.endpoint,
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${credential}`,
        },
        body: {
            model: config.model,
            input: request.prompt,
            ...(request.system ? { instructions: request.system } : {}),
            max_output_tokens: request.maxOutputTokens,
            store: false,
        },
        signal: request.signal,
    };
}
function withAbort(promise, signal) {
    if (signal.aborted)
        return Promise.reject(new ProviderFailure("cancelled", "provider request was cancelled or expired"));
    return new Promise((resolvePromise, reject) => {
        const onAbort = () => {
            cleanup();
            reject(new ProviderFailure("cancelled", "provider request was cancelled or expired"));
        };
        const cleanup = () => signal.removeEventListener("abort", onAbort);
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then((value) => {
            cleanup();
            resolvePromise(value);
        }, (error) => {
            cleanup();
            reject(error);
        });
    });
}
export function createProvider(config, options = {}) {
    const cell = cellFor(config.provider);
    if (!cell)
        throw new Error(`[conquistador.provider] unsupported provider: ${config.provider}`);
    if (!config.model.trim() || /^(?:latest|default|auto)$/i.test(config.model)) {
        throw new Error("[conquistador.provider] model ID must be exact");
    }
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(config.credentialEnv)) {
        throw new Error("[conquistador.provider] credentialEnv must be an environment reference");
    }
    const env = options.env ?? process.env;
    const credential = env[config.credentialEnv];
    if (!credential)
        throw new Error(`[conquistador.provider] credential is missing from ${config.credentialEnv}`);
    const transport = options.transport ?? defaultTransport;
    const sleep = options.sleep ?? defaultSleep;
    const now = options.now ?? (() => new Date());
    const stableConfig = structuredClone(config);
    return deepFreeze({
        id: cell.id,
        async generate(request) {
            if (!Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0) {
                throw new ProviderFailure("provider-failure", "provider request has an invalid output ceiling");
            }
            const deadline = Date.parse(request.deadlineAt);
            if (!Number.isFinite(deadline)) {
                throw new ProviderFailure("provider-failure", "provider request deadline is invalid");
            }
            if (request.signal?.aborted)
                throw new ProviderFailure("cancelled", "provider request was cancelled");
            if (now().getTime() >= deadline) {
                throw new ProviderFailure("deadline-exceeded", "provider request deadline was exceeded", true);
            }
            const controller = new AbortController();
            let deadlineExpired = false;
            const interrupted = () => request.signal?.aborted
                ? new ProviderFailure("cancelled", "provider request was cancelled")
                : new ProviderFailure("deadline-exceeded", "provider request deadline was exceeded", true);
            const abortFromCaller = () => controller.abort();
            request.signal?.addEventListener("abort", abortFromCaller, { once: true });
            if (request.signal?.aborted)
                controller.abort();
            const deadlineMilliseconds = deadline - now().getTime();
            const deadlineTimer = setTimeout(() => {
                deadlineExpired = true;
                controller.abort();
            }, deadlineMilliseconds);
            const prepared = transportRequest(stableConfig, cell, credential, { ...request, signal: controller.signal });
            try {
                for (let attempt = 1; attempt <= 3; attempt += 1) {
                    if (controller.signal.aborted || now().getTime() >= deadline) {
                        if (!request.signal?.aborted && now().getTime() >= deadline)
                            deadlineExpired = true;
                        throw interrupted();
                    }
                    let response;
                    try {
                        response = await withAbort(transport(prepared), controller.signal);
                    }
                    catch (error) {
                        if (controller.signal.aborted || deadlineExpired || (error && typeof error === "object" && error.code === "cancelled")) {
                            throw interrupted();
                        }
                        if (attempt < 3) {
                            await sleep(attempt * 250, controller.signal);
                            continue;
                        }
                        throw new ProviderFailure("provider-failure", "provider transport failed after bounded retries", true);
                    }
                    if (response.status >= 200 && response.status < 300) {
                        const record = object(response.json);
                        const rawText = stableConfig.provider === "anthropic"
                            ? textFromAnthropic(record)
                            : textFromOpenAi(record);
                        if (!rawText)
                            throw new ProviderFailure("provider-failure", "provider returned no usable text");
                        const result = {
                            provider: stableConfig.provider,
                            providerCellId: cell.id,
                            ...(typeof record.id === "string" ? { providerRequestId: record.id } : {}),
                            text: String(redact(rawText, [credential])),
                            usage: usage(record, stableConfig.provider),
                        };
                        return deepFreeze(result);
                    }
                    const transient = [408, 409, 425, 429].includes(response.status) || response.status >= 500;
                    if (transient && attempt < 3) {
                        await sleep(attempt * 250, controller.signal);
                        continue;
                    }
                    throw new ProviderFailure("provider-failure", "provider rejected the request without exposing provider detail", transient);
                }
                throw new ProviderFailure("provider-failure", "provider failed after bounded retries", true);
            }
            finally {
                clearTimeout(deadlineTimer);
                request.signal?.removeEventListener("abort", abortFromCaller);
            }
        },
    });
}
