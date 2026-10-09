// Installer reach (2026-10-10): hooks for Copilot CLI and Grok CLI, a hooks switch people can use from
// their agent, four more skill agents, and a shorter agents screen. Written before the change.
//
// What can go wrong, and the check for each:
// - Copilot never loads the hooks: our root plugin.json is an Agent Plugins manifest, which wins over
//   .claude-plugin/plugin.json, and Copilot then reads hooks only from com.github.copilot/hooks/hooks.json
//     -> that file exists, ships in the plugin payload, and keeps the Agent Plugins $schema at the root
// - Copilot hooks use the wrong format or cannot find the scripts
//     -> version 1, camelCase events, bash and powershell commands through PLUGIN_ROOT, scripts exist
// - Copilot blocks a marketing answer by mistake: its transcript format is unverified, so the read
//   check cannot trust it -> no agentStop hook, and `copilot stop` prints nothing
// - Copilot gets output it does not read -> top-level additionalContext for prompt, start, and edit
// - A shared hooks/hooks.json double-runs hooks in Claude Code, which loads it by default
//     -> the shared payload has no hooks/hooks.json
// - Grok loads no hooks or MCP server: it reads only hooks/hooks.json and .mcp.json, and a second
//   source path registers a second plugin with the same name
//     -> a Grok-only staged copy carries both files, absolute paths, and the install removes the old
//        registration before it registers the staged copy
// - Grok runs a hook whose output it discards, or blocks by mistake
//     -> the Grok hooks file has only PostToolUse (the copy check); `grok stop` prints nothing
// - Grok or Copilot edits are missed -> the copy check reads toolArgs (Copilot) and toolInput (Grok)
// - Hooks ignore the off switch -> CONQUISTADOR_HOOKS=off and {"hooks": false} silence every client
// - People can only turn hooks off with an environment variable
//     -> `conquistador hooks on|off|status`; status names the environment override; bad input exits 2;
//        the skill routes /conquistador hooks to it; other config keys survive
// - The legacy project command breaks -> `hooks ... --project` still reaches the project operator
// - New agents install to the wrong folder or duplicate a skill
//     -> Qoder, Rovo Dev, Trae and Trae CN folders as documented; Rovo Dev shares Pi's ~/.agents/skills
//        copy (Rovo Dev reads that folder), so both install one copy; folders, not `acli`, find Rovo Dev
// - The agents screen hides found agents or cannot reach the rest
//     -> covered end to end in tools/e2e/installer.mjs (T20)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'runtime/bin/conquistador.js');

function temp(t, prefix = 'cq-reach-') {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}

// Run a hook script as the host would: JSON on stdin, output on stdout.
function hook(script, args, input, env = {}) {
  const result = spawnSync(process.execPath, [join(root, 'hooks', script), ...args], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 20_000,
    env: { ...process.env, CONQUISTADOR_HOOKS: '', ...env },
  });
  const text = (result.stdout ?? '').trim();
  return { status: result.status, text, json: text ? JSON.parse(text) : null };
}

// Load the agent registry with a private HOME, so homedir() and detection see only the fixture.
function registry(home, code, env = {}) {
  const script = `const m = await import(${JSON.stringify(join(root, 'tools/agents.mjs'))}); ${code}`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 20_000, env: { ...process.env, HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, '.conquistador'), ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function marketingFile(t) {
  const project = temp(t, 'cq-reach-project-');
  const file = join(project, 'ads', 'google-ads-rsa.md');
  mkdirSync(dirname(file), { recursive: true });
  copyFileSync(join(root, 'tools/e2e/fixtures/check/bad/google-ads-rsa.md'), file);
  return { project, file };
}

// --- Copilot ---------------------------------------------------------------------------------------

test('Copilot hooks live where an Agent Plugins manifest makes Copilot read them', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const file = join(root, 'com.github.copilot/hooks/hooks.json');
  assert.ok(existsSync(file), 'com.github.copilot/hooks/hooks.json is missing');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(config.version, 1);
  assert.deepEqual(Object.keys(config.hooks).sort(), ['postToolUse', 'sessionStart', 'userPromptSubmitted']);
  for (const [event, handlers] of Object.entries(config.hooks)) {
    for (const handler of handlers) {
      assert.match(handler.bash, /^node "\$PLUGIN_ROOT\/hooks\/(conquistador-hook|check-hook)\.mjs" copilot (start|prompt|edit)$/, `${event} bash`);
      assert.match(handler.powershell, /^node "\$env:PLUGIN_ROOT\/hooks\/(conquistador-hook|check-hook)\.mjs" copilot (start|prompt|edit)$/, `${event} powershell`);
      assert.ok(handler.timeoutSec > 0 && handler.timeoutSec <= 15, `${event} timeout`);
      const script = /hooks\/([\w-]+\.mjs)/.exec(handler.bash)[1];
      assert.ok(existsSync(join(root, 'hooks', script)), script);
    }
  }
});

test('the Copilot hooks file ships in the plugin payload, and no shared hooks/hooks.json does', async () => {
  const { readPluginManifest, pluginPayload } = await import('./plugin-payload.mjs');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const paths = readPluginManifest(root, version).map(item => item.path);
  assert.ok(paths.includes('com.github.copilot/hooks/hooks.json'), 'not in release/plugin-completeness.json');
  assert.ok(pluginPayload.includes('com.github.copilot'));
  assert.ok(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).files.includes('com.github.copilot'));
  assert.ok(!existsSync(join(root, 'hooks/hooks.json')), 'hooks/hooks.json would also load in Claude Code');
  assert.ok(!paths.includes('hooks/hooks.json'));
});

test('Copilot gets top-level additionalContext for start and a marketing prompt, and no stop gate', t => {
  const state = temp(t);
  const env = { CONQUISTADOR_STATE: state, CONQUISTADOR_HOME: temp(t) };
  const start = hook('conquistador-hook.mjs', ['copilot', 'start'], { sessionId: 's1', cwd: state }, env);
  assert.equal(typeof start.json?.additionalContext, 'string');
  assert.match(start.json.additionalContext, /conquistador_brief/);
  const prompt = hook('conquistador-hook.mjs', ['copilot', 'prompt'], { sessionId: 's1', cwd: state, prompt: 'Write three cold emails for our accounting app launch' }, env);
  assert.equal(typeof prompt.json?.additionalContext, 'string');
  assert.equal(prompt.json.hookSpecificOutput, undefined);
  const transcript = join(state, 'events.jsonl');
  writeFileSync(transcript, '{"type":"unknown.event","data":{}}\n');
  const stop = hook('conquistador-hook.mjs', ['copilot', 'stop'], { sessionId: 's1', cwd: state, transcriptPath: transcript, transcript_path: transcript, stop_hook_active: false }, env);
  assert.equal(stop.text, '', 'Copilot must not block on an unverified transcript');
});

test('Copilot edits are checked through toolArgs and answered with additionalContext', t => {
  const { project, file } = marketingFile(t);
  const env = { CONQUISTADOR_STATE: temp(t), CONQUISTADOR_HOME: temp(t) };
  for (const toolArgs of [JSON.stringify({ path: file }), { path: file }]) {
    const out = hook('check-hook.mjs', ['copilot', 'edit'], { sessionId: `s-${typeof toolArgs}`, cwd: project, toolName: 'edit', toolArgs }, env);
    assert.match(out.json?.additionalContext ?? '', /Conquistador check found/, JSON.stringify(out));
  }
});

// --- Grok ------------------------------------------------------------------------------------------

test('Grok edits are checked through toolInput and answered in Grok\'s PostToolUse shape', t => {
  const { project, file } = marketingFile(t);
  const env = { CONQUISTADOR_STATE: temp(t), CONQUISTADOR_HOME: temp(t), GROK_HOOK_EVENT: 'post_tool_use' };
  const out = hook('check-hook.mjs', ['grok', 'edit'], { sessionId: 'g1', cwd: project, toolName: 'search_replace', toolInput: { file_path: file } }, env);
  assert.equal(out.json?.hookSpecificOutput?.hookEventName, 'PostToolUse');
  assert.match(out.json.hookSpecificOutput.additionalContext, /Conquistador check found/);
});

test('Grok never gets a stop gate, even when Claude-format hooks run inside Grok', t => {
  const state = temp(t);
  const env = { CONQUISTADOR_STATE: state, CONQUISTADOR_HOME: temp(t), GROK_HOOK_EVENT: 'stop' };
  const transcript = join(state, 'grok.jsonl');
  writeFileSync(transcript, '{"kind":"turn"}\n');
  for (const client of ['grok', 'claude']) {
    hook('conquistador-hook.mjs', [client, 'prompt'], { session_id: `g-${client}`, prompt: 'Plan our Product Hunt launch next week', transcript_path: transcript }, { ...env, GROK_HOOK_EVENT: 'user_prompt_submit' });
    const stop = hook('conquistador-hook.mjs', [client, 'stop'], { session_id: `g-${client}`, transcript_path: transcript, stopHookActive: false }, env);
    assert.equal(stop.text, '', `${client} inside Grok must not block`);
  }
});

test('the Grok install stages its own copy with hooks/hooks.json and .mcp.json, then replaces the old registration', t => {
  const home = temp(t);
  const plan = registry(home, `
    const grok = m.AGENTS.find(agent => agent.id === 'grok');
    const lines = [];
    const result = m.applyAgent(grok, 'install', { source: m.pluginHome(), dryRun: true, log: line => lines.push(line) });
    const removeLines = [];
    m.applyAgent(grok, 'remove', { dryRun: true, log: line => removeLines.push(line) });
    console.log(JSON.stringify({ result, lines, removeLines, staged: m.grokPluginHome() }));
  `);
  assert.equal(plan.staged, join(home, '.conquistador', 'grok-plugin'));
  assert.deepEqual(plan.lines, [
    'copy plugin → ~/.conquistador/grok-plugin',
    'grok plugin uninstall conquistador --confirm --keep-data',
    `grok plugin install ${plan.staged} --trust`,
  ]);
  assert.ok(plan.removeLines.includes('grok plugin uninstall conquistador --confirm'));
  assert.ok(plan.removeLines.includes(`remove ${plan.staged}`));
});

test('the Grok-only files point at the staged copy and register only the copy check', t => {
  const folder = temp(t);
  const files = registry(folder, `
    m.writeGrokFiles(${JSON.stringify(folder)});
    const fs = await import('node:fs');
    const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log(JSON.stringify({ hooks: read(${JSON.stringify(join(folder, 'hooks/hooks.json'))}), mcp: read(${JSON.stringify(join(folder, '.mcp.json'))}) }));
  `);
  assert.deepEqual(Object.keys(files.hooks.hooks), ['PostToolUse']);
  const [group] = files.hooks.hooks.PostToolUse;
  for (const tool of ['Edit', 'Write', 'search_replace', 'write_file']) assert.match(tool, new RegExp(`^(?:${group.matcher})$`));
  assert.equal(group.hooks[0].command, `node "${join(folder, 'hooks', 'check-hook.mjs')}" grok edit`);
  assert.deepEqual(files.mcp.mcpServers.conquistador, { command: 'node', args: [join(folder, 'mcp', 'server.mjs')] });
});

// --- The off switch ---------------------------------------------------------------------------------

test('hooks off silences every new client', t => {
  const { project, file } = marketingFile(t);
  const home = temp(t);
  writeFileSync(join(home, 'config.json'), '{"hooks": false}\n');
  for (const env of [{ CONQUISTADOR_HOME: home }, { CONQUISTADOR_HOOKS: 'off', CONQUISTADOR_HOME: temp(t) }]) {
    const base = { ...env, CONQUISTADOR_STATE: temp(t) };
    assert.equal(hook('conquistador-hook.mjs', ['copilot', 'start'], { sessionId: 'x' }, base).text, '');
    assert.equal(hook('conquistador-hook.mjs', ['copilot', 'prompt'], { sessionId: 'x', prompt: 'Write a launch plan' }, base).text, '');
    assert.equal(hook('check-hook.mjs', ['copilot', 'edit'], { sessionId: 'x', cwd: project, toolName: 'edit', toolArgs: { path: file } }, base).text, '');
    assert.equal(hook('check-hook.mjs', ['grok', 'edit'], { sessionId: 'x', cwd: project, toolName: 'search_replace', toolInput: { file_path: file } }, base).text, '');
  }
});

function run(args, home, env = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, CONQUISTADOR_HOOKS: '', CONQUISTADOR_HOME: home, ...env } });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

test('conquistador hooks on, off and status change only the hooks setting', t => {
  const home = temp(t);
  writeFileSync(join(home, 'config.json'), `${JSON.stringify({ playbooks: ['~/notes'], hooks: true }, null, 2)}\n`);
  const off = run(['hooks', 'off'], home);
  assert.equal(off.status, 0, off.out);
  assert.match(off.out, /off/i);
  assert.match(off.out, /conquistador hooks on/);
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')), { playbooks: ['~/notes'], hooks: false });
  assert.match(run(['hooks', 'status'], home).out, /Hooks are off/);
  const on = run(['hooks', 'on'], home);
  assert.equal(on.status, 0, on.out);
  assert.equal(JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).hooks, true);
  assert.equal(JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).playbooks[0], '~/notes');
  const status = run(['hooks', 'status'], home);
  assert.equal(status.status, 0);
  assert.match(status.out, /Hooks are on/);
  assert.match(status.out, /Claude Code, Codex, Cursor, GitHub Copilot CLI, Grok CLI/);
});

test('hooks status names an environment override, and bad input exits 2', t => {
  const home = temp(t);
  const status = run(['hooks', 'status'], home, { CONQUISTADOR_HOOKS: 'off' });
  assert.equal(status.status, 0);
  assert.match(status.out, /Hooks are off/);
  assert.match(status.out, /CONQUISTADOR_HOOKS=off/);
  const bad = run(['hooks', 'sideways'], home);
  assert.equal(bad.status, 2);
  assert.match(bad.out, /conquistador hooks on\|off\|status/);
});

test('the legacy project hooks command still reaches the project operator', t => {
  const home = temp(t);
  const legacy = run(['hooks', 'status'], home, {});
  assert.doesNotMatch(legacy.out, /--project/, 'plain status is the new switch');
  const project = run(['hooks', 'enable', '--project', temp(t)], home);
  assert.match(project.out, /Install this project operator before enabling hooks/);
});

test('help and the skill tell people how to turn hooks on and off', () => {
  const help = spawnSync(process.execPath, [cli, 'help', '--all'], { encoding: 'utf8', timeout: 30_000 });
  assert.match(`${help.stdout}${help.stderr}`, /conquistador hooks on\|off\|status/);
  const skill = readFileSync(join(root, 'skills/conquistador/SKILL.md'), 'utf8');
  assert.match(skill, /\/conquistador hooks/);
  assert.match(skill, /conquistador hooks (on|off|status)/);
});

// --- New agents --------------------------------------------------------------------------------------

test('Qoder, Rovo Dev, Trae and Trae CN install to their documented skill folders', t => {
  const home = temp(t);
  const agents = registry(home, `
    const pick = id => m.AGENTS.find(agent => agent.id === id);
    console.log(JSON.stringify(['qoder', 'rovodev', 'trae', 'trae-cn'].map(id => ({ id, label: pick(id)?.label, how: pick(id)?.how, global: pick(id)?.global?.(), project: pick(id)?.project }))));
  `);
  assert.deepEqual(agents, [
    { id: 'qoder', label: 'Qoder', how: 'skill', global: join(home, '.qoder', 'skills'), project: '.qoder/skills' },
    { id: 'rovodev', label: 'Rovo Dev', how: 'skill', global: join(home, '.agents', 'skills'), project: '.rovodev/skills' },
    { id: 'trae', label: 'Trae', how: 'skill', global: join(home, '.trae', 'skills'), project: '.trae/skills' },
    { id: 'trae-cn', label: 'Trae CN', how: 'skill', global: join(home, '.trae-cn', 'skills'), project: '.trae/skills' },
  ]);
});

test('new agents are found by their folders, not by a shared command such as acli', t => {
  const home = temp(t);
  const bin = temp(t);
  writeFileSync(join(bin, 'acli'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'acli'), 0o755);
  const none = registry(home, `console.log(JSON.stringify(m.detectAgents().filter(agent => ['qoder', 'rovodev', 'trae', 'trae-cn'].includes(agent.id) && agent.found).map(agent => agent.id)))`, { PATH: `${bin}:/usr/bin:/bin` });
  assert.deepEqual(none, []);
  for (const folder of ['.qoder', '.rovodev', '.trae', '.trae-cn']) mkdirSync(join(home, folder));
  const found = registry(home, `console.log(JSON.stringify(m.detectAgents().filter(agent => agent.found).map(agent => agent.id)))`, { PATH: '/usr/bin:/bin' });
  for (const id of ['qoder', 'rovodev', 'trae', 'trae-cn']) assert.ok(found.includes(id), id);
});

test('names people type resolve to the new agents', t => {
  const names = registry(temp(t), `console.log(JSON.stringify(['qoder', 'qodercli', 'rovodev', 'rovo-dev', 'rovo', 'trae', 'trae-cn', 'traecn'].map(m.agentId)))`);
  assert.deepEqual(names, ['qoder', 'qoder', 'rovodev', 'rovodev', 'rovodev', 'trae', 'trae-cn', 'trae-cn']);
});

test('Pi and Rovo Dev share one skill copy in ~/.agents/skills', t => {
  const home = temp(t);
  const lines = registry(home, `
    const done = new Set();
    const lines = [];
    const results = ['pi', 'rovodev'].map(id => m.applyAgent(m.AGENTS.find(agent => agent.id === id), 'install', { dryRun: true, done, log: line => lines.push(line) }));
    console.log(JSON.stringify({ lines, results }));
  `);
  assert.deepEqual(lines.results, [{ ok: true }, { ok: true }]);
  assert.deepEqual(lines.lines, [`copy skill → ~/.agents/skills/conquistador`]);
});

test('install docs list every agent the registry knows', t => {
  const ids = registry(temp(t), 'console.log(JSON.stringify(m.AGENTS.map(agent => agent.label)))');
  const install = readFileSync(join(root, 'INSTALL.md'), 'utf8');
  for (const label of ids) assert.ok(install.includes(`| ${label} |`), `INSTALL.md table misses ${label}`);
});

// --- The hooks hint on the Options screen --------------------------------------------------------------

test('the Options hint says what hooks do and how to turn them off from the agent', () => {
  const source = readFileSync(join(root, 'tools/installer-tui.mjs'), 'utf8');
  const hint = /label: 'Prompt hooks'[\s\S]*?hint: \(\) => '([^']+)'/.exec(source)?.[1] ?? '';
  assert.match(hint, /copy/i);
  assert.match(hint, /\/conquistador hooks off/);
});
