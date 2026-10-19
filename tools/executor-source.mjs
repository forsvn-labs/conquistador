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
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onPath as onPathDefault, run as runCommand, readState, writeState } from './agents.mjs';
import { executorV2Connection } from './executor-v2.mjs';

// The Executor CLI: `executor` on PATH, else the CLI inside the macOS app (Executor.app bundles one).
// CONQUISTADOR_EXECUTOR_APP=off skips the app, so tests with an isolated HOME never reach a real one.
export function executorBinary({ onPath = onPathDefault, platform = process.platform, home = homedir(), exists = existsSync, env = process.env } = {}) {
  const found = onPath('executor');
  if (found) return found;
  if (platform !== 'darwin' || env.CONQUISTADOR_EXECUTOR_APP === 'off') return null;
  const inside = 'Executor.app/Contents/Resources/executor/executor';
  return [join('/Applications', inside), join(home, 'Applications', inside)].find(exists) ?? null;
}

export const slugFor = name => String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'conquistador';

// Executor 2 removed the v1 CLI source API. Do not start a daemon or replay those commands.
export const usesExecutor2 = version => Number.parseInt(version, 10) >= 2;
const configuredV2 = () => Boolean(process.env.CONQUISTADOR_EXECUTOR_AUTH_ENV ||
  process.env.CONQUISTADOR_EXECUTOR_ORGANIZATION || process.env.EXECUTOR_API_KEY ||
  process.env.CONQUISTADOR_EXECUTOR_ACCESS);
const trackedV2 = name => {
  const previous = readState().executor;
  return Boolean(previous?.binding && [previous.name, previous.slug].includes(name));
};

export const executor2Handoff = 'Executor 2 uses apps and MCP. Keep Executor running, set CONQUISTADOR_EXECUTOR_URL to its API origin, and set CONQUISTADOR_EXECUTOR_AUTH_ENV to the environment variable holding your Executor access credential. Hosted access also needs CONQUISTADOR_EXECUTOR_ORGANIZATION. Connect accounts in Executor, then retry. https://executor.sh/docs/mcp';

export function executorHandoff(version) {
  if (!version) return 'Could not verify the Executor version. Source changes are paused. Check executor --version, then retry.';
  if (usesExecutor2(version)) {
    try { executorV2Connection(); } catch { return executor2Handoff; }
  }
  return null;
}

function v2Operation(action, name, server, run) {
  const state = readState();
  const previous = state.executor && [state.executor.name, state.executor.slug].includes(name) ? state.executor : null;
  const result = run(process.execPath, [fileURLToPath(new URL('./executor-v2.mjs', import.meta.url)), action,
    JSON.stringify({ name, ...(previous?.binding ? { binding: previous.binding } : {}), ...(server?.url ? { sourceUrl: server.url } : {}) })], { timeout: 150000 });
  let value;
  try { value = JSON.parse(result.stdout); } catch { return { ok: false, status: 'failed', error: 'Executor v2 did not return a verified result.' }; }
  if (result.status !== 0) return { ok: false, status: 'failed', error: 'Executor v2 operation failed.' };
  if (action === 'register' && value.ok && previous && value.binding) {
    writeState({ ...state, executor: { ...previous, slug: value.slug, binding: value.binding } });
  }
  return value;
}

function executorVersion(run) {
  if (configuredV2()) return '2.0.0';
  const result = run(executorBinary() ?? 'executor', ['--version'], { timeout: 8_000 });

  return result.status === 0 ? /(\d+\.\d+\.\d+)/.exec(`${result.stdout}\n${result.stderr}`)?.[1] ?? null : null;
}

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
  if (configuredV2()) return { installed: true, running: null, version: '2.0.0', app: false, configuredGateway: true };
  const bin = executorBinary();
  if (!bin) return { installed: false, running: false, version: null };
  const version = executorVersion(run);

  if (usesExecutor2(version) || executorHandoff(version)) return { installed: true, running: null, version, app: bin.includes('Executor.app') };
  const status = run(bin, ['daemon', 'status'], { timeout: 8_000 });
  const text = `${status.stdout}\n${status.stderr}`;
  return { installed: true, version, running: !/not running/i.test(text) && /reachable|running/i.test(text), app: bin.includes('Executor.app') };
}

// Call one Executor tool and accept its approval prompt.
function call(path, input, run) {
  const bin = executorBinary() ?? 'executor';
  const first = run(bin, ['call', 'executor', ...path.split('.'), JSON.stringify(input)], { timeout: 90_000 });
  const outcome = executorOutcome(first.stdout || first.stderr);
  if (!outcome.paused) return outcome;
  const resumed = run(bin, ['resume', '--execution-id', outcome.paused, '--action', 'accept', '--content', '{}'], { timeout: 90_000 });
  return executorOutcome(resumed.stdout || resumed.stderr);
}

export const sourceInput = (name, server) => ({ transport: 'stdio', name, slug: slugFor(name), description: 'Growth, marketing, and sales playbooks from Conquistador',
  command: server.command, args: server.args });

export function manualSteps(name, server) {
  if (configuredV2() || trackedV2(name)) return [executor2Handoff];
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
  const version = trackedV2(name) ? '2.0.0' : executorVersion(run);
  const handoff = executorHandoff(version);

  if (handoff) return { ok: false, status: 'manual', error: handoff };
  if (usesExecutor2(version)) return v2Operation('register', name, server, run);
  if (start) run(executorBinary() ?? 'executor', ['daemon', 'run'], { timeout: 60_000 });
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
  if (!configuredV2() && !trackedV2(slug) && !executorBinary()) return { ok: false, error: `Executor is not installed here. Remove the "${slug}" integration in Executor by hand.` };
  const version = trackedV2(slug) ? '2.0.0' : executorVersion(run);
  const handoff = executorHandoff(version);

  if (handoff) return { ok: false, error: `${handoff} The tracked source "${slug}" is kept until removal is verified.` };
  if (usesExecutor2(version)) return v2Operation('remove', slug, null, run);
  const removed = call('coreTools.integrations.remove', { slug }, run);
  if (removed.error?.code === 'tool_not_found') return { ok: false, error: `This Executor version cannot remove a source from the command line. Remove "${slug}" in the Executor app: executor web` };
  return removed.ok ? { ok: true, removed: removed.data?.removed !== false } : { ok: false, error: removed.error?.message ?? 'Executor did not remove the source' };
}

export function checkSource(slug, { run = runCommand } = {}) {
  if (!configuredV2() && !trackedV2(slug) && !executorBinary()) return { ok: false, detail: 'Executor is not installed here' };
  const version = trackedV2(slug) ? '2.0.0' : executorVersion(run);
  const handoff = executorHandoff(version);

  if (handoff) return { ok: false, detail: handoff };
  if (usesExecutor2(version)) {
    const result = v2Operation('check', slug, null, run);
    return { ...result, detail: result.detail ?? result.error };
  }
  const found = call('mcp.getServer', { slug }, run);
  const config = found.ok ? found.data?.integration?.config : null;
  if (!config) return { ok: false, detail: `source "${slug}" not found${found.ok ? '' : ` (${found.error?.code ?? 'no answer'})`}` };
  for (const file of [config.command, ...(config.args ?? [])].filter(item => /[\\/]/.test(item ?? ''))) if (!existsSync(file)) return { ok: false, detail: `source "${slug}" runs ${file}, which is missing` };
  return { ok: true, detail: `source "${slug}" is registered` };
}
