import type { ArtifactEnvelope } from "./artifacts.ts";
import type { Sha256 } from "./canonical.ts";
import type { ActionReceiptV1, ReviewPacketV1, ReviewVerdictV1 } from "./review-contract.ts";
export declare const LEARNING_KINDS: readonly ["fact", "decision", "edit-delta", "action", "observed-result"];
export type LearningKind = (typeof LEARNING_KINDS)[number];
export type LearningEntry = {
    schemaVersion: "conquistador.learning-entry/v1";
    id: string;
    recordedAt: string;
    runId: string;
    kind: LearningKind;
    approved: true;
    inferred: false;
    source: {
        artifactId: string;
        contentDigest: Sha256;
        reviewPacketId: string;
        actionReceiptId?: string;
    };
    body: unknown;
};
export declare function learningLedgerPath(runsDir: string): string;
export declare function validateLearningEntry(value: unknown): asserts value is LearningEntry;
export declare function readLearningLedger(path: string): LearningEntry[];
export declare function appendLearningEntry(ledgerPath: string, entry: unknown): LearningEntry;
export declare function learningEntriesFromRun(input: {
    runId: string;
    recordedAt: string;
    envelopes: ArtifactEnvelope[];
    canonicalPacket: ReviewPacketV1;
    verdict: ReviewVerdictV1;
    actionReceipt?: ActionReceiptV1;
}): LearningEntry[];
export declare function appendRunLearning(ledgerPath: string, entries: LearningEntry[]): LearningEntry[];
