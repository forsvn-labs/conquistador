#!/usr/bin/env node

// Installation must work before runtime dependencies exist.
if (process.argv.length === 2) {
  const { runSetup } = await import("../../tools/setup.mjs");
  process.exitCode = await runSetup(process.stdin.isTTY ? [] : ["--help"]);
} else if (["start", "skills"].includes(process.argv[2])) {
  try {
    const { runStart } = await import("../../tools/start.mjs");
    process.exitCode = runStart(process.argv.slice(3), process.cwd(), process.argv[2] === "skills");
  } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
} else if (process.argv[2] === "install") {
  const { runOperatorSetup } = await import("../../tools/operator-setup.mjs");
  process.exitCode = await runOperatorSetup(["install", ...process.argv.slice(3)]);
} else if (process.argv[2] === "operator") {
  const { runOperatorSetup } = await import("../../tools/operator-setup.mjs");
  process.exitCode = await runOperatorSetup(process.argv.slice(3));
} else if (process.argv[2] === "setup") {
  const { runSetup } = await import("../../tools/setup.mjs");
  process.exitCode = await runSetup(process.argv.slice(3));
} else if (process.argv[2] === "connections") {
  const { run } = await import("../../hosts/executor/cli.mjs");
  process.exitCode = await run(process.argv.slice(3));
} else if (process.argv[2] === "jobs") {
  const { run } = await import("../../hosts/eve/jobs.mjs");
  process.exitCode = await run(process.argv.slice(3));
} else if (process.argv[2] === "integrations") {
  const { runIntegrationReleases } = await import("../../tools/integration-releases.mjs");
  process.exitCode = await runIntegrationReleases(process.argv.slice(3));
} else if (process.argv[2] === "mcp" && !process.argv.slice(3).some(arg => arg === "--url" || arg.startsWith("--url="))) {
  if (process.argv.length !== 3) {
    process.stderr.write("Usage: conquistador mcp [--url URL]\n");
    process.exitCode = 2;
  } else {
    const { runSkillsMcp } = await import("../../tools/skills-mcp.mjs");
    await runSkillsMcp();
  }
} else {
  const { runCli } = await import("../lib/main.js");
  process.exitCode = await runCli(process.argv.slice(2));
}
