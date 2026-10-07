// Agent-facing MCP tools: the draft check and the caller context on the brief.
// Deployed agents have no repository and no CLI, so the server carries the review loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMcpHandler, LIMITS } from './skills-mcp.mjs';
import { briefFiles } from './operator-package.mjs';
import { createBrief, formatBriefPack, LIMITS as BRIEF_LIMITS } from './brief.mjs';

const handle = createMcpHandler({ requireInitialize: false });
const call = (name, args) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
const json = response => JSON.parse(response.result.content[0].text);
const check = args => call('conquistador_check', args);

test('tools/list offers the draft check as a read-only tool with a closed schema', () => {
  const { tools } = handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result;
  const tool = tools.find(item => item.name === 'conquistador_check');
  assert.ok(tool);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.deepEqual(tool.inputSchema.required, ['text']);
  assert.ok(tool.inputSchema.properties.channel.enum.includes('linkedin'));
  const brief = tools.find(item => item.name === 'conquistador_brief');
  assert.deepEqual(brief.inputSchema.required, ['task']);
  assert.equal(brief.inputSchema.properties.context.type, 'string');
});

test('check rejects empty, oversized, and wrongly typed input without crashing', () => {
  for (const text of ['', '   \n ']) assert.equal(check({ text }).result.isError, true);
  const big = check({ text: 'a'.repeat(LIMITS.checkText + 1) });
  assert.equal(big.result.isError, true);
  assert.match(big.result.content[0].text, new RegExp(String(LIMITS.checkText)));
  for (const args of [{ text: 42 }, { text: 'Hi', channel: 7 }, { text: 'Hi', format: ['md'] }, { text: 'Hi', extra: 'x' }, {}]) {
    assert.equal(check(args).error?.code, -32602, JSON.stringify(args));
  }
});

test('check names the valid channels and formats instead of falling back silently', () => {
  const channel = check({ text: 'Hello there.', channel: 'myspace' });
  assert.equal(channel.result.isError, true);
  assert.match(channel.result.content[0].text, /linkedin/);
  const format = check({ text: 'Hello there.', format: 'docx' });
  assert.equal(format.result.isError, true);
  assert.match(format.result.content[0].text, /markdown/);
});

test('check normalizes channel aliases and applies that channel\'s limits', () => {
  const result = json(check({ text: `${'Ship it today. '.repeat(25)}`, channel: 'twitter' }));
  assert.equal(result.channel, 'x');
  assert.equal(result.clean, false);
  assert.ok(result.findings.some(finding => finding.rule === 'x-length'));
  for (const finding of result.findings) for (const key of ['rule', 'severity', 'message', 'fix', 'line', 'snippet']) assert.ok(key in finding, key);
});

test('clean or advisory-only text is clean, and advisories are still listed', () => {
  const clean = json(check({ text: 'We cut onboarding from nine steps to four. Book a 20-minute walkthrough.', channel: 'linkedin' }));
  assert.equal(clean.clean, true);
  assert.equal(clean.blocking, 0);
  const advisory = json(check({ text: 'Fast — simple — yours — today — now — here. Try the demo.', channel: 'social' }));
  assert.equal(advisory.blocking, 0);
  assert.equal(advisory.clean, true);
  assert.ok(advisory.findings.every(finding => finding.severity === 'advisory'));
});

test('check finds AI tells and honors inline waivers like the CLI', () => {
  const flagged = json(check({ text: 'Unlock seamless growth for your team.' }));
  assert.ok(flagged.findings.some(finding => finding.rule === 'ai-unlock'));
  const waived = json(check({ text: '<!-- conquistador-disable-next-line ai-unlock: product name -->\nUnlock seamless growth for your team.' }));
  assert.ok(!waived.findings.some(finding => finding.rule === 'ai-unlock'));
});

test('html format checks the visible copy, not the markup', () => {
  const result = json(check({ text: '<html><head><title>Plan</title></head><body><h1>Plan launches</h1><p>Unlock growth.</p><a href="https://example.com">Start a plan</a></body></html>', format: 'html', channel: 'landing' }));
  assert.ok(result.findings.some(finding => finding.rule === 'ai-unlock'));
  assert.ok(!result.findings.some(finding => /<\/?p>/.test(finding.snippet)));
});

test('many findings are capped, marked truncated, and stay under the response limit', () => {
  const text = Array.from({ length: 1500 }, (_, index) => `Line ${index}: unlock seamless, game-changer growth. Click here.`).join('\n');
  const response = check({ text: text.slice(0, LIMITS.checkText) });
  const result = json(response);
  assert.equal(result.truncated, true);
  assert.equal(result.findings.length, LIMITS.checkFindings);
  assert.ok(result.blocking > LIMITS.checkFindings);
  assert.ok(Buffer.byteLength(JSON.stringify(response)) < LIMITS.response);
});

test('brief accepts caller context, keeps routing, and puts the check in the loop', () => {
  const task = 'Write a cold email to RevOps leads at mid-market SaaS companies';
  const plain = call('conquistador_brief', { task }).result.content[0].text;
  const context = 'Product: Ledgerline reconciles Stripe and HubSpot revenue nightly. Proof: 41 paying teams. Voice: plain, no hype.';
  const withContext = call('conquistador_brief', { task, context }).result.content[0].text;
  const commands = text => text.match(/^Commands: .*$/m)?.[0];
  assert.equal(commands(withContext), commands(plain));
  assert.match(withContext, /Caller context/);
  assert.ok(withContext.includes(context));
  assert.ok(!plain.includes('Caller context'));
  for (const text of [plain, withContext]) assert.match(text, /conquistador_check/);
  assert.equal(call('conquistador_brief', { task, context: { product: 'x' } }).error?.code, -32602);
  assert.equal(call('conquistador_brief', { task, context: 'a'.repeat(8001) }).result.isError, true);
});

test('the HTTP image copies every module the MCP server imports', () => {
  const dockerfile = readFileSync(new URL('../mcp/Dockerfile', import.meta.url), 'utf8');
  const copied = new Set(dockerfile.split('\n').filter(line => line.startsWith('COPY ')).flatMap(line => line.slice(5).trim().split(/\s+/).slice(0, -1)));
  const covered = file => copied.has(file) || [...copied].some(item => item.endsWith('/') ? file.startsWith(item) : file.startsWith(`${item}/`));
  for (const file of [...briefFiles, 'tools/mcp-http.mjs', 'tools/check/index.mjs', 'tools/check/rules.mjs', 'tools/check/channels.mjs', 'tools/check/extract.mjs', 'mcp/server.mjs']) {
    assert.ok(covered(file), `${file} is not copied into the image`);
  }
});

test('an email that asks for a reply with a direct question has a call to action', () => {
  const email = ask => `---\nsubject: Stripe and HubSpot totals\n---\nHi Dana,\n\nLedgerline compares the two every night.\n\n${ask}\n`;
  const rules = ask => json(check({ text: email(ask), channel: 'email' })).findings.map(finding => finding.rule);
  for (const ask of ['Would a 15-minute look at one month of your data be useful?', 'Open to a short call next week?', 'Worth a reply?', 'Is this worth a conversation?']) {
    assert.ok(!rules(ask).includes('cta-missing'), ask);
  }
  for (const ask of ['Why does this matter?', 'Who knew reconciliation could be this dull?', `Would ${'a very long and winding '.repeat(5)}conversation be useful?`]) {
    assert.ok(rules(ask).includes('cta-missing'), ask);
  }
});

// The command's own "Core:" list is the contract an agent sees; the brief must inline it.
const coreOf = name => {
  const text = readFileSync(new URL(`../skills/conquistador/commands/${name}/COMMAND.md`, import.meta.url), 'utf8');
  const lines = text.split(/^Core:\s*$/m)[1]?.split('\n') ?? [];
  const end = lines.findIndex(line => line.trim() && !line.startsWith('- '));
  const block = lines.slice(0, end < 0 ? undefined : end).join('\n');
  const paths = [...block.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)].map(match => `skills/conquistador/commands/${name}/${match[1]}`);
  assert.ok(paths.length > 0, `${name} has a core list`);
  return paths;
};

test('a brief inlines every core file of the selected command', () => {
  const core = coreOf('outreach');
  assert.equal(core.length, 5);
  const brief = createBrief('Write a 3-email cold sequence to RevOps leads at B2B SaaS companies', { force: true, playbooks: [] });
  const must = brief.must.map(item => item.path);
  for (const path of core) assert.ok(must.includes(path), path);
  const pack = formatBriefPack(brief);
  for (const path of core) assert.ok(pack.includes(`File: ${path}`), `inlined ${path}`);
});

test('every command with a core list gets it in its brief, within the pack budget', () => {
  for (const name of ['position', 'convert', 'seo', 'social', 'pricing', 'campaign', 'ads', 'copy']) {
    const brief = createBrief(`/conquistador ${name} for a B2B analytics product`, { force: true, playbooks: [] });
    assert.equal(brief.methods[0]?.name, name);
    const must = brief.must.map(item => item.path);
    for (const path of coreOf(name)) assert.ok(must.includes(path), `${name}: ${path}`);
    assert.ok(Buffer.byteLength(formatBriefPack(brief)) <= BRIEF_LIMITS.packBytes);
  }
  const results = createBrief('/conquistador results for last month\'s Meta campaign', { force: true, playbooks: [] });
  assert.equal(results.action, 'brief');
});

test('a named platform guide still joins the brief next to the core files', () => {
  const brief = createBrief('Write a LinkedIn post announcing our analytics launch', { force: true, playbooks: [] });
  assert.ok(brief.must.some(item => item.path.endsWith('channels/linkedin.md')));
  for (const path of coreOf(brief.methods[0].name)) assert.ok(brief.must.some(item => item.path === path), path);
});

test('a natural-length action line in email counts, and the fix names the reply option', () => {
  const email = ask => `---\nsubject: Stripe and HubSpot totals\n---\nHi Dana,\n\nLedgerline compares the two every night.\n\n${ask}\n`;
  const rules = ask => json(check({ text: email(ask), channel: 'email' })).findings.map(finding => finding.rule);
  for (const ask of ['Reply with how your team checks the two today.', 'Reply "yes" and I\'ll send two times for a 20-minute walkthrough.']) {
    assert.ok(!rules(ask).includes('cta-missing'), ask);
  }
  const missing = json(check({ text: email('Thanks for reading.'), channel: 'email' })).findings.find(finding => finding.rule === 'cta-missing');
  assert.match(missing.fix, /reply/i);
});

test('check results are structured, with a declared output schema and a blocking count', () => {
  const tool = handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.find(item => item.name === 'conquistador_check');
  assert.equal(tool.outputSchema.type, 'object');
  for (const key of ['channel', 'clean', 'blocking', 'truncated', 'findings']) assert.ok(key in tool.outputSchema.properties, key);
  const response = check({ text: 'Unlock seamless growth.', channel: 'linkedin' });
  const structured = response.result.structuredContent;
  assert.deepEqual(structured, json(response));
  assert.equal(typeof structured.blocking, 'number');
  assert.ok(!('counted' in structured));
});

test('the brief says a clean check does not verify facts', () => {
  const text = call('conquistador_brief', { task: 'Write a cold email to RevOps leads' }).result.content[0].text;
  assert.match(text, /clean check does not verify facts/i);
});
