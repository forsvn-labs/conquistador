import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { loadJudgingPack } from "../src/blind-judging";
import {
  DEFAULT_RUNNER,
  INSTRUCTION,
  checkRunnerFlags,
  generateDrafts,
  parseBriefOutput,
  splitCommand,
  type GenerateOptions,
} from "../src/judge-generate";
import { root } from "./helpers";

const fakeRunner = resolve(root, "fixtures/judge-generate/fake-runner.mjs");
const temps: string[] = [];
const temp = (prefix = "judge-generate-") => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

// A small repository whose `brief` command prints what the real one prints: a header, a
// "Required references not inlined" line, and File: blocks. Two commits differ in the reference.
const FAKE_CLI = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const [command, task, flag] = process.argv.slice(2);
if (command !== "brief" || flag !== "--full") { console.error("usage: brief TASK --full"); process.exit(2); }
if (task.includes("FAIL-BRIEF")) { console.error("brief failed"); process.exit(3); }
// Dirty the checkout, as a cache write would.
fs.writeFileSync(path.join(__dirname, "..", "..", "stray-cache.txt"), "dirty");
const ref = task.includes("ESCAPE") ? "../outside.md" : task.includes("MISSING-REF") ? "skills/demo/missing.md" : "skills/demo/references/method.md";
const playbooks = process.env.CONQUISTADOR_PLAYBOOKS || "none";
const home = fs.existsSync(path.join(process.env.HOME || "/nonexistent", ".conquistador")) ? "has-config" : "clean";
console.log("# Conquistador brief\n\nStart here: Demo method for " + task + ".\nUser playbooks: " + playbooks + ". Home: " + home + ". Working folder entries: " + fs.readdirSync(process.cwd()).length + ".\n\nRequired references not inlined (budget): " + ref + ". Expand them with conquistador_read before the stage that uses them.\n\n## Demo entry\nFile: skills/demo/ENTRY.md\n<!-- conquistador-file {\"id\":\"skills/demo/ENTRY.md\"} -->\nLead with the strongest true fact.\n<!-- /conquistador-file -->\n\n## Demo craft\nFile: skills/demo/references/craft.md\n<!-- conquistador-file {\"id\":\"skills/demo/references/craft.md\"} -->\nOne idea, one ask.\n<!-- /conquistador-file -->");
`;

let repo = "";
let firstCommit = "";
let secondCommit = "";
let realHome = "";
beforeAll(() => {
  repo = temp("judge-generate-repo-");
  realHome = temp("judge-generate-home-");
  mkdirSync(join(realHome, ".conquistador", "playbooks"), { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  mkdirSync(join(repo, "runtime", "bin"), { recursive: true });
  mkdirSync(join(repo, "skills", "demo", "references"), { recursive: true });
  writeFileSync(join(repo, "runtime", "bin", "conquistador.js"), FAKE_CLI);
  writeFileSync(join(repo, "skills", "demo", "ENTRY.md"), "Lead with the strongest true fact.\n");
  writeFileSync(join(repo, "skills", "demo", "references", "method.md"), "# Check after drafting\n\nReference version one: cut every sentence without a fact.\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "one");
  firstCommit = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "skills", "demo", "references", "method.md"), "# Check after drafting\n\nReference version two.\n");
  git(repo, "commit", "-q", "-am", "two");
  secondCommit = git(repo, "rev-parse", "HEAD");
  // An uncommitted edit must never reach a draft: the context comes from the pinned commit only.
  writeFileSync(join(repo, "skills", "demo", "references", "method.md"), "# Check after drafting\n\nUncommitted working-tree text.\n");
});
afterAll(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const packs: string[] = [];
afterEach(() => {
  expect(git(repo, "worktree", "list", "--porcelain").split("\n").filter((line) => line.startsWith("worktree ")), "a temporary worktree was left behind").toHaveLength(1);
});

type CaseSpec = { id: string; practice?: string; brief?: string; drafts?: Record<string, string> };
function makePack(cases: CaseSpec[], arms = { baseline: "bare", candidate: "method" }): string {
  const dir = temp("judge-generate-pack-");
  packs.push(dir);
  writeFileSync(join(dir, "pack.json"), JSON.stringify({ schemaVersion: "conquistador.judging-pack/v1", id: "gen-pack", arms }));
  for (const spec of cases) {
    mkdirSync(join(dir, spec.id));
    writeFileSync(join(dir, spec.id, "case.json"), JSON.stringify({ practice: spec.practice ?? "copy" }));
    writeFileSync(join(dir, spec.id, "brief.md"), spec.brief ?? `Task: Write a hero section for ${spec.id}.\n\n- Product: Tallypot, expense tracking for clubs.\n- Proof: 64 clubs use it.\n`);
    for (const [name, body] of Object.entries(spec.drafts ?? {})) writeFileSync(join(dir, spec.id, name), body);
  }
  return dir;
}

type LogEntry = { argv: string[]; cwd: string; entries: string[]; conquistadorEnv: string[]; prompt: string };
function runnerLog(): { path: string; read: () => LogEntry[] } {
  const path = join(temp("judge-generate-log-"), "calls.jsonl");
  return { path, read: () => (existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as LogEntry) : []) };
}
const fake = (logPath: string, mode = "echo") => `node "${fakeRunner}" --mode ${mode} --log "${logPath}"`;

function fakeClaude(): string {
  const bin = temp("judge-generate-bin-");
  const path = join(bin, "claude");
  writeFileSync(path, `#!/bin/sh\nexec node "${fakeRunner}" "$@"\n`);
  chmodSync(path, 0o755);
  return path;
}

async function generate(options: Partial<GenerateOptions> & { packDir: string }) {
  const lines: string[] = [];
  const result = await generateDrafts({ commit: firstCommit, repoDir: repo, trustRunner: true, log: (line) => lines.push(line), ...options });
  return { result, lines };
}
const draft = (pack: string, id: string, arm: string) => readFileSync(join(pack, id, `${arm}.md`), "utf8");
const sidecar = (pack: string, id: string) => JSON.parse(readFileSync(join(pack, ".generation", id, "generation.json"), "utf8"));

describe("judge:generate", () => {
  it("writes both arms for every case, keeps the pack loadable, and records a sidecar outside the case folder", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }, { id: "hero-2" }]);
    await generate({ packDir: pack, runner: fake(log.path) });
    expect(readdirSync(join(pack, "hero-1")).sort()).toEqual(["bare.md", "brief.md", "case.json", "method.md"]);
    expect(loadJudgingPack(pack).cases).toHaveLength(2);
    const record = sidecar(pack, "hero-1");
    expect(record).toMatchObject({ schemaVersion: "conquistador.judging-generation/v1", caseId: "hero-1", practice: "copy" });
    expect(record.method).toMatchObject({ commit: firstCommit, runner: fake(log.path), model: null, taskLine: "Write a hero section for hero-1." });
    expect(record.method.briefFiles).toEqual(["skills/demo/ENTRY.md", "skills/demo/references/craft.md"]);
    expect(record.method.references).toEqual(["skills/demo/references/method.md"]);
    expect(record.method.promptDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(record.bare.promptDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(record.bare.promptDigest).not.toBe(record.method.promptDigest);
    expect(log.read()).toHaveLength(4);
  });

  it("gives the method arm the pinned brief and the full required reference, and the bare arm the brief only, under one instruction", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }]);
    await generate({ packDir: pack, runner: fake(log.path) });
    const [bare, method] = log.read().map((entry) => entry.prompt);
    const brief = readFileSync(join(pack, "hero-1", "brief.md"), "utf8").trim();
    expect(bare).toContain(INSTRUCTION);
    expect(method).toContain(INSTRUCTION);
    expect(bare).toContain(brief);
    expect(method).toContain(brief);
    expect(bare).not.toMatch(/conquistador/i);
    expect(method).toContain("Start here: Demo method for Write a hero section for hero-1.");
    expect(method).toContain("Reference version one: cut every sentence without a fact.");
    expect(method).not.toContain("Reference version two");
    expect(method).not.toContain("Uncommitted working-tree text");
    // Strip the shared brief: what is left of the bare prompt is the instruction alone, with no arm name.
    const wrapper = bare!.replace(brief, "");
    expect(wrapper).not.toMatch(/\b(bare|method|baseline|candidate|arm)\b/i);
  });

  it("builds the method context deterministically and from the requested commit", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }]);
    await generate({ packDir: pack, runner: fake(log.path), arms: ["method"] });
    await generate({ packDir: pack, runner: fake(log.path), arms: ["method"], force: true });
    await generate({ packDir: pack, runner: fake(log.path), arms: ["method"], force: true, commit: secondCommit.slice(0, 10) });
    const prompts = log.read().map((entry) => entry.prompt);
    expect(prompts[0]).toBe(prompts[1]);
    expect(prompts[2]).toContain("Reference version two.");
    expect(sidecar(pack, "hero-1").method.commit).toBe(secondCommit);
  });

  it("isolates the brief from user playbooks and project files, and the runner from the pack and Conquistador variables", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }]);
    const saved = { HOME: process.env.HOME, CONQUISTADOR_PLAYBOOKS: process.env.CONQUISTADOR_PLAYBOOKS, CONQUISTADOR_HOME: process.env.CONQUISTADOR_HOME };
    process.env.HOME = realHome;
    process.env.CONQUISTADOR_PLAYBOOKS = join(realHome, ".conquistador", "playbooks");
    process.env.CONQUISTADOR_HOME = join(realHome, ".conquistador");
    try {
      await generate({ packDir: pack, runner: fake(log.path) });
    } finally {
      for (const [name, value] of Object.entries(saved)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    const calls = log.read();
    const method = calls[1]!.prompt;
    expect(method).toContain("User playbooks: none. Home: clean. Working folder entries: 0.");
    for (const call of calls) {
      expect(call.entries).toEqual([]);
      expect(call.conquistadorEnv).toEqual([]);
      expect(resolve(call.cwd).startsWith(resolve(pack))).toBe(false);
    }
  });

  it("never shows the method arm the bare draft, or the bare arm the method draft", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1", drafts: { "bare.md": "CANARY-BARE-DRAFT" } }]);
    await generate({ packDir: pack, runner: fake(log.path), arms: ["method"] });
    expect(log.read()[0]!.prompt).not.toContain("CANARY-BARE-DRAFT");
    const other = makePack([{ id: "hero-1", drafts: { "method.md": "CANARY-METHOD-DRAFT" } }]);
    await generate({ packDir: other, runner: fake(log.path), arms: ["bare"] });
    expect(log.read()[1]!.prompt).not.toContain("CANARY-METHOD-DRAFT");
    expect(log.read().every((call) => !call.entries.length)).toBe(true);
  });

  it("refuses a pinned commit that does not exist, before any draft or worktree", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }]);
    await expect(generate({ packDir: pack, runner: fake(log.path), commit: "0123456789abcdef0123456789abcdef01234567" })).rejects.toThrow(/commit .* does not exist/);
    await expect(generate({ packDir: pack, runner: fake(log.path), commit: "--help" })).rejects.toThrow(/commit/);
    expect(log.read()).toEqual([]);
    expect(existsSync(join(pack, "hero-1", "bare.md"))).toBe(false);
  });

  it("removes the temporary worktree after success, after a dirty checkout, and after a failed brief", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }, { id: "hero-2", brief: "Task: FAIL-BRIEF now.\n" }]);
    const failed = generate({ packDir: pack, runner: fake(log.path) });
    await expect(failed).rejects.toThrow(/brief .*failed/);
    const ok = makePack([{ id: "hero-1" }]);
    const { lines } = await generate({ packDir: ok, runner: fake(log.path) });
    const checkout = lines.find((line) => line.startsWith("Checked out"))!.split(" at ")[1]!.trim();
    expect(existsSync(checkout)).toBe(false);
    expect(git(repo, "status", "--porcelain")).toBe("M skills/demo/references/method.md");
  });

  it("refuses to overwrite drafts without --force, checking every case before drafting any", async () => {
    const log = runnerLog();
    const pack = makePack([{ id: "hero-1" }, { id: "hero-2", drafts: { "method.md": "Earlier draft." } }]);
    await expect(generate({ packDir: pack, runner: fake(log.path) })).rejects.toThrow(/hero-2.*method\.md.*--force/);
    expect(log.read()).toEqual([]);
    expect(existsSync(join(pack, "hero-1", "bare.md"))).toBe(false);
    await generate({ packDir: pack, runner: fake(log.path), force: true });
    expect(draft(pack, "hero-2", "method")).not.toContain("Earlier draft.");
  });

  it("refuses a pack inside a Git work tree", async () => {
    const inside = join(repo, "private-pack");
    mkdirSync(join(inside, "hero-1"), { recursive: true });
    writeFileSync(join(inside, "pack.json"), JSON.stringify({ schemaVersion: "conquistador.judging-pack/v1", id: "gen-pack", arms: { baseline: "bare", candidate: "method" } }));
    writeFileSync(join(inside, "hero-1", "case.json"), JSON.stringify({ practice: "copy" }));
    writeFileSync(join(inside, "hero-1", "brief.md"), "Task: Write it.\n");
    try {
      await expect(generate({ packDir: inside, runner: fake(runnerLog().path) })).rejects.toThrow(/Git work tree/);
    } finally {
      rmSync(inside, { recursive: true, force: true });
    }
  });

  it("refuses a claude runner that would expose Conquistador tools, by flags and by its startup report", async () => {
    const pack = makePack([{ id: "hero-1" }]);
    expect(checkRunnerFlags(splitCommand("claude -p --model claude-opus-5-5"))).toEqual(expect.arrayContaining(["--safe-mode", "--strict-mcp-config", '--tools ""']));
    expect(checkRunnerFlags(splitCommand(DEFAULT_RUNNER))).toEqual([]);
    const claude = fakeClaude();
    const log = runnerLog();
    await expect(generate({ packDir: pack, runner: `"${claude}" -p --model claude-opus-5-5 --log "${log.path}"`, trustRunner: false })).rejects.toThrow(/isolation flags/);
    const isolated = DEFAULT_RUNNER.replace(/^claude/, `"${claude}"`);
    await expect(generate({ packDir: pack, runner: `${isolated} --leaky --log "${log.path}"`, trustRunner: false })).rejects.toThrow(/exposes .*conquistador/i);
    expect(existsSync(join(pack, "hero-1", "bare.md"))).toBe(false);
    await generate({ packDir: pack, runner: `${isolated} --log "${log.path}"`, trustRunner: false });
    expect(sidecar(pack, "hero-1").bare).toMatchObject({ model: "claude-opus-5-5", isolation: "verified" });
  });

  it("refuses a runner it cannot check unless the caller vouches for it", async () => {
    const pack = makePack([{ id: "hero-1" }]);
    await expect(generate({ packDir: pack, runner: fake(runnerLog().path), trustRunner: false })).rejects.toThrow(/--trust-runner/);
    await generate({ packDir: pack, runner: fake(runnerLog().path), trustRunner: true });
    expect(sidecar(pack, "hero-1").bare.isolation).toBe("trusted-by-caller");
  });

  it("refuses a draft that names Conquistador, and records arm words for the human check", async () => {
    const pack = makePack([{ id: "hero-1" }]);
    await expect(generate({ packDir: pack, runner: fake(runnerLog().path, "leak"), arms: ["bare"] })).rejects.toThrow(/names Conquistador/);
    expect(existsSync(join(pack, "hero-1", "bare.md"))).toBe(false);
    const { lines } = await generate({ packDir: pack, runner: fake(runnerLog().path, "armword"), arms: ["bare"] });
    expect(sidecar(pack, "hero-1").bare.identityRemovals).toContain("arm-label");
    expect(lines.join("\n")).toMatch(/hero-1 bare.*arm-label/);
  });

  it("writes no draft when the runner fails or returns nothing", async () => {
    const pack = makePack([{ id: "hero-1" }]);
    await expect(generate({ packDir: pack, runner: fake(runnerLog().path, "fail"), arms: ["bare"] })).rejects.toThrow(/runner .*exit/);
    await expect(generate({ packDir: pack, runner: fake(runnerLog().path, "empty"), arms: ["bare"] })).rejects.toThrow(/empty draft/);
    expect(readdirSync(join(pack, "hero-1")).sort()).toEqual(["brief.md", "case.json"]);
  });

  it("requires a Task line, known cases and arms, and references inside the checkout", async () => {
    const log = runnerLog();
    await expect(generate({ packDir: makePack([{ id: "hero-1", brief: "Write a hero.\n" }]), runner: fake(log.path) })).rejects.toThrow(/Task:/);
    await expect(generate({ packDir: makePack([{ id: "hero-1" }]), runner: fake(log.path), cases: ["nope"] })).rejects.toThrow(/unknown case nope/);
    await expect(generate({ packDir: makePack([{ id: "hero-1" }]), runner: fake(log.path), arms: ["model"] })).rejects.toThrow(/unknown arm model/);
    await expect(generate({ packDir: makePack([{ id: "hero-1", brief: "Task: ESCAPE please.\n" }]), runner: fake(log.path) })).rejects.toThrow(/outside the checkout/);
    await expect(generate({ packDir: makePack([{ id: "hero-1", brief: "Task: MISSING-REF please.\n" }]), runner: fake(log.path) })).rejects.toThrow(/missing\.md/);
    expect(log.read()).toEqual([]);
  });

  it("generates only the selected cases", async () => {
    const pack = makePack([{ id: "hero-1" }, { id: "hero-2" }]);
    await generate({ packDir: pack, runner: fake(runnerLog().path), cases: ["hero-2"] });
    expect(existsSync(join(pack, "hero-1", "bare.md"))).toBe(false);
    expect(existsSync(join(pack, "hero-2", "method.md"))).toBe(true);
  });
});

describe("runner command and brief parsing", () => {
  it("splits a quoted runner command without a shell", () => {
    expect(splitCommand(`claude -p --tools "" --mcp-config '{"mcpServers":{}}' --x a\\ b`)).toEqual(["claude", "-p", "--tools", "", "--mcp-config", '{"mcpServers":{}}', "--x", "a b"]);
    expect(() => splitCommand(`claude "open`)).toThrow(/quote/);
  });

  it("reads File: lines and required references that were not inlined", () => {
    const parsed = parseBriefOutput("Head\n\nRequired references not inlined (budget): a/one.md, b/two.md. Expand them with conquistador_read before the stage that uses them.\n\n## X\nFile: a/x.md\n");
    expect(parsed).toEqual({ files: ["a/x.md"], notInlined: ["a/one.md", "b/two.md"] });
    expect(parseBriefOutput("No refs\nFile: a/x.md\n")).toEqual({ files: ["a/x.md"], notInlined: [] });
  });

  it("defaults to an isolated claude runner on the pinned model", () => {
    expect(DEFAULT_RUNNER).toMatch(/^claude -p --model claude-opus-5-5 /);
  });
});
