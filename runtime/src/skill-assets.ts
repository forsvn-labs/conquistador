import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { posix, resolve } from "node:path";
import { sha256, type Sha256 } from "./canonical.ts";

const sourceSkillsRoot = resolve(import.meta.dirname, "../../skills/skills");
export const DEFAULT_SKILLS_ROOT = existsSync(resolve(sourceSkillsRoot, "conquistador/SKILL.md"))
  ? sourceSkillsRoot
  : resolve(import.meta.dirname, "../../skills");

export type SkillAssets = {
  digest: Sha256;
  files: Array<{ path: string; digest: string; content: string | null }>;
};

/** Bind every installed byte; load only complete, local Markdown methods as context. */
export function loadSkillAssets(skillId: string, skillsRoot = DEFAULT_SKILLS_ROOT): SkillAssets {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(skillId)) throw new Error("invalid skill ID");
  const files: SkillAssets["files"] = [];
  let totalBytes = 0;
  const walk = (directory: string, prefix: string): void => {
    if (lstatSync(directory).isSymbolicLink()) throw new Error("skill asset directory is a symlink");
    for (const entry of readdirSync(directory).sort()) {
      const path = resolve(directory, entry);
      const id = prefix ? `${prefix}/${entry}` : entry;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error("skill asset is a symlink");
      if (stat.isDirectory()) { walk(path, id); continue; }
      if (!stat.isFile()) throw new Error("skill asset is not a regular file");
      totalBytes += stat.size;
      if (totalBytes > 10_000_000 || files.length >= 1200) throw new Error("skill package exceeds inventory budget");
      const bytes = readFileSync(path);
      files.push({ path: id, digest: createHash("sha256").update(bytes).digest("hex"), content: id.endsWith(".md") ? bytes.toString("utf8") : null });
    }
  };
  // Each command lives under the one parent skill: conquistador/commands/<id>/COMMAND.md.
  walk(resolve(skillsRoot, "conquistador/commands", skillId), "");
  if (!files.some((file) => file.path === "COMMAND.md")) throw new Error("skill method is missing");
  return { digest: sha256(files.map(({ path, digest }) => ({ path, digest }))), files };
}

export function skillMethodContext(assets: SkillAssets, maximumBytes = 24_000): string {
  const byPath = new Map(assets.files.map((file) => [file.path, file]));
  const queue = ["COMMAND.md"];
  const seen = new Set<string>();
  const parts: string[] = [];
  let bytes = 0;
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const file = byPath.get(path);
    if (!file || file.content === null) continue;
    // The generated playbook map tells tool-using hosts what to read. A served step has no file
    // tools and receives only the files below, so the map would be a false instruction here.
    const content = file.content.replace(/<!-- playbooks:start[\s\S]*?<!-- playbooks:end -->\n*/g, "");
    const part = `<skill-method path=${JSON.stringify(path)}>\n${content}\n</skill-method>`;
    const size = Buffer.byteLength(part);
    if (bytes + size > maximumBytes) {
      if (path === "COMMAND.md") throw new Error("skill front door exceeds method context budget");
      continue;
    }
    parts.push(part);
    bytes += size;
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const link = match[1].trim();
      if (/^(?:[a-z]+:|\/)/i.test(link)) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), link));
      if (target === ".." || target.startsWith("../")) continue;
      queue.push(target);
    }
  }
  return parts.join("\n\n");
}
