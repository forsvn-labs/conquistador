#!/usr/bin/env node

// Setup only prepares local packages and must also work before runtime dependencies exist.
if (process.argv[2] === "setup") {
  const { runSetup } = await import("../../tools/setup.mjs");
  process.exitCode = await runSetup(process.argv.slice(3));
} else {
  const { runCli } = await import("../lib/main.js");
  process.exitCode = await runCli(process.argv.slice(2));
}
