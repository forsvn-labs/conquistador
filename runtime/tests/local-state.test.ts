import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildArtifactEnvelope,
  type ArtifactStatus,
} from "../src/artifacts.ts";
import { sha256 } from "../src/canonical.ts";
import {
  applyMigrations,
  buildExportBundle,
  buildLocalBackup,
  checkMigration,
  createLocalBackup,
  dataRoot,
  ensureLocalStateRoot,
  enforceRetention,
  eraseScope,
  exportData,
  inventoryDataRoot,
  parseLifecycleScope,
  readLifecycleReceipts,
  recoverInterruptedRestore,
  recoverStaging,
  restoreBackup,
  validateLifecycleReceipt,
  verifyBackupContainer,
  verifyExportContainer,
  withLifecycleLock,
} from "../src/local-state.ts";

const temporary: string[] = [];
const NOW = "2026-08-21T00:00:00.000Z";

afterEach(() => {
  for (const path of temporary.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function freshRoot(label: string): string {
  const root = resolve(mkdtempSync(resolve(tmpdir(), `conquistador-state-${label}-`)), "data");
  temporary.push(resolve(root, ".."));
  ensureLocalStateRoot(root, { instanceId: "state-test", now: NOW });
  return root;
}

function writeState(root: string, relativePath: string, content: string): void {
  const absolute = resolve(root, relativePath);
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  writeFileSync(absolute, content);
}

function bareRoot(label: string): string {
  const directory = mkdtempSync(resolve(tmpdir(), `conquistador-state-${label}-`));
  temporary.push(directory);
  const root = resolve(directory, "data");
  mkdirSync(root);
  return root;
}

function snapshotFiles(root: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  const walk = (directory: string, prefix = ""): void => {
    for (const entry of readdirSync(directory).sort()) {
      const absolute = resolve(directory, entry);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      const info = lstatSync(absolute);
      if (info.isDirectory()) walk(absolute, relativePath);
      else snapshot[relativePath] = readFileSync(absolute).toString("base64");
    }
  };
  walk(root);
  return snapshot;
}

function reseal(record: Record<string, unknown>): Record<string, unknown> {
  const { manifestDigest: _ignored, ...body } = record;
  return { ...body, manifestDigest: sha256(body) };
}

function writeResealed(
  path: string,
  record: Record<string, unknown>,
): void {
  writeFileSync(path, JSON.stringify(reseal(record), null, 2));
}

function oldLock(pid: number, owner: string): string {
  return `${JSON.stringify({
    acquiredAt: "2000-01-01T00:00:00.000Z",
    owner,
    pid,
  })}\n`;
}

function writeArtifactPair(
  root: string,
  runId: string,
  status: ArtifactStatus,
): void {
  const content = `${status}\n`;
  writeState(root, `sessions/${runId}/artifacts/result.md`, content);
  const envelope = buildArtifactEnvelope({
    artifactId: "result",
    schema: "conquistador.test-artifact/v1",
    format: "markdown",
    playbookId: "retention-test",
    playbookVersion: "1.0.0",
    runId,
    stepId: "produce-result",
    parents: [],
    contentDigest: sha256(content),
    producedAt: NOW,
    status,
  });
  writeState(
    root,
    `sessions/${runId}/artifacts/result.meta.json`,
    JSON.stringify(envelope),
  );
}

describe("local state lifecycle", () => {
  it("builds byte-identical containers from identical state under a fixed clock", () => {
    const root = freshRoot("determinism");
    writeState(root, "diagnostics/note.md", "operator note\n");
    const first = buildLocalBackup(root, { now: NOW });
    const second = buildLocalBackup(root, { now: NOW });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.manifestDigest).toBe(second.manifestDigest);
  });

  it("redacts secret-shaped material in markdown, json, and jsonl members", () => {
    const root = freshRoot("redaction");
    writeState(root, "diagnostics/notes.md", "token bearer Zx9qW3rTyAsDfGhJ12 here\n");
    writeState(
      root,
      "memory/learning.jsonl",
      `${JSON.stringify({
        schemaVersion: "conquistador.learning-entry/v1",
        id: "x",
        recordedAt: NOW,
        runId: "run-x",
        kind: "fact",
        approved: true,
        inferred: false,
        source: { artifactId: "a", contentDigest: `sha256:${"0".repeat(64)}` },
        body: { note: "sk-probe123456789" },
      })}\n`,
    );
    const container = buildLocalBackup(root, { now: NOW });
    const notes = container.files.find((file) => file.path === "diagnostics/notes.md")!;
    expect(notes.content).toContain("[REDACTED]");
    expect(notes.content).not.toContain("Zx9qW3rTyAsDfGhJ12");
    const ledger = container.files.find((file) => file.path === "memory/learning.jsonl")!;
    expect(ledger.content).not.toContain("sk-probe123456789");
    expect(ledger.content).toContain("[REDACTED]");
  });

  it("keeps the append-only receipt journal across restore", () => {
    const root = freshRoot("journal");
    writeState(root, "sessions/run-a/state.json", JSON.stringify({ status: "cancelled" }));
    createLocalBackup(root, { file: "backups/a.json", now: NOW });
    const before = readLifecycleReceipts(root).map((receipt) => receipt.id);
    restoreBackup(root, { file: "backups/a.json", now: NOW });
    const after = readLifecycleReceipts(root).map((receipt) => receipt.id);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.length).toBeGreaterThan(before.length);
    expect(readLifecycleReceipts(root).at(-1)!.op).toBe("restore.apply");
  });

  it("exports only the requested class scope and stays readable without the runtime", () => {
    const root = freshRoot("export");
    writeState(root, "sessions/run-a/state.json", JSON.stringify({ status: "cancelled" }));
    writeState(
      root,
      "memory/learning.jsonl",
      `${JSON.stringify({ schemaVersion: "conquistador.learning-entry/v1" })}\n`,
    );
    const bundle = buildExportBundle(root, { scope: "memory", now: NOW });
    expect(bundle.inventory.map((entry) => entry.path)).toEqual([
      "memory/learning.jsonl",
    ]);
    expect(bundle.provenance.memoryEntries).toBe(1);
    expect(bundle.readme).toContain("no running service");
    expect(() =>
      buildExportBundle(root, { scope: "workspace:all", now: NOW }),
    ).toThrow(/unsupported lifecycle scope/);
  });

  it("rejects identity drift, tampered receipts, wrong kinds, and symlinked targets", () => {
    const root = freshRoot("guards");
    expect(() =>
      ensureLocalStateRoot(root, { instanceId: "other-instance", now: NOW }),
    ).toThrow(/different instance/);

    const receiptsPath = resolve(root, "receipts/lifecycle.jsonl");
    const lines = readFileSync(receiptsPath, "utf8").trim().split("\n");
    writeFileSync(receiptsPath, `${lines[0]!}\n{"schemaVersion":"bogus"}\n`);
    expect(() => readLifecycleReceipts(root)).toThrow(/lifecycle receipt is invalid/);
    expect(() => validateLifecycleReceipt(null)).toThrow();
    writeFileSync(receiptsPath, `${lines[0]}\n`);

    createLocalBackup(root, { file: "backups/a.json", now: NOW });
    const container = JSON.parse(
      readFileSync(resolve(root, "backups/a.json"), "utf8"),
    ) as Record<string, unknown>;
    container.kind = "export";
    const { manifestDigest: _dropped, ...body } = container;
    const swappedRecord = { ...body, manifestDigest: sha256(body) };
    const swapped = resolve(root, "backups/swapped.json");
    writeFileSync(swapped, JSON.stringify(swappedRecord));
    expect(() => verifyBackupContainer(swapped)).toThrow(/not a backup|not closed/);
    expect(() => verifyExportContainer(swapped)).toThrow(/not an export bundle|not closed/);

    rmSync(resolve(root, "backups/a.json"));
    symlinkSync(swapped, resolve(root, "backups/a.json"));
    expect(() =>
      createLocalBackup(root, { file: "backups/a.json", now: NOW }),
    ).toThrow(/symlink|escapes|regular file/);
  });

  it("enforces exact scope grammar and preserves receipts, identity, and backups on erase-all", () => {
    const root = freshRoot("erase-all");
    writeState(root, "sessions/run-a/state.json", JSON.stringify({ status: "cancelled" }));
    writeState(root, "diagnostics/d.md", "note\n");
    createLocalBackup(root, { file: "backups/keep.json", now: NOW });
    expect(parseLifecycleScope("session:Run-1", ["all", "session"])).toEqual({
      kind: "session",
      runId: "Run-1",
    });
    expect(parseLifecycleScope("memory", ["all", "session", "memory"])).toEqual({
      kind: "memory",
    });
    eraseScope(root, {
      scope: "all",
      confirm: "all",
      recoverability: "backup",
      now: NOW,
    });
    expect(existsSync(resolve(root, "sessions"))).toBe(false);
    expect(existsSync(resolve(root, "diagnostics"))).toBe(false);
    expect(existsSync(resolve(root, "instance.json"))).toBe(true);
    expect(existsSync(resolve(root, "backups/keep.json"))).toBe(true);
    const ops = readLifecycleReceipts(root).map((receipt) => receipt.op);
    expect(ops).toContain("erase.apply");
    expect(ops).toContain("backup.create");
    expect(inventoryDataRoot(root).every((entry) => entry.class !== "session")).toBe(
      true,
    );
  });

  it("keeps every run byte when applying retention finds a corrupt required envelope", () => {
    const root = freshRoot("retention");
    writeState(
      root,
      "sessions/run-old/state.json",
      JSON.stringify({
        status: "cancelled",
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
    );
    mkdirSync(resolve(root, "sessions/run-old/artifacts"), { recursive: true });
    writeFileSync(
      resolve(root, "sessions/run-old/artifacts/broken.meta.json"),
      "{corrupt",
    );
    writeState(root, "sessions/run-old/artifacts/broken.md", "must survive\n");
    writeState(
      root,
      "sessions/run-old/trace.json",
      JSON.stringify([{ sequence: 1, at: "2026-06-01T00:00:00.000Z" }]),
    );
    writeState(root, "sessions/run-state/state.json", "{corrupt");
    writeState(
      root,
      "sessions/run-state/trace.json",
      JSON.stringify([{ sequence: 1, at: "2026-06-01T00:00:00.000Z" }]),
    );
    writeState(
      root,
      "sessions/run-trace/state.json",
      JSON.stringify({ status: "cancelled", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    writeState(root, "sessions/run-trace/trace.json", "{corrupt");
    writeState(
      root,
      "sessions/run-protected/state.json",
      JSON.stringify({ status: "completed", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    writeArtifactPair(root, "run-protected", "approved");
    writeState(root, "sessions/run-protected/trace.json", "{corrupt");
    writeState(
      root,
      "sessions/run-fabricated/state.json",
      JSON.stringify({ status: "cancelled", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    writeState(root, "sessions/run-fabricated/artifacts/result.md", "fabricated\n");
    writeState(
      root,
      "sessions/run-fabricated/artifacts/result.meta.json",
      JSON.stringify({ status: "draft" }),
    );
    writeState(
      root,
      "sessions/run-missing-envelope/state.json",
      JSON.stringify({
        status: "cancelled",
        updatedAt: "2026-06-01T00:00:00.000Z",
        artifacts: {
          result: {
            path: "artifacts/result.md",
            envelopePath: "artifacts/result.meta.json",
          },
        },
      }),
    );
    writeState(
      root,
      "sessions/run-missing-envelope/artifacts/result.md",
      "orphan payload must survive\n",
    );
    writeState(
      root,
      "sessions/run-unreadable/state.json",
      JSON.stringify({ status: "cancelled", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    writeState(
      root,
      "sessions/run-missing-trace/state.json",
      JSON.stringify({ status: "cancelled", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    const outsideTrace = resolve(root, "../outside-trace.json");
    writeFileSync(outsideTrace, "outside trace stays intact\n");
    symlinkSync(outsideTrace, resolve(root, "sessions/run-unreadable/trace.json"));
    const runIds = [
      "run-fabricated",
      "run-old",
      "run-missing-envelope",
      "run-missing-trace",
      "run-protected",
      "run-state",
      "run-trace",
      "run-unreadable",
    ];
    const before = Object.fromEntries(
      runIds.map((runId) => [
        runId,
        snapshotFiles(resolve(root, `sessions/${runId}`)),
      ]),
    );
    const rootBefore = snapshotFiles(root);
    const report = enforceRetention(
      root,
      { sessionRetentionDays: 30, traceRetentionDays: 14, artifactPolicy: "accepted-only" },
      { now: NOW, apply: true },
    );
    for (const fragment of [
      "broken.meta.json",
      "run-fabricated/artifacts/result.meta.json",
      "run-missing-envelope/artifacts/result.meta.json",
      "run-missing-trace/trace.json",
      "run-protected/trace.json",
      "run-state/state.json",
      "run-trace/trace.json",
      "run-unreadable/trace.json",
    ]) {
      expect(report.blockers.some((blocker) => blocker.path.includes(fragment))).toBe(true);
    }
    expect(report.protectedSessions).toContain("run-protected");
    for (const runId of runIds) {
      expect(report.expiredSessions).not.toContain(runId);
      expect(report.prunedTraces.map((entry) => entry.runId)).not.toContain(runId);
      expect(snapshotFiles(resolve(root, `sessions/${runId}`))).toEqual(before[runId]);
    }
    expect(lstatSync(resolve(root, "sessions/run-unreadable/trace.json")).isSymbolicLink())
      .toBe(true);
    expect(readFileSync(outsideTrace, "utf8")).toBe("outside trace stays intact\n");
    expect(snapshotFiles(root)).toEqual(rootBefore);
  });

  it("applies reviewed and accepted-only artifact policies observably", () => {
    const seed = (root: string, runId: string, status: ArtifactStatus): void => {
      writeState(
        root,
        `sessions/${runId}/state.json`,
        JSON.stringify({ status: "completed", updatedAt: "2026-06-01T00:00:00.000Z" }),
      );
      writeArtifactPair(root, runId, status);
      writeState(root, `sessions/${runId}/trace.json`, "[]");
    };

    const reviewedRoot = freshRoot("retention-reviewed");
    seed(reviewedRoot, "run-reviewed", "reviewed");
    const reviewed = enforceRetention(
      reviewedRoot,
      { sessionRetentionDays: 30, traceRetentionDays: 14, artifactPolicy: "reviewed" },
      { now: NOW, apply: true },
    );
    expect(reviewed.protectedSessions).toEqual(["run-reviewed"]);
    expect(existsSync(resolve(reviewedRoot, "sessions/run-reviewed"))).toBe(true);

    const acceptedRoot = freshRoot("retention-accepted");
    for (const status of ["approved", "acted", "observed"] as const) {
      seed(acceptedRoot, `run-${status}`, status);
    }
    seed(acceptedRoot, "run-reviewed", "reviewed");
    const accepted = enforceRetention(
      acceptedRoot,
      { sessionRetentionDays: 30, traceRetentionDays: 14, artifactPolicy: "accepted-only" },
      { now: NOW, apply: true },
    );
    expect(accepted.protectedSessions).toEqual([
      "run-acted",
      "run-approved",
      "run-observed",
    ]);
    expect(existsSync(resolve(acceptedRoot, "sessions/run-reviewed"))).toBe(false);
    for (const status of ["approved", "acted", "observed"] as const) {
      expect(existsSync(resolve(acceptedRoot, `sessions/run-${status}`))).toBe(true);
    }
  });

  it("cleans staging without tmp and fails closed on uncleanable symlinks", () => {
    const root = freshRoot("staging");
    expect(recoverStaging(root)).toBe(0);
    writeState(root, "tmp/partial.json.tmp", "{}");
    expect(recoverStaging(root)).toBe(1);
    expect(existsSync(resolve(root, "tmp/partial.json.tmp"))).toBe(false);
  });

  it("resolves the data root from config deterministically and blocks unknown migration states", () => {
    expect(dataRoot("./relative")).toBe(resolve("./relative"));
    const root = freshRoot("migration");
    const check = checkMigration(root);
    expect(check.from).toContain("conquistador.local-state/v1");
    expect(check.to).toBe("conquistador.local-state/v1");
    expect(check.pending).toEqual([]);
    const applied = applyMigrations(root, { now: NOW });
    expect(applied.applied).toBe(0);
    writeState(
      root,
      "sessions/run-x/state.json",
      JSON.stringify({ schemaVersion: "conquistador.run-state/v2" }),
    );
    expect(checkMigration(root).blockers).toHaveLength(1);
    expect(() => applyMigrations(root, { now: NOW })).toThrow(/migration blocked/);
  });

  it("rejects containers whose stored bytes drift from their inventory", () => {
    const root = freshRoot("drift");
    writeState(root, "diagnostics/note.md", "stable\n");
    const path = createLocalBackup(root, { file: "backups/a.json", now: NOW }).file;
    const container = JSON.parse(readFileSync(path, "utf8")) as {
      inventory: Array<{ path: string; bytes: number; digest: string; class: string }>;
      files: Array<{ path: string; content: string }>;
      totalBytes: number;
    };
    container.inventory[0]!.bytes += 1;
    const drifted = resolve(root, "backups/drifted.json");
    writeFileSync(drifted, JSON.stringify(container));
    expect(() => verifyBackupContainer(drifted)).toThrow(/manifest digest mismatch/);
  });

  it("keeps retention dry-runs read-only and serializes applying retention", () => {
    const root = freshRoot("retention-lock");
    const policy = {
      sessionRetentionDays: 30,
      traceRetentionDays: 14,
      artifactPolicy: "accepted-only" as const,
    };
    withLifecycleLock(root, () => {
      expect(enforceRetention(root, policy, { now: NOW, apply: false }).blockers)
        .toEqual([]);
      expect(() => enforceRetention(root, policy, { now: NOW, apply: true }))
        .toThrow(/another lifecycle operation holds the local lock/);
    });
  });

  it("records closed PID lock ownership and rejects ordinary contention", () => {
    const root = freshRoot("lock");
    withLifecycleLock(root, () => {
      const lock = JSON.parse(
        readFileSync(resolve(root, "locks/lifecycle.lock"), "utf8"),
      ) as Record<string, unknown>;
      expect(Object.keys(lock).sort()).toEqual(["acquiredAt", "owner", "pid"]);
      expect(lock.pid).toBe(process.pid);
    });
    expect(() =>
      withLifecycleLock(root, () => withLifecycleLock(root, () => 1)),
    ).toThrow(/another lifecycle operation holds the local lock/);
  });

  it("never steals a live old lock and reclaims only an old dead owner", () => {
    const liveRoot = freshRoot("lock-live-old");
    const livePath = resolve(liveRoot, "locks/lifecycle.lock");
    const liveBytes = oldLock(process.pid, "00000000-0000-4000-8000-000000000001");
    writeFileSync(livePath, liveBytes);
    expect(() => withLifecycleLock(liveRoot, () => "stolen"))
      .toThrow(/another lifecycle operation holds the local lock/);
    expect(readFileSync(livePath, "utf8")).toBe(liveBytes);

    const deadRoot = freshRoot("lock-dead-old");
    const deadPath = resolve(deadRoot, "locks/lifecycle.lock");
    writeFileSync(
      deadPath,
      oldLock(2_147_483_647, "00000000-0000-4000-8000-000000000002"),
    );
    expect(withLifecycleLock(deadRoot, () => "reclaimed")).toBe("reclaimed");
    expect(existsSync(deadPath)).toBe(false);
  });

  it("preserves corrupt lock bytes and foreign lock bytes during non-owner cleanup", () => {
    const corruptRoot = freshRoot("lock-corrupt");
    const corruptPath = resolve(corruptRoot, "locks/lifecycle.lock");
    writeFileSync(corruptPath, "{corrupt\n");
    expect(() => withLifecycleLock(corruptRoot, () => "unsafe"))
      .toThrow(/lock.*unreadable|lock.*invalid|another lifecycle operation/);
    expect(readFileSync(corruptPath, "utf8")).toBe("{corrupt\n");

    const corruptCleanupRoot = freshRoot("lock-corrupt-cleanup");
    const corruptCleanupPath = resolve(corruptCleanupRoot, "locks/lifecycle.lock");
    withLifecycleLock(corruptCleanupRoot, () => {
      writeFileSync(corruptCleanupPath, "{corrupt replacement\n");
    });
    expect(readFileSync(corruptCleanupPath, "utf8")).toBe("{corrupt replacement\n");

    const foreignRoot = freshRoot("lock-foreign");
    const foreignPath = resolve(foreignRoot, "locks/lifecycle.lock");
    const foreignBytes = oldLock(process.pid, "00000000-0000-4000-8000-000000000003");
    withLifecycleLock(foreignRoot, () => {
      writeFileSync(foreignPath, foreignBytes);
    });
    expect(readFileSync(foreignPath, "utf8")).toBe(foreignBytes);
  });

  it("does not follow a fixed backup temp symlink", () => {
    const root = freshRoot("backup-temp-symlink");
    const outside = resolve(root, "../outside-sentinel.txt");
    writeFileSync(outside, "outside stays intact\n");
    symlinkSync(outside, resolve(root, "backups/a.json.tmp"));
    createLocalBackup(root, { file: "backups/a.json", now: NOW });
    expect(readFileSync(outside, "utf8")).toBe("outside stays intact\n");
    expect(lstatSync(resolve(root, "backups/a.json")).isFile()).toBe(true);
    expect(lstatSync(resolve(root, "backups/a.json")).isSymbolicLink()).toBe(false);
    expect(lstatSync(resolve(root, "backups/a.json.tmp")).isSymbolicLink()).toBe(true);
  });

  it("rejects every symlinked lifecycle control directory before writing outside", () => {
    for (const directory of [
      "locks",
      "receipts",
      "tmp",
      "backups",
      "sessions",
      "memory",
      "diagnostics",
    ]) {
      const root = bareRoot(`control-${directory}`);
      const outside = resolve(root, `../outside-${directory}`);
      mkdirSync(outside);
      symlinkSync(outside, resolve(root, directory));
      expect(() =>
        ensureLocalStateRoot(root, { instanceId: "state-test", now: NOW }),
      ).toThrow(/symlink|real directory|control directory/);
      expect(readdirSync(outside)).toEqual([]);
    }
  });

  it("rejects a receipts directory escape without creating the outside journal", () => {
    const root = bareRoot("receipts-exact-probe");
    const outside = resolve(root, "../outside-receipts");
    mkdirSync(outside);
    symlinkSync(outside, resolve(root, "receipts"));
    expect(() => ensureLocalStateRoot(root, { instanceId: "state-test", now: NOW }))
      .toThrow(/symlink|real directory|control directory/);
    expect(existsSync(resolve(outside, "lifecycle.jsonl"))).toBe(false);
  });

  it("rejects lifecycle control directory swaps before a later mutation", () => {
    for (const directory of [
      "locks",
      "receipts",
      "tmp",
      "backups",
      "sessions",
      "memory",
      "diagnostics",
    ]) {
      const root = freshRoot(`control-swap-${directory}`);
      const outside = resolve(root, `../outside-swap-${directory}`);
      mkdirSync(outside);
      rmSync(resolve(root, directory), { recursive: true, force: false });
      symlinkSync(outside, resolve(root, directory));
      expect(() =>
        createLocalBackup(root, { file: "backups/escaped.json", now: NOW }),
      ).toThrow(/symlink|real directory|control directory/);
      expect(readdirSync(outside)).toEqual([]);
    }
  });

  it("rejects closed-container violations before returning trusted backup or export models", () => {
    const root = freshRoot("container-closure");
    writeState(root, "diagnostics/note.md", "stable\n");
    const backupPath = createLocalBackup(root, {
      file: "backups/valid.json",
      now: NOW,
    }).file;
    const valid = JSON.parse(readFileSync(backupPath, "utf8")) as Record<string, unknown>;
    const cases: Array<[string, (record: Record<string, unknown>) => void]> = [
      ["extra-container", (record) => { record.extra = true; }],
      ["missing-state-schema", (record) => { delete record.stateSchema; }],
      ["stale-state-schema", (record) => { record.stateSchema = "conquistador.local-state/v0"; }],
      ["stale-container-schema", (record) => { record.schemaVersion = "conquistador.backup/v0"; }],
      ["extra-inventory", (record) => {
        (record.inventory as Array<Record<string, unknown>>)[0]!.extra = true;
      }],
      ["missing-inventory", (record) => {
        delete (record.inventory as Array<Record<string, unknown>>)[0]!.digest;
      }],
      ["extra-payload", (record) => {
        (record.files as Array<Record<string, unknown>>)[0]!.extra = true;
      }],
      ["missing-payload", (record) => {
        delete (record.files as Array<Record<string, unknown>>)[0]!.encoding;
      }],
      ["phantom-inventory", (record) => {
        (record.inventory as Array<Record<string, unknown>>).push({
          path: "diagnostics/phantom.md",
          class: "diagnostic",
          bytes: 8,
          digest: sha256("phantom\n"),
        });
        record.fileCount = (record.inventory as unknown[]).length;
      }],
      ["duplicate-payload", (record) => {
        const files = record.files as Array<Record<string, unknown>>;
        files.push(structuredClone(files[0]!));
        record.fileCount = files.length;
        record.totalBytes = Number(record.totalBytes) +
          Buffer.byteLength(String(files[0]!.content), "utf8");
      }],
      ["wrong-count", (record) => { record.fileCount = Number(record.fileCount) + 1; }],
    ];
    for (const [name, mutate] of cases) {
      const record = structuredClone(valid);
      mutate(record);
      const path = resolve(root, `backups/${name}.json`);
      writeResealed(path, record);
      expect(() => verifyBackupContainer(path), name).toThrow();
    }

    const exportPath = exportData(root, {
      scope: "all",
      file: "backups/export.json",
      now: NOW,
    }).file;
    const exported = JSON.parse(readFileSync(exportPath, "utf8")) as Record<string, unknown>;
    for (const [name, mutate] of [
      ["missing-provenance", (record: Record<string, unknown>) => { delete record.provenance; }],
      ["missing-readme", (record: Record<string, unknown>) => { delete record.readme; }],
      ["extra-provenance", (record: Record<string, unknown>) => {
        (record.provenance as Record<string, unknown>).extra = true;
      }],
      ["invalid-provenance", (record: Record<string, unknown>) => {
        (record.provenance as Record<string, unknown>).sourceInventoryDigest = "sha256:nope";
      }],
      ["invalid-provenance-count", (record: Record<string, unknown>) => {
        (record.provenance as Record<string, unknown>).receipts = 99;
      }],
    ] as const) {
      const record = structuredClone(exported);
      mutate(record);
      const path = resolve(root, `backups/export-${name}.json`);
      writeResealed(path, record);
      expect(() => verifyExportContainer(path), name).toThrow();
    }
  });

  it("fails closed on a corrupt or foreign restore journal", () => {
    const root = freshRoot("journal-corrupt");
    writeState(root, "tmp/restore-journal.json", "{not json");
    expect(() => recoverInterruptedRestore(root)).toThrow(
      /restore journal is corrupt/,
    );
    writeState(
      root,
      "tmp/restore-journal.json",
      JSON.stringify({
        schemaVersion: "conquistador.restore-journal/v1",
        phase: "prepared",
        backupFile: "../../outside/backups/a.json",
        manifestDigest: `sha256:${"0".repeat(64)}`,
        remainingPaths: ["diagnostics/note.md"],
        startedAt: NOW,
        extra: true,
      }),
    );
    expect(() => recoverInterruptedRestore(root)).toThrow(/not closed|escapes/);
  });

  it("repairs drift introduced between an interrupted restore and its roll-forward", () => {
    const root = freshRoot("rollforward-drift");
    writeState(root, "diagnostics/note.md", "pristine\n");
    createLocalBackup(root, { file: "backups/a.json", now: NOW });
    expect(() =>
      restoreBackup(root, {
        file: "backups/a.json",
        now: NOW,
        faultAfter: "first-file",
      }),
    ).toThrow(/injected fault after first restored file/);
    writeState(root, "diagnostics/note.md", "tampered mid-crash\n");
    const recovered = recoverInterruptedRestore(root);
    expect(recovered.recovered).toBe(true);
    expect(readFileSync(resolve(root, "diagnostics/note.md"), "utf8")).toBe(
      "pristine\n",
    );
    expect(existsSync(resolve(root, "tmp/restore-journal.json"))).toBe(false);
  });

  it("clears private staging leftovers on erase-all", () => {
    const root = freshRoot("erase-staging");
    writeState(root, "sessions/run-a/state.json", JSON.stringify({ status: "cancelled" }));
    createLocalBackup(root, { file: "backups/a.json", now: NOW });
    writeState(root, "tmp/orphan.json.tmp", '{"partial":"private"}');
    eraseScope(root, { scope: "all", confirm: "all", recoverability: "backup", now: NOW });
    expect(existsSync(resolve(root, "tmp/orphan.json.tmp"))).toBe(false);
  });

  it("rejects oversized state files by size before reading them", () => {
    const root = freshRoot("quota");
    mkdirSync(resolve(root, "diagnostics"), { recursive: true });
    writeFileSync(
      resolve(root, "diagnostics/huge.txt"),
      Buffer.alloc(16 * 1024 * 1024 + 1),
    );
    expect(() => inventoryDataRoot(root)).toThrow(/per-file quota/);
  });

  it("keeps session erase exact under case-insensitive filesystems and reserved names", () => {
    const root = freshRoot("erase-exact");
    writeState(root, "sessions/ABC/state.json", JSON.stringify({ status: "cancelled" }));
    expect(() =>
      eraseScope(root, {
        scope: "session:abc",
        confirm: "session:abc",
        recoverability: "decline",
        now: NOW,
      }),
    ).toThrow(/scope does not exist/);
    expect(existsSync(resolve(root, "sessions/ABC"))).toBe(true);
    expect(() =>
      eraseScope(root, {
        scope: "session:learning.jsonl",
        confirm: "session:learning.jsonl",
        recoverability: "decline",
        now: NOW,
      }),
    ).toThrow(/reserved state/);
    expect(existsSync(resolve(root, "sessions/ABC/state.json"))).toBe(true);
  });

  it("rejects unicode-normalizing and malformed inventory members in containers", () => {
    const root = freshRoot("unicode");
    const base = {
      schemaVersion: "conquistador.backup/v1",
      kind: "backup",
      createdAt: NOW,
      instanceId: "state-test",
      stateSchema: "conquistador.local-state/v1",
      redaction: "applied",
    };
    const member = (path: string) => ({
      inventory: [
        { path, class: "diagnostic", bytes: 6, digest: sha256("note\n") },
      ],
      files: [{ path, encoding: "utf8", content: "note\n" }],
      fileCount: 1,
      totalBytes: 6,
    });
    const seal = (body: Record<string, unknown>) => ({
      ...base,
      ...body,
      manifestDigest: sha256({ ...base, ...body }),
    });
    const colliding = resolve(root, "backups/colliding.json");
    writeFileSync(
      colliding,
      JSON.stringify(seal(member("diagnostics/\uFB01le.md")), null, 2),
    );
    const second = JSON.parse(readFileSync(colliding, "utf8")) as Record<string, unknown>;
    const withSecond = {
      ...second,
      inventory: [
        (second.inventory as Array<Record<string, unknown>>)[0],
        {
          path: "diagnostics/file.md",
          class: "diagnostic",
          bytes: 6,
          digest: sha256("note\n"),
        },
      ],
      files: [
        (second.files as Array<Record<string, unknown>>)[0],
        { path: "diagnostics/file.md", encoding: "utf8", content: "note\n" },
      ],
      fileCount: 2,
      totalBytes: 12,
    };
    writeFileSync(
      colliding,
      JSON.stringify(
        { ...withSecond, manifestDigest: sha256(withSecond) },
        null,
        2,
      ),
    );
    expect(() => verifyBackupContainer(colliding)).toThrow(/case-colliding/);

    const badClass = seal(member("diagnostics/note.md")) as Record<string, unknown>;
    (badClass.inventory as Array<Record<string, unknown>>)[0]!.class = "banana";
    const badClassPath = resolve(root, "backups/bad-class.json");
    writeFileSync(badClassPath, JSON.stringify(badClass));
    expect(() => verifyBackupContainer(badClassPath)).toThrow(/class is invalid/);

    const badDigest = seal(member("diagnostics/note.md")) as Record<string, unknown>;
    (badDigest.inventory as Array<Record<string, unknown>>)[0]!.digest = "md3:nope";
    const badDigestPath = resolve(root, "backups/bad-digest.json");
    writeFileSync(badDigestPath, JSON.stringify(badDigest));
    expect(() => verifyBackupContainer(badDigestPath)).toThrow(/malformed/);
  });
});
