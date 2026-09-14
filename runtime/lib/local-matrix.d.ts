import { type Sha256 } from "./canonical.ts";
export declare const MATRIX_SCHEMA = "conquistador.runtime-local-matrix/v1";
export declare const MATRIX_ID = "runtime-local:v1";
export type LocalMatrixCell = {
    id: string;
    scenario: string;
    result: "pass";
    detail: Record<string, unknown>;
};
export type LocalMatrixRecord = {
    schemaVersion: typeof MATRIX_SCHEMA;
    matrixId: typeof MATRIX_ID;
    generatedAt: string;
    scope: "local-current-host-only";
    releaseState: "NO-GO";
    candidateStatus: "UNBOUND";
    supportPromotion: false;
    profileCells: Array<{
        id: string;
        result: "pass";
        detail: Record<string, unknown>;
    }>;
    cells: LocalMatrixCell[];
    adversarial: {
        cases: number;
        rejected: number;
    };
    boundaries: Record<string, unknown>;
    digest: Sha256;
};
export declare function buildRuntimeLocalMatrix(options: {
    workRoot: string;
    productRoot: string;
}): Promise<LocalMatrixRecord>;
export declare function renderMatrix(record: LocalMatrixRecord): string;
