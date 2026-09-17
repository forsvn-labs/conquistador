import { join } from 'node:path';

const complete = 'Parent and all 38 methods, manual operator profile, agent contracts and schemas, and BB adapter.';
export const routes = [
  { id: 'operator', label: 'Project operator (recommended)', targets: ['operator'], mode: 'single-agent', folder: '.conquistador-operator',
    contents: complete, boundary: 'Your host reads the parent file and supplies execution. No host registration or routing is installed.' },
  { id: 'plugin', label: 'Native host plugin', targets: ['claude-plugin', 'codex-plugin', 'copilot-plugin', 'agent-plugins'], mode: 'plugin', folder: '.conquistador-plugin',
    contents: complete, boundary: 'Prefer your native host manager. Setup prepares a local source only. Claude local scope is project-local; Codex and Copilot registration is user-level. The manager owns activated copies, updates, and removal.' },
  { id: 'skill', label: 'Host skill integration', targets: ['codex', 'claude-code', 'copilot', 'cursor', 'skill'], mode: 'conquistador', folder: '.agents/skills/conquistador',
    contents: 'Parent and all 38 methods with the manual operator profile. No portable agent schemas or BB adapter.',
    boundary: 'Your host discovers and follows the skill. This compact copy is not the complete executable operator.' },
  { id: 'harness', label: 'Portable agent package', targets: ['harness', 'squad'], mode: 'single-agent', folder: '.conquistador-agent',
    contents: `Harness: ${complete} Squad instead contains worker/advisor contracts and their declared methods, without the BB adapter.`, boundary: 'Harness is the operator alias. A consuming adapter must execute the contracts; JSON files do not register native agents.' },
  { id: 'mcp', label: 'Local MCP connector', targets: ['mcp'], mode: 'mcp', folder: '.conquistador-mcp',
    contents: 'Owned method-server copy with all 38 methods and the operator inventory. No runtime dependencies.',
    boundary: 'The client registers connector.json and owns the stdio process. Tools only list/read methods; they do not execute the operator.' },
  { id: 'runtime-mcp', label: 'Runtime MCP connector', targets: ['mcp'], mode: 'mcp', folder: '.conquistador-runtime-mcp',
    contents: 'Connector to an existing stable runtime installation and HTTP service. No methods or runtime are copied.',
    boundary: 'Runs supported playbooks, not all 38 methods. Service, data, and credentials have a separate lifecycle. Never pass human review or action tokens.' },
  { id: 'experimental', label: 'Experimental imports', targets: ['grok-bot', 'eve'], mode: null, folder: '.conquistador-import',
    contents: 'Import guidance only. Guided setup installs no files.',
    boundary: 'Native import, activation, and execution are unverified. Grok Bot is not Grok CLI.' },
];

export const targets = Object.fromEntries(routes.flatMap(route => route.targets.map(target => [target,
  target === 'squad' ? 'squad' : route.mode ?? target])));
export const projectPaths = { operator: '.conquistador-operator', codex: '.agents/skills/conquistador', 'claude-code': '.claude/skills/conquistador', copilot: '.github/skills/conquistador', cursor: '.cursor/skills/conquistador' };

export function routeFor(target, url) {
  return routes.find(route => route.targets.includes(target) && (target !== 'mcp' || route.id === (url ? 'runtime-mcp' : 'mcp')));
}
export function defaultPath(target = 'operator', cwd = process.cwd(), url) {
  return join(cwd, projectPaths[target] ?? (target === 'squad' ? '.conquistador-squad' : routeFor(target, url)?.folder ?? '.conquistador-operator'));
}
export function describeRoute(target, url) {
  const route = routeFor(target, url);
  if (!route) return [];
  if (target === 'squad') return ['Portable squad: worker and advisor contracts with their declared methods.',
    'This is not the complete operator package. Your adapter supplies separate contexts; same-context review must be labeled.'];
  return [route.label, route.contents, route.boundary];
}
