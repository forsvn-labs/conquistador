#!/usr/bin/env node
// E2E for `conquistador check` and its edit hook. Offline, no model, no key.
// Runs the real CLI entry point over good and bad copy (landing, email, X, LinkedIn, Google
// and Meta ads), config ignores, inline waivers, a URL served by a local HTTP server, and a
// hook round trip through the commands declared in the Claude Code, Codex, and Cursor manifests.
// Report: dist/e2e/check/report.json and report.md.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadavg, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from '../spawn.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = join(root, 'tools/e2e/fixtures/check');
const bin = join(root, 'runtime/bin/conquistador.js');
const args = process.argv.slice(2);
const out = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : join(root, 'dist/e2e/check'));
const results = [];

// Expected rule ids per bad fixture: the exact set the checker must report.
const expected = {
  'bad/landing.html': ['ai-elevate', 'ai-fast-paced-world', 'ai-seamless', 'claim-number-unsourced', 'claim-scarcity', 'claim-superlative', 'claim-urgency', 'claim-vague-proof', 'cta-vague', 'link-http', 'link-placeholder', 'meta-description-missing', 'meta-title-length'],
  'bad/launch-email.md': ['ai-exclamation', 'ai-fast-paced-world', 'ai-not-just', 'ai-unlock', 'claim-number-unsourced', 'claim-superlative', 'claim-urgency', 'cta-vague', 'email-address-missing', 'email-fake-reply', 'email-preheader-missing', 'email-subject-shouting', 'email-unsubscribe-missing', 'link-http', 'link-utm-missing'],
  'bad/x-thread.md': ['ai-game-changer', 'ai-purple-prose', 'ai-unlock', 'x-length'],
  'bad/linkedin-post.md': ['ai-em-dash', 'linkedin-hook'],
  'bad/google-ads-rsa.md': ['claim-guarantee', 'rsa-asset-count', 'rsa-description-length', 'rsa-headline-length', 'rsa-path-length'],
  'bad/meta-ad.md': ['claim-scarcity', 'meta-ad-headline-length', 'meta-ad-primary-length'],
};

const good = ['good/landing.html', 'good/launch-email.md', 'good/x-thread.md', 'good/google-ads-rsa.md', 'good/meta-ad.md'];

function run(command, commandArgs, options = {}) {
  const { file, args: fileArgs, options: spawnOptions } = spawnCommand(command, commandArgs);
  const started = performance.now();
  const result = spawnSync(file, fileArgs, { encoding: 'utf8', timeout: 30_000, ...spawnOptions, ...options });

  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', ms: performance.now() - started };
}

const check = (checkArgs, cwd = root) => run(process.execPath, [bin, 'check', ...checkArgs], { cwd });

const ids = stdout => [...new Set(JSON.parse(stdout).map(finding => finding.rule))].sort();

function record(name, pass, detail) {
  results.push({ name, pass: Boolean(pass), detail });
}

function sameSet(name, actual, wanted) {
  const missing = wanted.filter(id => !actual.includes(id));
  const extra = actual.filter(id => !wanted.includes(id));

  record(name, !missing.length && !extra.length, missing.length || extra.length ? `missing: ${missing.join(', ') || '-'}; unexpected: ${extra.join(', ') || '-'}` : actual.join(', '));
}

// 1. Bad copy: exit 2 and the exact rule set.
for (const [fixture, wanted] of Object.entries(expected)) {
  const result = check(['--json', '--no-config', join(fixtures, fixture)]);

  record(`${fixture} exits 2`, result.status === 2, `exit ${result.status}`);
  sameSet(`${fixture} rules`, result.status === 2 ? ids(result.stdout) : [], wanted);
}

// 2. Good copy: exit 0 and no findings at all.
for (const fixture of good) {
  const result = check(['--json', '--no-config', join(fixtures, fixture)]);

  record(`${fixture} is clean`, result.status === 0 && result.stdout.trim() === '[]', `exit ${result.status}, ${result.stdout.trim().slice(0, 120)}`);
}

// 3. Folder scan, human output on stderr only, scan failures, unknown channel.
{
  const folder = check([join(fixtures, 'bad')]);

  record('folder scan exits 2 with text on stderr and nothing on stdout', folder.status === 2 && folder.stdout === '' && /\d+ findings/.test(folder.stderr), `exit ${folder.status}`);
  const files = check(['--json', join(fixtures, 'bad')]);

  record('folder scan covers every bad fixture', new Set(JSON.parse(files.stdout).map(finding => finding.file.split(/[\\/]/).pop())).size === Object.keys(expected).length, `${JSON.parse(files.stdout).length} findings`);
  const missing = check(['--json', join(fixtures, 'good/landing.html'), join(fixtures, 'missing.md')]);

  record('a missing target exits 1 even when another target is clean', missing.status === 1 && /does not exist/.test(missing.stderr), `exit ${missing.status}`);
  const partial = check(['--json', join(fixtures, 'bad/meta-ad.md'), join(fixtures, 'missing.md')]);

  record('a scan failure outranks findings (exit 1)', partial.status === 1 && JSON.parse(partial.stdout).length > 0, `exit ${partial.status}`);
  const channel = check(['--channel', 'fax', join(fixtures, 'good/landing.html')]);

  record('an unknown channel exits 1', channel.status === 1 && /Unknown channel/.test(channel.stderr), `exit ${channel.status}`);
  const forced = check(['--json', '--no-config', '--channel', 'x', join(fixtures, 'bad/linkedin-post.md')]);

  record('--channel overrides front matter', !ids(forced.stdout).includes('linkedin-hook'), ids(forced.stdout).join(', '));
}

// 4. Config ignores and inline waivers, and --no-config restores everything.
const project = mkdtempSync(join(tmpdir(), 'conquistador-check-e2e-'));

try {
  mkdirSync(join(project, '.conquistador'));
  mkdirSync(join(project, 'marketing', 'drafts'), { recursive: true });
  cpSync(join(fixtures, 'bad/launch-email.md'), join(project, 'marketing/launch-email.md'));
  cpSync(join(fixtures, 'bad/meta-ad.md'), join(project, 'marketing/drafts/meta-ad.md'));
  writeFileSync(join(project, '.conquistador/config.json'), JSON.stringify({ check: { ignoreRules: ['email-preheader-missing', 'ai-exclamation'], ignoreFiles: ['marketing/drafts/**'] } }));
  const configured = check(['--json', 'marketing'], project);
  const configuredIds = ids(configured.stdout);

  record('config ignoreRules removes those rules', !configuredIds.includes('email-preheader-missing') && !configuredIds.includes('ai-exclamation'), configuredIds.join(', '));
  record('config ignoreFiles skips matching files', !JSON.parse(configured.stdout).some(finding => finding.file.includes('drafts')), `${JSON.parse(configured.stdout).length} findings`);
  const raw = check(['--json', '--no-config', 'marketing'], project);

  record('--no-config ignores the config', ids(raw.stdout).includes('email-preheader-missing') && JSON.parse(raw.stdout).some(finding => finding.file.includes('drafts')), `${JSON.parse(raw.stdout).length} findings`);
  writeFileSync(join(project, 'marketing/waived.md'), [
    '---', 'channel: landing', '---', '<!-- conquistador-disable ai-delve: quoting a competitor -->', '',
    'We delve into pricing.', '',
    'We are the #1 tool for planners. <!-- conquistador-disable-line claim-superlative: G2 Fall 2026 grid -->', '',
    '<!-- conquistador-disable-next-line claim-number-unsourced: internal benchmark, see appendix -->',
    'Reports load 4x faster than last year.', '',
    'Teams see 40% fewer meetings.', '',
    '[Start a free workspace](https://acme.example.org/start)', '',
  ].join('\n'));
  const waived = check(['--json', 'marketing/waived.md'], project);
  const waivedFindings = JSON.parse(waived.stdout);

  record('file, line, and next-line waivers suppress only their rule and line', waivedFindings.length === 1 && waivedFindings[0].rule === 'claim-number-unsourced' && waivedFindings[0].line === 13, waivedFindings.map(finding => `${finding.rule}:${finding.line}`).join(', '));
  const unwaived = check(['--json', '--no-config', 'marketing/waived.md'], project);

  record('--no-config ignores inline waivers', ids(unwaived.stdout).join(',') === 'ai-delve,claim-number-unsourced,claim-superlative', ids(unwaived.stdout).join(', '));
} finally {
  rmSync(project, { recursive: true, force: true });
}

// 5. URL scan against a real local HTTP server (visible text and meta tags).
// spawnSync blocks the event loop, so the URL check runs the server in a child process instead.
{
  const serverScript = `const http=require('node:http');const fs=require('node:fs');const body=fs.readFileSync(process.argv[1]);const s=http.createServer((q,r)=>{if(q.url==='/landing'){r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(body)}else{r.writeHead(404);r.end()}});s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port)+'\\n')});setTimeout(()=>process.exit(0),20000);`;
  const server = spawnCommand(process.execPath, ['-e', serverScript, join(fixtures, 'bad/landing.html')]);
  const child = spawn(server.file, server.args, { ...server.options, stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise(done => child.stdout.once('data', chunk => done(String(chunk).trim())));

  try {
    const page = check(['--json', '--no-config', `http://127.0.0.1:${port}/landing`]);
    const pageIds = page.status === 2 ? ids(page.stdout) : [];

    record('URL scan reads title, meta tags, and visible text', page.status === 2 && pageIds.includes('meta-title-length') && pageIds.includes('meta-description-missing') && pageIds.includes('claim-scarcity'), `exit ${page.status}: ${pageIds.join(', ')}`);
    const gone = check(['--json', `http://127.0.0.1:${port}/missing`]);

    record('an unreachable URL page exits 1', gone.status === 1 && /HTTP 404/.test(gone.stderr), `exit ${gone.status}`);
  } finally {
    child.kill();
  }
}

// 6. Hook round trip through the exact commands in the host manifests.
function manifestCommand(manifest, event, variable) {
  const hooks = JSON.parse(readFileSync(join(root, 'hooks', manifest), 'utf8')).hooks[event];
  const command = hooks.flatMap(entry => entry.hooks ?? [entry]).map(entry => entry.command).find(text => text.includes('check-hook.mjs'));
  const match = /^node "([^"]+)" (\w+) (\w+)$/.exec(command.replace(`\${${variable}}`, root.replace(/[\\/]$/, '')));

  return { script: match[1], client: match[2], event: match[3], matcher: hooks.find(entry => JSON.stringify(entry).includes('check-hook.mjs')).matcher };
}

const hosts = {
  claude: manifestCommand('claude.json', 'PostToolUse', 'CLAUDE_PLUGIN_ROOT'),
  codex: manifestCommand('codex.json', 'PostToolUse', 'PLUGIN_ROOT'),
  cursor: manifestCommand('cursor.json', 'postToolUse', 'CURSOR_PLUGIN_ROOT'),
};

record('manifests route Write and Edit tools to the check hook', /Write/.test(hosts.claude.matcher) && /Edit/.test(hosts.claude.matcher) && /apply_patch/.test(hosts.codex.matcher) && /Write/.test(hosts.cursor.matcher), `${hosts.claude.matcher} | ${hosts.codex.matcher} | ${hosts.cursor.matcher}`);
const hookProject = mkdtempSync(join(tmpdir(), 'conquistador-check-hook-'));
const state = mkdtempSync(join(tmpdir(), 'conquistador-check-state-'));
const timings = [];
let timing = null;

function hook(host, input, env = {}) {
  const result = run(process.execPath, [hosts[host].script, hosts[host].client, hosts[host].event], { cwd: hookProject, input: JSON.stringify({ cwd: hookProject, ...input }), env: { ...process.env, CONQUISTADOR_STATE: state, CONQUISTADOR_HOME: join(state, 'home'), ...env } });

  timings.push(result.ms);

  return { ...result, json: result.stdout.trim() ? JSON.parse(result.stdout) : null };
}

try {
  mkdirSync(join(hookProject, 'marketing'));
  mkdirSync(join(hookProject, 'src'));
  cpSync(join(fixtures, 'bad/launch-email.md'), join(hookProject, 'marketing/launch-email.md'));
  writeFileSync(join(hookProject, 'README.md'), '# Acme\n\nThe #1 tool. Unlock 300% growth.\n');
  writeFileSync(join(hookProject, 'src/app.md'), 'Internal notes: unlock the cache.\n');
  const write = { session_id: 'e2e-1', hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'marketing/launch-email.md' } };
  const first = hook('claude', write);
  const context = first.json?.hookSpecificOutput?.additionalContext ?? '';

  record('Claude Code: findings return as PostToolUse additionalContext', first.status === 0 && first.json?.hookSpecificOutput?.hookEventName === 'PostToolUse' && /\[email-fake-reply\]/.test(context) && /\[email-unsubscribe-missing\]/.test(context) && !/\[email-preheader-missing\]/.test(context), context.split('\n')[0]);
  record('Claude Code: the same findings are not repeated', hook('claude', write).stdout === '', 'silent on repeat');
  cpSync(join(fixtures, 'good/launch-email.md'), join(hookProject, 'marketing/launch-email.md'));
  record('Claude Code: silent after the agent fixes the file', hook('claude', write).stdout === '', 'silent when clean');
  cpSync(join(fixtures, 'bad/launch-email.md'), join(hookProject, 'marketing/launch-email.md'));
  record('Claude Code: reports again when findings come back', /\[email-fake-reply\]/.test(hook('claude', write).stdout), 'reported');
  record('silent on README and project docs', hook('claude', { ...write, session_id: 'e2e-2', tool_input: { file_path: 'README.md' } }).stdout === '', 'README.md');
  record('silent on files outside marketing folders', hook('claude', { ...write, session_id: 'e2e-2', tool_input: { file_path: 'src/app.md' } }).stdout === '', 'src/app.md');
  record('silent on code files', hook('claude', { ...write, session_id: 'e2e-2', tool_input: { file_path: 'src/index.ts' } }).stdout === '', 'src/index.ts');
  record('CONQUISTADOR_HOOKS=off disables it', hook('claude', { ...write, session_id: 'e2e-3' }, { CONQUISTADOR_HOOKS: 'off' }).stdout === '', 'off');
  const broken = run(process.execPath, [hosts.claude.script, 'claude', 'edit'], { cwd: hookProject, input: 'not json' });

  record('malformed input exits 0 with no output', broken.status === 0 && broken.stdout === '', `exit ${broken.status}`);
  const codex = hook('codex', { session_id: 'e2e-4', tool_name: 'apply_patch', tool_input: { command: ['apply_patch', '*** Begin Patch\n*** Update File: marketing/launch-email.md\n@@\n-a\n+b\n*** End Patch\n'] } });

  record('Codex: apply_patch paths are checked; output uses PostToolUse additionalContext', /\[email-fake-reply\]/.test(codex.json?.hookSpecificOutput?.additionalContext ?? ''), codex.stdout.slice(0, 80));
  const cursor = hook('cursor', { conversation_id: 'e2e-5', tool_name: 'Write', tool_input: { file_path: join(hookProject, 'marketing/launch-email.md') } });

  record('Cursor: findings return as additional_context', /\[email-fake-reply\]/.test(cursor.json?.additional_context ?? ''), cursor.stdout.slice(0, 80));
  // Wall time depends on machine load, so the pass condition uses CPU time for the hook's own work:
  // importing the checker, reading one file, and running every rule. Wall times go in the report.
  const cpu = () => { const usage = process.cpuUsage(); return (usage.user + usage.system) / 1000; };
  const before = cpu();
  const { extractDocument } = await import('../check/extract.mjs');
  const { checkDocument } = await import('../check/index.mjs');
  const document = extractDocument(readFileSync(join(fixtures, 'bad/launch-email.md'), 'utf8'), '.md');

  checkDocument(document, { channel: 'email', file: 'launch-email.md' });
  const work = cpu() - before;
  const bare = [];

  for (let index = 0; index < 5; index += 1) {
    bare.push(run(process.execPath, ['-e', '0']).ms);
    hook('claude', { ...write, session_id: `e2e-time-${index}` });
  }
  const median = values => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];

  timing = { hookWallMedianMs: Math.round(median(timings)), bareNodeWallMedianMs: Math.round(median(bare)), checkerCpuMs: Math.round(work), loadAverage: loadavg().map(value => Number(value.toFixed(2))) };
  record('hook work (import, extract, all rules) uses under 200 ms of CPU', work < 200, `${work.toFixed(0)} ms CPU; wall: hook ${timing.hookWallMedianMs} ms vs bare Node ${timing.bareNodeWallMedianMs} ms at load ${timing.loadAverage[0]}`);
} finally {
  rmSync(hookProject, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
}

// 7. The catalog documents every rule.
{
  const catalog = readFileSync(join(root, 'docs/CHECK.md'), 'utf8');
  const listed = JSON.parse(check(['--rules', '--json']).stdout).map(rule => rule.id);
  const undocumented = listed.filter(id => !catalog.includes(`\`${id}\``));

  record('docs/CHECK.md lists every rule', !undocumented.length, undocumented.length ? `missing: ${undocumented.join(', ')}` : `${listed.length} rules`);
}

// Report.
const report = {
  createdAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  rules: JSON.parse(check(['--rules', '--json']).stdout).length,
  timing,
  passed: results.filter(item => item.pass).length,
  total: results.length,
  results,
};

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'report.md'), [
  `# conquistador check E2E: ${report.passed}/${report.total} pass`, '',
  `Run: ${report.createdAt}. Node ${report.node}, ${report.platform}. Rules: ${report.rules}.`, '',
  'Repeat: `node tools/e2e/check.mjs`', '',
  '| Result | Case | Detail |', '| --- | --- | --- |',
  ...results.map(item => `| ${item.pass ? 'pass' : 'FAIL'} | ${item.name} | ${String(item.detail).replace(/\|/g, '/').replace(/\n/g, ' ')} |`), '',
].join('\n'));
for (const item of results) if (!item.pass) console.log(`FAIL ${item.name}\n     ${item.detail}`);
console.log(`${report.passed}/${report.total} pass. Report: ${join(out, 'report.md')}`);
process.exitCode = report.passed === report.total ? 0 : 1;
