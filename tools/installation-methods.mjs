// Four public installation paths. Reuse the owned installer and its preview/undo contract.
import { AGENTS, agentId } from './agents.mjs';

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
  mcp: `Usage: conquistador mcp
Serve the local playbook tools over stdio. Add this command to any stdio MCP client.
  conquistador mcp install [--apps=CLIENT,...] [--yes] [--dry-run] [--json]
  conquistador mcp --http [--host HOST] [--port PORT]
Remote MCP: https://mcp.forsvn.com/mcp (OAuth sign-in or API-key Bearer header).
No mcporter bridge is required. Keep credentials in your client's secret settings.`,
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
  try {
    if (command === 'skills' && rest.includes('--no-hooks')) throw Error('Skills have no hooks. Omit --no-hooks; it controls hooks in installed plugins.');
    if (command !== 'install') {
      for (const arg of rest) {
        if (/^--(?:surface|scope)(?:=|$)/.test(arg)) throw Error(`${command} chooses its own installation type. Omit ${arg}. Use conquistador install for advanced choices.`);
      }
    }
    if (command === 'plugins') {
      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        const value = arg.startsWith('--providers=') ? arg.slice(12) : ['--providers', '--in'].includes(arg) ? rest[++i] : null;
        for (const name of value?.split(',') ?? []) {
          const agent = AGENTS.find(item => item.id === agentId(name));
          if (!agent || agent.how === 'skill') throw Error(`${name} has no native plugin adapter. Use conquistador skills for Agent Skills clients.`);
        }
      }
    }
    const defaults = { skills: ['--surface=agents', '--scope=project'], plugins: ['--surface=agents', '--scope=global'], mcp: ['--surface=mcp-apps'], install: [] }[command];
    return (await import('./launch.mjs')).runStart([...defaults, ...rest], { installer: true, method: command });
  } catch (error) { console.error(error.message); return 2; }
}
