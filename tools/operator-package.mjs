// Shared inventory for staging and checking the portable operator executable.
export const operatorFiles = [
  ...['contracts.mjs', 'operator.mjs', 'receipt.mjs', 'orchestrate.mjs', 'bb.mjs', 'team.mjs', 'host.json', 'README.md']
    .map(name => `hosts/coding-agent/${name}`),
  'tools/domain-package.mjs', 'tools/plugin-contracts.mjs', 'tools/method-library.mjs',
  'agents/conquistador/agent.json', 'agents/conquistador/compatibility/v1.json',
  'agents/agent-package.schema.json', 'agents/agent-package-v2.schema.json',
  'agents/operator-profile.schema.json', 'agents/execution-receipt.schema.json',
];
