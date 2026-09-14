import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "./canonical.js";
import { buildHumanActionManifest, resolveOperation } from "./operations.js";
export class OperationReconciliationRequired extends Error {
    receipt;
    constructor(receipt) {
        super("Operation dispatch requires host reconciliation; automatic replay is disabled.");
        this.receipt = receipt;
    }
}
function syncDirectory(path) {
    const fd = openSync(path, "r");
    try {
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
}
function durableWrite(path, data, exclusive = false) {
    const fd = openSync(path, exclusive ? "wx" : "w", 0o600);
    try {
        writeFileSync(fd, JSON.stringify(data));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
}
export function validateOperationTerminalReceipt(value) {
    const v = value;
    if (!v || v.schemaVersion !== "conquistador.operation-terminal-receipt/v1" || v.terminalRecord !== true ||
        !/^sha256:[a-f0-9]{64}$/.test(v.catalogReceiptDigest) || !/^sha256:[a-f0-9]{64}$/.test(v.requestDigest) ||
        !["succeeded", "partial", "failed", "pending", "unknown", "rejected", "expired", "blocked"].includes(v.status) ||
        typeof v.usageKnown !== "boolean" || typeof v.accepted !== "boolean" ||
        (v.usageKnown ? (!Number.isFinite(v.unitsUsed) || Number(v.unitsUsed) < 0 || !Number.isFinite(v.costUsed) || Number(v.costUsed) < 0) : (v.unitsUsed !== null || v.costUsed !== null)) ||
        !v.data || typeof v.data !== "object" || Array.isArray(v.data) ||
        Object.keys(v).some((key) => !["schemaVersion", "catalogReceiptDigest", "requestDigest", "status", "terminalRecord", "usageKnown", "accepted", "unitsUsed", "costUsed", "data"].includes(key))) {
        throw new OperationReconciliationRequired();
    }
}
export function hasOperationDispatch(directory, runId, stepId) {
    return existsSync(resolve(directory, "operation-dispatch", `${sha256([runId, stepId]).slice(7)}.json`));
}
export async function invokeDurableOperation(input) {
    const operation = resolveOperation(input.request.operationId, input.catalog);
    const handoff = () => ({
        kind: "human-action-manifest", operation, executed: false, liveCall: false, credentialsUsed: false,
        manifest: buildHumanActionManifest({ operation, known: true, summary: "No supported host binding is available, or this operation needs separate human action authority." }),
    });
    if (operation.actionClass === "consequential" || !input.catalog.records.some((item) => item.id === operation.id))
        return handoff();
    const { signal, ...basis } = input.request;
    // Deadline changes across resume, but the logical operation identity does not.
    const { deadlineAt: _deadline, remainingCost: _remaining, unitsUsedForOperation: _units, ...identity } = basis;
    const digest = sha256(identity);
    const directory = resolve(input.directory, "operation-dispatch");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    syncDirectory(input.directory);
    const path = resolve(directory, `${sha256([basis.runId, basis.stepId]).slice(7)}.json`);
    const idempotencyKey = `runtime-${digest.slice(7)}`;
    if (existsSync(path)) {
        let saved;
        try {
            saved = JSON.parse(readFileSync(path, "utf8"));
        }
        catch {
            throw new OperationReconciliationRequired();
        }
        if (saved.digest !== digest || !saved.result || sha256(saved.result.operation) !== sha256(operation))
            throw new OperationReconciliationRequired();
        if (saved.result.kind === "gateway-receipt") {
            validateOperationTerminalReceipt(saved.result.receipt);
            if (!saved.result.receipt.usageKnown || ["pending", "unknown"].includes(saved.result.receipt.status))
                throw new OperationReconciliationRequired(saved.result.receipt);
        }
        else if (saved.result.kind !== "human-action-manifest")
            throw new OperationReconciliationRequired();
        return saved.result;
    }
    if (!input.bridge)
        throw new OperationReconciliationRequired();
    if (signal.aborted || Date.now() >= Date.parse(basis.deadlineAt))
        throw new OperationReconciliationRequired();
    // Reserve before host preparation or connection resolution, and survive restart.
    try {
        durableWrite(path, { digest, state: "dispatch-intent" }, true);
        syncDirectory(directory);
    }
    catch {
        throw new OperationReconciliationRequired();
    }
    let outcome;
    try {
        outcome = await input.bridge.invoke({ ...input.request, actionClass: operation.actionClass, idempotencyKey });
    }
    catch {
        throw new OperationReconciliationRequired();
    }
    let result;
    if (outcome.kind === "handoff")
        result = handoff();
    else {
        validateOperationTerminalReceipt(outcome.receipt);
        result = { kind: "gateway-receipt", operation, receipt: outcome.receipt };
    }
    const temporary = `${path}.terminal`;
    durableWrite(temporary, { digest, result });
    renameSync(temporary, path);
    syncDirectory(directory);
    if (signal.aborted || (result.kind === "gateway-receipt" && (!result.receipt.usageKnown || ["pending", "unknown"].includes(result.receipt.status))))
        throw new OperationReconciliationRequired(result.kind === "gateway-receipt" ? result.receipt : undefined);
    return result;
}
