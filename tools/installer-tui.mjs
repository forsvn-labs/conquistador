// The full-screen installer: Ink in the terminal's alternate screen. It builds the same plan as the
// line flow in onboard.mjs (detect, choose, review, install with a verify pass), one card per step.
// It never opens an agent and never asks for a task: the last screen says what to type in each
// agent. On exit the normal screen comes back and the summary stays in scrollback.
import { Box, Text, createElement as h, render, useAnimation, useApp, useEffect, useInput, useMemo, useRef, useState, useWindowSize } from './vendor/ink.mjs';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AGENTS, home, projectRoot, readState, self, setHooks, version } from './agents.mjs';
import { SURFACE_IDS, applyPlan, buildPlan, dedupeNote, defaultChoices, detect, duplicateApps, planLines, preflightNotes, summaryLines, verifyResults } from './onboard.mjs';
import { colorMode, paint, wrapText } from './onboard-ui.mjs';
import { startUpdateCheck, updateNotice } from './preflight.mjs';
import { channel } from './self-update.mjs';
import { installRows, installsHere, needsInit, nextStep } from './launch.mjs';
import { appById } from './mcp-apps.mjs';
import { hooksState } from './hooks-cli.mjs';
import { runCommand } from './process-run.mjs';
import { productRoot } from './agents.mjs';
import { managedInstalls } from './managed-installs.mjs';
import { installerOperation } from './installer-operation.mjs';
import { executorHandoff } from './executor-source.mjs';
import { APP_GUIDE } from './app-guide.mjs';

// Brand colors from conquistador-landing src/styles/tokens.css. NO_COLOR and dumb terminals get none.
const COLORS = { brand: '#FF6B2C', ember: '#FF8A4C', sticky: '#FFE45C', sky: '#BFE0FF', ok: '#7FD18B', bad: '#FF7A6B', line: '#81756C', ink: '#1A100A' };
const LOGO = [
  ['▄▀▀', '▄▀▄', '█▄ █', '▄▀▄', '█ █', '█', '▄▀▀', '▀█▀', '▄▀▄', '█▀▄', '▄▀▄', '█▀▄'],
  ['▀▄▄', '▀▄▀', '█ ▀█', '▀▄█', '▀▄▀', '█', '▄▄▀', ' █ ', '█▀█', '█▄▀', '▀▄▀', '█▀▄'],
];
const LOGO_WIDTH = LOGO[0].join(' ').length;
const STEPS = ['Agents', 'Options', 'Review', 'Install', 'Done'];
const STEP_OF = { agents: 0, options: 1, review: 2, install: 3, done: 4 };
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const sleep = ms => new Promise(done => setTimeout(done, ms));
const realHome = () => { try { return realpathSync(homedir()); } catch { return homedir(); } };
const tilde = path => {
  for (const base of [homedir(), realHome()]) if (typeof path === 'string' && (path === base || path.startsWith(`${base}/`))) return `~${path.slice(base.length)}`;
  return path;
};

// Mix two #RRGGBB colors: the wordmark runs from Tangerine to Sticky.
const mix = (from, to, amount) => `#${[1, 3, 5].map(index => Math.round(parseInt(from.slice(index, index + 2), 16) * (1 - amount) + parseInt(to.slice(index, index + 2), 16) * amount).toString(16).padStart(2, '0')).join('')}`;

// Every body line is one terminal row: wrap words, then cut words longer than the row.
function rows(text, width) {
  return wrapText(String(text), width).split('\n').flatMap(line => {
    const out = [];
    for (let rest = line; ; rest = rest.slice(width)) { out.push(rest.slice(0, width)); if (rest.length <= width) break; }
    return out;
  });
}

// The part of a list that fits: keeps the cursor in view and says how many rows are hidden.
function windowed(items, cursor, height) {
  if (items.length <= height) return { start: 0, shown: items, above: 0, below: 0 };
  const size = Math.max(1, height - 2);
  const start = Math.min(Math.max(0, cursor - Math.floor(size / 2)), items.length - size);
  return { start, shown: items.slice(start, start + size), above: start, below: items.length - start - size };
}

function Spinner({ color }) {
  const { frame } = useAnimation({ interval: 80 });
  return h(Text, { color }, SPINNER[frame % SPINNER.length]);
}

function Header({ c, columns, step, compact }) {
  const logo = !compact && columns - 4 >= LOGO_WIDTH + 8;
  const letters = LOGO[0].length;
  return h(Box, { flexDirection: 'column', paddingX: 2, paddingTop: 1 },
    logo
      ? LOGO.map((line, row) => h(Box, { key: row },
        ...line.flatMap((letter, index) => [h(Text, { key: index, bold: true, color: c.brand && mix(COLORS.brand, COLORS.sticky, index / (letters - 1)) }, letter), index < letters - 1 ? h(Text, { key: `s${index}` }, ' ') : null]),
        row === 1 ? h(Text, { dimColor: true }, `  ${version}`) : null))
      : h(Text, null, h(Text, { bold: true, color: c.brand }, 'CONQUISTADOR'), h(Text, { dimColor: true }, `  ${version}`)),
    !compact ? h(Text, { dimColor: true }, columns >= 68 ? 'Growth, marketing, and sales playbooks for your coding agent.' : 'Growth playbooks for your coding agent.') : null,
    step === null ? h(Text, null, ' ') : h(Box, { marginTop: 1 }, ...STEPS.flatMap((name, index) => {
      const state = index < step ? 'done' : index === step ? 'now' : 'next';
      const mark = state === 'done' ? '✓' : state === 'now' ? '●' : '○';
      return [
        h(Text, { key: name, color: state === 'done' ? c.ok : state === 'now' ? c.brand : undefined, bold: state === 'now', dimColor: state === 'next' }, `${mark} ${name}`),
        index < STEPS.length - 1 ? h(Text, { key: `${name}-gap`, dimColor: true }, columns >= 76 ? '  ──  ' : ' ') : null,
      ];
    })));
}

function Card({ c, width, title, subtitle, children }) {
  return h(Box, { flexDirection: 'column', marginX: 2, marginTop: 1, width, borderStyle: 'round', borderColor: c.line, paddingX: 1 },
    h(Text, { bold: true }, title),
    ...(subtitle ? rows(subtitle, width - 4).map((text, index) => h(Text, { key: `s${index}`, dimColor: true }, text)) : []),
    h(Box, { flexDirection: 'column', marginTop: 1 }, children));
}

// Key hints under the card. Each hint stays whole; a narrow terminal wraps between hints.
function Keys({ c, keys }) {
  return h(Box, { paddingX: 2, marginTop: 1, flexWrap: 'wrap', columnGap: 2 }, ...keys.map(([key, label]) =>
    h(Box, { key, flexShrink: 0 }, h(Text, { bold: true, color: key === 'enter' ? c.brand : undefined }, key), h(Text, { dimColor: true }, ` ${label}`))));
}

// One styled line of body text. `tone` picks the color.
const Line = ({ c, text, tone, bold, dim }) => h(Text, { color: tone ? c[tone] : undefined, bold, dimColor: dim, wrap: 'truncate-end' }, text || ' ');

// A cursor is an action focus. A checkbox is an independent selection, including without color.
function FocusRow({ c, label, width, focused, selected, status = '' }) {
  const check = selected === undefined ? '' : selected ? '[✓] ' : '[ ] ';
  const available = Math.max(1, width - 2 - check.length - (status ? status.length + 2 : 0));
  const name = label.length > available ? `${label.slice(0, available - 1)}…` : label.padEnd(available);

  return h(Text, { backgroundColor: focused ? c.brand : undefined, color: focused && c.brand ? c.ink : undefined, bold: focused, wrap: 'truncate-end' },
    h(Text, { color: focused ? undefined : c.brand }, focused ? '› ' : '  '),
    h(Text, { color: !focused && selected ? c.ok : undefined }, check),
    name, status ? h(Text, { dimColor: !focused }, `  ${status}`) : null);
}

// Wide terminals put the explanation beside the choices. Compact terminals keep one column.
function Columns({ c, mainWidth, sideWidth, height, main, side }) {
  return h(Box, { flexDirection: 'row' },
    h(Box, { flexDirection: 'column', width: mainWidth }, main),
    h(Box, { width: 1, marginX: 2 }, h(Text, { color: c.line }, Array.from({ length: height }, () => '│').join('\n'))),
    h(Box, { flexDirection: 'column', width: sideWidth }, side));
}

function Detail({ c, title, description, selected, selectionTitle, width, height }) {
  const descriptionRows = rows(description, width).slice(0, Math.max(0, Math.min(4, height - 4)));
  const capacity = Math.max(0, height - descriptionRows.length - 3);
  const visibleCount = Math.max(0, capacity - (selected.length > capacity ? 1 : 0));

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true, color: c.sky, wrap: 'truncate-end' }, title),
    ...descriptionRows.map((text, index) => h(Text, { key: `detail${index}`, dimColor: true }, text)),
    h(Text, null, ' '),
    h(Text, { bold: true }, `${selectionTitle} · ${selected.length}`),
    ...selected.slice(0, visibleCount).map(label => h(Text, { key: label, color: c.ok, wrap: 'truncate-end' }, `✓ ${label}`)),
    selected.length > visibleCount ? h(Text, { dimColor: true }, `+ ${selected.length - visibleCount} more selected`) : !selected.length && capacity ? h(Text, { dimColor: true }, 'None selected') : null);
}

// A scrolled block of body lines, with "more" markers when it does not fit. `limit` gets the
// largest useful offset, so scrolling past the end does not pile up key presses.
function Scroll({ c, lines, offset, height, limit }) {
  const markerRows = lines.length > height ? Math.min(2, Math.max(0, height - 1)) : 0;
  const capacity = Math.max(1, height - markerRows);
  limit.current = Math.max(0, lines.length - capacity);
  const top = Math.min(offset, limit.current);
  const shown = lines.slice(top, top + capacity);
  const below = lines.length - top - shown.length;
  return h(Box, { flexDirection: 'column' },
    top && markerRows ? h(Text, { dimColor: true }, `↑ ${top} more`) : null,
    ...shown.map((line, index) => h(Line, { key: index + top, c, ...line })),
    below && markerRows > (top ? 1 : 0) ? h(Text, { dimColor: true }, `↓ ${below} more`) : null);
}

// --- The plan from the answers ----------------------------------------------------------------------
function optionRows(ctx, choices, options) {
  const list = [];
  const notes = [];
  if (choices.agents.length && !options.scope) {
    list.push({ id: 'scope', label: 'Install for', values: ['global', 'project'], names: { global: 'All projects', project: 'This project' },
      hint: value => (value === 'global' ? 'The plugin in each agent: the skill, prompt hooks, and the MCP server.' : 'One skill folder in this project that you can commit.') });
  }
  const plugins = AGENTS.some(agent => choices.agents.includes(agent.id) && agent.how !== 'skill');
  if (plugins && choices.scope === 'global' && options.hooks) {
    list.push({ id: 'hooks', label: 'Prompt hooks', values: [true, false], names: { true: 'On', false: 'Off' },
      hint: () => 'Hooks give the agent the right playbooks for growth, marketing, and sales prompts, and check marketing copy after each edit (Claude Code, Codex, Cursor, Copilot, Grok). Turn them off later: /conquistador hooks off.' });
  }
  const skip = duplicateApps({ surfaces: ['agents'], scope: choices.scope, agents: choices.agents }, ctx);
  const apps = ctx.apps.filter(app => app.found && !skip.includes(app.id));
  const deduped = ctx.apps.filter(app => app.found && skip.includes(app.id)).map(app => dedupeNote(app.id));
  list.push({ id: 'mcp-apps', label: 'MCP clients', toggle: true,
    hint: () => [apps.length ? `Adds the local MCP server to ${apps.map(app => app.label).join(', ')}.` : 'No MCP client found. Name one with --apps.', ...deduped].join(' ') });
  if (ctx.executor.installed) {
    list.push({ id: 'executor', label: 'Executor', toggle: true,
      hint: () => executorHandoff(ctx.executor.version) ?? `Adds the source "${choices.executorName}" for every Executor-connected agent.${ctx.executor.running === false ? ' Starts Executor first.' : ''} Rename: --executor-name.` });
  }
  list.push({ id: 'bot', label: 'Chat bot files', toggle: true, hint: () => `Writes a system prompt and knowledge files to ${tilde(choices.botOut)} for GPTs, Claude Projects, and Gems. Folder: --bot-out.` });
  if (ctx.login && ctx.online !== false) list.push({ id: 'hosted', label: 'Hosted MCP', toggle: true, hint: () => 'Sign in with GitHub to get a token for deployed agents and remote apps.' });
  else if (ctx.login) notes.push('Hosted MCP needs a network connection. It is not offered now.');
  list.push({ id: 'cli', label: 'Keep the CLI installed', values: ['off', 'npm', 'bun'], names: { off: 'Skip', npm: 'npm', bun: 'Bun' },
    hint: value => value === 'off' ? 'Skip CLI installation. An existing command stays installed. Choose npm or Bun to keep the command after a run-once install.' : `Install the permanent conquistador command with ${value === 'bun' ? 'Bun' : 'npm'}. The exact command appears in the review.` });
  return { list, notes };
}

const valueOf = (row, choices, toggles) => (row.id === 'cli' ? toggles.cli ? choices.packageManager : 'off' : row.toggle ? toggles[row.id] : row.id === 'scope' ? choices.scope : choices.hooks);
const nameOf = (row, value) => (row.toggle ? (value ? 'On' : 'Off') : row.names[String(value)]);

// The answers as onboard.mjs choices. Apps come from --apps, else every found app that does not
// already get the server from its plugin.
function finalChoices(choices, toggles, agentsOn, ctx) {
  const surfaces = SURFACE_IDS.filter(id => (id === 'agents' ? agentsOn && choices.agents.length > 0 : toggles[id]));
  const skip = duplicateApps({ ...choices, surfaces }, ctx);
  return { ...choices, surfaces, apps: choices.appsFromFlag ?? choices.apps.filter(id => !skip.includes(id)) };
}

// Review lines with a tone for each kind of line.
function reviewLines(plan, width) {
  if (!plan.surfaces.length) return [{ text: 'Nothing to install. Go back and choose an agent or an option.', tone: 'sticky' }];
  let warning = false;
  return planLines(plan).flatMap(line => {
    if (line === 'Warning') warning = true;
    const tone = warning && line.startsWith('  ') ? 'sticky' : undefined;
    const style = !line.startsWith(' ') && line && !/^(?:Unchanged|Undo):/.test(line) ? { bold: true } : /^ {4}|^(?:Unchanged|Undo):/.test(line) ? { dim: true } : {};
    return rows(line, width).map(text => ({ text, tone: line === 'Warning' ? 'sticky' : tone, ...style }));
  });
}

// "Label   text" with the text wrapped under itself, for the what-to-type table.
function pair(label, text, pad, width) {
  const lines = rows(text, Math.max(10, width - pad - 2));
  return lines.map((line, index) => `  ${(index ? '' : label).padEnd(pad)}${line}`);
}

// The Done card: the headline, what to type in each agent, then anything that needs attention.
function doneLines({ results, checks, plan, ready, cwd, task, notice }, width) {
  const lines = [];
  const add = (text, style = {}) => { for (const piece of rows(text, width)) lines.push({ text: piece, ...style }); };
  const failed = results.filter(item => !item.ok);
  const badChecks = checks.filter(item => !item.ok);
  const problems = failed.length + badChecks.length > 0;
  add(problems ? '! Installed with problems' : '✓ Conquistador is ready', { tone: problems ? 'sticky' : 'ok', bold: true });
  if (checks.length) add(badChecks.length ? `✗ ${badChecks.length} of ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} found a problem` : `✓ ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} passed`, { tone: badChecks.length ? 'bad' : 'ok' });
  if (ready.length) {
    add('');
    add('Next, in your agent', { bold: true });
    add(needsInit(cwd) && !task ? 'Open the agent in this project and type the command. Init records your product and growth context first.' : 'Open the agent in this project and type the command.', { dim: true });
    const pad = Math.min(20, Math.max(...ready.map(agent => agent.label.length)) + 2);
    for (const agent of ready) for (const line of pair(agent.label, nextStep(agent, cwd, task), pad, width)) lines.push({ text: line, tone: 'brand' });
    for (const agent of ready.filter(item => item.note)) add(agent.note, { tone: 'sky' });
    if (!task) add('Then ask for an outcome: /conquistador plan our launch', { dim: true });
  }
  const bot = results.find(item => item.surface === 'bot' && item.ok);
  if (bot) { add(''); add(`Chat bots: follow ${tilde(join(bot.target, 'README.md'))} for each chat app.`); }

  if (results.some(item => item.surface === 'mcp-apps' && item.ok && !item.skipped)) { add(''); add('MCP clients: restart each app to load the Conquistador server.'); }
  if (results.some(item => item.surface === 'hosted' && item.ok)) { add(''); add('Hosted MCP: the client config prints when you exit. The token is secret.', { tone: 'sky' }); }
  if (problems) {
    add('');
    add('Needs attention', { bold: true });
    for (const item of failed) { add(`${item.skipped ? '!' : '✗'} ${item.label}: ${item.skipped ? 'skipped. ' : ''}${item.error ?? 'failed'}`, { tone: item.skipped ? 'sticky' : 'bad' }); if (item.retry) add(`  Retry: ${item.retry}`, { dim: true }); }
    for (const check of badChecks) { add(`✗ ${check.label}: ${check.detail}`, { tone: 'bad' }); if (check.fix) add(`  Fix: ${check.fix}`, { dim: true }); }
  }
  for (const warning of plan.warnings) { add(''); add(`! ${warning}`, { tone: 'sticky' }); }
  if (notice) { add(''); add(`! ${notice}`, { tone: 'sticky' }); }
  return lines;
}

// --- The app ------------------------------------------------------------------------------------------
function App({ options: initialOptions, cwd, first, update, warnings, onExit, mode }) {
  const { exit } = useApp();
  const { columns, rows: height } = useWindowSize();
  const c = mode === 'none' ? {} : COLORS;
  const width = Math.max(18, Math.min(columns - 4, 116));
  const inner = width - 4;
  const compact = height < 32;
  const wide = inner >= 80 && !compact;
  const sideWidth = Math.min(38, Math.floor(inner * 0.4));
  const mainWidth = wide ? inner - sideWidth - 5 : inner;
  const [screen, setScreen] = useState(first === 'home' ? 'home' : 'loading');
  const [options, setOptions] = useState(initialOptions);
  const [ctx, setCtx] = useState(null);
  const [choices, setChoices] = useState(null);
  const [toggles, setToggles] = useState({ 'mcp-apps': false, hosted: false, executor: false, bot: false, cli: false });
  const [order, setOrder] = useState([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [activity, setActivity] = useState(null);
  const [report, setReport] = useState(null);
  const [hookSetting, setHookSetting] = useState(hooksState);
  const [target, setTarget] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState(0);
  const [shown, setShown] = useState({ agents: false, options: false });
  const [progress, setProgress] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const limit = useRef(0);
  const signIn = useRef(null);
  const finish = result => { onExit(result); exit(); };
  const cancel = () => { if (first === 'home' || outcome || report) go('home'); else finish({ kind: 'cancel', code: 130 }); };
  const go = next => { setScreen(next); setCursor(0); setOffset(0); };
  const quit = () => finish(outcome ? { kind: 'done', ...outcome } : { kind: 'quit', code: report?.status ?? 0, output: report?.output });
  const openInstaller = overrides => {
    setOptions({ ...initialOptions, providers: null, wanted: null, scope: null, surfaces: null, surfacesFrom: null, apps: null, yes: false, ...overrides });
    setQuery(''); setSearching(false); setProgress([]); setMessage(null); setStatus(null); go('loading');
  };
  const maintain = (title, args, operation = null, payload = null) => { setOutcome(null); setActivity({ title, args, operation, payload }); setReport({ status: null, output: '' }); go('maintenance'); };

  // Detect, then open the first screen that still has a question. Flags answer questions.
  useEffect(() => {
    if (screen !== 'loading') return;
    let live = true;
    (async () => {
      await sleep(20);
      const found = await detect({ cwd, method: options.method });
      if (!live) return;
      const base = defaultChoices(options, found);
      const fromFlags = options.surfacesFrom === 'flag' || options.surfacesFrom === 'implied';
      const agentsOn = !options.surfaces || options.surfaces.includes('agents');
      const next = { ...base, agents: agentsOn ? base.agents : [], appsFromFlag: options.apps ?? null };
      setToggles({ 'mcp-apps': Boolean(options.surfaces?.includes('mcp-apps')), hosted: Boolean(options.surfaces?.includes('hosted') && found.login), executor: Boolean(options.surfaces?.includes('executor')), bot: Boolean(options.surfaces?.includes('bot')),
        cli: Boolean(options.surfaces?.includes('cli') || !options.yes && !options.surfaces && channel().kind === 'npx' && !found.state.cli) });
      // Keep the public support list in registry order, even when an agent is not detected.
      setOrder(found.agents);
      setCtx(found);
      setChoices(next);
      // --yes answers every question with its default.
      const askAgents = !options.yes && agentsOn && !options.providers && !options.wanted;
      const askOptions = !options.yes && (!fromFlags || (agentsOn && next.agents.length > 0 && !options.scope) || options.surfaces?.includes('cli') && !options.packageManager);
      setShown({ agents: askAgents, options: askOptions });
      go(askAgents ? 'agents' : !options.yes && options.surfaces?.includes('mcp-apps') && !options.apps ? 'apps' : askOptions ? 'options' : options.yes ? 'install' : 'review');
    })();
    return () => { live = false; };
  }, [screen]);

  const agentsOn = !options.surfaces || options.surfaces.includes('agents') || shown.agents;
  const visible = order.filter(agent => `${agent.label} ${agent.id}`.toLowerCase().includes(query.toLowerCase()));
  const opts = useMemo(() => (ctx && choices ? optionRows(ctx, choices, options) : { list: [], notes: [] }), [ctx, choices]);
  const final = useMemo(() => (ctx && choices ? finalChoices(choices, toggles, agentsOn, ctx) : null), [ctx, choices, toggles, agentsOn]);
  const plan = useMemo(() => (final ? buildPlan(final, ctx) : null), [final]);
  const appChoices = ctx ? ctx.apps.filter(app => !duplicateApps({ ...choices, surfaces: ['agents'] }, ctx).includes(app.id)) : [];
  const installedItems = useMemo(() => screen === 'installed' ? managedInstalls(projectRoot(cwd)) : [], [screen]);

  useEffect(() => {
    if (screen !== 'maintenance') return;
    (async () => {
      if (activity.operation) {
        const result = await installerOperation(activity.operation, activity.payload);
        setReport({ status: result.ok ? 0 : 1, output: result.ok ? result.detail : `${result.error}\nRetry from Installed items after fixing the problem.` });
        go('report'); return;
      }
      const result = await runCommand(process.execPath, [join(productRoot, 'runtime/bin/conquistador.js'), ...activity.args], {
        cwd, timeout: 650_000, env: { ...process.env, NO_COLOR: '1' },
        onOutput: text => setReport(previous => ({ ...previous, output: (previous.output + text).slice(-100_000) })),
      });
      setReport({ status: result.status, output: `${result.stdout}${result.stderr}${result.error ? `\n${result.error}` : ''}` });
      go('report');
    })();
  }, [screen]);

  // Install, then verify. Each step draws one row; a failed step never stops the others.
  useEffect(() => {
    if (screen !== 'install') return;
    const controller = new AbortController();
    (async () => {
      try {
      const track = async (label, work, { quiet = false, cancellable = false } = {}) => {
        const id = `${label}-${Math.random()}`;
        setProgress(list => [...list, { id, label, state: 'run', quiet }]);
        if (cancellable) signIn.current = controller;
        try {
          await sleep(40);
          const result = await work();
          const ok = result?.ok ?? (typeof result === 'boolean' ? result : true);
          const manual = result?.manual || result?.status === 'manual';
          setProgress(list => list.map(item => (item.id === id ? { ...item, state: ok ? 'ok' : manual ? 'manual' : 'bad', label: quiet ? label.replace(/^Checking /, 'Checked ') : label } : item)));
          return result;
        } finally { if (cancellable) signIn.current = null; }
      };
      // The hosted sign-in talks through this Clack-shaped UI: the code goes on the card.
      const ui = {
        note: (body, title) => setMessage({ title, body }),
        spinner: () => ({ start: text => setStatus(text), stop: () => setStatus(null), message: text => setStatus(text) }),
        log: Object.fromEntries(['info', 'warn', 'error', 'message', 'step', 'success'].map(name => [name, text => setMessage({ title: null, body: String(text) })])),
        isCancel: () => false,
      };
      const results = await applyPlan(plan, final, { ui, progress: track, login: ctx.login, signal: controller.signal });
      setMessage(null);
      const checks = await verifyResults(results, plan, { progress: track });
      update.persist();
      const latest = await update.latest(1500);
      const failedChecks = new Set(checks.filter(item => !item.ok).map(item => item.label));
      const ready = AGENTS.filter(agent => results.some(item => item.surface === 'agents' && item.ok && (item.agent === agent.id || item.agents?.includes(agent.id))) && !failedChecks.has(agent.label));
      const code = results.some(item => !item.ok) || checks.some(item => !item.ok) ? 1 : 0;
      setOutcome({ results, checks, plan, ready, code, notice: updateNotice(latest, version, channel().kind) });
      go('done');
      } catch (error) {
        // A step that throws (for example a config file that cannot be written) still ends on Done.
        setMessage(null);
        setOutcome({ results: [{ surface: 'installer', label: 'Installation', ok: false, error: error instanceof Error ? error.message : String(error), retry: `${self} doctor --fix` }],
          checks: [], plan, ready: [], code: 1, notice: null });
        go('done');
      }
    })();
  }, [screen]);

  // --yes answers every question, so the Done screen closes by itself.
  useEffect(() => {
    if (screen !== 'done' || !options.yes) return undefined;
    const timer = setTimeout(() => finish({ kind: 'done', ...outcome }), 1500);
    return () => clearTimeout(timer);
  }, [screen]);

  const homeRows = useMemo(() => (screen === 'home' ? installRows(projectRoot(cwd)) : []), [screen]);
  const MENU = [
    { id: 'add', label: 'Add or change agents', hint: `Choose from all ${AGENTS.length} supported agents. Search with /. Only selected agents install.` },
    { id: 'skills', label: 'Skills in this project', hint: 'Copy the Conquistador skill into selected agent folders in this project.' },
    { id: 'mcp', label: 'MCP connections', hint: 'Choose local MCP clients, Hosted MCP, Executor, or chat bot files.' },
    { id: 'app', label: 'Use in an app', hint: 'Add Conquistador as a production dependency. Call its tools in your agent and mount MCP beside the app.' },
    { id: 'hooks', label: 'Hooks', hint: 'Turn prompt and copy-check hooks on or off. Changes apply on the next prompt.' },
    { id: 'cli', label: 'Keep the CLI installed', hint: 'Keep conquistador on PATH with npm or Bun, including after an npx run.' },
    { id: 'installed', label: 'Installed items', hint: 'See the scope and path of each install. Update or remove one selected item.' },
    { id: 'update', label: 'Update', hint: `Get the newest version and refresh every install (${self} update).` },
    { id: 'doctor', label: 'Check and repair', hint: `Find and repair install and project drift (${self} doctor --fix).` },
    { id: 'remove', label: 'Remove', hint: `Remove Conquistador from your agents (${self} remove). Your playbooks and config stay.` },
    { id: 'quit', label: 'Quit', hint: 'Close this screen.' },
  ];

  useInput((input, key) => {
    const ctrlC = key.ctrl && input === 'c';
    const up = key.upArrow || input === 'k', down = key.downArrow || input === 'j';
    if (screen === 'agents' && searching) {
      if (key.escape || key.return) { setSearching(false); return; }
      if (ctrlC) { cancel(); return; }
      if (key.backspace || key.delete) setQuery(value => value.slice(0, -1));
      else if (!key.ctrl && !key.meta && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow) setQuery(value => value + input);
      setCursor(0); return;
    }
    if (screen === 'maintenance') {
      if (up) setOffset(value => Math.max(0, value - 1));
      else if (down) setOffset(value => Math.min(limit.current, value + 1));
      return;
    }
    if (screen === 'report') {
      if (up) setOffset(value => Math.max(0, value - 1));
      else if (down) setOffset(value => Math.min(limit.current, value + 1));
      else if (key.return || key.escape) go('home');
      else if (ctrlC || input === 'q') quit();
      return;
    }
    if (screen === 'hooks') {
      if (key.escape || key.return) go('home');
      else if (input === ' ' || key.leftArrow || key.rightArrow) { setHooks(!hookSetting.on); setHookSetting(hooksState()); }
      else if (ctrlC || input === 'q') quit();
      return;
    }
    if (screen === 'installed') {
      if (key.escape) go('home');
      else if (ctrlC || input === 'q') quit();
      else if (up && installedItems.length) setCursor(value => (value + installedItems.length - 1) % installedItems.length);
      else if (down && installedItems.length) setCursor(value => (value + 1) % installedItems.length);
      else if (key.return && installedItems[cursor]) { setTarget(installedItems[cursor]); go('details'); }
      return;
    }
    if (screen === 'details') {
      if (key.return || key.escape) go('installed');
      else if (ctrlC || input === 'q') quit();
      else if (input === 'r') go('confirm-remove');
      else if (input === 'u') openInstaller(target.surface === 'agents' ? { surfaces: ['agents'], providers: target.agents, scope: target.scope }
        : target.surface === 'mcp-apps' ? { surfaces: ['mcp-apps'], apps: [target.app] } : { surfaces: ['executor'], executorName: readState().executor?.name ?? target.slug });
      return;
    }
    if (screen === 'install') {
      if (ctrlC && signIn.current) { signIn.current.abort(); setStatus('Cancelling sign-in. Completed installs stay.'); }
      else if (ctrlC) setStatus('Installing. Wait for this step to finish; nothing is left half done.');
      return;
    }
    if (screen === 'loading') { if (ctrlC || key.escape || input === 'q') cancel(); return; }
    if (screen === 'done') {
      if (up) setOffset(value => Math.max(0, value - 1));
      else if (down) setOffset(value => Math.min(limit.current, value + 1));
      else if (key.return) go('home');
      else if (ctrlC || key.escape || input === 'q') finish({ kind: 'done', ...outcome });
      return;
    }
    if (screen === 'home') {
      if (ctrlC || key.escape || input === 'q') { quit(); return; }
      if (up) setCursor(value => (value + MENU.length - 1) % MENU.length);
      else if (down) setCursor(value => (value + 1) % MENU.length);
      else if (key.return) {
        const choice = MENU[cursor].id;
        if (choice === 'quit') quit();
        else if (choice === 'add') openInstaller({ surfaces: ['agents'] });
        else if (choice === 'skills') openInstaller({ surfaces: ['agents'], scope: 'project' });
        else if (choice === 'mcp') openInstaller({ surfaces: ['mcp-apps'] });
        else if (choice === 'app') { setActivity({ title: 'Use in an app' }); setReport({ status: 0, guide: true, output: APP_GUIDE }); go('report'); }
        else if (choice === 'cli') openInstaller({ surfaces: ['cli'] });
        else if (choice === 'hooks') { setHookSetting(hooksState()); go('hooks'); }
        else if (choice === 'installed') go('installed');
        else if (choice === 'remove') { setTarget(null); go('confirm-remove'); }
        else maintain(choice === 'update' ? 'Update' : 'Check and repair', choice === 'update' ? ['update'] : ['doctor', '--fix']);
      }
      return;
    }
    if (screen === 'confirm-remove') {
      if (input === 'y') {
        if (!target) maintain('Remove', ['remove']);
        else if (target.surface === 'agents') maintain('Remove', ['remove', ...target.agents, `--scope=${target.scope}`]);
        else maintain('Remove', [], target.surface === 'mcp-apps' ? 'app-remove' : 'executor-remove', target);
      }
      else if (input === 'n' || key.escape || input === 'q' || ctrlC) go(target ? 'details' : 'home');
      return;
    }
    if (ctrlC || input === 'q') { cancel(); return; }
    if (screen === 'agents') {
      if (key.escape && query) { setQuery(''); setCursor(0); }
      else if (key.escape) cancel();
      else if (input === '/') setSearching(true);
      else if (up && visible.length) setCursor(value => (value + visible.length - 1) % visible.length);
      else if (down && visible.length) setCursor(value => (value + 1) % visible.length);
      else if (input === ' ') {
        const id = visible[cursor]?.id;
        if (!id) return;
        setChoices(value => ({ ...value, agents: order.map(agent => agent.id).filter(item => (item === id ? !value.agents.includes(id) : value.agents.includes(item))) }));
      } else if (input === 'a') {
        const found = order.filter(agent => agent.found).map(agent => agent.id);
        setChoices(value => ({ ...value, agents: found.every(id => value.agents.includes(id)) ? value.agents.filter(id => !found.includes(id)) : order.map(agent => agent.id).filter(id => found.includes(id) || value.agents.includes(id)) }));
      } else if (input === 'A') {
        setChoices(value => ({ ...value, agents: order.map(agent => agent.id) }));
      } else if (input === 'n') {
        setChoices(value => ({ ...value, agents: [] }));
      } else if (key.return) go(shown.options ? 'options' : 'review');
      return;
    }
    if (screen === 'apps') {
      if (key.escape) go('options');
      else if (up && appChoices.length) setCursor(value => (value + appChoices.length - 1) % appChoices.length);
      else if (down && appChoices.length) setCursor(value => (value + 1) % appChoices.length);
      else if (input === ' ' && appChoices[cursor]) {
        const id = appChoices[cursor].id;
        setChoices(value => ({ ...value, apps: value.apps.includes(id) ? value.apps.filter(app => app !== id) : [...value.apps, id] }));
      } else if (input === 'a' || input === 'A') {
        setChoices(value => ({ ...value, apps: appChoices.map(app => app.id) }));
      } else if (input === 'n') {
        setChoices(value => ({ ...value, apps: [] }));
      } else if (key.return) { setChoices(value => ({ ...value, appsChosen: true })); go(shown.options ? 'options' : 'review'); }
      return;
    }
    if (screen === 'options') {
      const list = opts.list;
      if (key.escape) { if (shown.agents) go('agents'); else cancel(); }
      else if (up) setCursor(value => (value + list.length - 1) % list.length);
      else if (down) setCursor(value => (value + 1) % list.length);
      else if (key.leftArrow || key.rightArrow || input === ' ') {
        const row = list[cursor];
        if (!row) return;
        if (row.toggle) setToggles(value => ({ ...value, [row.id]: !value[row.id] }));
        else {
          const values = row.values;
          const now = values.indexOf(valueOf(row, choices, toggles));
          const next = values[(now + (key.leftArrow ? values.length - 1 : 1)) % values.length];
          if (row.id === 'cli') { setToggles(value => ({ ...value, cli: next !== 'off' })); if (next !== 'off') setChoices(value => ({ ...value, packageManager: next })); }
          else setChoices(value => ({ ...value, [row.id]: next }));
        }
      } else if (key.return) go(toggles['mcp-apps'] && !options.apps && !choices.appsChosen ? 'apps' : 'review');
      return;
    }
    if (screen === 'review') {
      if (key.escape) { if (shown.options) go('options'); else if (shown.agents) go('agents'); else cancel(); }
      else if (up) setOffset(value => Math.max(0, value - 1));
      else if (down) setOffset(value => Math.min(limit.current, value + 1));
      else if (key.return && plan.surfaces.length) go('install');
    }
  }, { isActive: true });

  // Reserve the frame and wrapped key hints. Small terminals use the compact wordmark.
  const room = (notes, subtitle = '') => Math.max(3, height - (compact ? 12 : 14) - Math.max(1, rows(subtitle, inner).length) - notes);
  const step = STEP_OF[screen] ?? null;
  const frame = (card, keys) => h(Box, { flexDirection: 'column', width: columns },
    h(Header, { c, columns, step, compact }), card, h(Keys, { c, keys }));

  if (screen === 'loading') {
    return frame(h(Card, { c, width, title: 'Looking for your coding agents', subtitle: 'Reading PATH and your home folder. Nothing changes yet.' },
      h(Text, null, h(Spinner, { color: c.brand }), ' Detecting')), [['esc', 'quit']]);
  }

  if (screen === 'home') {
    const here = installsHere(projectRoot(cwd));
    const lead = here.agents.find(agent => agent.slash) ?? here.agents[0];
    const notice = updateNotice(update.cached, version, channel().kind);
    const state = readState();
    const appLabels = Object.keys(state.mcpApps ?? {}).map(id => appById(id)?.label).filter(Boolean);
    const subtitle = `${AGENTS.length} supported agents · Manage your installs.`;
    const support = compact ? [] : rows('Claude Code · Codex · Cursor · Copilot · Gemini · OpenCode', inner).slice(0, 2);
    const installedLabels = [...new Set(homeRows.map(row => row.label ?? row.agent.label)), ...appLabels, ...(state.executor ? ['Executor'] : []), ...(state.cli ? ['CLI command'] : [])];
    const installed = wide ? [] : rows(`Installed: ${installedLabels.join(', ') || 'choose an option below'}`, inner).slice(0, compact ? 1 : 2);
    const hints = wide ? [] : rows(MENU[cursor].hint, inner).slice(0, compact ? 1 : 2);
    const capacity = room(support.length + installed.length + 1 + (lead ? 1 : 0) + (notice ? 1 : 0) + hints.length + (hints.length && !compact ? 1 : 0), subtitle);
    const menu = windowed(MENU, cursor, capacity);

    const menuRows = [
      menu.above ? h(Text, { key: 'above', dimColor: true }, `↑ ${menu.above} more actions`) : null,
      ...menu.shown.map((item, index) => h(FocusRow, { key: item.id, c, label: item.label, width: mainWidth, focused: menu.start + index === cursor })),
      menu.below ? h(Text, { key: 'below', dimColor: true }, `↓ ${menu.below} more actions`) : null,
    ];

    const bodyHeight = menu.shown.length + Number(Boolean(menu.above)) + Number(Boolean(menu.below));
    return frame(h(Card, { c, width, title: 'Conquistador is installed', subtitle },
      ...support.map((text, index) => h(Text, { key: `support${index}`, color: c.sky }, text)),
      ...installed.map((text, index) => h(Text, { key: `installed${index}`, dimColor: true }, text)),
      h(Text, { color: homeRows.some(row => row.stale) ? c.sticky : c.ok, wrap: 'truncate-end' }, homeRows.some(row => row.stale) ? '! An installed copy needs update or repair.' : `${here.agents.length} ${here.agents.length === 1 ? 'agent' : 'agents'} installed · ${appLabels.length} MCP clients · hooks ${hooksState().on ? 'on' : 'off'}`),
      lead ? h(Text, { color: c.brand, wrap: 'truncate-end' }, `In ${lead.label}: ${nextStep(lead, cwd)}`) : null,
      notice ? h(Text, { key: 'notice', color: c.sticky, wrap: 'truncate-end' }, `! ${notice}`) : null,
      wide ? h(Columns, { c, mainWidth, sideWidth, height: bodyHeight, main: menuRows,
        side: h(Detail, { c, width: sideWidth, height: bodyHeight, title: MENU[cursor].label, description: MENU[cursor].hint, selected: installedLabels, selectionTitle: 'Installed here' }) }) : menuRows,
      hints.length && !compact ? h(Text, { key: 'gap' }, ' ') : null,
      ...hints.map((text, index) => h(Text, { key: `hint${index}`, dimColor: true, wrap: 'truncate-end' }, text))), [['↑↓', 'move'], ['enter', 'choose'], ['q', 'quit']]);
  }

  if (screen === 'hooks') {
    return frame(h(Card, { c, width, title: 'Hooks', subtitle: 'Give the agent the playbooks to read and check copy after edits.' },
      h(Text, { color: hookSetting.on ? c.ok : c.sticky, bold: true }, `Hooks are ${hookSetting.on ? 'on' : 'off'}`),
      ...rows(hookSetting.why ?? 'Applies to Claude Code, Codex, Cursor, Copilot, and Grok plugin installs.', inner).map((text, index) => h(Text, { key: index }, text)),
      ...rows('Space changes the setting. It applies on the next prompt. Agent hook trust is managed in the agent.', inner).map((text, index) => h(Text, { key: `hint${index}`, dimColor: true }, text))),
    [['space', 'toggle'], ['enter', 'back'], ['q', 'quit']]);
  }

  if (screen === 'installed') {
    const subtitle = 'Each row is one registration or shared skill folder. Select an item to manage it.';
    const list = windowed(installedItems, cursor, room(0, subtitle));
    return frame(h(Card, { c, width, title: 'Installed items', subtitle },
      list.above ? h(Text, { dimColor: true }, `↑ ${list.above} more`) : null,
      ...list.shown.map((item, index) => h(Text, { key: item.id, color: list.start + index === cursor ? c.brand : undefined, wrap: 'truncate-end' },
        `${list.start + index === cursor ? '› ◆' : '  ◇'} ${item.label} · ${item.scope === 'project' ? 'this project' : item.scope === 'global' ? 'all projects' : item.surface === 'mcp-apps' ? 'MCP client' : 'source'}`)),
      list.below ? h(Text, { dimColor: true }, `↓ ${list.below} more`) : null,
      !installedItems.length ? h(Text, null, 'No tracked agent or MCP installs here. Choose an install option from the home screen.') : null),
    [['↑↓', 'move'], ['enter', 'details'], ['esc', 'back'], ['q', 'quit']]);
  }

  if (screen === 'details') {
    const lines = [target.label, target.path, ...(target.agents?.length > 1 ? ['This folder is shared. Removal affects every agent named above.'] : []),
      ...(target.surface === 'agents' ? [`In your agent: ${nextStep(AGENTS.find(agent => agent.id === target.agents[0]), cwd)}`] : ['Restart the app after updating its MCP configuration.'])];
    return frame(h(Card, { c, width, title: 'Install details', subtitle: target.scope === 'project' ? 'This project' : target.scope === 'global' ? 'All projects' : 'Conquistador MCP server' },
      ...lines.flatMap((line, index) => rows(line, inner).map((text, row) => h(Text, { key: `${index}-${row}`, dimColor: index > 1 }, text)))),
    [['u', 'update'], ['r', 'remove'], ['enter', 'back'], ['q', 'quit']]);
  }

  if (screen === 'maintenance' || screen === 'report') {
    const lines = rows(report.output || 'Waiting for the command...', inner).map(text => ({ text }));
    return frame(h(Card, { c, width, title: activity.title, subtitle: report.guide ? 'Project dependency setup. Copy a command and follow the guide.' : screen === 'maintenance' ? 'Running. Completed changes stay if a later check fails.' : report.status ? 'Needs attention. Review the result and recovery steps.' : 'Complete. Review the result.' },
      screen === 'maintenance' ? h(Text, null, h(Spinner, { color: c.brand }), ` ${activity.args.join(' ')}`) : null,
      h(Scroll, { c, lines, offset, height: room(1), limit })),
    screen === 'maintenance' ? [['↑↓', 'scroll'], ['…', 'running']] : [['enter', 'back'], ['↑↓', 'scroll'], ['q', 'quit']]);
  }

  if (screen === 'confirm-remove') {
    return frame(h(Card, { c, width, title: 'Remove Conquistador?', subtitle: target ? `Only ${target.label}${target.scope ? ` (${target.scope})` : ''}.` : 'From every agent, MCP client, and Executor source this installer added.' },
      ...(target?.path ? rows(target.path, inner).map((text, index) => h(Text, { key: `path${index}` }, text)) : []),
      target?.agents?.length > 1 ? h(Text, { color: c.sticky }, 'Shared folder: every named agent loses this skill copy.') : null,
      ...rows('Your playbooks, config, bot exports, and the npm CLI stay. You can install again with conquistador.', inner).map((text, index) => h(Text, { key: index }, text))),
    [['y', 'remove'], ['n', 'back']]);
  }

  if (screen === 'agents') {
    const notes = [...warnings, ...(ctx.found.length ? [] : ['No coding agent found on PATH or in your home folder. A skill-format agent still installs; or turn on an option on the next screen.'])].flatMap(text => rows(`! ${text}`, inner));
    const detail = visible[Math.min(cursor, visible.length - 1)];
    const describe = !detail ? 'No matching agent. Clear the search with Escape.' : detail.found
      ? detail.how === 'skill' ? 'Copies the Conquistador skill folder into your agent.' : 'Global installs include the skill, hooks, and MCP. Project installs copy one skill folder.'
      : detail.how === 'skill' ? 'Not found. The skill folder still installs; the agent reads it after you install the agent.' : `Not found. Install ${detail.label} first, or choose This project on the next screen.`;

    const hints = wide ? [] : rows(describe, inner).slice(0, 2);
    const subtitle = 'Select one or more agents. Nothing changes until you confirm.';
    const capacity = room(notes.length + hints.length + (hints.length ? 1 : 0) + 1 + (query || searching ? 1 : 0), subtitle);
    const list = windowed(visible, cursor, capacity);

    const listRows = [
      list.above ? h(Text, { key: 'above', dimColor: true }, `↑ ${list.above} more`) : null,
      ...list.shown.map((agent, index) => h(FocusRow, { key: agent.id, c, width: mainWidth, label: agent.label,
        focused: list.start + index === cursor, selected: choices.agents.includes(agent.id), status: agent.found ? 'found' : 'not found' })),
      list.below ? h(Text, { key: 'below', dimColor: true }, `↓ ${list.below} more`) : null,
    ];

    const bodyHeight = Math.min(capacity, Math.max(10, list.shown.length + Number(Boolean(list.above)) + Number(Boolean(list.below))));
    return frame(h(Card, { c, width, title: 'Which agents?', subtitle },
      h(Text, null, h(Text, { color: c.sky }, `${order.length} supported agents`), h(Text, { dimColor: true }, ` · ${ctx.found.length} found · `), h(Text, { bold: true, color: c.ok }, `${choices.agents.length} selected`)),
      query || searching ? h(Text, { color: c.brand }, `Search: ${query}${searching ? '▎' : ''}`) : null,
      ...notes.map((text, index) => h(Text, { key: `w${index}`, color: c.sticky }, text)),
      wide ? h(Columns, { c, mainWidth, sideWidth, height: bodyHeight, main: listRows,
        side: h(Detail, { c, width: sideWidth, height: bodyHeight, title: detail?.label ?? 'No matching agent', description: describe,
          selected: AGENTS.filter(agent => choices.agents.includes(agent.id)).map(agent => agent.label), selectionTitle: 'Selected agents' }) }) : listRows,
      hints.length ? h(Text, { key: 'gap' }, ' ') : null,
      ...hints.map((text, index) => h(Text, { key: `h${index}`, dimColor: true }, text))),
    searching ? [['type', 'search'], ['enter', 'finish search'], ['esc', 'stop search']] : [['↑↓', 'move'], ['space', 'toggle'], ['/', 'search'], ['a', 'found'], ['A', 'all'], ['n', 'clear'], ['enter', 'continue'], ['esc', query ? 'clear search' : 'quit']]);
  }

  if (screen === 'apps') {
    const subtitle = 'Select one or more apps to use Conquistador.';
    const description = appChoices.length ? 'These apps are MCP clients. Checked apps connect to the local Conquistador server. Other servers stay. Restart each app after setup.' : 'Selected plugins already provide the server. Nothing to add.';
    const hints = wide ? [] : rows(description, inner).slice(0, 2);
    const capacity = room(1 + hints.length + (hints.length ? 1 : 0), subtitle);
    const list = windowed(appChoices, cursor, capacity);

    const listRows = [
      list.above ? h(Text, { key: 'above', dimColor: true }, `↑ ${list.above} more`) : null,
      ...list.shown.map((app, index) => h(FocusRow, { key: app.id, c, width: mainWidth, label: app.label,
        focused: list.start + index === cursor, selected: choices.apps.includes(app.id), status: app.found ? 'found' : 'not found' })),
      list.below ? h(Text, { key: 'below', dimColor: true }, `↓ ${list.below} more`) : null,
    ];

    const bodyHeight = Math.min(capacity, Math.max(10, list.shown.length + Number(Boolean(list.above)) + Number(Boolean(list.below))));

    return frame(h(Card, { c, width, title: 'Which MCP clients?', subtitle },
      h(Text, null, h(Text, { dimColor: true }, `${appChoices.length} apps · `), h(Text, { bold: true, color: c.ok }, `${choices.apps.length} selected`)),
      wide ? h(Columns, { c, mainWidth, sideWidth, height: bodyHeight, main: listRows,
        side: h(Detail, { c, width: sideWidth, height: bodyHeight, title: appChoices[cursor]?.label ?? 'MCP clients', description,
          selected: appChoices.filter(app => choices.apps.includes(app.id)).map(app => app.label), selectionTitle: 'Selected apps' }) }) : listRows,
      hints.length ? h(Text, { key: 'gap' }, ' ') : null,
      ...hints.map((text, index) => h(Text, { key: `hint${index}`, dimColor: true }, text))),
    [['↑↓', 'move'], ['space', 'toggle'], ['a', 'all'], ['n', 'clear'], ['enter', 'continue'], ['esc', 'back']]);
  }

  if (screen === 'options') {
    const list = opts.list;
    const row = list[Math.min(cursor, list.length - 1)];
    const notes = [...(shown.agents ? [] : warnings), ...opts.notes].flatMap(text => rows(text.startsWith('Hosted') ? text : `! ${text}`, inner));
    const description = row?.hint(valueOf(row, choices, toggles)) ?? '';
    const hints = wide ? [] : rows(description, inner).slice(0, 3);
    const chosen = choices.agents.length ? `${choices.agents.length} ${choices.agents.length === 1 ? 'agent' : 'agents'} chosen.` : 'No agent chosen.';
    const subtitle = `${chosen} Turn on more places for Conquistador, or press Enter.`;
    const capacity = room(notes.length + hints.length + (hints.length ? 1 : 0), subtitle);
    const visibleOptions = windowed(list, cursor, capacity);

    const optionViews = [
      visibleOptions.above ? h(Text, { key: 'above', dimColor: true }, `↑ ${visibleOptions.above} more options`) : null,
      ...visibleOptions.shown.map((item, index) => h(FocusRow, { key: item.id, c, width: mainWidth, focused: visibleOptions.start + index === cursor,
        label: `${item.label.padEnd(16)} ‹ ${nameOf(item, valueOf(item, choices, toggles))} ›` })),
      visibleOptions.below ? h(Text, { key: 'below', dimColor: true }, `↓ ${visibleOptions.below} more options`) : null,
    ];

    const bodyHeight = Math.min(capacity, Math.max(10, visibleOptions.shown.length + Number(Boolean(visibleOptions.above)) + Number(Boolean(visibleOptions.below))));

    return frame(h(Card, { c, width, title: 'Choose options', subtitle },
      ...notes.map((text, index) => h(Text, { key: `w${index}`, color: c.sticky }, text)),
      wide ? h(Columns, { c, mainWidth, sideWidth, height: bodyHeight, main: optionViews,
        side: h(Detail, { c, width: sideWidth, height: bodyHeight, title: row?.label ?? 'Options', description,
          selected: AGENTS.filter(agent => choices.agents.includes(agent.id)).map(agent => agent.label), selectionTitle: 'Selected agents' }) }) : optionViews,
      hints.length ? h(Text, { key: 'gap' }, ' ') : null,
      ...hints.map((text, index) => h(Text, { key: `h${index}`, dimColor: true }, text))),
    [['↑↓', 'move'], ['←→', 'change'], ['enter', 'review'], ['esc', 'back'], ['q', 'quit']]);
  }

  if (screen === 'review') {
    const lines = reviewLines(plan, inner);
    const subtitle = plan.surfaces.length ? 'Nothing changes until you press Enter.' : 'Nothing to install yet.';
    return frame(h(Card, { c, width, title: 'Review the changes', subtitle },
      h(Scroll, { c, lines, offset, height: room(0, subtitle), limit })),
    plan.surfaces.length ? [['enter', 'install'], ['↑↓', 'scroll'], ['esc', 'back'], ['q', 'quit']] : [['esc', 'back'], ['q', 'quit']]);
  }

  if (screen === 'install') {
    const extra = (message ? rows(message.body, inner).length + (message.title ? 1 : 0) + 1 : 0) + (status ? 2 : 0);
    const list = progress.slice(-Math.max(3, room(extra, 'Each agent installs with its own plugin manager.')));
    return frame(h(Card, { c, width, title: 'Installing', subtitle: 'Each agent installs with its own plugin manager.' },
      ...list.map(item => h(Text, { key: item.id, wrap: 'truncate-end' },
        item.state === 'run' ? h(Spinner, { color: c.brand }) : h(Text, { color: item.state === 'ok' ? c.ok : item.state === 'manual' ? c.sticky : c.bad }, item.state === 'ok' ? '✓' : item.state === 'manual' ? '!' : '✗'),
        h(Text, { dimColor: item.quiet }, ` ${item.label}${item.state === 'bad' ? ': failed' : item.state === 'manual' ? ': needs a step by hand' : ''}`))),
      message ? h(Box, { key: 'message', flexDirection: 'column', marginTop: 1 },
        message.title ? h(Text, { bold: true, color: c.sky }, message.title) : null,
        ...rows(message.body, inner).map((text, index) => h(Text, { key: index }, text))) : null,
      status ? h(Text, { key: 'status', dimColor: true, wrap: 'truncate-end' }, `\n${status}`) : null),
    signIn.current ? [['ctrl-c', 'skip sign-in']] : [['…', 'installing']]);
  }

  // Done.
  const lines = doneLines({ ...outcome, cwd, task: options.task }, inner);
  const subtitle = 'Conquistador works inside your agent. The terminal only installs it.';
  return frame(h(Card, { c, width, title: outcome.code ? 'Done, with problems' : 'Done', subtitle },
    h(Scroll, { c, lines, offset, height: room(0, subtitle), limit })),
  [['enter', 'manage installs'], ['↑↓', 'scroll'], ['q', 'exit']]);
}

// Run the installer ('install') or the home screen ('home'). Returns the exit code.
export async function runTui(options, { cwd = process.cwd(), screen = 'install' } = {}) {
  const p = paint();
  const update = startUpdateCheck({ file: join(home(), 'update-check.json') });
  const warnings = [...(options.notice ? [options.notice] : []), ...(screen === 'install' ? preflightNotes(update) : [])];
  let result = { kind: 'cancel', code: 130 };
  // A crash must not leave the terminal in the alternate screen with a hidden cursor.
  // runtime/bin/conquistador.js calls restoreScreen before it prints a crash.
  let mounted = true;
  const restore = () => { if (mounted) { mounted = false; process.stdout.write('\x1b[?1049l\x1b[?25h'); } };
  globalThis.conquistadorRestoreScreen = restore;
  process.on('exit', restore);
  const app = render(h(App, { options, cwd, first: screen, update, warnings, mode: colorMode(), onExit: value => { result = value; } }),
    // interactive: runStart already checked for a terminal; Ink would turn itself off when CI is set.
    { alternateScreen: true, interactive: true, exitOnCtrlC: false, patchConsole: true });
  try { await app.waitUntilExit(); } finally { mounted = false; process.off('exit', restore); delete globalThis.conquistadorRestoreScreen; }

  if (result.kind === 'cancel') { console.log('Cancelled. No files changed.'); return 130; }
  if (result.kind === 'quit') { if (result.output) console.log(result.output); return result.code ?? 0; }
  if (result.kind === 'action') {
    const front = await import('./front-door.mjs');
    if (result.action === 'update') return front.runUpdate([]);
    if (result.action === 'remove') return front.runRemove([]);
    return (await import('./doctor.mjs')).runDoctor(['--fix']);
  }
  // Done: the summary stays on the normal screen.
  console.log(`${p.bold('Summary')}\n${summaryLines({ results: result.results, checks: result.checks, plan: result.plan, notice: result.notice, p }).join('\n')}`);
  const lead = result.ready.find(agent => agent.slash) ?? result.ready[0];
  if (lead) {
    const width = Math.max(40, process.stdout.columns || 80) - 2;
    const prompt = wrapText(nextStep(lead, cwd, options.task), width).split('\n').map(line => `  ${p.brand(line)}`).join('\n');
    console.log(`\n→ Open ${lead.label} in this project and type:\n${prompt}`);
  }
  return result.code;
}
