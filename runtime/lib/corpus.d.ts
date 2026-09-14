import { type Sha256 } from "./canonical.ts";
import type { CorpusDescriptor } from "./contracts.ts";
export type CorpusFile = Readonly<{
    id: string;
    content: string;
    digest: Sha256;
}>;
export type CorpusSelection = Readonly<{
    job: CorpusDescriptor["jobs"][number];
    fileIds: string[];
    digest: Sha256;
    systemInstructions: string;
    omittedFileIds: string[];
}>;
export type RuntimeCorpus = Readonly<{
    descriptor: CorpusDescriptor;
    resolve(prompt: string): CorpusSelection;
}>;
export declare function loadCorpusDescriptor(skillsRoot: string): CorpusDescriptor;
export declare function loadRuntimeCorpus(skillsRoot: string): RuntimeCorpus;
