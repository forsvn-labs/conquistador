// The full-screen installer: Ink in the terminal's alternate screen. It builds the same plan as the
// line flow in onboard.mjs (detect, choose, review, install with a verify pass), one card per step.
// It never opens an agent and never asks for a task: the last screen says what to type in each
// agent. On exit the normal screen comes back and the summary stays in scrollback.
import { Box, Text, createElement as h, render, useAnimation, useApp, useEffect, useInput, useMemo, useRef, useState, useWindowSize } from './vendor/ink.mjs';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AGENTS, home, projectRoot, self, version } from './agents.mjs';
import { SURFACE_IDS, applyPlan, buildPlan, dedupeNote, defaultChoices, detect, duplicateApps, planLines, preflightNotes, summaryLines, verifyResults } from './onboard.mjs';
import { colorMode, paint, wrapText } from './onboard-ui.mjs';
import { startUpdateCheck, updateNotice } from './preflight.mjs';
import { channel } from './self-update.mjs';
import { installRows, installsHere, needsInit, nextStep } from './launch.mjs';

// Brand colors from conquistador-landing src/styles/tokens.css. NO_COLOR and dumb terminals get none.
const COLORS = { brand: '#FF6B2C', ember: '#FF8A4C', sticky: '#FFE45C', sky: '#BFE0FF', ok: '#7FD18B', bad: '#FF7A6B', line: '#81756C' };
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
  const size = Math.max(1, height - 1);
  const start = Math.min(Math.max(0, cursor - Math.floor(size / 2)), items.length - size);
  return { start, shown: items.slice(start, start + size), above: start, below: items.length - start - size };
}

function Spinner({ color }) {
  const { frame } = useAnimation({ interval: 80 });
  return h(Text, { color }, SPINNER[frame % SPINNER.length]);
}

function Header({ c, columns, step }) {
  const logo = columns - 4 >= LOGO_WIDTH + 8;
  const letters = LOGO[0].length;
  return h(Box, { flexDirection: 'column', paddingX: 2, paddingTop: 1 },
    logo
      ? LOGO.map((line, row) => h(Box, { key: row },
        ...line.flatMap((letter, index) => [h(Text, { key: index, bold: true, color: c.brand && mix(COLORS.brand, COLORS.sticky, index / (letters - 1)) }, letter), index < letters - 1 ? h(Text, { key: `s${index}` }, ' ') : null]),
        row === 1 ? h(Text, { dimColor: true }, `  ${version}`) : null))
      : h(Text, null, h(Text, { bold: true, color: c.brand }, 'CONQUISTADOR'), h(Text, { dimColor: true }, `  ${version}`)),
    h(Text, { dimColor: true }, columns >= 68 ? 'Growth, marketing, and sales playbooks for your coding agent.' : 'Growth playbooks for your coding agent.'),
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
function Keys({ keys }) {
  return h(Box, { paddingX: 2, marginTop: 1, flexWrap: 'wrap', columnGap: 3 }, ...keys.map(([key, label]) =>
    h(Box, { key, flexShrink: 0 }, h(Text, { bold: true }, key), h(Text, { dimColor: true }, ` ${label}`))));
}

// One styled line of body text. `tone` picks the color.
const Line = ({ c, text, tone, bold, dim }) => h(Text, { color: tone ? c[tone] : undefined, bold, dimColor: dim, wrap: 'truncate-end' }, text || ' ');

// A scrolled block of body lines, with "more" markers when it does not fit. `limit` gets the
// largest useful offset, so scrolling past the end does not pile up key presses.
function Scroll({ c, lines, offset, height, limit }) {
  limit.current = Math.max(0, lines.length - height);
  const top = Math.min(offset, limit.current);
  const shown = lines.length > height ? lines.slice(top, top + height - 1) : lines;
  const below = lines.length > height ? lines.length - top - shown.length : 0;
  return h(Box, { flexDirection: 'column' },
    top ? h(Text, { dimColor: true }, `↑ ${top} more`) : null,
    ...shown.map((line, index) => h(Line, { key: index + top, c, ...line })),
    below ? h(Text, { dimColor: true }, `↓ ${below} more`) : null);
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
      hint: () => 'Hooks give the agent the right playbooks for growth, marketing, and sales prompts. Turn them off later: CONQUISTADOR_HOOKS=off.' });
  }
  const skip = duplicateApps({ surfaces: ['agents'], scope: choices.scope, agents: choices.agents }, ctx);
  const apps = ctx.apps.filter(app => app.found && !skip.includes(app.id));
  const deduped = ctx.apps.filter(app => app.found && skip.includes(app.id)).map(app => dedupeNote(app.id));
  list.push({ id: 'mcp-apps', label: 'MCP apps', toggle: true,
    hint: () => [apps.length ? `Adds the local MCP server to ${apps.map(app => app.label).join(', ')}.` : 'No MCP app found. Name one with --apps.', ...deduped].join(' ') });
  if (ctx.executor.installed) {
    list.push({ id: 'executor', label: 'Executor', toggle: true,
      hint: () => `Adds the source "${choices.executorName}" for every Executor-connected agent.${ctx.executor.running === false ? ' Starts Executor first.' : ''} Rename: --executor-name.` });
  }
  list.push({ id: 'bot', label: 'Chat bot files', toggle: true, hint: () => `Writes a system prompt and knowledge files to ${tilde(choices.botOut)} for GPTs, Claude Projects, and Gems. Folder: --bot-out.` });
  if (ctx.login && ctx.online !== false) list.push({ id: 'hosted', label: 'Hosted MCP', toggle: true, hint: () => 'Sign in with GitHub to get a token for deployed agents and remote apps.' });
  else if (ctx.login) notes.push('Hosted MCP needs a network connection. It is not offered now.');
  return { list, notes };
}

const valueOf = (row, choices, toggles) => (row.toggle ? toggles[row.id] : row.id === 'scope' ? choices.scope : choices.hooks);
const nameOf = (row, value) => (row.toggle ? (value ? 'On' : 'Off') : row.names[String(value)]);

// The answers as onboard.mjs choices. Apps come from --apps, else every found app that does not
// already get the server from its plugin.
function finalChoices(choices, toggles, agentsOn, ctx) {
  const surfaces = SURFACE_IDS.filter(id => (id === 'agents' ? agentsOn && choices.agents.length > 0 : toggles[id]));
  const skip = duplicateApps({ ...choices, surfaces }, ctx);
  return { ...choices, surfaces, apps: choices.appsFromFlag ?? ctx.apps.filter(app => app.found && !skip.includes(app.id)).map(app => app.id) };
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
  if (results.some(item => item.surface === 'mcp-apps' && item.ok && !item.skipped)) { add(''); add('MCP apps: restart each app to load the Conquistador server.'); }
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
function App({ options, cwd, first, update, warnings, onExit, mode }) {
  const { exit } = useApp();
  const { columns, rows: height } = useWindowSize();
  const c = mode === 'none' ? {} : COLORS;
  const width = Math.max(40, Math.min(columns - 4, 96));
  const inner = width - 4;
  const [screen, setScreen] = useState(first === 'home' ? 'home' : 'loading');
  const [ctx, setCtx] = useState(null);
  const [choices, setChoices] = useState(null);
  const [toggles, setToggles] = useState({ 'mcp-apps': false, hosted: false, executor: false, bot: false });
  const [order, setOrder] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState(0);
  const [shown, setShown] = useState({ agents: false, options: false });
  const [progress, setProgress] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const limit = useRef(0);
  const finish = result => { onExit(result); exit(); };
  const cancel = () => finish({ kind: 'cancel', code: 130 });
  const go = next => { setScreen(next); setCursor(0); setOffset(0); };

  // Detect, then open the first screen that still has a question. Flags answer questions.
  useEffect(() => {
    if (screen !== 'loading') return;
    let live = true;
    (async () => {
      await sleep(20);
      const found = await detect({ cwd });
      if (!live) return;
      const base = defaultChoices(options, found);
      const fromFlags = options.surfacesFrom === 'flag' || options.surfacesFrom === 'implied';
      const agentsOn = !options.surfaces || options.surfaces.includes('agents');
      const next = { ...base, agents: agentsOn ? base.agents : [], appsFromFlag: options.apps ?? null };
      setToggles({ 'mcp-apps': Boolean(options.surfaces?.includes('mcp-apps')), hosted: Boolean(options.surfaces?.includes('hosted') && found.login), executor: Boolean(options.surfaces?.includes('executor')), bot: Boolean(options.surfaces?.includes('bot')) });
      // Found agents first, then the rest, in registry order.
      setOrder([...found.agents.filter(agent => agent.found), ...found.agents.filter(agent => !agent.found)]);
      setCtx(found);
      setChoices(next);
      const askAgents = agentsOn && !options.providers && !options.wanted;
      const askOptions = !fromFlags || (agentsOn && next.agents.length > 0 && !options.scope);
      setShown({ agents: askAgents, options: askOptions });
      go(askAgents ? 'agents' : askOptions ? 'options' : options.yes ? 'install' : 'review');
    })();
    return () => { live = false; };
  }, [screen]);

  const agentsOn = !options.surfaces || options.surfaces.includes('agents') || shown.agents;
  const opts = useMemo(() => (ctx && choices ? optionRows(ctx, choices, options) : { list: [], notes: [] }), [ctx, choices]);
  const final = useMemo(() => (ctx && choices ? finalChoices(choices, toggles, agentsOn, ctx) : null), [ctx, choices, toggles, agentsOn]);
  const plan = useMemo(() => (final ? buildPlan(final, ctx) : null), [final]);

  // Install, then verify. Each step draws one row; a failed step never stops the others.
  useEffect(() => {
    if (screen !== 'install') return;
    (async () => {
      try {
      const track = async (label, work, { quiet = false } = {}) => {
        const id = `${label}-${Math.random()}`;
        setProgress(list => [...list, { id, label, state: 'run', quiet }]);
        await sleep(40);
        const result = await work();
        const ok = result?.ok ?? (typeof result === 'boolean' ? result : true);
        const manual = result?.manual || result?.status === 'manual';
        setProgress(list => list.map(item => (item.id === id ? { ...item, state: ok ? 'ok' : manual ? 'manual' : 'bad', label: quiet ? label.replace(/^Checking /, 'Checked ') : label } : item)));
        return result;
      };
      // The hosted sign-in talks through this Clack-shaped UI: the code goes on the card.
      const ui = {
        note: (body, title) => setMessage({ title, body }),
        spinner: () => ({ start: text => setStatus(text), stop: () => setStatus(null), message: text => setStatus(text) }),
        log: Object.fromEntries(['info', 'warn', 'error', 'message', 'step', 'success'].map(name => [name, text => setMessage({ title: null, body: String(text) })])),
        isCancel: () => false,
      };
      const results = await applyPlan(plan, final, { ui, progress: track, login: ctx.login });
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
    { id: 'add', label: 'Add or change agents', hint: 'Open the installer: agents, scope, hooks, MCP apps, and more.' },
    { id: 'update', label: 'Update', hint: `Get the newest version and refresh every install (${self} update).` },
    { id: 'doctor', label: 'Check and repair', hint: `Find and repair install and project drift (${self} doctor --fix).` },
    { id: 'remove', label: 'Remove', hint: `Remove Conquistador from your agents (${self} remove). Your playbooks and config stay.` },
    { id: 'quit', label: 'Quit', hint: 'Close this screen.' },
  ];

  useInput((input, key) => {
    const ctrlC = key.ctrl && input === 'c';
    const up = key.upArrow || input === 'k', down = key.downArrow || input === 'j';
    if (screen === 'install') { if (ctrlC) setStatus('Installing. Wait for this step to finish; nothing is left half done.'); return; }
    if (screen === 'loading') { if (ctrlC || key.escape || input === 'q') cancel(); return; }
    if (screen === 'done') {
      if (up) setOffset(value => Math.max(0, value - 1));
      else if (down) setOffset(value => Math.min(limit.current, value + 1));
      else if (key.return || ctrlC || key.escape || input === 'q') finish({ kind: 'done', ...outcome });
      return;
    }
    if (screen === 'home') {
      if (ctrlC || key.escape || input === 'q') { finish({ kind: 'quit', code: 0 }); return; }
      if (up) setCursor(value => (value + MENU.length - 1) % MENU.length);
      else if (down) setCursor(value => (value + 1) % MENU.length);
      else if (key.return) {
        const choice = MENU[cursor].id;
        if (choice === 'quit') finish({ kind: 'quit', code: 0 });
        else if (choice === 'add') go('loading');
        else if (choice === 'remove') go('confirm-remove');
        else finish({ kind: 'action', action: choice });
      }
      return;
    }
    if (screen === 'confirm-remove') {
      if (input === 'y' || key.return) finish({ kind: 'action', action: 'remove' });
      else if (input === 'n' || key.escape || input === 'q' || ctrlC) go('home');
      return;
    }
    if (ctrlC || input === 'q') { cancel(); return; }
    if (screen === 'agents') {
      if (key.escape) cancel();
      else if (up) setCursor(value => (value + order.length - 1) % order.length);
      else if (down) setCursor(value => (value + 1) % order.length);
      else if (input === ' ') {
        const id = order[cursor].id;
        setChoices(value => ({ ...value, agents: AGENTS.map(agent => agent.id).filter(item => (item === id ? !value.agents.includes(id) : value.agents.includes(item))) }));
      } else if (input === 'a') {
        const found = order.filter(agent => agent.found).map(agent => agent.id);
        setChoices(value => ({ ...value, agents: found.every(id => value.agents.includes(id)) ? [] : AGENTS.map(agent => agent.id).filter(id => found.includes(id) || value.agents.includes(id)) }));
      } else if (key.return) go(shown.options ? 'options' : 'review');
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
          setChoices(value => ({ ...value, [row.id]: next }));
        }
      } else if (key.return) go('review');
      return;
    }
    if (screen === 'review') {
      if (key.escape) { if (shown.options) go('options'); else if (shown.agents) go('agents'); else cancel(); }
      else if (up) setOffset(value => Math.max(0, value - 1));
      else if (down) setOffset(value => Math.min(limit.current, value + 1));
      else if (key.return && plan.surfaces.length) go('install');
    }
  }, { isActive: true });

  // Rows left for a list after the header (6), the card frame, title, and subtitle (5 or more),
  // and the keys (2), with one row to spare.
  const room = (notes, subtitle = '') => Math.max(3, height - 14 - Math.max(1, rows(subtitle, inner).length) - notes);
  const step = STEP_OF[screen] ?? null;
  const frame = (card, keys) => h(Box, { flexDirection: 'column', width: columns },
    h(Header, { c, columns, step }), card, h(Keys, { keys }));

  if (screen === 'loading') {
    return frame(h(Card, { c, width, title: 'Looking for your coding agents', subtitle: 'Reading PATH and your home folder. Nothing changes yet.' },
      h(Text, null, h(Spinner, { color: c.brand }), ' Detecting')), [['esc', 'quit']]);
  }

  if (screen === 'home') {
    const here = installsHere(projectRoot(cwd));
    const lead = here.agents.find(agent => agent.slash) ?? here.agents[0];
    const notice = updateNotice(update.cached, version, channel().kind);
    const pad = Math.min(22, Math.max(...homeRows.map(row => (row.label ?? row.agent.label).length)) + 2);
    const list = windowed(homeRows, 0, Math.max(2, height - 22 - (notice ? 1 : 0)));
    return frame(h(Card, { c, width, title: 'Conquistador is installed', subtitle: 'The work happens in your agent. This screen only manages the installs.' },
      ...list.shown.map((row, index) => h(Text, { key: index, wrap: 'truncate-end' }, h(Text, { color: row.stale ? c.sticky : c.ok }, row.stale ? '! ' : '✓ '), (row.label ?? row.agent.label).padEnd(pad), h(Text, { dimColor: true }, row.where + (row.stale ? '; needs update' : ''))))
        .concat(list.below ? [h(Text, { key: 'more', dimColor: true }, `↓ ${list.below} more`)] : []),
      h(Text, { key: 'next' }, ' '),
      ...rows(`In your agent, type: ${lead ? nextStep(lead, cwd) : '/conquistador'}`, inner).map((text, index) => h(Text, { key: `n${index}`, color: c.brand }, text)),
      notice ? h(Text, { key: 'notice', color: c.sticky, wrap: 'truncate-end' }, `! ${notice}`) : null,
      h(Text, { key: 'gap' }, ' '),
      ...MENU.map((item, index) => h(Text, { key: item.id, color: index === cursor ? c.brand : undefined, bold: index === cursor }, `${index === cursor ? '› ◆' : '  ◇'} ${item.label}`)),
      h(Text, { key: 'hint', dimColor: true, wrap: 'truncate-end' }, MENU[cursor].hint)), [['↑↓', 'move'], ['enter', 'choose'], ['q', 'quit']]);
  }

  if (screen === 'confirm-remove') {
    return frame(h(Card, { c, width, title: 'Remove Conquistador?', subtitle: 'From every agent, MCP app, and Executor source this installer added.' },
      ...rows('Your playbooks, config, bot exports, and the npm CLI stay. You can install again with conquistador.', inner).map((text, index) => h(Text, { key: index }, text))),
    [['y', 'remove'], ['n', 'back']]);
  }

  if (screen === 'agents') {
    const notes = [...warnings, ...(ctx.found.length ? [] : ['No coding agent found on PATH or in your home folder. A skill-format agent still installs; or turn on an option on the next screen.'])].flatMap(text => rows(`! ${text}`, inner));
    const detail = order[cursor];
    const describe = detail.found
      ? `Found${detail.foundAt ? ` at ${tilde(detail.foundAt)}` : ''}. ${detail.how === 'skill' ? 'Copies the Conquistador skill folder.' : 'Installs the plugin: the skill, prompt hooks, and the MCP server.'}`
      : detail.how === 'skill' ? 'Not found. The skill folder still installs; the agent reads it after you install the agent.' : `Not found. Install ${detail.label} first, or choose This project on the next screen.`;
    const hints = rows(describe, inner).slice(0, 2);
    const subtitle = 'Conquistador installs into each agent you choose. Nothing changes until you confirm.';
    const list = windowed(order, cursor, room(notes.length + hints.length + 1, subtitle));
    const labelWidth = Math.min(20, inner - 22);
    return frame(h(Card, { c, width, title: 'Which agents?', subtitle },
      ...notes.map((text, index) => h(Text, { key: `w${index}`, color: c.sticky }, text)),
      list.above ? h(Text, { key: 'above', dimColor: true }, `↑ ${list.above} more`) : null,
      ...list.shown.map((agent, index) => {
        const at = list.start + index, on = choices.agents.includes(agent.id), here = at === cursor;
        return h(Text, { key: agent.id, wrap: 'truncate-end' },
          h(Text, { color: c.brand }, here ? '› ' : '  '),
          h(Text, { color: on ? c.brand : undefined, dimColor: !on }, on ? '◉ ' : '○ '),
          h(Text, { bold: here }, agent.label.slice(0, labelWidth).padEnd(labelWidth)),
          h(Text, { dimColor: true }, ` ${(agent.how === 'skill' ? 'skill' : 'plugin').padEnd(7)}`),
          h(Text, { color: agent.found ? c.ok : undefined, dimColor: !agent.found }, agent.found ? 'found' : 'not found'));
      }),
      list.below ? h(Text, { key: 'below', dimColor: true }, `↓ ${list.below} more`) : null,
      h(Text, { key: 'gap' }, ' '),
      ...hints.map((text, index) => h(Text, { key: `h${index}`, dimColor: true }, text))),
    [['↑↓', 'move'], ['space', 'select'], ['a', 'all found'], ['enter', 'continue'], ['esc', 'quit']]);
  }

  if (screen === 'options') {
    const list = opts.list;
    const row = list[Math.min(cursor, list.length - 1)];
    const notes = [...(shown.agents ? [] : warnings), ...opts.notes].flatMap(text => rows(text.startsWith('Hosted') ? text : `! ${text}`, inner));
    const hints = row ? rows(row.hint(valueOf(row, choices, toggles)), inner).slice(0, 3) : [];
    const chosen = choices.agents.length ? `${choices.agents.length} ${choices.agents.length === 1 ? 'agent' : 'agents'} chosen.` : 'No agent chosen.';
    return frame(h(Card, { c, width, title: 'Choose options', subtitle: `${chosen} Turn on more places for Conquistador, or press Enter.` },
      ...notes.map((text, index) => h(Text, { key: `w${index}`, color: c.sticky }, text)),
      ...list.map((item, index) => {
        const value = valueOf(item, choices, toggles), here = index === cursor;
        const on = item.toggle ? value : true;
        return h(Text, { key: item.id, wrap: 'truncate-end' },
          h(Text, { color: c.brand }, here ? '› ' : '  '),
          h(Text, { bold: here }, item.label.padEnd(16)),
          h(Text, { color: on && (here || !item.toggle) ? c.brand : on ? c.ember : undefined, dimColor: !on, bold: here }, `‹ ${nameOf(item, value)} ›`));
      }),
      h(Text, { key: 'gap' }, ' '),
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
    [['…', 'installing']]);
  }

  // Done.
  const lines = doneLines({ ...outcome, cwd, task: options.task }, inner);
  const subtitle = 'Conquistador works inside your agent. The terminal only installs it.';
  return frame(h(Card, { c, width, title: outcome.code ? 'Done, with problems' : 'Done', subtitle },
    h(Scroll, { c, lines, offset, height: room(0, subtitle), limit })),
  [['enter', 'exit'], ['↑↓', 'scroll']]);
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
  if (result.kind === 'quit') return 0;
  if (result.kind === 'action') {
    const front = await import('./front-door.mjs');
    if (result.action === 'update') return front.runUpdate([]);
    if (result.action === 'remove') return front.runRemove([]);
    return (await import('./doctor.mjs')).runDoctor(['--fix']);
  }
  // Done: the summary stays on the normal screen.
  console.log(`${p.bold('Summary')}\n${summaryLines({ results: result.results, checks: result.checks, plan: result.plan, notice: result.notice, p }).join('\n')}`);
  const lead = result.ready.find(agent => agent.slash) ?? result.ready[0];
  if (lead) console.log(`\n→ Open ${lead.label} in this project and type:\n  ${p.brand(nextStep(lead, cwd, options.task))}`);
  return result.code;
}
