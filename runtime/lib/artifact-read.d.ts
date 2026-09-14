import type { RunSnapshot } from "./runner.ts";
export declare const AUTHORITY_ARTIFACTS: Set<string>;
export declare function readOwnedArtifact(run: RunSnapshot, artifactId: string): Record<string, unknown>;
