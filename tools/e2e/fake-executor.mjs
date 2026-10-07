// A stand-in for the Executor CLI in the onboarding E2E: node fake-executor.mjs ARGS...
// It copies the behavior observed in Executor 1.6.8 (2026-10-07): `call` pauses for approval and
// prints an execution ID; `resume --action accept` runs the call and prints {"ok": ...} JSON.
// State lives in $HOME/.fake-executor.json. FAKE_EXECUTOR=stopped starts with no daemon;
// FAKE_EXECUTOR=old has no mcp.addServer tool. Every call goes to $FAKE_AGENT_LOG.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const file = join(process.env.HOME, '.fake-executor.json');
const mode = process.env.FAKE_EXECUTOR ?? 'running';
let state;
try { state = JSON.parse(readFileSync(file, 'utf8')); } catch { state = { running: mode !== 'stopped', integrations: {}, pending: {} }; }
const save = () => writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
if (process.env.FAKE_AGENT_LOG) appendFileSync(process.env.FAKE_AGENT_LOG, `${JSON.stringify({ name: 'executor', args })}\n`);
const json = value => { console.log(JSON.stringify(value, null, 2)); process.exit(0); };

if (args[0] === '--version') { console.log(mode === 'old' ? 'executor v1.5.40' : 'executor v1.6.8'); process.exit(0); }
if (args[0] === 'daemon' && args[1] === 'status') { console.log(state.running ? 'Daemon reachable at http://localhost:4788 (pid 4242).' : 'Daemon not running at http://localhost:4788.'); process.exit(0); }
if (args[0] === 'daemon' && args[1] === 'run') { state.running = true; save(); console.log('Starting daemon on localhost:4788...'); process.exit(0); }
if (args[0] === 'tools' && args[1] === 'integrations') {
  state.running = true; save();
  json({ items: Object.keys(state.integrations).map(id => ({ id, name: id, kind: 'mcp', toolCount: 16 })) });
}
if (args[0] === 'call' && args[1] === 'executor') {
  // `call` starts the daemon when it is not running, as the real CLI does.
  if (!state.running) { console.log('Starting daemon on localhost:4788...'); state.running = true; }
  const path = args.slice(2, -1).join('.');
  const input = JSON.parse(args.at(-1));
  if (path === 'mcp.addServer' && mode === 'old') { save(); json({ ok: false, error: { code: 'tool_not_found', message: 'Tool not found: executor.mcp.addServer' } }); }
  if (path === 'mcp.getServer') { save(); json(state.integrations[input.slug] ? { ok: true, data: state.integrations[input.slug] } : { ok: false, error: { code: 'integration_not_found', message: `Integration ${input.slug} not found` } }); }
  if (['mcp.addServer', 'coreTools.integrations.remove'].includes(path)) {
    const id = `exec_${Object.keys(state.pending).length + 1}0000000-fake`;
    state.pending[id] = { path, input };
    save();
    console.log(`Execution paused: ${path === 'mcp.addServer' ? 'Add an MCP server' : `Approve executor.${path}?`}\n\nArguments:\n${JSON.stringify(input, null, 2)}\n\nexecutionId: ${id}\n\nCLI fallback:\n  executor resume --execution-id ${id} --base-url http://localhost:4788 --action accept --content '{}'`);
    process.exit(0);
  }
  save();
  json({ ok: false, error: { code: 'tool_not_found', message: `Tool not found: executor.${path}` } });
}
if (args[0] === 'resume') {
  const id = args[args.indexOf('--execution-id') + 1];
  const action = args[args.indexOf('--action') + 1];
  const call = state.pending[id];
  if (!call) json({ ok: false, error: { code: 'execution_not_found', message: `No paused execution ${id}` } });
  delete state.pending[id];
  if (action !== 'accept') { save(); json({ ok: false, error: { code: 'declined', message: 'The user declined.' } }); }
  if (call.path === 'mcp.addServer') {
    const slug = call.input.slug ?? call.input.name.toLowerCase();
    if (state.integrations[slug]) { save(); json({ ok: false, error: { code: 'integration_already_exists', message: `Integration ${slug} already exists; update it instead of re-adding.` } }); }
    state.integrations[slug] = { slug, ...call.input };
    save();
    json({ ok: true, data: { slug } });
  }
  const removed = Boolean(state.integrations[call.input.slug]);
  delete state.integrations[call.input.slug];
  save();
  json({ ok: true, data: { removed } });
}
console.error(`fake executor: unsupported ${args.join(' ')}`);
process.exit(2);
