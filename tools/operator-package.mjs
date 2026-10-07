// Shared inventory for staging and checking the portable operator executable.
// The MCP server and hooks need the briefing engine and its router dependencies.
export const briefFiles = ['tools/skills-mcp.mjs', 'tools/brief.mjs', 'tools/context-files.mjs', 'tools/context-selection.mjs', 'tools/request-text.mjs', 'tools/routing-contract.mjs', 'tools/domain-package.mjs', 'tools/method-library.mjs', 'tools/plugin-contracts.mjs', 'tools/module-root.mjs', 'tools/check/index.mjs', 'tools/check/rules.mjs', 'tools/check/channels.mjs', 'tools/check/extract.mjs'];
export const operatorFiles = [
  ...['contracts.mjs', 'operator.mjs', 'receipt.mjs', 'orchestrate.mjs', 'bb.mjs', 'team.mjs', 'host.json', 'README.md']
    .map(name => `hosts/coding-agent/${name}`),
  'tools/domain-package.mjs', 'tools/plugin-contracts.mjs', 'tools/method-library.mjs', 'tools/routing-contract.mjs', 'tools/request-text.mjs', 'tools/knowledge-index.mjs', 'tools/brief.mjs', 'tools/context-files.mjs', 'tools/context-selection.mjs',
  'agents/conquistador/agent.json', 'agents/conquistador/compatibility/v1.json',
  'agents/agent-package.schema.json', 'agents/agent-package-v2.schema.json',
  'agents/operator-profile.schema.json', 'agents/execution-receipt.schema.json',
];
