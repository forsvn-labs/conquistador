/**
 * Generate the two drafts of each case in a private judging pack. The bare arm gets the case brief
 * only. The method arm also gets guidance assembled from a pinned commit: the `brief --full` output
 * for the case's Task line, plus the full text of every required reference the brief did not inline.
 * Both arms get one shared instruction, run through the same isolated runner, and never see the
 * other arm's draft. Drafts and generation records stay in the private pack, outside any Git tree.
 */
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import { readCaseBrief, readPackManifest, requirePrivatePath } from "./blind-judging.ts";
import { digestBytes } from "./digest.ts";
import { normalizeDraft } from "./draft-normalizer.ts";
import { invariant } from "./validate.ts";

export const GENERATION_SCHEMA = "conquistador.judging-generation/v1";
export const DEFAULT_MODEL = "claude-opus-5-5";
/**
 * Claude Code in print mode with nothing loaded but the model: --safe-mode turns off CLAUDE.md,
 * skills, installed plugins, hooks, and MCP servers; --strict-mcp-config with an empty
 * --mcp-config adds no server; --setting-sources "" reads no settings file; --tools "" removes
 * every built-in tool; --disable-slash-commands removes skills and commands.
 */
export const DEFAULT_RUNNER = `claude -p --model ${DEFAULT_MODEL} --safe-mode --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources "" --tools "" --disable-slash-commands --no-session-persistence`;
/** The one instruction both arms receive. It names no arm and no product. */
export const INSTRUCTION = [
  "Write the deliverable that the task below asks for.",
  "Follow any guidance supplied with it, including any check it asks you to run after drafting.",
  "Return only the finished deliverable, ready to use: no preamble, no notes on how you wrote it, no check results, and no label for the draft.",
].join(" ");

const PROBE_PROMPT = "Reply with the single word OK.";
const MAX_OUTPUT = 64 * 1024 * 1024;

export type GenerateOptions = {
  packDir: string;
  commit: string;
  arms?: string[];
  runner?: string;
  cases?: string[];
  force?: boolean;
  /** Repository that holds the commit. Defaults to the checkout that contains this file. */
  repoDir?: string;
  /** Accept a runner this tool cannot check. Claude runners are always checked. */
  trustRunner?: boolean;
  timeoutMs?: number;
  now?: () => string;
  log?: (line: string) => void;
};

type ArmRecord = {
  role: "baseline" | "candidate";
  commit: string;
  runner: string;
  model: string | null;
  isolation: "verified" | "trusted-by-caller";
  instructionDigest: string;
  promptDigest: string;
  draftDigest: string;
  generatedAt: string;
  identityRemovals: string[];
  residualLeaks: string[];
  taskLine?: string;
  briefFiles?: string[];
  references?: string[];
};

/** Split a command line into arguments, with POSIX-style quotes, and no shell. */
export function splitCommand(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]!;
    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "\\" && (command[index + 1] === '"' || command[index + 1] === "\\")) current += command[++index];
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === "\\" && index + 1 < command.length) {
      current += command[++index];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) args.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  invariant(quote === null, "the runner command has an unclosed quote");
  if (started) args.push(current);
  invariant(args.length > 0, "the runner command is empty");
  return args;
}

const isClaude = (argv: string[]) => basename(argv[0]!).replace(/\.(exe|cmd)$/i, "") === "claude";
function flagValue(argv: string[], flag: string): string | undefined {
  for (let index = argv.length - 1; index >= 0; index -= 1) {
    if (argv[index] === flag) return argv[index + 1];
    if (argv[index]!.startsWith(`${flag}=`)) return argv[index]!.slice(flag.length + 1);
  }
  return undefined;
}
const hasFlag = (argv: string[], flag: string) => argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`));

/** For a claude runner, list each isolation flag that is missing and each loading flag to remove. */
export function checkRunnerFlags(argv: string[]): string[] {
  const missing: string[] = [];
  if (!hasFlag(argv, "--safe-mode")) missing.push("--safe-mode");
  if (!hasFlag(argv, "--strict-mcp-config")) missing.push("--strict-mcp-config");
  let servers: unknown;
  try { servers = JSON.parse(flagValue(argv, "--mcp-config") ?? "null")?.mcpServers; } catch { servers = undefined; }
  if (!servers || typeof servers !== "object" || Object.keys(servers).length) missing.push(`--mcp-config '{"mcpServers":{}}'`);
  if (flagValue(argv, "--setting-sources") !== "") missing.push('--setting-sources ""');
  if (flagValue(argv, "--tools") !== "") missing.push('--tools ""');
  if (!hasFlag(argv, "--disable-slash-commands")) missing.push("--disable-slash-commands");
  for (const flag of ["--plugin-dir", "--plugin-url", "--add-dir", "--agents", "--settings"]) if (hasFlag(argv, flag)) missing.push(`remove ${flag}`);
  return missing;
}

/** The File: lines of a brief, and the required references it names as not inlined. */
export function parseBriefOutput(text: string): { files: string[]; notInlined: string[] } {
  const files = [...text.matchAll(/^File: (.+?)\s*$/gm)].map((match) => match[1]!);
  const required = /^Required references not inlined \(budget\): (.+?)\. Expand them/m.exec(text);
  return { files, notInlined: required ? required[1]!.split(/,\s*/).filter(Boolean) : [] };
}

/** The request given to `brief`: the first "Task:" line of brief.md. */
export function taskLine(brief: string): string | null {
  const match = /^\s*\**Task\**\s*:\s*\**\s*(\S.*?)\s*$/im.exec(brief);
  return match ? match[1]!.replace(/\*+$/, "").trim() : null;
}

export function buildPrompt(brief: string, guidance?: string): string {
  const parts = [INSTRUCTION, ""];
  if (guidance) parts.push("<guidance>", guidance.trim(), "</guidance>", "");
  parts.push("<task>", brief.trim(), "</task>", "");
  return parts.join("\n");
}

/** The parent environment without Conquistador variables, so neither a brief nor a runner picks up user playbooks or plugin roots. */
const cleanEnv = (): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/conquistador/i.test(name)));

/** Run a command with stdin in a new empty folder that is removed afterwards. */
function runIsolated(argv: string[], input: string, options: SpawnSyncOptions & { prefix: string }) {
  const work = mkdtempSync(join(tmpdir(), options.prefix));
  try {
    return spawnSync(argv[0]!, argv.slice(1), { ...options, input, cwd: work, encoding: "utf8", maxBuffer: MAX_OUTPUT, windowsHide: true });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Ask a claude runner for its startup report, and refuse it if it exposes any tool, server, skill, command, or added plugin. */
function probeClaudeRunner(argv: string[], timeoutMs: number): void {
  const result = runIsolated([...argv, "--output-format", "stream-json", "--verbose"], PROBE_PROMPT, { prefix: "judge-probe-", env: cleanEnv(), timeout: timeoutMs });
  invariant(!result.error, `the runner could not start for its isolation check: ${result.error?.message}`);
  invariant(result.status === 0, `the runner isolation check failed (exit ${result.status}): ${String(result.stderr).trim().slice(0, 300)}`);
  const events = String(result.stdout).split("\n").flatMap((line) => { try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; } });
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  invariant(init, "the runner did not print a startup report; cannot check its isolation");
  const names = (value: unknown) => (Array.isArray(value) ? value.map((entry) => (entry && typeof entry === "object" ? String((entry as { name?: unknown }).name) : String(entry))) : []);
  const exposed = [
    ...names(init.tools),
    ...names(init.mcp_servers),
    ...names(init.skills),
    ...names(init.slash_commands),
    ...(Array.isArray(init.plugins) ? init.plugins.filter((plugin: { path?: unknown }) => plugin?.path !== "builtin").map((plugin: { name?: unknown }) => String(plugin?.name)) : []),
  ];
  if (!exposed.length && /conquistador/i.test(JSON.stringify(init))) exposed.push("a Conquistador entry in its startup report");
  invariant(!exposed.length, `the runner exposes tools, MCP servers, skills, commands, or plugins to the drafting model: ${exposed.slice(0, 8).join(", ")}`);
}

function git(repoDir: string, args: string[]) {
  return spawnSync("git", ["-C", repoDir, ...args], { encoding: "utf8", windowsHide: true });
}

function resolveCommit(repoDir: string, commit: string): string {
  invariant(/^[0-9a-f]{7,40}$/i.test(commit), `--commit must be a commit SHA (7 to 40 hexadecimal characters), not ${commit}`);
  const result = git(repoDir, ["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]);
  invariant(result.status === 0, `commit ${commit} does not exist in ${repoDir}; fetch it or check the SHA`);
  return result.stdout.trim();
}

type MethodContext = { guidance: string; taskLine: string; briefFiles: string[]; references: string[] };

/** Check out the commit into a temporary folder, build each case's method guidance, and always remove the checkout. */
function buildMethodContexts(repoDir: string, sha: string, tasks: Array<{ id: string; task: string }>, log: (line: string) => void): Map<string, MethodContext> {
  const scratch = mkdtempSync(join(tmpdir(), "judge-generate-"));
  const checkout = join(scratch, "checkout");
  const home = join(scratch, "home");
  const contexts = new Map<string, MethodContext>();
  try {
    mkdirSync(home);
    const added = git(repoDir, ["worktree", "add", "--detach", "--quiet", checkout, sha]);
    invariant(added.status === 0, `could not check out ${sha}: ${added.stderr.trim()}`);
    log(`Checked out ${sha.slice(0, 12)} at ${checkout}`);
    const cli = join(checkout, "runtime", "bin", "conquistador.js");
    invariant(existsSync(cli), `commit ${sha.slice(0, 12)} has no runtime/bin/conquistador.js`);
    const root = realpathSync(checkout);
    // No user playbooks, no home config, no shared cache, and no project files in the working folder.
    const env = { ...cleanEnv(), HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, ".conquistador"), CONQUISTADOR_CACHE: join(scratch, "cache") };
    for (const { id, task } of tasks) {
      const result = runIsolated([process.execPath, cli, "brief", task, "--full"], "", { prefix: "judge-brief-", env, timeout: 120_000 });
      invariant(!result.error && result.status === 0, `the brief at ${sha.slice(0, 12)} failed for case ${id} (exit ${result.status}): ${String(result.stderr || result.error?.message || "").trim().slice(0, 300)}`);
      const output = String(result.stdout).trim();
      const { files, notInlined } = parseBriefOutput(output);
      const blocks = notInlined.map((path) => {
        const absolute = resolve(checkout, path);
        const inside = (target: string) => { const rel = relative(root, target); return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel); };
        invariant(!isAbsolute(path) && inside(resolve(root, path)), `case ${id}: required reference ${path} is outside the checkout`);
        invariant(existsSync(absolute), `case ${id}: required reference ${path} does not exist at ${sha.slice(0, 12)}`);
        invariant(inside(realpathSync(absolute)), `case ${id}: required reference ${path} is outside the checkout`);
        return `## Required reference\nFile: ${path}\n${readFileSync(absolute, "utf8").replace(/\r\n?/g, "\n").trim()}`;
      });
      contexts.set(id, { guidance: [output, ...blocks].join("\n\n"), taskLine: task, briefFiles: files, references: notInlined });
    }
  } finally {
    const removed = git(repoDir, ["worktree", "remove", "--force", checkout]);
    rmSync(scratch, { recursive: true, force: true });
    // Prune only when removal failed, so the stale entry for this folder does not stay registered.
    if (removed.status !== 0) git(repoDir, ["worktree", "prune"]);
  }
  return contexts;
}

function writeAtomic(path: string, text: string): void {
  const temporary = join(resolve(path, ".."), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(temporary, text);
  renameSync(temporary, path);
}

export async function generateDrafts(options: GenerateOptions): Promise<{ written: string[] }> {
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date().toISOString());
  const timeoutMs = options.timeoutMs ?? 15 * 60_000;
  const repoDir = resolve(options.repoDir ?? join(import.meta.dirname, "..", ".."));

  // 1. Pack, cases, arms, and every refusal that needs no subprocess.
  const packDir = requirePrivatePath(options.packDir, "pack");
  const manifest = readPackManifest(packDir);
  const { baseline, candidate } = manifest.arms;
  const arms = options.arms ?? [baseline, candidate];
  for (const arm of arms) invariant(arm === baseline || arm === candidate, `unknown arm ${arm}; this pack's arms are ${baseline} and ${candidate}`);
  const caseIds = options.cases ?? manifest.caseIds;
  for (const id of caseIds) invariant(manifest.caseIds.includes(id), `unknown case ${id}; the pack has ${manifest.caseIds.join(", ")}`);
  const cases = caseIds.map((id) => ({ id, ...readCaseBrief(packDir, id) }));
  const existing: string[] = [];
  for (const entry of cases) {
    if (arms.includes(candidate)) invariant(taskLine(entry.brief), `case ${entry.id} brief.md has no "Task:" line; add one line "Task: <the request>" so the method brief can be built`);
    if (arms.includes(baseline)) invariant(!/conquistador/i.test(entry.brief), `case ${entry.id} brief.md names Conquistador; the ${baseline} arm must not see it`);
    for (const arm of arms) if (existsSync(join(packDir, entry.id, `${arm}.md`))) existing.push(`case ${entry.id} already has ${arm}.md`);
  }
  invariant(!existing.length || options.force, `${existing.join("; ")}; pass --force to replace existing drafts`);

  // 2. The pinned commit and the runner's isolation.
  const sha = resolveCommit(repoDir, options.commit);
  const runner = options.runner ?? DEFAULT_RUNNER;
  const argv = splitCommand(runner);
  let isolation: ArmRecord["isolation"];
  if (isClaude(argv)) {
    const missing = checkRunnerFlags(argv);
    invariant(!missing.length, `the claude runner is missing isolation flags: ${missing.join(", ")}. Without them a Conquistador plugin, skill, MCP server, or tool can reach the drafting model`);
    probeClaudeRunner(argv, Math.min(timeoutMs, 180_000));
    isolation = "verified";
    log("Runner isolation verified: no tools, MCP servers, skills, commands, or added plugins.");
  } else {
    invariant(options.trustRunner, `cannot check that runner ${basename(argv[0]!)} hides Conquistador; only a claude runner is checked. Pass --trust-runner after you confirm it exposes no Conquistador plugin, skill, MCP server, or tool`);
    isolation = "trusted-by-caller";
    log(`Runner isolation not checked: ${basename(argv[0]!)} is trusted by the caller.`);
  }
  const model = flagValue(argv, "--model") ?? null;

  // 3. Method guidance from a temporary checkout of the commit, removed before any drafting.
  const contexts = arms.includes(candidate)
    ? buildMethodContexts(repoDir, sha, cases.map((entry) => ({ id: entry.id, task: taskLine(entry.brief)! })), log)
    : new Map<string, MethodContext>();

  // 4. Draft each arm. A prompt holds the instruction, the brief, and for the method arm its guidance; never a draft.
  const written: string[] = [];
  for (const entry of cases) {
    const sidecarPath = join(packDir, ".generation", entry.id, "generation.json");
    for (const arm of arms) {
      const role = arm === baseline ? "baseline" : "candidate";
      const context = role === "candidate" ? contexts.get(entry.id)! : undefined;
      const prompt = buildPrompt(entry.brief, context?.guidance);
      const result = runIsolated(argv, prompt, { prefix: "judge-runner-", env: cleanEnv(), timeout: timeoutMs });
      invariant(!result.error, `the runner could not finish case ${entry.id}: ${result.error?.message}`);
      invariant(result.status === 0, `the runner failed for case ${entry.id} (exit ${result.status}): ${String(result.stderr).trim().slice(0, 300)}`);
      const text = String(result.stdout).replace(/\r\n?/g, "\n").trim();
      invariant(text.length > 0, `the runner returned an empty draft for case ${entry.id}`);
      invariant(!/conquistador/i.test(text), `the ${arm} draft for case ${entry.id} names Conquistador, so it was not written. Check the runner isolation and generate it again`);
      const normalized = normalizeDraft(text, { identityTokens: [baseline, candidate], stripHeadings: manifest.stripHeadings });
      const identityRemovals = [...new Set(normalized.removals.map((removal) => removal.rule))];
      if (identityRemovals.length || normalized.residualLeaks.length) {
        log(`Check ${entry.id} ${arm}: ${[...identityRemovals, ...normalized.residualLeaks].join(", ")}. Prepare removes labels and stops on residual words.`);
      }
      const draftPath = join(packDir, entry.id, `${arm}.md`);
      writeAtomic(draftPath, `${text}\n`);
      written.push(draftPath);

      const record: ArmRecord = {
        role, commit: sha, runner, model, isolation,
        instructionDigest: digestBytes(INSTRUCTION),
        promptDigest: digestBytes(prompt),
        draftDigest: digestBytes(`${text}\n`),
        generatedAt: now(),
        identityRemovals,
        residualLeaks: normalized.residualLeaks,
        ...(context ? { taskLine: context.taskLine, briefFiles: context.briefFiles, references: context.references } : {}),
      };
      let sidecar: Record<string, unknown> = {};
      if (existsSync(sidecarPath)) { try { sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")); } catch { sidecar = {}; } }
      mkdirSync(join(packDir, ".generation", entry.id), { recursive: true });
      writeAtomic(sidecarPath, `${JSON.stringify({ ...sidecar, schemaVersion: GENERATION_SCHEMA, caseId: entry.id, practice: entry.practice, briefDigest: digestBytes(entry.brief), [arm]: record }, null, 2)}\n`);
      log(`Wrote ${entry.id}/${arm}.md (${text.split(/\s+/).length} words)`);
    }
  }
  return { written };
}
