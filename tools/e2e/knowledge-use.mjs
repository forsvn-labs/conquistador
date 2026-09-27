#!/usr/bin/env node
// E2E: does a real agent read the playbooks? Runs headless Claude Code on fixed prompts with
//   before  – the plugin at BEFORE_REF (default: the commit before this overhaul),
//   hooks   – this checkout as a plugin, hooks on,
//   mcp     – this checkout as a plugin, hooks off (MCP server instructions only).
// Uses your Claude Code login and spends real tokens. Nothing outside OUT_DIR is written.
//   node tools/e2e/knowledge-use.mjs [--runs N] [--before REF] [--out DIR] [--only before,hooks,mcp]
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief } from '../brief.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const runs = Number(option('--runs', 1));
const beforeRef = option('--before', 'df97556');
const out = resolve(option('--out', join(root, 'dist/e2e/knowledge-use')));
const only = option('--only', 'before,hooks,mcp').split(',');
const PROMPTS = [
  'Plan a Product Hunt launch for Tinyshot, a macOS screenshot tool for developers. We launch in 3 weeks, have 400 waitlist emails, and no budget. Keep the plan to one page.',
  'Design pricing tiers for Ledgerly, a bookkeeping SaaS for freelancers. We charge $12/month flat today and 30% of trials convert. Recommend a tier structure in under 400 words.',
];
mkdirSync(join(out, 'transcripts'), { recursive: true });
const work = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-knowledge-')));
const before = join(work, 'before');
mkdirSync(before);
execFileSync('sh', ['-c', `git -C "${root}" archive ${beforeRef} | tar -x -C "${before}"`]);
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

function analyze(text, must) {
  const reads = new Set();
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
      const input = JSON.stringify(item.input);
      for (const match of input.matchAll(/(?:skills|library)\/[\w./-]+?\.md/g)) reads.add(match[0].replace(/^library\//, 'skills/'));
    }
  }
  const tail = path => path.split('/').slice(-3).join('/');
  const covered = brief ? must.length : must.filter(path => [...reads].some(read => read.endsWith(tail(path)))).length;
  const answer = result?.result ?? '';
  return { knowledgeFilesRead: [...reads].filter(path => !/SKILL\.md$/.test(path)).length, reads: [...reads].sort(), briefToolCalled: brief, mustRead: must.length, mustReadCovered: covered, citesPlaybooks: /playbooks applied/i.test(answer), turns: result?.num_turns ?? null, costUsd: result?.total_cost_usd ?? null, answerTail: answer.slice(-600) };
}

const rows = [];
for (const [pi, prompt] of PROMPTS.entries()) {
  const must = createBrief(prompt, { root, playbooks: [] }).must.map(item => item.path);
  for (const name of only) for (let run = 1; run <= runs; run += 1) {
    const transcript = join(out, 'transcripts', `p${pi + 1}-${name}-${run}.jsonl`);
    process.stdout.write(`prompt ${pi + 1} · ${name} · run ${run} … `);
    const { code, text } = await claude(prompt, configs[name], transcript);
    const row = { prompt: pi + 1, config: name, run, exit: code, ...analyze(text, must) };
    rows.push(row);
    console.log(`read ${row.knowledgeFilesRead} files, must-read ${row.mustReadCovered}/${row.mustRead}${row.briefToolCalled ? ' (brief)' : ''}, cites=${row.citesPlaybooks}`);
  }
}
const summary = Object.fromEntries(only.map(name => {
  const list = rows.filter(row => row.config === name);
  const mean = key => Number((list.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) / Math.max(list.length, 1)).toFixed(2));
  return [name, { runs: list.length, meanKnowledgeFilesRead: mean('knowledgeFilesRead'), mustReadCoverage: Number((list.reduce((s, r) => s + r.mustReadCovered, 0) / Math.max(list.reduce((s, r) => s + r.mustRead, 0), 1)).toFixed(2)), citesPlaybooksRate: mean('citesPlaybooks'), meanCostUsd: mean('costUsd') }];
}));
const report = { schema: 'conquistador.e2e.knowledge-use/v1', at: new Date().toISOString(), beforeRef, head: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), claude: execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim(), prompts: PROMPTS, summary, rows };
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const table = ['| Config | Runs | Knowledge files read (mean) | Must-read coverage | Cites playbooks | Cost (mean USD) |', '| --- | --- | --- | --- | --- | --- |',
  ...Object.entries(summary).map(([name, s]) => `| ${name} | ${s.runs} | ${s.meanKnowledgeFilesRead} | ${Math.round(s.mustReadCoverage * 100)}% | ${Math.round(s.citesPlaybooksRate * 100)}% | ${s.meanCostUsd} |`)];
writeFileSync(join(out, 'report.md'), `# Knowledge-use E2E\n\n${report.at} · head ${report.head.slice(0, 7)} · before ${beforeRef} · ${report.claude}\n\n${table.join('\n')}\n\nTranscripts: transcripts/. Raw rows: report.json.\n`);
console.log(`\n${table.join('\n')}\n\nReport: ${join(out, 'report.md')}`);
