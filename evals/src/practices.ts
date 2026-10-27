/**
 * Practice registry: every Conquistador method (command, play, channel, format, specialist) belongs to
 * exactly one practice, and each practice records who judges it and its latest blind-test status.
 * The registry holds practice names and statuses only; packs, drafts, and verdicts stay private.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type PracticeStatus = "untested" | "baseline" | "passed" | "failed" | "pass-through";
export type Practice = {
  id: string;
  judge: "human" | "pending-calibration";
  status: PracticeStatus;
  commit?: string;
  date?: string;
  pr?: number;
  note?: string;
  members: string[];
};
export type PracticeRegistry = {
  $schema?: string;
  schemaVersion: "conquistador.practices/v1";
  practices: Practice[];
  nonMethods: Array<{ member: string; reason: string }>;
};

export const SKILL_ROOT = "skills/conquistador";
/** Commands are folders; plays, channels, formats, and specialists are Markdown files. */
const KINDS: Array<{ folder: string; type: "dir" | "md" }> = [
  { folder: "commands", type: "dir" },
  { folder: "plays", type: "md" },
  { folder: "channels", type: "md" },
  { folder: "formats", type: "md" },
  { folder: "specialists", type: "md" },
];

/** Every method in the skill tree, as `<kind>/<name>`, found from the files themselves. */
export function discoverMethodFiles(repoDir: string): string[] {
  const found: string[] = [];
  for (const { folder, type } of KINDS) {
    const dir = join(repoDir, SKILL_ROOT, folder);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (type === "dir" && entry.isDirectory()) found.push(`${folder}/${entry.name}`);
      if (type === "md" && entry.isFile() && entry.name.endsWith(".md")) found.push(`${folder}/${entry.name.slice(0, -3)}`);
    }
  }
  return found.sort();
}

function memberExists(repoDir: string, member: string): boolean {
  const [folder] = member.split("/");
  const kind = KINDS.find((entry) => entry.folder === folder);
  if (!kind) return false;
  const path = join(repoDir, SKILL_ROOT, kind.type === "dir" ? member : `${member}.md`);
  return existsSync(path) && (kind.type === "dir" ? statSync(path).isDirectory() : statSync(path).isFile());
}

/** Return every coverage problem; an empty list means the registry matches the skill tree. */
export function checkPracticeRegistry(registry: PracticeRegistry, repoDir: string): string[] {
  const problems: string[] = [];
  const owner = new Map<string, string>();
  const ids = new Set<string>();
  for (const practice of registry.practices) {
    if (ids.has(practice.id)) problems.push(`duplicate practice id ${practice.id}`);
    ids.add(practice.id);
    for (const member of practice.members) {
      if (!memberExists(repoDir, member)) problems.push(`${member} (practice ${practice.id}) does not exist in ${SKILL_ROOT}`);
      const earlier = owner.get(member);
      if (earlier) problems.push(`${member} is in more than one practice (${earlier}, ${practice.id})`);
      else owner.set(member, practice.id);
    }
  }
  const excluded = new Set<string>();
  for (const { member } of registry.nonMethods) {
    if (!memberExists(repoDir, member)) problems.push(`${member} (non-method exclusion) does not exist in ${SKILL_ROOT}`);
    if (owner.has(member)) problems.push(`${member} is both a member and excluded as a non-method`);
    excluded.add(member);
  }
  for (const method of discoverMethodFiles(repoDir)) {
    if (!owner.has(method) && !excluded.has(method)) problems.push(`${method} exists but no practice covers it; add it to one practice in evals/practices.json`);
  }
  return problems;
}
