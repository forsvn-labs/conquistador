#!/usr/bin/env node

// Setup only prepares local packages and must also work before runtime dependencies exist.
if (process.argv[2] === "setup") {
  const { runSetup } = await import("../../tools/setup.mjs");
  process.exitCode = await runSetup(process.argv.slice(3));
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
