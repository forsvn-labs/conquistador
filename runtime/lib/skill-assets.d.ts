import { type Sha256 } from "./canonical.ts";
export declare const DEFAULT_SKILLS_ROOT: string;
export type SkillAssets = {
    digest: Sha256;
    files: Array<{
        path: string;
        digest: string;
        content: string | null;
    }>;
};
/** Bind every installed byte; load only complete, local Markdown methods as context. */
export declare function loadSkillAssets(skillId: string, skillsRoot?: string): SkillAssets;
export declare function skillMethodContext(assets: SkillAssets, maximumBytes?: number): string;
