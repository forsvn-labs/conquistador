import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeSync, } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { validateArtifactEnvelope, } from "./artifacts.js";
import { sha256 } from "./canonical.js";
export const LOCAL_STATE_SCHEMA = "conquistador.local-state/v1";
export const BACKUP_SCHEMA = "conquistador.backup/v1";
export const EXPORT_SCHEMA = "conquistador.export/v1";
export const LIFECYCLE_RECEIPT_SCHEMA = "conquistador.lifecycle-receipt/v1";
export const RESTORE_JOURNAL_SCHEMA = "conquistador.restore-journal/v1";
export const RETENTION_REPORT_SCHEMA = "conquistador.retention-report/v1";
export const MIGRATION_CHECK_SCHEMA = "conquistador.migration-check/v1";
export const MAX_CONTAINER_BYTES = 268_435_456;
export const MAX_MEMBER_BYTES = 16_777_216;
const LOCK_STALE_MILLISECONDS = 15 * 60 * 1_000;
const MAX_LOCK_BYTES = 4_096;
const LIFECYCLE_DIRECTORIES = [
    "sessions",
    "memory",
    "receipts",
    "diagnostics",
    "tmp",
    "locks",
    "backups",
];
const REQUIRED_CONTROL_DIRECTORIES = new Set(["receipts", "tmp", "locks", "backups"]);
const RUN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i;
const SECRET_VALUE = /(?:sk-[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{20,}|bearer\s+[A-Za-z0-9._-]{8,})/i;
const SECRET_KEY = /(?:authorization|api[-_]?key|token|password|secret|cookie|credential)/i;
const ALLOWED_EXTENSIONS = new Set([".json", ".jsonl", ".md", ".txt", ".yaml"]);
const EXCLUDED_ROOT_ENTRIES = new Set(["tmp", "locks", "backups"]);
const KNOWN_STATE_SCHEMAS = new Set([
    "conquistador.config/v1",
    "conquistador.local-state/v1",
    "conquistador.run-state/v1",
    "conquistador.plan/v1",
    "conquistador.authority-commit/v1",
    "conquistador.learning-entry/v1",
    "conquistador.lifecycle-receipt/v1",
    "conquistador.run-receipt/v1",
    "conquistador.step-receipt/v1",
    "conquistador.artifact-lineage/v1",
    "conquistador.review-contract/v1",
]);
const DATA_CLASSES = new Set([
    "identity",
    "session",
    "artifact",
    "memory",
    "receipt",
    "diagnostic",
]);
const SHA256_SHAPE = /^sha256:[0-9a-f]{64}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVED_SESSION_NAMES = new Set(["learning.jsonl"]);
class RetentionInspectionError extends Error {
    path;
    constructor(path, reason) {
        super(reason);
        this.path = path;
    }
}
function fail(message) {
    throw new Error(`[conquistador.local-state] ${message}`);
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function inject(point, faultAfter) {
    if (faultAfter === point)
        fail(`injected fault after ${point}`);
}
function lstatSafe(path) {
    try {
        return lstatSync(path, { throwIfNoEntry: false });
    }
    catch {
        return undefined;
    }
}
function fingerprint(path) {
    const info = lstatSync(path);
    return { dev: info.dev, ino: info.ino };
}
function sameFingerprint(left, right) {
    return left.dev === right.dev && left.ino === right.ino;
}
function assertRootDirectory(root, create) {
    const existing = lstatSafe(root);
    if (!existing && create)
        mkdirSync(root, { recursive: true });
    const info = lstatSafe(root);
    if (!info)
        fail("configured data root is missing");
    if (info.isSymbolicLink())
        fail("configured data root is a symlink");
    if (!info.isDirectory())
        fail("configured data root is not a real directory");
    return realpathSync(root);
}
function realDirectoryWithinRoot(root, relativeDirectory, create) {
    const rootReal = assertRootDirectory(root, create);
    safeMemberPath(`${relativeDirectory}/.directory-probe`);
    let cursor = root;
    for (const segment of relativeDirectory.split("/")) {
        cursor = resolve(cursor, segment);
        let info = lstatSafe(cursor);
        if (!info && create) {
            mkdirSync(cursor);
            fsyncParentDirectory(cursor);
            info = lstatSafe(cursor);
        }
        if (!info)
            fail(`required state directory is missing: ${relativeDirectory}`);
        if (info.isSymbolicLink()) {
            fail(`state control directory is a symlink: ${relativeDirectory}`);
        }
        if (!info.isDirectory()) {
            fail(`state control path is not a real directory: ${relativeDirectory}`);
        }
        const cursorReal = realpathSync(cursor);
        const rel = relative(rootReal, cursorReal);
        if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
            fail(`state control directory escapes the configured data root: ${relativeDirectory}`);
        }
    }
    return cursor;
}
function validateLifecycleDirectories(root, create) {
    assertRootDirectory(root, create);
    for (const directory of LIFECYCLE_DIRECTORIES) {
        if (!create &&
            !existsSync(resolve(root, directory)) &&
            !REQUIRED_CONTROL_DIRECTORIES.has(directory))
            continue;
        realDirectoryWithinRoot(root, directory, create);
    }
}
function writeAll(fd, bytes) {
    let offset = 0;
    while (offset < bytes.byteLength) {
        const written = writeSync(fd, bytes, offset, bytes.byteLength - offset);
        if (written <= 0)
            fail("filesystem write made no progress");
        offset += written;
    }
}
function fsyncParentDirectory(path) {
    const parent = dirname(path);
    const fd = openSync(parent, constants.O_RDONLY);
    try {
        try {
            fsyncSync(fd);
        }
        catch (error) {
            const code = error.code;
            if (code !== "EINVAL" && code !== "ENOTSUP")
                throw error;
        }
    }
    finally {
        closeSync(fd);
    }
}
function readRegularFileNoFollow(path, label, maxBytes) {
    const before = lstatSafe(path);
    if (!before)
        fail(`${label} is missing`);
    if (before.isSymbolicLink())
        fail(`${label} is a symlink and is not allowed`);
    if (!before.isFile())
        fail(`${label} is not a regular file`);
    const expected = { dev: before.dev, ino: before.ino };
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = fstatSync(fd);
        if (!opened.isFile() || !sameFingerprint(expected, opened)) {
            fail(`${label} changed while it was opened`);
        }
        if (maxBytes !== undefined && opened.size > maxBytes) {
            fail(`${label} exceeds its size quota`);
        }
        const bytes = readFileSync(fd);
        const after = fstatSync(fd);
        if (!sameFingerprint(expected, after)) {
            fail(`${label} changed while it was read`);
        }
        return { bytes, fingerprint: expected };
    }
    finally {
        closeSync(fd);
    }
}
function unlinkUnchangedRegularFile(path, expectedFingerprint, expectedBytes) {
    try {
        const current = readRegularFileNoFollow(path, "owned filesystem entry");
        if (!sameFingerprint(current.fingerprint, expectedFingerprint) ||
            !current.bytes.equals(expectedBytes))
            return false;
        const immediatelyBefore = fingerprint(path);
        if (!sameFingerprint(immediatelyBefore, expectedFingerprint))
            return false;
        unlinkSync(path);
        fsyncParentDirectory(path);
        return true;
    }
    catch {
        return false;
    }
}
function unlinkOwnedRegularFile(path, expectedFingerprint) {
    try {
        const info = lstatSync(path);
        if (info.isSymbolicLink() ||
            !info.isFile() ||
            !sameFingerprint(expectedFingerprint, info))
            return false;
        unlinkSync(path);
        fsyncParentDirectory(path);
        return true;
    }
    catch {
        return false;
    }
}
function digestOf(bytes) {
    return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
export function containWithin(root, candidate) {
    if (!candidate || candidate.includes("\0")) {
        fail("path is empty or contains a NUL byte");
    }
    if (candidate.includes("\\")) {
        fail("path separators must be forward slashes");
    }
    const absolute = isAbsolute(candidate)
        ? resolve(candidate)
        : resolve(root, candidate);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
        fail("path escapes the configured data root");
    }
    let cursor = root;
    for (const segment of rel.split("/").slice(0, -1)) {
        cursor = resolve(cursor, segment);
        const info = existsSync(cursor) ? lstatSafe(cursor) : undefined;
        if (info?.isSymbolicLink())
            fail(`path traverses a symlink: ${rel}`);
    }
    return absolute;
}
function safeMemberPath(path) {
    if (!path || path.includes("\0") || path.includes("\\")) {
        fail(`container member path is unsafe: ${path}`);
    }
    if (isAbsolute(path) || /^[a-zA-Z]:/.test(path)) {
        fail(`container member path must be relative: ${path}`);
    }
    for (const segment of path.split("/")) {
        if (!segment || segment === "." || segment === "..") {
            fail(`container member path escapes its container: ${path}`);
        }
    }
}
function assertRegularFile(path, label) {
    const info = lstatSafe(path);
    if (!info)
        fail(`${label} is missing`);
    if (info.isSymbolicLink())
        fail(`${label} is a symlink and is not allowed`);
    if (!info.isFile())
        fail(`${label} is not a regular file`);
}
export function dataRoot(configDataDir) {
    return resolve(configDataDir);
}
export function ensureLocalStateRoot(root, options) {
    if (!RUN_ID.test(options.instanceId))
        fail("instance id is invalid");
    return withLifecycleLock(root, () => {
        validateLifecycleDirectories(root, true);
        const identityPath = resolve(root, "instance.json");
        if (existsSync(identityPath)) {
            const identity = readLocalStateIdentity(root);
            if (identity.instanceId !== options.instanceId) {
                fail("data root belongs to a different instance");
            }
            return identity;
        }
        const identity = {
            schemaVersion: LOCAL_STATE_SCHEMA,
            instanceId: options.instanceId,
            createdAt: options.now,
        };
        atomicWriteJson(root, identityPath, identity);
        appendLifecycleReceipt(root, {
            op: "state.init",
            at: options.now,
            detail: { instanceId: options.instanceId },
        });
        return identity;
    });
}
export function readLocalStateIdentity(root) {
    const path = resolve(root, "instance.json");
    if (!existsSync(path))
        fail("data root is not initialized");
    assertRegularFile(path, "instance identity");
    let parsed;
    try {
        parsed = JSON.parse(readRegularFileNoFollow(path, "instance identity", MAX_MEMBER_BYTES)
            .bytes.toString("utf8"));
    }
    catch {
        fail("instance identity is corrupt");
    }
    if (!isObject(parsed))
        fail("instance identity is invalid");
    const keys = ["schemaVersion", "instanceId", "createdAt"];
    if (Object.keys(parsed).length !== keys.length ||
        keys.some((key) => !(key in parsed)))
        fail("instance identity fields are not closed");
    if (parsed.schemaVersion !== LOCAL_STATE_SCHEMA) {
        fail("instance identity schema is invalid");
    }
    if (typeof parsed.instanceId !== "string" ||
        !RUN_ID.test(parsed.instanceId))
        fail("instance identity id is invalid");
    return parsed;
}
function classify(relativePath) {
    if (relativePath === "instance.json")
        return "identity";
    if (relativePath === "sessions/learning.jsonl")
        return "memory";
    if (relativePath.startsWith("memory/"))
        return "memory";
    if (relativePath.startsWith("receipts/"))
        return "receipt";
    if (relativePath.startsWith("diagnostics/"))
        return "diagnostic";
    if (relativePath.startsWith("sessions/")) {
        return relativePath.slice("sessions/".length).includes("/artifacts/")
            ? "artifact"
            : "session";
    }
    return fail(`unclassifiable state path: ${relativePath}`);
}
export function inventoryDataRoot(root) {
    const entries = [];
    const seenLower = new Map();
    const walk = (absolute, prefix) => {
        for (const entry of readdirSync(absolute).sort()) {
            if (prefix === "" && EXCLUDED_ROOT_ENTRIES.has(entry))
                continue;
            const childAbsolute = resolve(absolute, entry);
            const info = lstatSafe(childAbsolute);
            if (!info)
                fail(`state path ${prefix}${entry} is not readable`);
            if (info.isSymbolicLink()) {
                fail(`symlinked state path is not allowed: ${prefix}${entry}`);
            }
            if (info.isDirectory()) {
                walk(childAbsolute, `${prefix}${entry}/`);
                continue;
            }
            if (!info.isFile()) {
                fail(`special state file is not allowed: ${prefix}${entry}`);
            }
            const relativePath = `${prefix}${entry}`;
            safeMemberPath(relativePath);
            const extension = entry.match(/\.[a-z]+$/)?.[0] ?? "";
            if (!ALLOWED_EXTENSIONS.has(extension)) {
                fail(`unsupported state file type: ${relativePath}`);
            }
            const lower = relativePath.normalize("NFKC").toLowerCase();
            const collision = seenLower.get(lower);
            if (collision && collision !== relativePath) {
                fail(`case-colliding state paths are not allowed: ${collision} and ${relativePath}`);
            }
            seenLower.set(lower, relativePath);
            if (info.size > MAX_MEMBER_BYTES) {
                fail(`state file exceeds the per-file quota: ${relativePath}`);
            }
            const bytes = readRegularFileNoFollow(childAbsolute, `state path ${relativePath}`, MAX_MEMBER_BYTES).bytes;
            if (bytes.byteLength > MAX_MEMBER_BYTES) {
                fail(`state file exceeds the per-file quota: ${relativePath}`);
            }
            entries.push({
                path: relativePath,
                class: classify(relativePath),
                bytes: bytes.byteLength,
                digest: digestOf(bytes),
            });
        }
    };
    if (!existsSync(root))
        return entries;
    walk(root, "");
    return entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}
function redactText(text) {
    return text.replace(new RegExp(SECRET_VALUE.source, "gi"), "[REDACTED]");
}
function redactedContent(root, entry) {
    const raw = readRegularFileNoFollow(resolve(root, entry.path), `state path ${entry.path}`, MAX_MEMBER_BYTES).bytes.toString("utf8");
    if (entry.path.endsWith(".json")) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            fail(`state file is not valid JSON: ${entry.path}`);
        }
        return `${JSON.stringify(redactValue(parsed), null, 2)}\n`;
    }
    if (entry.path.endsWith(".jsonl")) {
        return raw.split("\n").map((line) => {
            if (!line.trim())
                return line;
            try {
                return JSON.stringify(redactValue(JSON.parse(line)));
            }
            catch {
                fail(`state journal line is not valid JSON: ${entry.path}`);
            }
        }).join("\n");
    }
    return redactText(raw);
}
function redactValue(value) {
    if (Array.isArray(value))
        return value.map(redactValue);
    if (isObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [
            key,
            SECRET_KEY.test(key) ? "[REDACTED]" : redactValue(child),
        ]));
    }
    if (typeof value === "string" && SECRET_VALUE.test(value))
        return "[REDACTED]";
    return value;
}
function assertNoSecretMaterial(files) {
    for (const file of files) {
        if (file.path.endsWith(".json") || file.path.endsWith(".jsonl"))
            continue;
        if (SECRET_VALUE.test(file.content)) {
            fail(`unredacted secret-shaped material in ${file.path}`);
        }
    }
}
function sortedByPath(items) {
    return [...items].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}
function sealContainer(body) {
    return { ...body, manifestDigest: sha256(body) };
}
export function buildLocalBackup(root, options) {
    validateLifecycleDirectories(root, false);
    const identity = readLocalStateIdentity(root);
    inject("inventory", options.faultAfter);
    const entries = inventoryDataRoot(root);
    const files = entries.map((entry) => ({
        path: entry.path,
        encoding: "utf8",
        content: redactedContent(root, entry),
    }));
    const sealed = sealContainer({
        schemaVersion: BACKUP_SCHEMA,
        kind: "backup",
        createdAt: options.now,
        instanceId: identity.instanceId,
        stateSchema: LOCAL_STATE_SCHEMA,
        redaction: "applied",
        fileCount: files.length,
        totalBytes: storedBytes(files),
        inventory: storedInventory(entries, files),
        files: sortedByPath(files),
    });
    assertNoSecretMaterial(sealed.files);
    return sealed;
}
function storedBytes(files) {
    return sortedByPath(files)
        .map((file) => ({ path: file.path, bytes: Buffer.byteLength(file.content, "utf8") }))
        .reduce((sum, file) => sum + file.bytes, 0);
}
function storedInventory(entries, files) {
    const classes = new Map(entries.map((entry) => [entry.path, entry.class]));
    return sortedByPath(files).map((file) => {
        const bytes = Buffer.from(file.content, "utf8");
        return {
            path: file.path,
            class: classes.get(file.path) ?? fail(`unclassified member: ${file.path}`),
            bytes: bytes.byteLength,
            digest: digestOf(bytes),
        };
    });
}
export function createLocalBackup(root, options) {
    return withLifecycleLock(root, () => {
        validateLifecycleDirectories(root, false);
        readLocalStateIdentity(root);
        const target = requireContainerTarget(root, options.file);
        const container = buildLocalBackup(root, {
            now: options.now,
            faultAfter: options.faultAfter,
        });
        inject("payload", options.faultAfter);
        writeContainerAtomic(root, target, container, options.maxContainerBytes);
        inject("manifest", options.faultAfter);
        appendLifecycleReceipt(root, {
            op: "backup.create",
            at: options.now,
            detail: {
                file: relative(root, target),
                manifestDigest: container.manifestDigest,
                fileCount: container.fileCount,
                totalBytes: container.totalBytes,
            },
        });
        return { file: target, container };
    });
}
function requireContainerTarget(root, candidate) {
    realDirectoryWithinRoot(root, "backups", false);
    const target = containWithin(root, candidate);
    const rel = relative(root, target);
    if (!rel.startsWith(`backups/`) || target.endsWith(".tmp")) {
        fail("lifecycle containers must be written under <data-root>/backups/");
    }
    const existing = lstatSafe(target);
    if (existing?.isSymbolicLink()) {
        fail("container target is a symlink and is not allowed");
    }
    return target;
}
function writeContainerAtomic(root, target, container, maxContainerBytes) {
    const bytes = Buffer.from(`${JSON.stringify(container, null, 2)}\n`, "utf8");
    if (bytes.byteLength > (maxContainerBytes ?? MAX_CONTAINER_BYTES)) {
        fail("container exceeds the configured size quota");
    }
    durableReplace(root, target, bytes);
}
function validateContainerBytes(path, maxContainerBytes) {
    const file = readRegularFileNoFollow(path, "container", maxContainerBytes ?? MAX_CONTAINER_BYTES);
    let parsed;
    try {
        parsed = JSON.parse(file.bytes.toString("utf8"));
    }
    catch {
        fail("container is not valid JSON");
    }
    if (!isObject(parsed))
        fail("container is invalid");
    const backupKeys = [
        "schemaVersion",
        "kind",
        "createdAt",
        "instanceId",
        "stateSchema",
        "redaction",
        "fileCount",
        "totalBytes",
        "inventory",
        "files",
        "manifestDigest",
    ];
    const exportKeys = [
        "schemaVersion",
        "kind",
        "createdAt",
        "instanceId",
        "scope",
        "redaction",
        "readme",
        "provenance",
        "fileCount",
        "totalBytes",
        "inventory",
        "files",
        "manifestDigest",
    ];
    const isBackup = parsed.kind === "backup";
    const isExport = parsed.kind === "export";
    if (!isBackup && !isExport)
        fail("container kind is invalid");
    assertExactKeys(parsed, isBackup ? backupKeys : exportKeys, "container metadata");
    if ((isBackup && parsed.schemaVersion !== BACKUP_SCHEMA) ||
        (isExport && parsed.schemaVersion !== EXPORT_SCHEMA))
        fail("container schema is stale or unsupported");
    if (isBackup && parsed.stateSchema !== LOCAL_STATE_SCHEMA) {
        fail("backup state schema is stale or unsupported");
    }
    if (parsed.redaction !== "applied") {
        fail("container redaction policy is invalid");
    }
    if (typeof parsed.createdAt !== "string" ||
        Number.isNaN(Date.parse(parsed.createdAt)))
        fail("container created-at seam is invalid");
    if (typeof parsed.instanceId !== "string" ||
        !RUN_ID.test(parsed.instanceId))
        fail("container instance identity is malformed");
    if (!Number.isInteger(parsed.fileCount) ||
        parsed.fileCount < 0 ||
        !Number.isInteger(parsed.totalBytes) ||
        parsed.totalBytes < 0)
        fail("container counts are malformed");
    if (typeof parsed.manifestDigest !== "string" ||
        !SHA256_SHAPE.test(parsed.manifestDigest)) {
        fail("container manifest digest is malformed");
    }
    if (!Array.isArray(parsed.inventory) || !Array.isArray(parsed.files)) {
        fail("container inventory is malformed");
    }
    const inventory = [];
    const seenLower = new Set();
    const seenPaths = new Set();
    for (const entry of parsed.inventory) {
        if (!isObject(entry) ||
            typeof entry.path !== "string" ||
            typeof entry.bytes !== "number" ||
            typeof entry.digest !== "string" ||
            typeof entry.class !== "string")
            fail("container inventory entry is malformed");
        assertExactKeys(entry, ["path", "class", "bytes", "digest"], "container inventory entry");
        safeMemberPath(entry.path);
        const extension = entry.path.match(/\.[a-z]+$/)?.[0] ?? "";
        if (!ALLOWED_EXTENSIONS.has(extension)) {
            fail(`unsupported container member type: ${entry.path}`);
        }
        if (!DATA_CLASSES.has(entry.class)) {
            fail(`container inventory class is invalid: ${entry.path}`);
        }
        if (classify(entry.path) !== entry.class) {
            fail(`container inventory class does not match its path: ${entry.path}`);
        }
        if (!SHA256_SHAPE.test(entry.digest)) {
            fail(`container inventory digest is malformed: ${entry.path}`);
        }
        if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
            fail(`container inventory size is malformed: ${entry.path}`);
        }
        if (seenPaths.has(entry.path)) {
            fail(`duplicate container member: ${entry.path}`);
        }
        seenPaths.add(entry.path);
        const lower = entry.path.normalize("NFKC").toLowerCase();
        if (seenLower.has(lower)) {
            fail(`case-colliding container members: ${entry.path}`);
        }
        seenLower.add(lower);
        if (entry.bytes > MAX_MEMBER_BYTES) {
            fail(`container member exceeds the per-file quota: ${entry.path}`);
        }
        inventory.push({
            path: entry.path,
            class: entry.class,
            bytes: entry.bytes,
            digest: entry.digest,
        });
    }
    const files = [];
    const payloadPaths = new Set();
    const payloadCollisionKeys = new Set();
    for (const file of parsed.files) {
        if (!isObject(file) ||
            typeof file.path !== "string" ||
            file.encoding !== "utf8" ||
            typeof file.content !== "string")
            fail(`container payload is malformed: ${String(file?.path ?? "?")}`);
        assertExactKeys(file, ["path", "encoding", "content"], "container payload entry");
        safeMemberPath(file.path);
        if (payloadPaths.has(file.path)) {
            fail(`duplicate container payload member: ${file.path}`);
        }
        payloadPaths.add(file.path);
        const collisionKey = file.path.normalize("NFKC").toLowerCase();
        if (payloadCollisionKeys.has(collisionKey)) {
            fail(`case-colliding container payload members: ${file.path}`);
        }
        payloadCollisionKeys.add(collisionKey);
        if (Buffer.byteLength(file.content, "utf8") > MAX_MEMBER_BYTES) {
            fail(`container payload exceeds the per-file quota: ${file.path}`);
        }
        files.push({ path: file.path, encoding: "utf8", content: file.content });
    }
    if (inventory.length !== files.length ||
        inventory.length !== parsed.fileCount ||
        files.length !== parsed.fileCount) {
        fail("container inventory, payload, and file count are not bijective");
    }
    for (const entry of inventory) {
        if (!payloadPaths.has(entry.path)) {
            fail(`container inventory lacks a payload member: ${entry.path}`);
        }
    }
    for (const file of files) {
        if (!seenPaths.has(file.path)) {
            fail(`container payload lacks an inventory entry: ${file.path}`);
        }
    }
    if (files.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0) !== parsed.totalBytes) {
        fail("container total bytes do not match its payload");
    }
    const { manifestDigest: _declared, ...body } = parsed;
    if (sha256(body) !== parsed.manifestDigest) {
        fail("container manifest digest mismatch");
    }
    for (const file of files) {
        const entry = inventory.find((item) => item.path === file.path);
        const bytes = Buffer.from(file.content, "utf8");
        if (bytes.byteLength !== entry.bytes) {
            fail(`container member size mismatch: ${file.path}`);
        }
        if (digestOf(bytes) !== entry.digest) {
            fail(`container member digest mismatch: ${file.path}`);
        }
    }
    assertNoSecretMaterial(files);
    if (isBackup) {
        return {
            schemaVersion: BACKUP_SCHEMA,
            kind: "backup",
            createdAt: parsed.createdAt,
            instanceId: parsed.instanceId,
            stateSchema: LOCAL_STATE_SCHEMA,
            redaction: "applied",
            fileCount: parsed.fileCount,
            totalBytes: parsed.totalBytes,
            inventory,
            files,
            manifestDigest: parsed.manifestDigest,
        };
    }
    if (typeof parsed.scope !== "string" ||
        typeof parsed.readme !== "string" ||
        !isObject(parsed.provenance))
        fail("export metadata is malformed");
    parseLifecycleScope(parsed.scope, ["all", "session", "memory"]);
    const provenance = validateExportProvenance(parsed.provenance, inventory);
    return {
        schemaVersion: EXPORT_SCHEMA,
        kind: "export",
        createdAt: parsed.createdAt,
        instanceId: parsed.instanceId,
        scope: parsed.scope,
        redaction: "applied",
        readme: parsed.readme,
        provenance,
        fileCount: parsed.fileCount,
        totalBytes: parsed.totalBytes,
        inventory,
        files,
        manifestDigest: parsed.manifestDigest,
    };
}
function assertExactKeys(value, keys, label) {
    if (Object.keys(value).length !== keys.length ||
        keys.some((key) => !(key in value)) ||
        Object.keys(value).some((key) => !keys.includes(key)))
        fail(`${label} fields are not closed`);
}
function validateExportProvenance(value, inventory) {
    assertExactKeys(value, ["sourceInventoryDigest", "artifactLineage", "memoryEntries", "receipts"], "export provenance");
    if (typeof value.sourceInventoryDigest !== "string" ||
        !SHA256_SHAPE.test(value.sourceInventoryDigest) ||
        !Array.isArray(value.artifactLineage) ||
        !Number.isInteger(value.memoryEntries) ||
        value.memoryEntries < 0 ||
        !Number.isInteger(value.receipts) ||
        value.receipts < 0)
        fail("export provenance is malformed");
    const artifactLineage = [];
    const seenRunIds = new Set();
    for (const entry of value.artifactLineage) {
        if (!isObject(entry))
            fail("export artifact lineage is malformed");
        assertExactKeys(entry, ["runId", "artifacts"], "export artifact lineage");
        if (typeof entry.runId !== "string" ||
            !RUN_ID.test(entry.runId) ||
            !Number.isInteger(entry.artifacts) ||
            entry.artifacts < 1 ||
            seenRunIds.has(entry.runId))
            fail("export artifact lineage is malformed");
        seenRunIds.add(entry.runId);
        artifactLineage.push({ runId: entry.runId, artifacts: entry.artifacts });
    }
    const expectedLineage = new Map();
    for (const entry of inventory.filter((item) => item.class === "artifact")) {
        const runId = entry.path.split("/")[1];
        if (!runId || !RUN_ID.test(runId))
            fail("export artifact path is malformed");
        expectedLineage.set(runId, (expectedLineage.get(runId) ?? 0) + 1);
    }
    if (artifactLineage.length !== expectedLineage.size ||
        artifactLineage.some((entry) => expectedLineage.get(entry.runId) !== entry.artifacts) ||
        value.memoryEntries !== inventory.filter((entry) => entry.class === "memory").length ||
        value.receipts !== inventory.filter((entry) => entry.class === "receipt").length)
        fail("export provenance counts do not match the inventory");
    return {
        sourceInventoryDigest: value.sourceInventoryDigest,
        artifactLineage,
        memoryEntries: value.memoryEntries,
        receipts: value.receipts,
    };
}
export function verifyBackupContainer(path, options = {}) {
    const absolute = options.root
        ? containWithin(options.root, path)
        : resolve(path);
    const container = validateContainerBytes(absolute, options.maxContainerBytes);
    if (container.schemaVersion !== BACKUP_SCHEMA || container.kind !== "backup") {
        fail("container is not a backup");
    }
    if (options.expectedInstanceId &&
        container.instanceId !== options.expectedInstanceId)
        fail("backup belongs to a different instance; no import mode exists");
    return container;
}
export function verifyExportContainer(path, options = {}) {
    const absolute = options.root
        ? containWithin(options.root, path)
        : resolve(path);
    const container = validateContainerBytes(absolute);
    if (container.schemaVersion !== EXPORT_SCHEMA || container.kind !== "export") {
        fail("container is not an export bundle");
    }
    if (options.expectedInstanceId &&
        container.instanceId !== options.expectedInstanceId)
        fail("export belongs to a different instance");
    return container;
}
export function recoverStaging(root) {
    validateLifecycleDirectories(root, false);
    const tmp = realDirectoryWithinRoot(root, "tmp", false);
    let removed = 0;
    for (const entry of readdirSync(tmp).sort()) {
        const child = resolve(tmp, entry);
        const info = lstatSafe(child);
        if (!info)
            continue;
        if (info.isSymbolicLink())
            fail("staging directory contains a symlink");
        if (info.isDirectory())
            removeSafeDirectoryTree(child, `tmp/${entry}`);
        else if (info.isFile())
            unlinkRegularAndSync(child, `tmp/${entry}`);
        else
            fail(`staging directory contains a special file: ${entry}`);
        removed += 1;
    }
    return removed;
}
function restoreJournalPath(root) {
    return resolve(root, "tmp", "restore-journal.json");
}
const AUDIT_JOURNAL_PATH = "receipts/lifecycle.jsonl";
function materializeContainerFiles(root, container, faultAfter, limitTo) {
    let written = 0;
    for (const file of container.files) {
        if (file.path === AUDIT_JOURNAL_PATH)
            continue;
        if (limitTo && !limitTo.has(file.path))
            continue;
        const target = containWithin(root, file.path);
        if (existsSync(target))
            assertRegularFile(target, `state path ${file.path}`);
        durableReplace(root, target, Buffer.from(file.content, "utf8"));
        written += 1;
        if (faultAfter === "first-file" && written === 1) {
            fail("injected fault after first restored file");
        }
    }
    return written;
}
export function restoreBackup(root, options) {
    return withLifecycleLock(root, () => {
        validateLifecycleDirectories(root, false);
        const identity = readLocalStateIdentity(root);
        recoverInterruptedRestore(root);
        const backupPath = containWithin(root, options.file);
        const container = verifyBackupContainer(backupPath, {
            expectedInstanceId: options.expectedInstanceId ?? identity.instanceId,
        });
        const existing = inventoryDataRoot(root);
        const backupPaths = new Set(container.inventory.map((entry) => entry.path));
        const foreign = existing.filter((entry) => !backupPaths.has(entry.path) && entry.path !== "receipts/lifecycle.jsonl");
        if (foreign.length > 0) {
            fail(`target collision: ${foreign.map((entry) => entry.path).join(", ")}; no import mode exists`);
        }
        const journal = {
            schemaVersion: RESTORE_JOURNAL_SCHEMA,
            phase: "prepared",
            backupFile: backupPath,
            manifestDigest: container.manifestDigest,
            remainingPaths: container.files.map((file) => file.path),
            startedAt: options.now,
        };
        inject("journal", options.faultAfter);
        atomicWriteJson(root, restoreJournalPath(root), journal);
        const written = materializeContainerFiles(root, container, options.faultAfter);
        verifyMaterializedFiles(root, container);
        atomicWriteJson(root, restoreJournalPath(root), { ...journal, phase: "applied" });
        unlinkRegularAndSync(restoreJournalPath(root), "restore journal");
        appendLifecycleReceipt(root, {
            op: "restore.apply",
            at: options.now,
            detail: {
                manifestDigest: container.manifestDigest,
                restoredFiles: written,
            },
        });
        return { restoredFiles: written, manifestDigest: container.manifestDigest };
    });
}
function readRestoreJournal(root) {
    const path = restoreJournalPath(root);
    let parsed;
    try {
        parsed = JSON.parse(readRegularFileNoFollow(path, "restore journal", MAX_MEMBER_BYTES)
            .bytes.toString("utf8"));
    }
    catch {
        fail("restore journal is corrupt");
    }
    if (!isObject(parsed))
        fail("restore journal is invalid");
    const keys = [
        "schemaVersion",
        "phase",
        "backupFile",
        "manifestDigest",
        "remainingPaths",
        "startedAt",
    ];
    if (Object.keys(parsed).length !== keys.length ||
        keys.some((key) => !(key in parsed)))
        fail("restore journal fields are not closed");
    const journal = parsed;
    if (journal.schemaVersion !== RESTORE_JOURNAL_SCHEMA) {
        fail("restore journal schema is invalid");
    }
    if ((journal.phase !== "prepared" && journal.phase !== "applied") ||
        typeof journal.backupFile !== "string" ||
        !Array.isArray(journal.remainingPaths) ||
        journal.remainingPaths.some((entry) => typeof entry !== "string"))
        fail("restore journal is invalid");
    return journal;
}
function verifyMaterializedFiles(root, container) {
    for (const file of container.files) {
        if (file.path === AUDIT_JOURNAL_PATH)
            continue;
        const target = containWithin(root, file.path);
        assertRegularFile(target, `restored state path ${file.path}`);
        const bytes = readRegularFileNoFollow(target, `restored state path ${file.path}`, MAX_MEMBER_BYTES).bytes;
        const expected = Buffer.from(file.content, "utf8");
        if (bytes.byteLength !== expected.byteLength ||
            digestOf(bytes) !== digestOf(expected))
            fail(`restored state drifted from its verified digest: ${file.path}`);
    }
}
export function recoverInterruptedRestore(root) {
    validateLifecycleDirectories(root, false);
    const path = restoreJournalPath(root);
    if (!existsSync(path))
        return { recovered: false, restoredFiles: 0 };
    const identity = readLocalStateIdentity(root);
    const journal = readRestoreJournal(root);
    if (journal.phase !== "prepared") {
        unlinkRegularAndSync(path, "restore journal");
        return { recovered: false, restoredFiles: 0 };
    }
    const backupPath = containWithin(root, journal.backupFile);
    const container = verifyBackupContainer(backupPath, {
        expectedInstanceId: identity.instanceId,
    });
    if (container.manifestDigest !== journal.manifestDigest) {
        fail("restore journal does not match its backup");
    }
    const remaining = new Set(journal.remainingPaths);
    const written = materializeContainerFiles(root, container, undefined, remaining);
    verifyMaterializedFiles(root, container);
    unlinkRegularAndSync(path, "restore journal");
    return { recovered: true, restoredFiles: written };
}
export function parseLifecycleScope(scope, allowed) {
    const separator = scope.indexOf(":");
    const kind = separator < 0 ? scope : scope.slice(0, separator);
    const value = separator < 0 ? undefined : scope.slice(separator + 1);
    if (!allowed.includes(kind)) {
        fail(`unsupported lifecycle scope: ${scope}`);
    }
    if (kind === "all" || kind === "memory") {
        if (value !== undefined)
            fail(`ambiguous lifecycle scope: ${scope}`);
        return kind === "all" ? { kind: "all" } : { kind: "memory" };
    }
    if (!value || !RUN_ID.test(value)) {
        fail(`session scope requires an exact run id: ${scope}`);
    }
    return { kind: "session", runId: value };
}
export function buildExportBundle(root, options) {
    validateLifecycleDirectories(root, false);
    const identity = readLocalStateIdentity(root);
    const parsedScope = parseLifecycleScope(options.scope, [
        "all",
        "session",
        "memory",
    ]);
    const entries = inventoryDataRoot(root);
    const selected = entries.filter((entry) => {
        if (parsedScope.kind === "all")
            return true;
        if (parsedScope.kind === "memory")
            return entry.class === "memory";
        return entry.class === "artifact" &&
            entry.path.startsWith(`sessions/${parsedScope.runId}/`);
    });
    const lineage = [...new Set(selected
            .filter((entry) => entry.class === "artifact")
            .map((entry) => entry.path.split("/")[1]))]
        .sort()
        .map((runId) => ({
        runId,
        artifacts: selected.filter((entry) => entry.class === "artifact" &&
            entry.path.startsWith(`sessions/${runId}/`)).length,
    }));
    const files = selected.map((entry) => ({
        path: entry.path,
        encoding: "utf8",
        content: redactedContent(root, entry),
    }));
    const readme = [
        "Conquistador portable export.",
        "",
        "This bundle is plain UTF-8 JSON. It needs no running service to read.",
        "Each entry in `files` carries one state file with its inventory digest.",
        "`inventory` classes: session (operational run state), artifact (durable work products),",
        "memory (review-promoted learning only), receipt (audit-safe terminal receipts),",
        "diagnostic (never semantic memory), identity (instance record).",
        "Secret-shaped material was replaced with [REDACTED] before export.",
    ].join("\n");
    const sealed = sealContainer({
        schemaVersion: EXPORT_SCHEMA,
        kind: "export",
        createdAt: options.now,
        instanceId: identity.instanceId,
        scope: options.scope,
        redaction: "applied",
        readme,
        provenance: {
            sourceInventoryDigest: sha256(entries),
            artifactLineage: lineage,
            memoryEntries: selected.filter((entry) => entry.class === "memory").length,
            receipts: selected.filter((entry) => entry.class === "receipt").length,
        },
        fileCount: files.length,
        totalBytes: storedBytes(files),
        inventory: storedInventory(entries, files),
        files: sortedByPath(files),
    });
    assertNoSecretMaterial(sealed.files);
    return sealed;
}
export function exportData(root, options) {
    return withLifecycleLock(root, () => {
        validateLifecycleDirectories(root, false);
        readLocalStateIdentity(root);
        const target = requireContainerTarget(root, options.file);
        const container = buildExportBundle(root, {
            scope: options.scope,
            now: options.now,
        });
        writeContainerAtomic(root, target, container);
        appendLifecycleReceipt(root, {
            op: "export.create",
            at: options.now,
            detail: {
                scope: options.scope,
                file: relative(root, target),
                manifestDigest: container.manifestDigest,
            },
        });
        return { file: target, container };
    });
}
export function checkMigration(root) {
    validateLifecycleDirectories(root, false);
    const blockers = [];
    const found = new Set();
    const inspectJson = (path, relativePath) => {
        if (!existsSync(path))
            return;
        try {
            assertRegularFile(path, relativePath);
            const parsed = JSON.parse(readRegularFileNoFollow(path, relativePath, MAX_MEMBER_BYTES)
                .bytes.toString("utf8"));
            if (isObject(parsed) && typeof parsed.schemaVersion === "string") {
                found.add(parsed.schemaVersion);
                if (!KNOWN_STATE_SCHEMAS.has(parsed.schemaVersion)) {
                    blockers.push({
                        path: relativePath,
                        reason: `unsupported schema ${parsed.schemaVersion}`,
                    });
                }
            }
            else {
                blockers.push({ path: relativePath, reason: "missing schemaVersion" });
            }
        }
        catch (error) {
            blockers.push({
                path: relativePath,
                reason: error instanceof Error ? error.message : "unreadable state",
            });
        }
    };
    inspectJson(resolve(root, "instance.json"), "instance.json");
    const sessions = resolve(root, "sessions");
    if (existsSync(sessions)) {
        for (const runId of readdirSync(sessions).sort()) {
            const runDir = resolve(sessions, runId);
            const info = lstatSafe(runDir);
            if (!info)
                continue;
            if (info.isSymbolicLink()) {
                blockers.push({
                    path: `sessions/${runId}`,
                    reason: "symlinked run directory",
                });
                continue;
            }
            if (!info.isDirectory())
                continue;
            inspectJson(resolve(runDir, "state.json"), `sessions/${runId}/state.json`);
        }
        inspectJournal(resolve(sessions, "learning.jsonl"), "sessions/learning.jsonl", found, blockers);
    }
    inspectJournal(resolve(root, "receipts", "lifecycle.jsonl"), "receipts/lifecycle.jsonl", found, blockers);
    return {
        schemaVersion: MIGRATION_CHECK_SCHEMA,
        from: [...found].sort(),
        to: LOCAL_STATE_SCHEMA,
        pending: [],
        blockers,
    };
}
function inspectJournal(path, relativePath, found, blockers) {
    if (!existsSync(path))
        return;
    try {
        assertRegularFile(path, relativePath);
        for (const [index, line] of readRegularFileNoFollow(path, relativePath, MAX_MEMBER_BYTES).bytes.toString("utf8")
            .split("\n")
            .entries()) {
            if (!line.trim())
                continue;
            try {
                const parsed = JSON.parse(line);
                if (isObject(parsed) && typeof parsed.schemaVersion === "string") {
                    found.add(parsed.schemaVersion);
                    if (!KNOWN_STATE_SCHEMAS.has(parsed.schemaVersion)) {
                        blockers.push({
                            path: `${relativePath}:${index + 1}`,
                            reason: `unsupported schema ${parsed.schemaVersion}`,
                        });
                    }
                }
            }
            catch {
                blockers.push({
                    path: `${relativePath}:${index + 1}`,
                    reason: "unreadable journal line",
                });
            }
        }
    }
    catch (error) {
        blockers.push({
            path: relativePath,
            reason: error instanceof Error ? error.message : "unreadable journal",
        });
    }
}
export function applyMigrations(root, options) {
    return withLifecycleLock(root, () => {
        validateLifecycleDirectories(root, false);
        recoverInterruptedRestore(root);
        const check = checkMigration(root);
        if (check.blockers.length > 0) {
            fail(`migration blocked: ${check.blockers
                .map((blocker) => `${blocker.path}: ${blocker.reason}`)
                .join("; ")}`);
        }
        readLocalStateIdentity(root);
        if (check.pending.length === 0)
            return { applied: 0, check };
        appendLifecycleReceipt(root, {
            op: "migrate.apply",
            at: options.now,
            detail: {
                applied: check.pending.length,
                from: check.from,
                to: check.to,
            },
        });
        return { applied: check.pending.length, check };
    });
}
export function hasSuccessfulBackupReceipt(root) {
    return readLifecycleReceipts(root).some((receipt) => receipt.op === "backup.create" && receipt.outcome === "succeeded");
}
export function eraseScope(root, options) {
    if (options.scope !== options.confirm) {
        fail("erase confirmation must equal the exact scope");
    }
    return withLifecycleLock(root, () => {
        validateLifecycleDirectories(root, false);
        readLocalStateIdentity(root);
        recoverInterruptedRestore(root);
        recoverStaging(root);
        const parsed = parseLifecycleScope(options.scope, ["all", "session"]);
        if (options.recoverability === "backup" &&
            !hasSuccessfulBackupReceipt(root)) {
            fail("declared backup recoverability but no successful backup exists");
        }
        const targets = [];
        if (parsed.kind === "session") {
            if (RESERVED_SESSION_NAMES.has(parsed.runId)) {
                fail(`session scope cannot address reserved state: ${options.scope}`);
            }
            const sessionsDir = resolve(root, "sessions");
            const exact = existsSync(sessionsDir) &&
                readdirSync(sessionsDir).some((entry) => entry === parsed.runId);
            if (!exact)
                fail(`scope does not exist: ${options.scope}`);
            targets.push(`sessions/${parsed.runId}`);
        }
        else {
            for (const dir of ["sessions", "memory", "diagnostics"]) {
                if (existsSync(resolve(root, dir)))
                    targets.push(dir);
            }
            if (targets.length === 0)
                fail("scope does not exist: all");
        }
        const entries = inventoryDataRoot(root).filter((entry) => targets.some((target) => entry.path === target || entry.path.startsWith(`${target}/`)));
        if (entries.length === 0)
            fail(`scope does not exist: ${options.scope}`);
        const aggregateDigest = sha256(entries.map((entry) => ({ path: entry.path, digest: entry.digest })));
        const classes = Object.entries(entries.reduce((counts, entry) => {
            counts[entry.class] = (counts[entry.class] ?? 0) + 1;
            return counts;
        }, {})).sort();
        for (const target of targets) {
            const absolute = containWithin(root, target);
            const info = lstatSafe(absolute);
            if (!info)
                continue;
            if (info.isSymbolicLink()) {
                fail(`refusing to follow symlink scope: ${target}`);
            }
            if (info.isDirectory())
                assertSafeRetentionTree(absolute, target);
            else if (!info.isFile())
                fail(`refusing to delete special scope: ${target}`);
        }
        for (const target of targets) {
            const absolute = containWithin(root, target);
            const info = lstatSafe(absolute);
            if (!info)
                continue;
            if (info.isDirectory())
                removeSafeDirectoryTree(absolute, target);
            else
                unlinkRegularAndSync(absolute, target);
            inject("erase-partial", options.faultAfter);
        }
        return appendLifecycleReceipt(root, {
            op: "erase.apply",
            at: options.now,
            terminal: true,
            detail: {
                scope: options.scope,
                recoverability: options.recoverability,
                removedFiles: entries.length,
                removedBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
                classes,
                contentAggregateDigest: aggregateDigest,
            },
        });
    });
}
function removeDirectoryContents(absolute) {
    for (const entry of readdirSync(absolute).sort()) {
        const child = resolve(absolute, entry);
        const info = lstatSafe(child);
        if (!info)
            continue;
        if (info.isSymbolicLink())
            fail(`refusing to delete symlink: ${child}`);
        if (info.isDirectory())
            removeDirectoryContents(child);
        else
            unlinkSync(child);
    }
}
function unlinkRegularAndSync(path, label) {
    const info = lstatSafe(path);
    if (!info)
        fail(`${label} is missing`);
    if (info.isSymbolicLink())
        fail(`${label} is a symlink and is not allowed`);
    if (!info.isFile())
        fail(`${label} is not a regular file`);
    unlinkSync(path);
    fsyncParentDirectory(path);
}
function removeSafeDirectoryTree(path, label) {
    assertSafeRetentionTree(path, label);
    removeDirectoryContents(path);
    rmSync(path, { recursive: true, force: false });
    fsyncParentDirectory(path);
}
export function enforceRetention(root, policy, options) {
    if (options.apply) {
        return withLifecycleLock(root, () => {
            validateLifecycleDirectories(root, false);
            return enforceRetentionUnlocked(root, policy, options);
        });
    }
    validateLifecycleDirectories(root, false);
    return enforceRetentionUnlocked(root, policy, options);
}
function enforceRetentionUnlocked(root, policy, options) {
    const report = {
        schemaVersion: RETENTION_REPORT_SCHEMA,
        now: options.now,
        sessionRetentionDays: policy.sessionRetentionDays,
        traceRetentionDays: policy.traceRetentionDays,
        artifactPolicy: policy.artifactPolicy,
        expiredSessions: [],
        protectedSessions: [],
        prunedTraces: [],
        blockers: [],
    };
    const sessions = resolve(root, "sessions");
    if (!existsSync(sessions))
        return report;
    const nowMs = Date.parse(options.now);
    if (Number.isNaN(nowMs))
        fail("retention clock is invalid");
    const sessionCutoff = nowMs - policy.sessionRetentionDays * 86_400_000;
    const traceCutoff = nowMs - policy.traceRetentionDays * 86_400_000;
    const protectedStatuses = new Set([
        "approved",
        "acted",
        "observed",
        ...(policy.artifactPolicy === "reviewed" ? ["reviewed"] : []),
    ]);
    for (const runId of readdirSync(sessions).sort()) {
        const runDir = resolve(sessions, runId);
        const info = lstatSafe(runDir);
        if (!info) {
            report.blockers.push({ path: `sessions/${runId}`, reason: "unreadable run" });
            continue;
        }
        if (info.isSymbolicLink()) {
            report.blockers.push({ path: `sessions/${runId}`, reason: "symlinked run" });
            continue;
        }
        if (!info.isDirectory())
            continue;
        const statePath = resolve(runDir, "state.json");
        if (!existsSync(statePath)) {
            report.blockers.push({
                path: `sessions/${runId}/state.json`,
                reason: "missing state",
            });
            continue;
        }
        try {
            const state = parseRetentionObject(statePath, `sessions/${runId}/state.json`);
            if (typeof state.status !== "string") {
                throw new RetentionInspectionError(`sessions/${runId}/state.json`, "run state status is missing or invalid");
            }
            const updated = typeof state.updatedAt === "string"
                ? Date.parse(state.updatedAt)
                : Number.NaN;
            if (Number.isNaN(updated)) {
                throw new RetentionInspectionError(`sessions/${runId}/state.json`, "run state updatedAt is missing or invalid");
            }
            let protectedRun = false;
            if (state.artifacts !== undefined && !isObject(state.artifacts)) {
                throw new RetentionInspectionError(`sessions/${runId}/state.json`, "run state artifact declarations are invalid");
            }
            const artifactDeclarations = state.artifacts === undefined
                ? []
                : Object.entries(state.artifacts);
            const artifactsDir = resolve(runDir, "artifacts");
            if (artifactDeclarations.length > 0 && !existsSync(artifactsDir)) {
                throw new RetentionInspectionError(`sessions/${runId}/artifacts`, "declared artifact directory is missing");
            }
            if (existsSync(artifactsDir)) {
                const artifactsInfo = lstatSafe(artifactsDir);
                if (!artifactsInfo ||
                    artifactsInfo.isSymbolicLink() ||
                    !artifactsInfo.isDirectory()) {
                    throw new RetentionInspectionError(`sessions/${runId}/artifacts`, "artifact envelope directory is not a real directory");
                }
                const inspectedEnvelopes = new Set();
                if (artifactDeclarations.length > 0) {
                    for (const [artifactId, declaration] of artifactDeclarations) {
                        if (!isObject(declaration) || typeof declaration.path !== "string") {
                            throw new RetentionInspectionError(`sessions/${runId}/state.json`, `artifact declaration is invalid: ${artifactId}`);
                        }
                        const envelopeRelative = declaration.envelopePath === undefined
                            ? `artifacts/${artifactId}.meta.json`
                            : declaration.envelopePath;
                        if (typeof envelopeRelative !== "string") {
                            throw new RetentionInspectionError(`sessions/${runId}/state.json`, `artifact envelope declaration is invalid: ${artifactId}`);
                        }
                        readRequiredRunArtifact(runDir, runId, declaration.path, "artifact payload");
                        const envelope = inspectRetentionEnvelope(runDir, runId, envelopeRelative, artifactId);
                        if (declaration.path !== artifactPayloadPath(envelope)) {
                            throw new RetentionInspectionError(`sessions/${runId}/state.json`, `artifact declaration path does not match its envelope: ${artifactId}`);
                        }
                        inspectedEnvelopes.add(envelopeRelative);
                        if (protectedStatuses.has(envelope.status))
                            protectedRun = true;
                    }
                }
                for (const envelope of readdirSync(artifactsDir).sort()) {
                    const artifactPath = resolve(artifactsDir, envelope);
                    const artifactInfo = lstatSafe(artifactPath);
                    if (!artifactInfo) {
                        throw new RetentionInspectionError(`sessions/${runId}/artifacts/${envelope}`, "artifact path is unreadable");
                    }
                    if (artifactInfo.isSymbolicLink() || !artifactInfo.isFile()) {
                        throw new RetentionInspectionError(`sessions/${runId}/artifacts/${envelope}`, "artifact path is not a regular file");
                    }
                    if (envelope.endsWith(".meta.json")) {
                        const relativeEnvelope = `artifacts/${envelope}`;
                        let inspected;
                        if (!inspectedEnvelopes.has(relativeEnvelope)) {
                            inspected = inspectRetentionEnvelope(runDir, runId, relativeEnvelope);
                            if (protectedStatuses.has(inspected.status))
                                protectedRun = true;
                        }
                        else {
                            inspected = inspectRetentionEnvelope(runDir, runId, relativeEnvelope);
                        }
                        if (!existsSync(resolve(runDir, artifactPayloadPath(inspected)))) {
                            throw new RetentionInspectionError(`sessions/${runId}/artifacts/${envelope}`, "artifact envelope has no payload");
                        }
                        continue;
                    }
                    const dot = envelope.lastIndexOf(".");
                    if (dot <= 0) {
                        throw new RetentionInspectionError(`sessions/${runId}/artifacts/${envelope}`, "artifact payload has no envelope");
                    }
                    const requiredEnvelope = resolve(artifactsDir, `${envelope.slice(0, dot)}.meta.json`);
                    if (!existsSync(requiredEnvelope)) {
                        throw new RetentionInspectionError(`sessions/${runId}/artifacts/${envelope.slice(0, dot)}.meta.json`, "artifact payload has no envelope");
                    }
                }
            }
            if (protectedRun)
                report.protectedSessions.push(runId);
            const tracePath = resolve(runDir, "trace.json");
            if (!existsSync(tracePath)) {
                throw new RetentionInspectionError(`sessions/${runId}/trace.json`, "missing required trace");
            }
            const parsedTrace = parseRetentionJson(tracePath, `sessions/${runId}/trace.json`);
            if (!Array.isArray(parsedTrace)) {
                throw new RetentionInspectionError(`sessions/${runId}/trace.json`, "trace is not an array");
            }
            const trace = parsedTrace.map((event, index) => {
                if (!isObject(event) ||
                    !Number.isInteger(event.sequence) ||
                    event.sequence !== index + 1 ||
                    typeof event.at !== "string" ||
                    Number.isNaN(Date.parse(event.at))) {
                    throw new RetentionInspectionError(`sessions/${runId}/trace.json`, `trace event ${index + 1} is invalid`);
                }
                return event;
            });
            if (protectedRun) {
                continue;
            }
            const terminal = ["completed", "failed", "cancelled", "rejected"]
                .includes(state.status ?? "");
            if (terminal && updated < sessionCutoff) {
                assertSafeRetentionTree(runDir, `sessions/${runId}`);
                report.expiredSessions.push(runId);
                if (options.apply) {
                    removeSafeDirectoryTree(runDir, `sessions/${runId}`);
                }
                continue;
            }
            const retained = trace.filter((event) => Date.parse(event.at) >= traceCutoff);
            if (retained.length < trace.length) {
                report.prunedTraces.push({
                    runId,
                    removedEvents: trace.length - retained.length,
                });
                if (options.apply) {
                    atomicWriteJson(root, tracePath, retained.map((event, index) => ({ ...event, sequence: index + 1 })));
                }
            }
        }
        catch (error) {
            report.blockers.push({
                path: error instanceof RetentionInspectionError
                    ? error.path
                    : `sessions/${runId}`,
                reason: error instanceof Error ? error.message : "unreadable run",
            });
        }
    }
    if (options.apply &&
        (report.expiredSessions.length > 0 || report.prunedTraces.length > 0)) {
        appendLifecycleReceipt(root, {
            op: "retention.apply",
            at: options.now,
            detail: {
                expiredSessions: report.expiredSessions,
                prunedTraces: report.prunedTraces,
                artifactPolicy: report.artifactPolicy,
            },
        });
    }
    return report;
}
function parseRetentionJson(path, label) {
    let file;
    try {
        file = readRegularFileNoFollow(path, label);
    }
    catch (error) {
        throw new RetentionInspectionError(label, error instanceof Error ? error.message : "unreadable required state");
    }
    try {
        return JSON.parse(file.bytes.toString("utf8"));
    }
    catch {
        throw new RetentionInspectionError(label, "corrupt required state");
    }
}
function readRequiredRunArtifact(runDirectory, runId, relativePath, kind) {
    const label = `sessions/${runId}/${relativePath}`;
    try {
        safeMemberPath(relativePath);
        const pathShape = kind === "artifact envelope"
            ? /^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]*\.meta\.json$/
            : /^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:md|json)$/;
        if (!pathShape.test(relativePath)) {
            throw new Error(`${kind} path is not canonical`);
        }
        const path = containWithin(runDirectory, relativePath);
        return readRegularFileNoFollow(path, label, MAX_MEMBER_BYTES).bytes;
    }
    catch (error) {
        throw new RetentionInspectionError(label, `${kind} is missing, unreadable, or unsafe: ${error instanceof Error ? error.message : "invalid artifact path"}`);
    }
}
function inspectRetentionEnvelope(runDirectory, runId, relativePath, expectedArtifactId) {
    const label = `sessions/${runId}/${relativePath}`;
    const bytes = readRequiredRunArtifact(runDirectory, runId, relativePath, "artifact envelope");
    let parsed;
    try {
        parsed = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new RetentionInspectionError(label, "corrupt artifact envelope");
    }
    try {
        validateArtifactEnvelope(parsed);
    }
    catch (error) {
        throw new RetentionInspectionError(label, `artifact envelope is structurally invalid: ${error instanceof Error ? error.message : "invalid envelope"}`);
    }
    const pathArtifactId = relativePath.slice("artifacts/".length, -".meta.json".length);
    if (parsed.provenance.runId !== runId ||
        parsed.identity.artifactId !== pathArtifactId ||
        (expectedArtifactId !== undefined && parsed.identity.artifactId !== expectedArtifactId)) {
        throw new RetentionInspectionError(label, "artifact envelope identity does not match its run or path");
    }
    return parsed;
}
function artifactPayloadPath(envelope) {
    return `artifacts/${envelope.identity.artifactId}.${envelope.identity.format === "markdown" ? "md" : "json"}`;
}
function parseRetentionObject(path, label) {
    const parsed = parseRetentionJson(path, label);
    if (!isObject(parsed)) {
        throw new RetentionInspectionError(label, "required state is not an object");
    }
    return parsed;
}
function assertSafeRetentionTree(directory, label) {
    const info = lstatSafe(directory);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) {
        fail(`${label} is not a removable real directory`);
    }
    for (const entry of readdirSync(directory).sort()) {
        const child = resolve(directory, entry);
        const childInfo = lstatSafe(child);
        if (!childInfo)
            fail(`${label}/${entry} is unreadable`);
        if (childInfo.isSymbolicLink())
            fail(`${label}/${entry} is a symlink`);
        if (childInfo.isDirectory())
            assertSafeRetentionTree(child, `${label}/${entry}`);
        else if (!childInfo.isFile())
            fail(`${label}/${entry} is not a regular file`);
    }
}
export function readLifecycleReceipts(root) {
    const receiptsDirectory = realDirectoryWithinRoot(root, "receipts", false);
    const path = resolve(receiptsDirectory, "lifecycle.jsonl");
    if (!existsSync(path))
        return [];
    const file = readRegularFileNoFollow(path, "lifecycle receipt journal");
    const receipts = [];
    for (const [index, line] of file.bytes.toString("utf8")
        .split("\n")
        .entries()) {
        if (!line.trim())
            continue;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            fail(`lifecycle receipt line ${index + 1} is not valid JSON`);
        }
        validateLifecycleReceipt(parsed);
        receipts.push(parsed);
    }
    return receipts;
}
export function validateLifecycleReceipt(value) {
    if (!isObject(value))
        fail("lifecycle receipt must be an object");
    const keys = [
        "schemaVersion",
        "id",
        "op",
        "at",
        "outcome",
        "detail",
        "redaction",
        "terminal",
    ];
    if (Object.keys(value).some((key) => !keys.includes(key)) ||
        value.schemaVersion !== LIFECYCLE_RECEIPT_SCHEMA ||
        typeof value.id !== "string" ||
        typeof value.at !== "string" ||
        value.outcome !== "succeeded" ||
        !isObject(value.detail) ||
        value.redaction !== "applied")
        fail("lifecycle receipt is invalid");
    if (![
        "state.init",
        "backup.create",
        "restore.apply",
        "migrate.apply",
        "export.create",
        "erase.apply",
        "retention.apply",
    ].includes(value.op))
        fail("lifecycle receipt op is invalid");
    if (Number.isNaN(Date.parse(value.at))) {
        fail("lifecycle receipt time is invalid");
    }
}
function nextReceiptId(root, op) {
    return `${op}.${readLifecycleReceipts(root).length + 1}`;
}
function appendLifecycleReceipt(root, input) {
    const receipt = {
        schemaVersion: LIFECYCLE_RECEIPT_SCHEMA,
        id: nextReceiptId(root, input.op),
        op: input.op,
        at: input.at,
        outcome: "succeeded",
        detail: input.detail,
        redaction: "applied",
        ...(input.terminal ? { terminal: true } : {}),
    };
    validateLifecycleReceipt(receipt);
    const serialized = `${JSON.stringify(receipt)}\n`;
    if (SECRET_VALUE.test(serialized))
        fail("receipt would carry secret material");
    const receiptsDirectory = realDirectoryWithinRoot(root, "receipts", false);
    const path = resolve(receiptsDirectory, "lifecycle.jsonl");
    const existing = lstatSafe(path);
    if (existing?.isSymbolicLink())
        fail("lifecycle receipt journal is a symlink");
    if (existing && !existing.isFile()) {
        fail("lifecycle receipt journal is not a regular file");
    }
    const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT |
        constants.O_NOFOLLOW, 0o600);
    try {
        if (existing) {
            const opened = fstatSync(fd);
            if (!sameFingerprint({ dev: existing.dev, ino: existing.ino }, opened)) {
                fail("lifecycle receipt journal changed while it was opened");
            }
        }
        writeAll(fd, Buffer.from(serialized, "utf8"));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    if (!existing)
        fsyncParentDirectory(path);
    return receipt;
}
export function withLifecycleLock(root, operation) {
    const locks = realDirectoryWithinRoot(root, "locks", true);
    const lockPath = resolve(locks, "lifecycle.lock");
    const owner = randomUUID();
    const record = {
        acquiredAt: new Date().toISOString(),
        owner,
        pid: process.pid,
    };
    const ownedBytes = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
    let ownedFingerprint;
    for (;;) {
        try {
            const fd = openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
                constants.O_NOFOLLOW, 0o600);
            try {
                writeAll(fd, ownedBytes);
                fsyncSync(fd);
                const info = fstatSync(fd);
                ownedFingerprint = { dev: info.dev, ino: info.ino };
            }
            finally {
                closeSync(fd);
            }
            fsyncParentDirectory(lockPath);
            break;
        }
        catch (error) {
            if (!(error instanceof Error) ||
                error.code !== "EEXIST")
                throw error;
            const existing = readLifecycleLock(lockPath);
            const age = Date.now() - Date.parse(existing.record.acquiredAt);
            if (age <= LOCK_STALE_MILLISECONDS ||
                processOwnerLiveness(existing.record.pid) !== "dead")
                fail("another lifecycle operation holds the local lock");
            if (!unlinkUnchangedRegularFile(lockPath, existing.fingerprint, existing.bytes))
                fail("another lifecycle operation holds the local lock");
        }
    }
    try {
        return operation();
    }
    finally {
        try {
            const lock = readLifecycleLock(lockPath);
            if (ownedFingerprint &&
                lock.record.owner === owner &&
                lock.record.pid === process.pid) {
                unlinkUnchangedRegularFile(lockPath, ownedFingerprint, ownedBytes);
            }
        }
        catch {
            // Unreadable, foreign, replaced, or non-owned lock bytes are never removed.
        }
    }
}
function readLifecycleLock(path) {
    let file;
    try {
        file = readRegularFileNoFollow(path, "lifecycle lock", MAX_LOCK_BYTES);
    }
    catch {
        return fail("lifecycle lock metadata is unreadable or invalid");
    }
    let parsed;
    try {
        parsed = JSON.parse(file.bytes.toString("utf8"));
    }
    catch {
        return fail("lifecycle lock metadata is unreadable or invalid");
    }
    if (!isObject(parsed))
        fail("lifecycle lock metadata is invalid");
    assertExactKeys(parsed, ["acquiredAt", "owner", "pid"], "lifecycle lock metadata");
    if (typeof parsed.acquiredAt !== "string" ||
        Number.isNaN(Date.parse(parsed.acquiredAt)) ||
        typeof parsed.owner !== "string" ||
        !UUID_SHAPE.test(parsed.owner) ||
        !Number.isSafeInteger(parsed.pid) ||
        parsed.pid <= 0)
        fail("lifecycle lock metadata is invalid");
    return {
        record: {
            acquiredAt: parsed.acquiredAt,
            owner: parsed.owner,
            pid: parsed.pid,
        },
        ...file,
    };
}
function processOwnerLiveness(pid) {
    try {
        process.kill(pid, 0);
        return "live";
    }
    catch (error) {
        const code = error.code;
        if (code === "ESRCH")
            return "dead";
        if (code === "EPERM")
            return "live";
        return "unknown";
    }
}
function durableReplace(root, target, bytes) {
    const absolute = containWithin(root, target);
    const targetParent = dirname(absolute);
    const parentRelative = relative(root, targetParent);
    if (parentRelative)
        realDirectoryWithinRoot(root, parentRelative, true);
    else
        assertRootDirectory(root, false);
    const existing = lstatSafe(absolute);
    if (existing?.isSymbolicLink()) {
        fail(`refusing to replace a symlink: ${relative(root, absolute)}`);
    }
    if (existing && !existing.isFile()) {
        fail(`replacement target is not a regular file: ${relative(root, absolute)}`);
    }
    const temporary = resolve(targetParent, `.${basename(absolute)}.${process.pid}.${randomUUID()}.tmp`);
    let temporaryFingerprint;
    const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
        constants.O_NOFOLLOW, 0o600);
    try {
        try {
            const opened = fstatSync(fd);
            temporaryFingerprint = { dev: opened.dev, ino: opened.ino };
            writeAll(fd, bytes);
            fsyncSync(fd);
        }
        finally {
            closeSync(fd);
        }
        renameSync(temporary, absolute);
        temporaryFingerprint = undefined;
        fsyncParentDirectory(absolute);
    }
    finally {
        if (temporaryFingerprint) {
            unlinkOwnedRegularFile(temporary, temporaryFingerprint);
        }
    }
}
function atomicWriteJson(root, path, value) {
    durableReplace(root, path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}
