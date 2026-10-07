// Register Conquistador as a source in Executor (https://executor.sh), so every agent connected to
// Executor gets the playbook tools. This is the other direction from hosts/executor, which lets
// Conquistador read Executor.
//
// Checked against Executor 1.6.8 on 2026-10-07 in a throwaway data folder: `executor call executor
// mcp addServer JSON` pauses for approval and prints an execution ID; `executor resume
// --execution-id ID --action accept --content '{}'` runs it. A no-auth stdio server gets an
// org/default connection, and its tools appear at once. `integrations remove` works the same way.
// `mcp getServer` answers {"ok": true, "data": {"integration": null}} for a missing source, and
// {"integration": {"config": {"command", "args", ...}}} for a registered one.
// The user approves the whole plan first, so Conquistador answers yes to that one approval.
// Executor 1.5.40 (checked 2026-10-08) has mcp.addServer and mcp.getServer but no
// coreTools.integrations.remove: replacing or removing a source there is a step by hand.
// A version without mcp.addServer gets manual steps for the whole change.
import { existsSync } from 'node:fs';
import { onPath, run as runCommand } from './agents.mjs';

export const slugFor = name => String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'conquistador';

// Read one Executor answer: a paused execution, or the {"ok": ...} JSON envelope.
export function executorOutcome(text) {
  const paused = /executionId:\s*(exec_[\w-]+)/.exec(text);
  if (paused && /Execution paused/.test(text)) return { paused: paused[1] };
  const start = text.indexOf('{');
  if (start >= 0) {
    try {
      const value = JSON.parse(text.slice(start));
      if (typeof value?.ok === 'boolean') return value;
    } catch { /* Not JSON. */ }
  }
  return { ok: false, error: { code: 'unreadable', message: text.trim().split('\n').slice(-2).join(' ') || 'no answer' } };
}

export function executorStatus({ run = runCommand } = {}) {
  if (!onPath('executor')) return { installed: false, running: false, version: null };
  const version = /(\d+\.\d+\.\d+)/.exec(run('executor', ['--version'], { timeout: 8_000 }).stdout)?.[1] ?? null;
  const status = run('executor', ['daemon', 'status'], { timeout: 8_000 });
  const text = `${status.stdout}\n${status.stderr}`;
  return { installed: true, version, running: !/not running/i.test(text) && /reachable|running/i.test(text) };
}

// Call one Executor tool and accept its approval prompt.
function call(path, input, run) {
  const first = run('executor', ['call', 'executor', ...path.split('.'), JSON.stringify(input)], { timeout: 90_000 });
  const outcome = executorOutcome(first.stdout || first.stderr);
  if (!outcome.paused) return outcome;
  const resumed = run('executor', ['resume', '--execution-id', outcome.paused, '--action', 'accept', '--content', '{}'], { timeout: 90_000 });
  return executorOutcome(resumed.stdout || resumed.stderr);
}

export const sourceInput = (name, server) => ({ transport: 'stdio', name, slug: slugFor(name), description: 'Growth, marketing, and sales playbooks from Conquistador',
  command: server.command, args: server.args });

export function manualSteps(name, server) {
  return [
    'Add the source in Executor by hand:',
    '1. Open Executor: executor web',
    '2. Choose Add Integration, then MCP server, then stdio.',
    `3. Name: ${name}`,
    `4. Command: ${server.command}`,
    `5. Arguments: ${server.args.join(' ')}`,
  ];
}

// Returns { ok, status: added | updated | unchanged | manual, error? }.
export function registerSource(name, server, { run = runCommand, start = false } = {}) {
  if (start) run('executor', ['daemon', 'run'], { timeout: 60_000 });
  const slug = slugFor(name);
  const existing = call('mcp.getServer', { slug }, run);
  if (existing.error?.code === 'tool_not_found') return { ok: false, status: 'manual', error: 'This Executor version cannot add a source from the command line.' };
  let status = 'added';
  const config = existing.ok ? existing.data?.integration?.config : null;
  if (config) {
    if (config.command === server.command && JSON.stringify(config.args) === JSON.stringify(server.args)) return { ok: true, status: 'unchanged' };
    const removed = call('coreTools.integrations.remove', { slug }, run);
    if (removed.error?.code === 'tool_not_found') return { ok: false, status: 'manual', error: `The source "${slug}" runs an older path, and this Executor version cannot replace it from the command line. Remove "${slug}" in the Executor app (executor web), then run this again.` };
    if (!removed.ok) return { ok: false, status: 'failed', error: removed.error?.message ?? 'Executor did not remove the old source' };
    status = 'updated';
  }
  const added = call('mcp.addServer', sourceInput(name, server), run);
  if (added.ok) return { ok: true, status, slug: added.data?.slug ?? slug };
  if (added.error?.code === 'tool_not_found') return { ok: false, status: 'manual', error: 'This Executor version cannot add a source from the command line.' };
  if (added.error?.code === 'integration_already_exists') return { ok: true, status: 'unchanged' };
  return { ok: false, status: 'failed', error: added.error?.message ?? 'Executor did not add the source' };
}

export function removeSource(slug, { run = runCommand } = {}) {
  if (!onPath('executor')) return { ok: false, error: `Executor is not on PATH. Remove the "${slug}" integration in Executor by hand.` };
  const removed = call('coreTools.integrations.remove', { slug }, run);
  if (removed.error?.code === 'tool_not_found') return { ok: false, error: `This Executor version cannot remove a source from the command line. Remove "${slug}" in the Executor app: executor web` };
  return removed.ok ? { ok: true, removed: removed.data?.removed !== false } : { ok: false, error: removed.error?.message ?? 'Executor did not remove the source' };
}

export function checkSource(slug, { run = runCommand } = {}) {
  if (!onPath('executor')) return { ok: false, detail: 'Executor is not on PATH' };
  const found = call('mcp.getServer', { slug }, run);
  const config = found.ok ? found.data?.integration?.config : null;
  if (!config) return { ok: false, detail: `source "${slug}" not found${found.ok ? '' : ` (${found.error?.code ?? 'no answer'})`}` };
  for (const file of [config.command, ...(config.args ?? [])].filter(item => /[\\/]/.test(item ?? ''))) if (!existsSync(file)) return { ok: false, detail: `source "${slug}" runs ${file}, which is missing` };
  return { ok: true, detail: `source "${slug}" is registered` };
}
