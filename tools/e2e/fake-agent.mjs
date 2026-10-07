// A stand-in for an agent CLI in the onboarding E2E: node fake-agent.mjs NAME ARGS...
// It records every call in $FAKE_AGENT_LOG and keeps plugin state in $HOME/.fake-agents.json.
// FAKE_AGENT_FAIL=name[,name] makes that agent's plugin manager fail. FAKE_AGENT_NOREG=name makes
// install succeed without registering (a verify pass must catch it). A call that is not a
// plugin command is a launch: it prints the arguments and exits.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [name, ...args] = process.argv.slice(2);
const home = process.env.HOME;
const stateFile = join(home, '.fake-agents.json');
const read = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const state = read();
const save = () => writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
if (process.env.FAKE_AGENT_LOG) appendFileSync(process.env.FAKE_AGENT_LOG, `${JSON.stringify({ name, args })}\n`);
const failing = (process.env.FAKE_AGENT_FAIL ?? '').split(',').includes(name);
const plugin = args[0] === 'plugin';
const installed = Boolean(state[name]?.installed) && !(process.env.FAKE_AGENT_NOREG ?? '').split(',').includes(name);

if (args[0] === '--version') { console.log(name === 'claude' ? '2.1.300 (Claude Code)' : `${name} 1.0.0`); process.exit(0); }
if (args[0] === 'mcp' && args[1] === 'list') { console.log('No MCP servers configured.'); process.exit(0); }
if (plugin && failing) { console.error(`error: ${name} plugin manager crashed (fake failure)`); process.exit(1); }
if (plugin) {
  const action = args.slice(1).filter(arg => !arg.startsWith('-')).join(' ');
  if (/^list/.test(action)) {
    const id = name === 'grok' ? 'conquistador' : 'conquistador@conquistador';
    console.log(args.includes('--json') ? JSON.stringify(installed ? [{ id }] : []) : installed ? `${id} (enabled)` : 'No plugins installed.');
    process.exit(0);
  }
  if (/^(?:install|add)\b/.test(action)) { state[name] = { installed: true }; save(); console.log('Installed conquistador.'); process.exit(0); }
  if (/^(?:uninstall|remove)\b/.test(action)) { state[name] = { installed: false }; save(); console.log('Removed conquistador.'); process.exit(0); }
  console.log(`ok: ${action}`);
  process.exit(0);
}
console.log(`FAKE ${name.toUpperCase()} OPENED WITH: ${args.join(' ')}`);
process.exit(0);
