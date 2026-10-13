import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runCommand } from './process-run.mjs';

// Existing synchronous host adapters run in a child process. This preserves their ownership
// rules while allowing Ink to draw progress and react to terminal resizing.
export async function installerOperation(action, payload) {
  const result = await runCommand(process.execPath, [fileURLToPath(import.meta.url), action, JSON.stringify(payload)], { timeout: 650_000 });

  if (result.status !== 0) return { ok: false, error: result.error || result.stderr.trim() || `Installer operation exited ${result.status}.` };

  try { return JSON.parse(result.stdout); }
  catch { return { ok: false, error: 'The installer operation returned an invalid result.' }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, text] = process.argv.slice(2);
    const payload = JSON.parse(text);
    let result;

    if (action === 'agent-install') {
      const { AGENTS, installOne } = await import('./agents.mjs');
      const agent = AGENTS.find(agent => agent.id === payload.agent);

      if (!agent) throw Error('Unknown agent.');
      const done = new Set(payload.done);
      result = { ...installOne(agent, { scope: payload.scope, root: payload.root, done }), done: [...done] };
    } else if (action === 'agent-check') {
      const { AGENTS } = await import('./agents.mjs');
      const agent = AGENTS.find(agent => agent.id === payload.agent);

      if (!agent) throw Error('Unknown agent.');
      result = { registered: agent.installed(), healthy: agent.healthy?.() ?? true };
    } else if (action === 'executor-add') {
      result = (await import('./executor-source.mjs')).registerSource(payload.name, payload.server, { start: payload.start });
    } else if (action === 'executor-check') {
      result = (await import('./executor-source.mjs')).checkSource(payload.slug);
    } else if (action === 'app-remove' || action === 'executor-remove') {
      const { readState, writeState } = await import('./agents.mjs');
      const state = readState();

      if (action === 'app-remove') {
        if (!state.mcpApps?.[payload.app]) throw Error('This MCP app has no tracked Conquistador install.');
        result = (await import('./mcp-apps.mjs')).removeApp(payload.app);

        if (result.ok) { delete state.mcpApps[payload.app]; writeState(state); }
      } else {
        if (!state.executor || state.executor.slug !== payload.slug) throw Error('This Executor source has no tracked Conquistador install.');
        result = (await import('./executor-source.mjs')).removeSource(payload.slug);

        if (result.ok) { delete state.executor; writeState(state); }
      }

      if (result.ok) result.detail = 'Removed the selected Conquistador install. Other installs remain.';
    } else throw Error('Unknown installer operation.');
    process.stdout.write(JSON.stringify(result));
  } catch (error) { process.stderr.write(error.message); process.exitCode = 1; }
}
