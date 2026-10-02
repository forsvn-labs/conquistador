#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// An error that escapes gets one plain line, a log file, and a place to report it (I11).
function crash(error) {
  if (process.stdin.isTTY) try { process.stdin.setRawMode(false); } catch { /* Not in raw mode. */ }
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  if (process.env.CONQUISTADOR_DEBUG === '1') process.stderr.write(`${detail}\n`);
  let log = null;
  try {
    const folder = join(process.env.CONQUISTADOR_HOME || join(homedir(), '.conquistador'), 'logs');
    mkdirSync(folder, { recursive: true });
    log = join(folder, `error-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    writeFileSync(log, `conquistador ${process.argv.slice(2).join(' ')}\nnode ${process.version} ${process.platform} ${process.arch}\n\n${detail}\n`);
  } catch { log = null; }
  process.stderr.write(`\nConquistador stopped: ${error instanceof Error ? error.message : String(error)}\n`
    + (log ? `Details: ${log}\n` : '')
    + 'Report it at https://github.com/forsvn-labs/conquistador/issues with the details file.\n');
  process.exit(1);
}
process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);

const args = process.argv.slice(2);
function shortcut(arg) {
  if (!arg.startsWith("--")) return null;
  const name = arg.slice(2).split("=")[0];
  return ["bot", "skills", "plugin", "mcp", "advanced"].includes(name) ? name : null;
}

// Installation must work before runtime dependencies exist. Keep help and version
// available even when the shell selected an unsupported Node.
const helpOrVersion = args.includes('--help') || args.includes('-h') || args.includes('--version') || (args.length === 1 && args[0] === 'version');
const supportedNode = Number(process.versions.node.split('.')[0]) >= 24;
const onboarding = args.length === 0 || args[0].startsWith('-') || args[0] === 'project';
const preflight = helpOrVersion || supportedNode || !onboarding ? null : await (await import('../../tools/node-preflight.mjs')).nodePreflight();

// The start flow, installer, and playbook commands come first; older per-project routes follow.
// A first argument with a space is a task: `conquistador "plan our launch"` (same rule as front-door isStart).
const task = args.length > 0 && (/\s/.test(args[0]) || ['task', '--in', '--no-open'].includes(args[0]) || args[0].startsWith('--in='));
const frontDoor = preflight === null && (args.length === 0 || task || ['add', 'update', 'remove', 'agents', 'brief', 'playbooks', 'bot', 'tour', 'help', '--help', '-h'].includes(args[0]))
  ? await (await import('../../tools/front-door.mjs')).runFrontDoor(args) : null;
if (preflight !== null) {
  process.exitCode = preflight;
} else if (frontDoor !== null) {
  process.exitCode = frontDoor;
} else if (args[0] === 'project') {
  const { runOnboarding } = await import("../../tools/onboarding.mjs");
  process.exitCode = await runOnboarding(args.length > 1 ? args.slice(1) : (process.stdin.isTTY && process.stdout.isTTY) ? [] : ["--help"]);
} else if (args[0].startsWith("-")) {
  const { runOnboarding } = await import("../../tools/onboarding.mjs");
  process.exitCode = await runOnboarding(args);
} else if (args.some(shortcut)) {
  process.stderr.write("Do not mix --bot, --skills, --plugin, --mcp, or --advanced with commands. Use the top-level flag, or conquistador --advanced to combine families.\n");
  process.exitCode = 2;
} else if (["start", "skills"].includes(args[0])) {
  try {
    const { runStart } = await import("../../tools/start.mjs");
    process.exitCode = runStart(args.slice(1), process.cwd(), args[0] === "skills");
  } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
} else if (args[0] === "install") {
  const { runOperatorSetup } = await import("../../tools/operator-setup.mjs");
  process.exitCode = await runOperatorSetup(["install", ...args.slice(1)]);
} else if (args[0] === "operator") {
  const { runOperatorSetup } = await import("../../tools/operator-setup.mjs");
  process.exitCode = await runOperatorSetup(args.slice(1));
} else if ((args[0] === "status" && args.some(arg => arg === "--run-id" || arg.startsWith("--run-id="))) ||
           (args[0] === "doctor" && args.some(arg => arg === "--config" || arg.startsWith("--config=")))) {
  const { runCli } = await import("../lib/main.js");
  process.exitCode = await runCli(args);
} else if (["status", "doctor", "update", "uninstall"].includes(args[0])) {
  const { runOperatorSetup } = await import("../../tools/operator-setup.mjs");
  process.exitCode = await runOperatorSetup(args);
} else if (args[0] === "runtime") {
  const { runCli } = await import("../lib/main.js");
  process.exitCode = await runCli(args.slice(1));
} else if (args[0] === "hooks") {
  try {
    const { runHooks } = await import("../../tools/hooks-cli.mjs");
    await runHooks(args.slice(1));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
} else if (args[0] === "route") {
  try {
    const { runRouteExplanation } = await import("../../tools/route-explanation.mjs");
    runRouteExplanation(args.slice(1));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
} else if (args[0] === "setup") {
  const { runSetup } = await import("../../tools/setup.mjs");
  process.exitCode = await runSetup(args.slice(1));
} else if (args[0] === "connections") {
  const { run } = await import("../../hosts/executor/cli.mjs");
  process.exitCode = await run(args.slice(1));
} else if (args[0] === "jobs") {
  const { run } = await import("../../hosts/eve/jobs.mjs");
  process.exitCode = await run(args.slice(1));
} else if (args[0] === "review") {
  const { runReview } = await import("../../tools/review.mjs");
  process.exitCode = await runReview(args.slice(1));
} else if (args[0] === "integrations") {
  const { runIntegrationReleases } = await import("../../tools/integration-releases.mjs");
  process.exitCode = await runIntegrationReleases(args.slice(1));
} else if (args[0] === "mcp" && args[1] === "--http") {
  const { runMcpHttp } = await import("../../tools/mcp-http.mjs");
  try { await runMcpHttp(args.slice(2)); } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 2; }
} else if (args[0] === "mcp" && !args.slice(1).some(arg => arg === "--url" || arg.startsWith("--url="))) {
  if (args.length !== 1) {
    process.stderr.write("Usage: conquistador mcp [--http [--port N] [--host H]] [--url URL]\n");
    process.exitCode = 2;
  } else {
    const { runSkillsMcp } = await import("../../tools/skills-mcp.mjs");
    await runSkillsMcp();
  }
} else {
  const { runCli } = await import("../lib/main.js");
  process.exitCode = await runCli(args);
}
