#!/usr/bin/env node
// Synthetic drafting runner for judge:generate tests. It calls no model and no network.
// Reads the prompt on stdin, logs what it could see, and writes a draft on stdout.
//   --log <file>   append one JSON line per call: argv, cwd, folder entries, Conquistador env names, prompt
//   --mode echo|leak|armword|fail|empty
//   As "claude" with --output-format stream-json, it prints an init event (--leaky lists a Conquistador tool).
import { createHash } from "node:crypto";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const prompt = readFileSync(0, "utf8");
const log = value("--log", process.env.FAKE_RUNNER_LOG);
if (log) {
  appendFileSync(log, `${JSON.stringify({
    argv: args,
    cwd: process.cwd(),
    entries: readdirSync(process.cwd()),
    conquistadorEnv: Object.keys(process.env).filter((name) => /conquistador/i.test(name)),
    prompt,
  })}\n`);
}

if (value("--output-format") === "stream-json") {
  const leaky = args.includes("--leaky");
  const init = {
    type: "system", subtype: "init", cwd: process.cwd(), model: value("--model", "fake"),
    tools: leaky ? ["mcp__plugin_conquistador_conquistador__conquistador_brief"] : [],
    mcp_servers: leaky ? [{ name: "plugin:conquistador:conquistador", status: "connected" }] : [],
    slash_commands: [], skills: [], agents: [],
    plugins: leaky ? [{ name: "conquistador", path: "/plugins/conquistador" }] : [{ name: "cc-plugin-telemetry", path: "builtin" }],
  };
  console.log(JSON.stringify(init));
  console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "OK" }));
  process.exit(0);
}

const digest = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
const mode = value("--mode", "echo");
if (mode === "fail") { console.error("fake runner failed on purpose"); process.exit(4); }
if (mode === "empty") process.exit(0);
if (mode === "leak") { console.log(`Draft ${digest}. I used conquistador_brief to plan this.`); process.exit(0); }
if (mode === "armword") { console.log(`Bare draft:\n\nDraft ${digest} for the reader.`); process.exit(0); }
console.log(`# Headline ${digest}\n\nA plain synthetic draft, ${prompt.length} characters of prompt.`);
