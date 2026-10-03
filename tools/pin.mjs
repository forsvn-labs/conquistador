// conquistador pin <command> / unpin <command>
// Writes a standalone host skill (for example ~/.claude/skills/outreach/SKILL.md) that runs
// /conquistador <command> with the user's request. Every written file carries PIN_MARKER;
// unpin removes only marked files, so a skill the user wrote is never touched.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { productRoot, readState, tilde } from './agents.mjs';
import { projectRoot } from './context-files.mjs';

export const PIN_MARKER = '<!-- conquistador-pinned-skill -->';

// Every one-word command (spec D2). Commands found on disk are added, so new ones need no edit here.
export const COMMANDS = Object.freeze([
  'position', 'brand', 'pricing', 'channels', 'budget', 'funnel', 'diagnose', 'prioritize', 'shape', 'decide',
  'campaign', 'event', 'copy', 'social', 'outreach', 'article', 'video', 'ads', 'creative', 'ideas', 'vietnamese',
  'seo', 'convert', 'audit', 'critique', 'factcheck', 'measure', 'results', 'watch', 'flow', 'ui', 'architect',
  'build', 'docs', 'feedback',
  'launch', 'gtm', 'plan', 'landing', 'lifecycle', 'referral', 'outbound', 'press', 'content', 'series', 'paid',
  'expand', 'answers', 'pseo', 'report', 'trailer', 'appstore', 'qa', 'interactive', 'experiment', 'spec',
  'init', 'check', 'connect', 'review', 'doctor',
]);
// Names that hosts already use for built-in slash commands. Pin them only with --as <name>.
export const RESERVED = Object.freeze(['init', 'review', 'doctor', 'help', 'status', 'config', 'context', 'feedback', 'plan',
  'agents', 'hooks', 'mcp', 'memory', 'model', 'resume', 'export', 'usage', 'clear', 'compact', 'login', 'logout', 'cost',
  'permissions', 'pin', 'unpin', 'conquistador']);

const env = process.env;
const at = (variable, ...fallback) => env[variable] || join(homedir(), ...fallback);
// Skill folders per agent: user scope and project scope. Codex reads skills from .agents/skills and
// names them with $ instead of /.
export const PIN_TARGETS = [
  { id: 'claude-code', label: 'Claude Code', home: () => at('CLAUDE_CONFIG_DIR', '.claude'), user: () => join(at('CLAUDE_CONFIG_DIR', '.claude'), 'skills'), project: '.claude/skills', prefix: '/' },
  { id: 'codex', label: 'Codex', home: () => at('CODEX_HOME', '.codex'), user: () => join(homedir(), '.agents', 'skills'), project: '.agents/skills', prefix: '$' },
  { id: 'cursor', label: 'Cursor', home: () => at('CURSOR_HOME', '.cursor'), user: () => join(at('CURSOR_HOME', '.cursor'), 'skills'), project: '.cursor/skills', prefix: '/' },
  { id: 'copilot', label: 'GitHub Copilot CLI', home: () => at('COPILOT_HOME', '.copilot'), user: () => join(at('COPILOT_HOME', '.copilot'), 'skills'), project: '.github/skills', prefix: '/' },
  { id: 'grok', label: 'Grok CLI', home: () => at('GROK_HOME', '.grok'), user: () => join(at('GROK_HOME', '.grok'), 'skills'), project: '.grok/skills', prefix: '/' },
  { id: 'gemini', label: 'Gemini CLI', home: () => at('GEMINI_CLI_HOME', '.gemini'), user: () => join(at('GEMINI_CLI_HOME', '.gemini'), 'skills'), project: '.gemini/skills', prefix: '/' },
];

const isDir = path => { try { return statSync(path).isDirectory(); } catch { return false; } };
const read = path => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

export function knownCommands(root = productRoot) {
  const found = new Set(COMMANDS);
  const skill = join(root, 'skills', 'conquistador');
  try { for (const name of readdirSync(join(skill, 'commands'))) if (existsSync(join(skill, 'commands', name, 'COMMAND.md'))) found.add(name); } catch { /* Not moved yet. */ }
  try { for (const name of readdirSync(join(skill, 'plays'))) if (name.endsWith('.md')) found.add(name.slice(0, -3)); } catch { /* Not moved yet. */ }
  for (const name of ['pin', 'unpin']) found.delete(name);
  return [...found].sort();
}

// One line from the command's own front matter, else a plain shortcut line.
function describeCommand(command, root = productRoot) {
  const skill = join(root, 'skills', 'conquistador');
  const front = text => /^---\n([\s\S]*?)\n---/.exec(text ?? '')?.[1] ?? '';
  const field = (text, name) => /^(?:"|')?(.*?)(?:"|')?$/.exec(new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(front(text))?.[1]?.trim() ?? '')?.[1] || null;
  const value = field(read(join(skill, 'commands', command, 'COMMAND.md')), 'description') ?? field(read(join(skill, 'plays', `${command}.md`)), 'label');
  const shortcut = `Shortcut for /conquistador ${command}.`;
  return (value ? `${value.replace(/\.$/, '')}. ${shortcut}` : shortcut).replace(/"/g, "'");
}

export function pinnedSkill(command, name, { prefix = '/', root = productRoot } = {}) {
  const invoke = `${prefix}conquistador ${command}`;
  const front = prefix === '$'
    ? `metadata:\n  argument-hint: "[request]"`
    : 'argument-hint: "[request]"\nuser-invocable: true';
  return `---\nname: ${name}\ndescription: "${describeCommand(command, root)}"\n${front}\n---\n\n${PIN_MARKER}\n\n`
    + `This is a pinned shortcut for \`${invoke}\`.\n\n`
    + `Run \`${invoke}\` with the user's request as its argument, and follow that command's instructions.\n`
    + `If the \`conquistador\` skill is not available, tell the user to reinstall Conquistador or run \`conquistador unpin ${name}\`.\n`;
}

// Agents to pin for: those Conquistador installed, else those whose home folder exists.
export function pinAgents({ only = null } = {}) {
  if (only) {
    const unknown = only.filter(id => !PIN_TARGETS.some(target => target.id === id));
    if (unknown.length) throw Error(`Unknown agent: ${unknown.join(', ')}. Use ${PIN_TARGETS.map(target => target.id).join(', ')}.`);
    return PIN_TARGETS.filter(target => only.includes(target.id));
  }
  const installed = Object.keys(readState().agents ?? {});
  const recorded = PIN_TARGETS.filter(target => installed.includes(target.id));
  return recorded.length ? recorded : PIN_TARGETS.filter(target => isDir(target.home()));
}

function folders(agents, scope, cwd) {
  // An empty HOME resolves to the current folder; never write user skills there.
  if (scope === 'user' && !isAbsolute(homedir())) throw Error('HOME is not set. Set it, or pin with --project.');
  const root = projectRoot(cwd);
  const seen = new Set();
  return agents.map(agent => ({ agent, dir: scope === 'project' ? join(root, agent.project) : agent.user() }))
    .filter(({ dir }) => !seen.has(dir) && seen.add(dir));
}

export function pin(command, { name = command, scope = 'user', agents = pinAgents(), cwd = process.cwd(), root = productRoot } = {}) {
  const results = [];
  for (const { agent, dir } of folders(agents, scope, cwd)) {
    const file = join(dir, name, 'SKILL.md');
    const existing = read(file);
    if (existing !== null && !existing.includes(PIN_MARKER)) { results.push({ agent: agent.id, file, result: 'skipped', reason: 'a skill that Conquistador did not write is already there' }); continue; }
    if (existing === null && isDir(join(dir, name))) { results.push({ agent: agent.id, file, result: 'skipped', reason: 'a folder with this name is already there' }); continue; }
    mkdirSync(join(dir, name), { recursive: true });
    writeFileSync(file, pinnedSkill(command, name, { prefix: agent.prefix, root }));
    results.push({ agent: agent.id, file, result: existing === null ? 'written' : 'updated', invoke: `${agent.prefix}${name}` });
  }
  return results;
}

// Unpin looks in every agent's folder, installed or not, because removal is marker-guarded.
export function unpin(name, { scope = 'user', agents = PIN_TARGETS, cwd = process.cwd() } = {}) {
  const results = [];
  for (const { agent, dir } of folders(agents, scope, cwd)) {
    const file = join(dir, name, 'SKILL.md');
    const existing = read(file);
    if (existing === null) continue;
    if (!existing.includes(PIN_MARKER)) { results.push({ agent: agent.id, file, result: 'skipped', reason: 'not written by conquistador pin' }); continue; }
    rmSync(file);
    // Keep anything the user added next to the shortcut.
    try { rmdirSync(join(dir, name)); } catch { /* Not empty. */ }
    results.push({ agent: agent.id, file, result: 'removed' });
  }
  return results;
}

function parse(args) {
  const options = { json: false, scope: 'user', only: null, as: null, rest: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--project') options.scope = 'project';
    else if (arg.startsWith('--agents=')) options.only = arg.slice(9).split(',').filter(Boolean);
    else if (arg === '--as') options.as = args[++index] ?? '';
    else if (arg.startsWith('--as=')) options.as = arg.slice(5);
    else if (arg.startsWith('-')) throw Error(`Unknown option: ${arg}`);
    else options.rest.push(arg);
  }
  return options;
}

const USAGE = 'Usage: conquistador pin <command> [--as <name>] [--project] [--agents=claude-code,codex,...] [--json]\n'
  + '       conquistador unpin <name> [--project] [--json]\n';

export function runPin(action, args, cwd = process.cwd()) {
  let options;
  try { options = parse(args); } catch (error) { process.stderr.write(`${error.message}\n${USAGE}`); return 2; }
  const [command] = options.rest;
  if (!command || options.rest.length > 1) { process.stderr.write(`${USAGE}\nCommands: ${knownCommands().join(', ')}\n`); return 2; }
  const name = options.as ?? command;
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(name)) { process.stderr.write(`Use a lowercase name of letters, digits, and hyphens: ${name}\n`); return 2; }
  let results;
  if (action === 'pin') {
    if (!knownCommands().includes(command)) { process.stderr.write(`Unknown command: ${command}\nCommands: ${knownCommands().join(', ')}\n`); return 2; }
    if (RESERVED.includes(name)) { process.stderr.write(`/${name} is a built-in command in some agents. Pin it under another name: conquistador pin ${command} --as ${command}-growth\n`); return 2; }
    let agents;
    try { agents = pinAgents({ only: options.only }); } catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
    if (!agents.length) { process.stderr.write('No agent found. Install Conquistador first: conquistador add\n'); return 1; }
    try { results = pin(command, { name, scope: options.scope, agents, cwd }); } catch (error) { process.stderr.write(`${error.message}\n`); return 1; }
  } else {
    try { results = unpin(name, { scope: options.scope, agents: options.only ? PIN_TARGETS.filter(target => options.only.includes(target.id)) : PIN_TARGETS, cwd }); } catch (error) { process.stderr.write(`${error.message}\n`); return 1; }
  }
  if (options.json) {
    console.log(JSON.stringify({ action, command, name, scope: options.scope, results }, null, 2));
  } else {
    for (const item of results) console.log(`  ${item.result === 'removed' ? '-' : item.result === 'skipped' ? 'SKIP' : '+'} ${tilde(item.file)}${item.reason ? ` (${item.reason})` : ''}`);
    const done = results.filter(item => ['written', 'updated', 'removed'].includes(item.result));
    if (action === 'pin' && done.length) console.log(`\nPinned ${command}. Type ${[...new Set(done.map(item => item.invoke))].join(' or ')} in your agent. Restart the agent if it does not show yet.`);
    else if (action === 'unpin' && done.length) console.log(`\nUnpinned ${name}. The /conquistador command still works.`);
    else console.log(action === 'pin' ? '\nNothing pinned.' : `\nNo pinned ${name} shortcut found.`);
  }
  return results.some(item => item.result === 'skipped') && !results.some(item => item.result !== 'skipped') ? 1 : 0;
}
