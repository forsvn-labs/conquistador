// The agent-first start: `conquistador` ends inside the user's agent with the task typed in.
// Install when needed, pick a task, pick the agent, then hand the terminal to the agent.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { START_CONTEXT } from './brief.mjs';
import { AGENTS, applyAgent, copyPayload, detectAgents, payloadCurrent, pluginHome, readState, version, writeState } from './agents.mjs';

// Tasks that fit any product. The first one is the default.
export const STARTS = Object.freeze([
  'Plan marketing and growth for this project',
  'Get more signups to become active users',
  'Write a cold email sequence for our best customers',
  'Get our product recommended by ChatGPT and Perplexity',
]);
const startsFor = inProject => (inProject ? STARTS : ['Plan marketing and growth for my product', ...STARTS.slice(1)]);

const PROJECT_MARKERS = /^(?:\.git|package\.json|readme(?:\..+)?|pyproject\.toml|cargo\.toml|go\.mod|gemfile|composer\.json|pubspec\.yaml|package\.swift|index\.html|.+\.xcodeproj)$/i;

// A7: the home folder or an empty folder has no product to read.
export function isProject(cwd = process.cwd()) {
  if (resolve(cwd) === resolve(homedir())) return false;
  try { return readdirSync(cwd).some(name => PROJECT_MARKERS.test(name)); } catch { return false; }
}

export function promptFor(agent, task, cwd = process.cwd()) {
  const sentence = task.trim().replace(/[.!?]*$/, '.');
  const context = isProject(cwd) ? START_CONTEXT.project : START_CONTEXT.ask;
  return `${agent.slash ?? 'Use Conquistador: '}${sentence} ${context}`;
}

// A shell line a person can copy. Display only; launches never go through a shell (A6).
const quote = value => (/^[\w./=:-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`);
export const commandLine = launch => [launch.command, ...launch.args].map(quote).join(' ');

// Found agents that do not have the current version yet, except ones the user removed by name.
// A missing or broken plugin copy puts every found agent back on the list (I6).
function pending(state) {
  const removed = state.removed ?? [];
  const found = detectAgents().filter(agent => agent.found && !removed.includes(agent.id));
  const broken = !payloadCurrent(pluginHome());
  return { found, todo: found.filter(agent => broken || state.agents?.[agent.id]?.version !== version || agent.healthy?.() === false) };
}

async function ensureInstalled(ui) {
  const state = readState();
  const { found, todo } = pending(state);
  if (!found.length) return { ready: [], failed: [] };
  if (!todo.length) return { ready: found, failed: [] };
  const spin = ui.spinner();
  spin.start(`Installing into ${todo.map(agent => agent.label).join(', ')}`);
  try { copyPayload(pluginHome()); } catch (error) {
    spin.stop('Install failed', 2);
    ui.log.error(error.message);
    return { ready: [], failed: todo.map(agent => ({ agent, result: { ok: false, error: error.message } })), stopped: true };
  }
  const results = todo.map(agent => ({ agent, result: applyAgent(agent, state.agents?.[agent.id] ? 'update' : 'install', { source: pluginHome() }) }));
  const failed = results.filter(item => !item.result.ok);
  const done = results.filter(item => item.result.ok).map(item => item.agent);
  spin.stop(done.length ? `Installed into ${done.map(agent => agent.label).join(', ')}` : 'Install failed', done.length ? 0 : 2);
  for (const { agent, result } of failed) ui.log.error(`${agent.label}: ${result.error}\n  Retry: conquistador add ${agent.id}`);
  const ids = new Set(failed.map(item => item.agent.id));
  return { ready: found.filter(agent => !ids.has(agent.id)), failed };
}

async function pickTask(ui, cwd) {
  const starts = startsFor(isProject(cwd));
  const choice = await ui.select({
    message: 'What should we work on?',
    options: [...starts.map(task => ({ value: task, label: task })), { value: '#areas', label: 'Browse all areas…' }, { value: '#own', label: 'Something else…' }],
  });
  if (ui.isCancel(choice)) return null;
  if (choice === '#own') return describe(ui);
  if (choice !== '#areas') return choice;
  const { AREAS } = await import('./tour.mjs');
  const areaId = await ui.select({ message: 'Which area?', options: AREAS.map(area => ({ value: area.id, label: area.title, hint: area.covers })) });
  if (ui.isCancel(areaId)) return null;
  const area = AREAS.find(item => item.id === areaId);
  const example = await ui.select({ message: 'Pick a task', options: [...area.examples.map(item => ({ value: item.prompt, label: item.prompt })), { value: '', label: 'Something else…' }] });
  if (ui.isCancel(example)) return null;
  // Examples hold sample facts. Let the user make them true before an agent acts on them.
  return example ? describe(ui, example) : describe(ui);
}

async function describe(ui, initialValue) {
  const typed = await ui.text(initialValue
    ? { message: 'Edit the task, then press Enter', initialValue }
    : { message: 'Describe the task in one sentence', placeholder: 'Write a welcome email sequence for new trial users' });
  if (ui.isCancel(typed) || !String(typed ?? '').trim()) return null;
  return String(typed).trim();
}

async function pickAgent(ui, ready, wanted) {
  if (wanted) return ready.find(agent => agent.id === wanted) ?? null;
  const state = readState();
  const last = ready.find(agent => agent.id === state.lastAgent);
  if (last) return last;
  let agent = ready[0];
  if (ready.length > 1) {
    const id = await ui.select({ message: 'Open in', options: ready.map(item => ({ value: item.id, label: item.label })), initialValue: ready[0].id });
    if (ui.isCancel(id)) return null;
    agent = ready.find(item => item.id === id);
  }
  writeState({ ...readState(), lastAgent: agent.id });
  return agent;
}

// A5: without a terminal, show what would open. Never install or open anything.
function printOnly(task, wanted, cwd) {
  const state = readState();
  const found = detectAgents().filter(agent => agent.found);
  const agent = AGENTS.find(item => item.id === wanted)
    ?? found.find(item => item.id === state.lastAgent)
    ?? found.find(item => state.agents?.[item.id]) ?? found[0] ?? AGENTS[0];
  const prompt = promptFor(agent, task || startsFor(isProject(cwd))[0], cwd);
  const launch = agent.open(prompt);
  console.log(launch ? `Run this in a terminal to start in ${agent.label}:\n  ${commandLine(launch)}` : `Paste this into ${agent.label}:\n  ${prompt}`);
  if (!Object.keys(state.agents ?? {}).length) console.log('Conquistador is not installed yet. Run conquistador in a terminal first.');
  return 0;
}

// Hand the terminal to the agent and exit with its code. Node has no exec(), so the parent waits
// and ignores the terminal's Ctrl+C and Ctrl+\, which belong to the agent now (A11).
export function openAgent(launch) {
  return new Promise(done => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    const ignore = () => {};
    process.on('SIGINT', ignore);
    process.on('SIGQUIT', ignore);
    const child = spawn(launch.command, launch.args, { stdio: 'inherit', shell: process.platform === 'win32' });
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    child.on('error', error => { console.error(`Could not start ${launch.command}: ${error.message}`); done(1); });
    child.on('exit', (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

async function copy(value) {
  const tool = process.platform === 'darwin' ? ['pbcopy', []] : process.platform === 'win32' ? ['clip', []] : ['xclip', ['-selection', 'clipboard']];
  try { return spawnSync(tool[0], tool[1], { input: value }).status === 0; } catch { return false; }
}

const option = (args, name) => {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
};

// `conquistador`, `conquistador "TASK"`, `--in AGENT`, `--no-open`.
export async function runStart(args = [], { cwd = process.cwd() } = {}) {
  const wanted = option(args, '--in');
  if (wanted && !AGENTS.some(agent => agent.id === wanted)) { console.error(`Unknown agent: ${wanted}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`); return 2; }
  const task = args.filter((arg, index) => !arg.startsWith('-') && args[index - 1] !== '--in').join(' ').trim();
  if (!(process.stdin.isTTY && process.stdout.isTTY)) return printOnly(task, wanted, cwd);
  const ui = await import('./vendor/clack.mjs');
  ui.intro(`Conquistador ${version}`);
  const { ready, stopped } = await ensureInstalled(ui);
  if (stopped) { ui.outro('Nothing installed. Your agents are unchanged.'); return 1; }
  if (!ready.length) {
    ui.note('Install one of these agents, then run conquistador again:\n  Claude Code, Codex, Cursor, GitHub Copilot CLI, Grok CLI\nOther ways to install: see INSTALL.md.', 'No agent found');
    ui.outro('Nothing installed.');
    return 1;
  }
  if (wanted && !ready.some(agent => agent.id === wanted)) { ui.outro(`${AGENTS.find(agent => agent.id === wanted).label} is not installed or not found.`); return 1; }
  if (args.includes('--no-open')) { ui.outro('Ready. Run conquistador to start a task.'); return 0; }
  const chosen = task || await pickTask(ui, cwd);
  if (!chosen) { ui.cancel('Nothing opened. Run conquistador to start a task.'); return 130; }
  const agent = await pickAgent(ui, ready, wanted);
  if (!agent) { ui.cancel('Nothing opened. Run conquistador to start a task.'); return 130; }
  const prompt = promptFor(agent, chosen, cwd);
  const [{ createBrief }, { SPECIALISTS }] = await Promise.all([import('./brief.mjs'), import('./tour.mjs')]);
  const brief = createBrief(chosen, { force: true });
  if (brief.action === 'brief' && brief.methods.length) ui.log.info(`${brief.methods.map(method => SPECIALISTS[method.name] ?? method.label).join(', ')}. Reads ${brief.must.length} playbooks first.`);
  if (agent.note) ui.log.warn(agent.note);
  const launch = agent.open(prompt);
  if (!launch) {
    const copied = await copy(prompt);
    ui.note(prompt, copied ? `Paste this into the ${agent.label} agent chat (copied)` : `Paste this into the ${agent.label} agent chat`);
    ui.outro('Install cursor-agent to open Cursor from here next time.');
    return 0;
  }
  ui.outro(launch.sends ? `Opening ${agent.label}. It starts right away.` : `Opening ${agent.label}. Press Enter to start.`);
  return openAgent(launch);
}
