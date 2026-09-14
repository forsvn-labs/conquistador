import { type Sha256 } from "./canonical.ts";
export declare const LOCAL_STATE_SCHEMA = "conquistador.local-state/v1";
export declare const BACKUP_SCHEMA = "conquistador.backup/v1";
export declare const EXPORT_SCHEMA = "conquistador.export/v1";
export declare const LIFECYCLE_RECEIPT_SCHEMA = "conquistador.lifecycle-receipt/v1";
export declare const RESTORE_JOURNAL_SCHEMA = "conquistador.restore-journal/v1";
export declare const RETENTION_REPORT_SCHEMA = "conquistador.retention-report/v1";
export declare const MIGRATION_CHECK_SCHEMA = "conquistador.migration-check/v1";
export declare const MAX_CONTAINER_BYTES = 268435456;
export declare const MAX_MEMBER_BYTES = 16777216;
export type DataClass = "identity" | "session" | "artifact" | "memory" | "receipt" | "diagnostic";
export type InventoryEntry = {
    path: string;
    class: DataClass;
    bytes: number;
    digest: Sha256;
};
export type LocalStateIdentity = {
    schemaVersion: typeof LOCAL_STATE_SCHEMA;
    instanceId: string;
    createdAt: string;
};
export type LifecycleReceipt = {
    schemaVersion: typeof LIFECYCLE_RECEIPT_SCHEMA;
    id: string;
    op: "state.init" | "backup.create" | "restore.apply" | "migrate.apply" | "export.create" | "erase.apply" | "retention.apply";
    at: string;
    outcome: "succeeded";
    detail: Record<string, unknown>;
    redaction: "applied";
    terminal?: boolean;
};
export type BackupFileEntry = {
    path: string;
    encoding: "utf8";
    content: string;
};
export type BackupContainerV1 = {
    schemaVersion: typeof BACKUP_SCHEMA;
    kind: "backup";
    createdAt: string;
    instanceId: string;
    stateSchema: typeof LOCAL_STATE_SCHEMA;
    redaction: "applied";
    fileCount: number;
    totalBytes: number;
    inventory: InventoryEntry[];
    files: BackupFileEntry[];
    manifestDigest: Sha256;
};
export type ExportContainerV1 = {
    schemaVersion: typeof EXPORT_SCHEMA;
    kind: "export";
    createdAt: string;
    instanceId: string;
    scope: string;
    redaction: "applied";
    readme: string;
    provenance: {
        sourceInventoryDigest: Sha256;
        artifactLineage: Array<{
            runId: string;
            artifacts: number;
        }>;
        memoryEntries: number;
        receipts: number;
    };
    fileCount: number;
    totalBytes: number;
    inventory: InventoryEntry[];
    files: BackupFileEntry[];
    manifestDigest: Sha256;
};
export type MigrationCheck = {
    schemaVersion: typeof MIGRATION_CHECK_SCHEMA;
    from: string[];
    to: typeof LOCAL_STATE_SCHEMA;
    pending: string[];
    blockers: Array<{
        path: string;
        reason: string;
    }>;
};
export type RetentionReport = {
    schemaVersion: typeof RETENTION_REPORT_SCHEMA;
    now: string;
    sessionRetentionDays: number;
    traceRetentionDays: number;
    artifactPolicy: "accepted-only" | "reviewed";
    expiredSessions: string[];
    protectedSessions: string[];
    prunedTraces: Array<{
        runId: string;
        removedEvents: number;
    }>;
    blockers: Array<{
        path: string;
        reason: string;
    }>;
};
export type LifecycleScope = {
    kind: "all";
} | {
    kind: "session";
    runId: string;
} | {
    kind: "memory";
};
export type FaultPoint = "inventory" | "payload" | "manifest" | "journal" | "first-file" | "erase-partial";
export declare function containWithin(root: string, candidate: string): string;
export declare function dataRoot(configDataDir: string): string;
export declare function ensureLocalStateRoot(root: string, options: {
    instanceId: string;
    now: string;
}): LocalStateIdentity;
export declare function readLocalStateIdentity(root: string): LocalStateIdentity;
export declare function inventoryDataRoot(root: string): InventoryEntry[];
export declare function buildLocalBackup(root: string, options: {
    now: string;
    faultAfter?: FaultPoint;
}): BackupContainerV1;
export declare function createLocalBackup(root: string, options: {
    file: string;
    now: string;
    maxContainerBytes?: number;
    faultAfter?: FaultPoint;
}): {
    file: string;
    container: BackupContainerV1;
};
export declare function verifyBackupContainer(path: string, options?: {
    root?: string;
    expectedInstanceId?: string;
    maxContainerBytes?: number;
}): BackupContainerV1;
export declare function verifyExportContainer(path: string, options?: {
    root?: string;
    expectedInstanceId?: string;
}): ExportContainerV1;
export declare function recoverStaging(root: string): number;
export declare function restoreBackup(root: string, options: {
    file: string;
    now: string;
    expectedInstanceId?: string;
    faultAfter?: FaultPoint;
}): {
    restoredFiles: number;
    manifestDigest: Sha256;
};
export declare function recoverInterruptedRestore(root: string): {
    recovered: boolean;
    restoredFiles: number;
};
export declare function parseLifecycleScope(scope: string, allowed: ReadonlyArray<"all" | "session" | "memory">): LifecycleScope;
export declare function buildExportBundle(root: string, options: {
    scope: string;
    now: string;
}): ExportContainerV1;
export declare function exportData(root: string, options: {
    scope: string;
    file: string;
    now: string;
}): {
    file: string;
    container: ExportContainerV1;
};
export declare function checkMigration(root: string): MigrationCheck;
export declare function applyMigrations(root: string, options: {
    now: string;
}): {
    applied: number;
    check: MigrationCheck;
};
export declare function hasSuccessfulBackupReceipt(root: string): boolean;
export declare function eraseScope(root: string, options: {
    scope: string;
    confirm: string;
    recoverability: "backup" | "decline";
    now: string;
    faultAfter?: FaultPoint;
}): LifecycleReceipt;
export declare function enforceRetention(root: string, policy: {
    sessionRetentionDays: number;
    traceRetentionDays: number;
    artifactPolicy: "accepted-only" | "reviewed";
}, options: {
    now: string;
    apply: boolean;
}): RetentionReport;
export declare function readLifecycleReceipts(root: string): LifecycleReceipt[];
export declare function validateLifecycleReceipt(value: unknown): asserts value is LifecycleReceipt;
export declare function withLifecycleLock<T>(root: string, operation: () => T): T;
