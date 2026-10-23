// Four public installation paths. Reuse the owned installer and its preview/undo contract.
import { AGENTS, agentId } from './agents.mjs';
import { parseOnboard } from './onboard.mjs';

const HELP = {
  skills: `Usage: conquistador skills [--providers=AGENT,...] [--yes] [--dry-run] [--json] [--plain]
Install one skill in this project. No hooks or MCP server.
For a user-wide skill, use the external Skills CLI with --global:
  npx skills add https://github.com/forsvn-labs/conquistador/tree/main/skills/conquistador --skill conquistador --global
Browse an older project operator: conquistador skills --list [--project PATH]`,
  install: `Usage: conquistador install [--providers=AGENT,...] [--scope=project|global] [--yes] [--dry-run] [--json]
Open the reviewed installer for coding agents. Use conquistador app for deployed-agent imports.
Keep the CLI installed: conquistador install-cli
Older project operator: conquistador operator install --project PATH`,
  plugins: `Usage: conquistador plugins [--providers=AGENT,...] [--yes] [--dry-run] [--json]
Install a native plugin with its skill, hooks and MCP server.
Clients: ${AGENTS.filter(agent => agent.how !== 'skill').map(agent => agent.id).join(', ')}.
Other compatible clients can load the prepared plugin bundle using their own plugin manager.`,
  mcp: `Usage: npx conquistador@latest mcp
Serve local playbook tools over stdio. No skills or hooks are installed.

Desktop clients (review before applying):
  npx conquistador@latest mcp install [--apps=CLIENT,...] [--yes] [--dry-run] [--json]
Coding agents (standalone MCP, using the host's own registration):
  codex mcp add conquistador -- npx -y conquistador@latest mcp
  claude mcp add --transport stdio --scope user conquistador -- npx -y conquistador@latest mcp
Executor (existing version-aware installer):
  npx conquistador@latest mcp install --executor
Remote apps, including Executor and Composio:
  Connect a public HTTPS MCP URL; they cannot run your local npx command.
  Hosted endpoint: https://mcp.forsvn.com/mcp (OAuth or API-key authentication).
  Composio: register a Custom MCP toolkit, connect an account, then sync its tools.
  Remote deployment and authenticated acceptance are separate from npm publication.
Self-host: conquistador mcp --http [--host HOST] [--port PORT]
Keep credentials in client secret settings. Full setup: https://conquistador.app/docs/install/mcp-apps`,
};

export async function runInstallationMethod(command, args) {
  if (command === 'plugin') command = 'plugins';
  if (!Object.hasOwn(HELP, command)) return null;
  if (command === 'skills' && args.includes('--list')) {
    return (await import('./start.mjs')).runStart(args.filter(arg => arg !== '--list'), process.cwd(), true);
  }
  // Preserve explicit old operator routes. The ordinary install command now opens the installer.
  if (command === 'install' && args.some(arg => /^--(?:project|path|host)(?:=|$)/.test(arg))) return null;
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP[command]); return 0; }
  if (command === 'mcp' && args[0] !== 'install') return null;
  const rest = command === 'mcp' ? args.slice(1) : args;
  const executor = command === 'mcp' && rest.includes('--executor');
  try {
    if (executor && rest.some(arg => /^--(?:apps|providers|in)(?:=|$)/.test(arg))) throw Error('Choose --executor or desktop --apps, not both.');
    if (command === 'skills' && rest.includes('--no-hooks')) throw Error('Skills have no hooks. Omit --no-hooks; it controls hooks in installed plugins.');
    if (command !== 'install') {
      const allowed = new Set(['--yes', '--dry-run', '--json', '--plain', '--no-open', ...(command === 'mcp' ? ['--apps', '--executor'] : ['--providers', '--in', ...(command === 'plugins' ? ['--hooks', '--no-hooks'] : [])])]);
      for (const arg of rest) {
        if (/^--(?:surface|scope)(?:=|$)/.test(arg)) throw Error(`${command} chooses its own installation type. Omit ${arg}. Use conquistador install for advanced choices.`);
        if (arg.startsWith('--') && !allowed.has(arg.split('=')[0])) throw Error(`${command} cannot use ${arg.split('=')[0]}. Use conquistador install for advanced choices.`);
      }
    }
    if (command === 'plugins') {
      const selected = parseOnboard(rest);
      for (const name of selected.providers ?? (selected.wanted ? [selected.wanted] : [])) {
        const agent = AGENTS.find(item => item.id === agentId(name));
        if (!agent || agent.how === 'skill') throw Error(`${name} has no native plugin adapter. Use conquistador skills for Agent Skills clients.`);
      }
    }
    const defaults = { skills: ['--surface=agents', '--scope=project'], plugins: ['--surface=agents', '--scope=global'], mcp: [executor ? '--surface=executor' : '--surface=mcp-apps'], install: [] }[command];
    return (await import('./launch.mjs')).runStart([...defaults, ...rest.filter(arg => arg !== '--executor')], { installer: true, method: command });
  } catch (error) { console.error(error.message); return 2; }
}
