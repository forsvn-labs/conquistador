#!/usr/bin/env node

const args = process.argv.slice(2);
function shortcut(arg) {
  if (!arg.startsWith("--")) return null;
  const name = arg.slice(2).split("=")[0];
  return ["bot", "skills", "plugin", "mcp", "advanced"].includes(name) ? name : null;
}

// Installation must work before runtime dependencies exist.
if (args.length === 0) {
  const { runOnboarding } = await import("../../tools/onboarding.mjs");
  process.exitCode = await runOnboarding((process.stdin.isTTY && process.stdout.isTTY) ? [] : ["--help"]);
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
} else if (args[0] === "setup") {
  const { runSetup } = await import("../../tools/setup.mjs");
  process.exitCode = await runSetup(args.slice(1));
} else if (args[0] === "connections") {
  const { run } = await import("../../hosts/executor/cli.mjs");
  process.exitCode = await run(args.slice(1));
} else if (args[0] === "jobs") {
  const { run } = await import("../../hosts/eve/jobs.mjs");
  process.exitCode = await run(args.slice(1));
} else if (args[0] === "integrations") {
  const { runIntegrationReleases } = await import("../../tools/integration-releases.mjs");
  process.exitCode = await runIntegrationReleases(args.slice(1));
} else if (args[0] === "mcp" && !args.slice(1).some(arg => arg === "--url" || arg.startsWith("--url="))) {
  if (args.length !== 1) {
    process.stderr.write("Usage: conquistador mcp [--url URL]\n");
    process.exitCode = 2;
  } else {
    const { runSkillsMcp } = await import("../../tools/skills-mcp.mjs");
    await runSkillsMcp();
  }
} else {
  const { runCli } = await import("../lib/main.js");
  process.exitCode = await runCli(args);
}
