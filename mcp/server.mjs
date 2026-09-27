#!/usr/bin/env node
// Plugin entry for the read-only Conquistador playbook MCP server.
// stdio by default; `--http [--port N] [--host H]` for bots and remote apps.
const args = process.argv.slice(2);
if (args[0] === '--http') {
  const { runMcpHttp } = await import('../tools/mcp-http.mjs');
  try { await runMcpHttp(args.slice(1)); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
} else {
  const { runSkillsMcp } = await import('../tools/skills-mcp.mjs');
  await runSkillsMcp();
}
