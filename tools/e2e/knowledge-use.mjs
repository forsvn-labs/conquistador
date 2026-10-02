#!/usr/bin/env node
// E2E: does a real agent read the playbooks? Runs headless Claude Code on fixed prompts with
//   before  – the plugin at BEFORE_REF (default: the commit before this overhaul),
//   hooks   – this checkout as a plugin, hooks on,
//   mcp     – this checkout as a plugin, hooks off (MCP server instructions only).
// Uses your Claude Code login and spends real tokens. Nothing outside OUT_DIR is written.
//   node tools/e2e/knowledge-use.mjs [--runs N] [--before REF] [--out DIR] [--only before,hooks,mcp] [--set launch|breadth]
// --set breadth uses non-launch tasks: lifecycle email, AI answer visibility, and an in-product paywall.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, knowledgeIndex } from '../brief.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const runs = Number(option('--runs', 1));
const beforeRef = option('--before', 'df97556');
const out = resolve(option('--out', join(root, 'dist/e2e/knowledge-use')));
const only = option('--only', 'before,hooks,mcp').split(',');
const SETS = { launch: [
  'Plan a Product Hunt launch for Tinyshot, a macOS screenshot tool for developers. We launch in 3 weeks, have 400 waitlist emails, and no budget. Keep the plan to one page.',
  'Design pricing tiers for Ledgerly, a bookkeeping SaaS for freelancers. We charge $12/month flat today and 30% of trials convert. Recommend a tier structure in under 400 words.',
], breadth: [
  'Build a win-back email flow for churned subscribers of Brewbox, a $24/month coffee subscription. About 9% cancel each month, mostly after month three. Keep it to three emails with subject lines.',
  'Get Ledgerly, a bookkeeping SaaS for freelancers, recommended by ChatGPT and Perplexity when people ask for freelancer bookkeeping tools. Give a one-page plan.',
  'Plan a paywall and trial experiment for Stepwise, a habit-tracking iOS app with 40k monthly installs and a 2% install-to-paid rate. Keep it under 400 words.',
] };
const PROMPTS = SETS[option('--set', 'launch')] ?? SETS.launch;
mkdirSync(join(out, 'transcripts'), { recursive: true });
const work = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-knowledge-')));
const before = join(work, 'before');
mkdirSync(before);
if (!process.argv.includes('--reanalyze')) execFileSync('sh', ['-c', `git -C "${root}" archive ${beforeRef} | tar -x -C "${before}"`]);
const configs = { before: { plugin: before, env: {} }, hooks: { plugin: root, env: {} }, mcp: { plugin: root, env: { CONQUISTADOR_HOOKS: 'off' } } };

function claude(prompt, config, transcript) {
  const project = mkdtempSync(join(work, 'project-'));
  return new Promise(done => {
    const child = spawn('claude', ['-p', prompt, '--plugin-dir', config.plugin, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions', '--setting-sources', 'project'],
      { cwd: project, env: { ...process.env, ...config.env, CONQUISTADOR_STATE: join(work, 'state'), CONQUISTADOR_PLAYBOOKS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.on('close', code => { const text = Buffer.concat(chunks).toString('utf8'); writeFileSync(transcript, text); done({ code, text }); });
  });
}

// Every knowledge file key ("conquistador/commands/campaign/references/channel-strategy.md") in this checkout.
const knownKeys = knowledgeIndex(root, { playbooks: [] }).docs.map(doc => doc.key);
function analyze(text, must) {
  const tokens = new Set();
  let brief = false;
  let result = null;
  for (const line of text.split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'result') result = event;
    if (event.type !== 'assistant') continue;
    for (const item of event.message?.content ?? []) {
      if (item.type !== 'tool_use') continue;
      if (/conquistador_brief/.test(item.name)) brief = true;
      // Agents read with absolute paths, and with relative paths after `cd` into a method folder.
      const input = JSON.stringify(item.input);
      const base = [...input.matchAll(/cd\s+"?([^";&|\s]+)/g)].map(match => match[1].replace(/\/$/, '')).pop();
      for (const match of input.matchAll(/[\w./-]+\.md\b/g)) {
        const token = match[0];
        tokens.add(base && !token.startsWith('/') ? `${base}/${token}` : token);
      }
    }
  }
  const reads = new Set();
  for (const token of tokens) {
    const exact = knownKeys.filter(key => token.endsWith(`/${key}`) || token === key);
    // A bare relative path counts only when it names exactly one known file.
    const partial = exact.length ? [] : knownKeys.filter(key => token.includes('/') && key.endsWith(`/${token}`));
    for (const key of exact.length ? exact : partial.length === 1 ? partial : []) reads.add(key);
  }
  const tail = path => path.split('/').slice(-3).join('/');
  const covered = brief ? must.length : must.filter(path => [...reads].some(read => read.endsWith(tail(path)) || tail(path).endsWith(read))).length;
  const answer = result?.result ?? '';
  const invalid = !result || result.is_error === true || /session limit|rate limit|usage limit/i.test(answer);
  return { invalid, knowledgeFilesRead: reads.size, reads: [...reads].sort(), briefToolCalled: brief, mustRead: must.length, mustReadCovered: covered, citesPlaybooks: /playbooks applied/i.test(answer), turns: result?.num_turns ?? null, costUsd: result?.total_cost_usd ?? null, answerTail: answer.slice(-600) };
}

const rows = [];
const reanalyze = process.argv.includes('--reanalyze');
for (const [pi, prompt] of PROMPTS.entries()) {
  const must = createBrief(prompt, { root, playbooks: [] }).must.map(item => item.path);
  for (const name of only) for (let run = 1; run <= runs; run += 1) {
    const transcript = join(out, 'transcripts', `p${pi + 1}-${name}-${run}.jsonl`);
    process.stdout.write(`prompt ${pi + 1} · ${name} · run ${run} … `);
    // --reanalyze re-scores saved transcripts without calling the agent again.
    const { code, text } = reanalyze ? { code: 0, text: readFileSync(transcript, 'utf8') } : await claude(prompt, configs[name], transcript);
    const row = { prompt: pi + 1, config: name, run, exit: code, ...analyze(text, must) };
    rows.push(row);
    if (row.invalid) { console.log('invalid run (agent error or plan limit); excluded'); continue; }
    console.log(`read ${row.knowledgeFilesRead} files, must-read ${row.mustReadCovered}/${row.mustRead}${row.briefToolCalled ? ' (brief)' : ''}, cites=${row.citesPlaybooks}`);
  }
}
const summary = Object.fromEntries(only.map(name => {
  // Runs that failed (for example, an exhausted plan limit) say nothing about knowledge use.
  const list = rows.filter(row => row.config === name && !row.invalid);
  const mean = key => Number((list.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) / Math.max(list.length, 1)).toFixed(2));
  return [name, { runs: list.length, invalidRuns: rows.filter(row => row.config === name && row.invalid).length, meanKnowledgeFilesRead: mean('knowledgeFilesRead'), mustReadCoverage: Number((list.reduce((s, r) => s + r.mustReadCovered, 0) / Math.max(list.reduce((s, r) => s + r.mustRead, 0), 1)).toFixed(2)), citesPlaybooksRate: mean('citesPlaybooks'), meanCostUsd: mean('costUsd') }];
}));
const report = { schema: 'conquistador.e2e.knowledge-use/v1', at: new Date().toISOString(), beforeRef, head: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), claude: execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim(), prompts: PROMPTS, summary, rows };
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const table = ['| Config | Valid runs | Knowledge files read (mean) | Must-read coverage | Cites playbooks | Cost (mean USD) |', '| --- | --- | --- | --- | --- | --- |',
  ...Object.entries(summary).map(([name, s]) => `| ${name} | ${s.runs} | ${s.meanKnowledgeFilesRead} | ${Math.round(s.mustReadCoverage * 100)}% | ${Math.round(s.citesPlaybooksRate * 100)}% | ${s.meanCostUsd} |`)];
writeFileSync(join(out, 'report.md'), `# Knowledge-use E2E\n\n${report.at} · head ${report.head.slice(0, 7)} · before ${beforeRef} · ${report.claude}\n\n${table.join('\n')}\n\nTranscripts: transcripts/. Raw rows: report.json.\n`);
console.log(`\n${table.join('\n')}\n\nReport: ${join(out, 'report.md')}`);
