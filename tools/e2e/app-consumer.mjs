// Copied into a real installed app by app-integration.mjs. No source-relative imports.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
const checks = [];
const test = async (name, action) => {
  try { await action(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, detail: error.message.slice(0, 600) }); }
};
const context = 'Product: Ledgerline compares Stripe and HubSpot revenue each night and lists mismatches with their records. Buyer: RevOps leads at B2B SaaS companies. Proof: none. Voice: plain. Sender: Sam Lee, Ledgerline, 100 Example Street, Springfield.';
const task = 'Write the first cold email to RevOps leads at B2B SaaS companies.';
const draft = '---\nsubject: Stripe and HubSpot totals for last month\n---\nHi Dana,\n\nWhen Stripe and HubSpot disagree on last month\'s revenue, someone on RevOps usually rebuilds the numbers by hand.\n\nLedgerline compares the two every night and lists each mismatch with the records behind it.\n\nWould a 15-minute look at one month of your data be useful?\n\nLedgerline, 100 Example Street, Springfield. To opt out, reply "stop" and I will not email you again.\n';
const key = randomBytes(32).toString('hex');
const token = randomBytes(24).toString('hex');
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const toolCall = (name, args) => rpc('tools/call', { name, arguments: args });
let api, mcp, cq, brief, checked;
await test('the installed root and MCP imports load', async () => {
  api = await import('@forsvn/conquistador');
  mcp = await import('@forsvn/conquistador/mcp');
  assert.equal(typeof api.createConquistador, 'function');
  assert.equal(typeof mcp.createMcpRequestHandler, 'function');
  assert.equal(typeof mcp.createMcpFetchHandler, 'function');
  cq = api.createConquistador({ receiptKey: key });
});
if (cq) {
  await test('all eight tool definitions and agent instructions are available without a CLI', () => {
    assert.equal(cq.tools.length, 8);
    assert.match(cq.instructions, /conquistador_brief.*conquistador_check/);
    assert.ok(cq.tools.every(item => item.inputSchema.type === 'object'));
  });
  await test('tool definitions cannot mutate the shared engine', () => {
    try { cq.tools[0].name = 'broken'; } catch { /* An immutable descriptor is expected. */ }
    assert.equal(cq.tools[0].name, 'conquistador_brief');
    assert.equal(api.createConquistador().tools[0].name, 'conquistador_brief');
  });
  await test('a brief routes the task and carries only the supplied caller context', () => {
    brief = cq.callTool('conquistador_brief', { task, context });
    assert.equal(brief.isError, undefined);
    assert.equal(brief.structuredContent.command, 'outreach');
    assert.ok(brief.structuredContent.inlined.length > 3);
    assert.ok(brief.content[0].text.includes(context));
    assert.doesNotMatch(brief.content[0].text, /PRIVATE_|Project context:|\.conquistador\/playbooks/);
  });
  await test('compact briefs preserve required reads and a second caller has no first-caller context', () => {
    const second = cq.callTool('conquistador_brief', { task, context: 'Product: Cedar helps independent designers.', size: 'compact' });
    assert.ok(second.content[0].text.length < brief.content[0].text.length);
    assert.ok(second.structuredContent.readNow.length > 0);
    assert.doesNotMatch(second.content[0].text, /Ledgerline|PRIVATE_/);
  });
  await test('methods, files, search, and relative reads use the packaged library', () => {
    assert.ok(JSON.parse(cq.callTool('conquistador_methods').content[0].text).methods.length > 30);
    const files = JSON.parse(cq.callTool('conquistador_files', { method: 'outreach' }).content[0].text).files;
    assert.ok(files.length > 10);
    assert.match(cq.callTool('conquistador_read', { path: 'ctas.md', from: 'conquistador/commands/outreach/references/frameworks/structures.md' }).content[0].text, /Define the next decision/);
    const found = cq.callTool('conquistador_search', { query: 'revenue outreach cold email' });
    assert.doesNotMatch(found.content[0].text, /PRIVATE_|"source":"user"/);
  });
  await test('library reads reject escaping paths and do not execute scripts', () => {
    for (const path of ['../PRODUCT.md', '/etc/passwd', 'conquistador/../../package.json', 'file:///etc/passwd']) assert.equal(cq.callTool('conquistador_read', { path }).isError, true);
  });
  await test('invalid arguments and unknown tools have bounded caller errors', () => {
    assert.throws(() => cq.callTool('conquistador_send', {}), /Unknown|Invalid/i);
    assert.throws(() => cq.callTool('conquistador_brief', {}), /task/i);
    assert.throws(() => cq.callTool('conquistador_check', { text: 'x'.repeat(70_000) }), /limit|large|65536/i);
    assert.equal(cq.callTool('conquistador_brief', { task, context: 'x'.repeat(8001) }).isError, true);
  });
  await test('the check rejects weak writing and invented proof', () => {
    const weak = cq.callTool('conquistador_check', { text: 'Unlock seamless growth. Acme improved revenue by 40%, guaranteed.', channel: 'linkedin', context }).structuredContent;
    assert.equal(weak.clean, false);
    assert.ok(weak.findings.some(item => item.rule === 'claim-not-in-context'));
  });
  await test('the final draft gets a signed check receipt', () => {
    checked = cq.callTool('conquistador_check', { text: draft, channel: 'email', context }).structuredContent;
    assert.equal(checked.clean, true);
    assert.match(checked.receipt.signature, /^[a-f0-9]{64}$/);
  });
  await test('the host verifies the exact draft, context, and channel', () => {
    const result = cq.callTool('conquistador_verify', { text: draft, receipt: checked.receipt, context, channel: 'email' }).structuredContent;
    assert.deepEqual([result.valid, result.clean, result.signed], [true, true, true]);
  });
  await test('edited text, changed context, changed channel, and forged receipts are refused', () => {
    for (const changed of [
      { text: `${draft}P.S. Acme loves it.`, receipt: checked.receipt },
      { text: draft, receipt: checked.receipt, context: 'Another user context' },
      { text: draft, receipt: checked.receipt, channel: 'x' },
      { text: draft, receipt: { ...checked.receipt, blocking: 4 } },
    ]) assert.equal(cq.callTool('conquistador_verify', changed).structuredContent.valid, false);
    const other = api.createConquistador({ receiptKey: randomBytes(32).toString('hex') });
    assert.equal(other.callTool('conquistador_verify', { text: draft, receipt: checked.receipt }).structuredContent.valid, false);
  });
  await test('an unsigned check cannot become signed evidence', () => {
    const unsigned = api.createConquistador();
    const receipt = unsigned.callTool('conquistador_check', { text: draft, channel: 'email', context }).structuredContent.receipt;
    assert.equal(receipt.signature, null);
    assert.equal(unsigned.callTool('conquistador_verify', { text: draft, receipt }).structuredContent.signed, false);
    assert.equal(cq.callTool('conquistador_verify', { text: draft, receipt }).structuredContent.valid, false);
  });
  await test('the existing rubric gate enforces dimension floors', () => {
    const score = cq.callTool('conquistador_score', { rubric: 'conquistador/commands/outreach/references/copy-validation-rubric.md', variant: 'ready', scores: { 'Peer voice': 8, 'Signal connection': 7, 'CTA friction': 8, 'Recipient relevance': 7, Specificity: 5 } }).structuredContent;
    assert.equal(score.verdict, 'fail');
    assert.ok(score.failures.some(item => /Specificity/.test(item)));
  });
  const handler = mcp.createMcpRequestHandler({ token, receiptKey: key, allowedOrigins: ['https://app.example'] });
  const custom = mcp.createMcpRequestHandler({ receiptKey: key, authorize: request => request.headers['x-app-user'] === 'allowed' });
  const unavailable = mcp.createMcpRequestHandler();
  const denied = mcp.createMcpRequestHandler({ authorize: async () => { throw Error('PRIVATE_AUTH_CANARY'); } });
  const server = createServer((request, response) => {
    const path = request.url.split('?')[0];
    if (path.startsWith('/custom/')) { request.url = request.url.slice('/custom'.length); return custom(request, response); }
    if (path.startsWith('/unavailable/')) { request.url = request.url.slice('/unavailable'.length); return unavailable(request, response); }
    if (path.startsWith('/denied/')) { request.url = request.url.slice('/denied'.length); return denied(request, response); }
    if (path === '/mcp' || path === '/health') return handler(request, response);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ app: 'running' }));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (body = rpc('tools/list'), extra = {}) => fetch(`${base}${extra.path ?? '/mcp'}`, {
    method: extra.method ?? 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}`, ...extra.headers },
    ...(['GET', 'DELETE'].includes(extra.method) ? {} : { body: extra.raw ?? JSON.stringify(body) }),
  });
  try {
    await test('MCP mounts beside the app on the same port', async () => {
      assert.deepEqual(await (await fetch(`${base}/app`)).json(), { app: 'running' });
      assert.equal((await request()).status, 200);
      assert.equal((await fetch(`${base}/health`)).status, 200);
    });
    await test('MCP authentication fails closed without configuration or credentials', async () => {
      assert.equal((await request(undefined, { headers: { authorization: '' } })).status, 401);
      assert.equal((await request(undefined, { headers: { authorization: 'Bearer wrong' } })).status, 401);
      assert.equal((await request(undefined, { path: '/unavailable/mcp' })).status, 503);
    });
    await test('app-owned authentication can grant or deny a request without a shared token', async () => {
      assert.equal((await request(undefined, { path: '/custom/mcp', headers: { 'x-app-user': 'allowed' } })).status, 200);
      assert.equal((await request(undefined, { path: '/custom/mcp' })).status, 401);
      const refusal = await request(undefined, { path: '/denied/mcp' });
      assert.equal(refusal.status, 401);
      assert.doesNotMatch(await refusal.text(), /PRIVATE_AUTH_CANARY/);
    });
    await test('HTTP validates Origins and permits only an explicit browser origin', async () => {
      assert.equal((await request(undefined, { headers: { origin: 'https://evil.example' } })).status, 403);
      assert.equal((await request(undefined, { headers: { origin: 'null' } })).status, 403);
      assert.equal((await request(undefined, { headers: { origin: 'https://app.example' } })).status, 200);
      assert.equal((await request(undefined, { path: '/custom/mcp', headers: { origin: 'https://app.example', 'x-app-user': 'allowed' } })).status, 403);
    });
    await test('HTTP accepts initialize and initialized notification without leaking user state', async () => {
      const init = await request(rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'app-test', version: '1' } }));
      assert.equal((await init.json()).result.serverInfo.name, 'conquistador');
      const notification = await request({ jsonrpc: '2.0', method: 'notifications/initialized' });
      assert.equal(notification.status, 202);
      assert.equal(await notification.text(), '');
    });
    await test('HTTP refuses unsupported versions, bad JSON, batches, and oversized streamed input', async () => {
      assert.equal((await request(undefined, { headers: { 'mcp-protocol-version': 'invalid' } })).status, 400);
      assert.equal((await request(undefined, { raw: '{bad' })).status, 400);
      assert.equal((await request([rpc('tools/list')])).status, 400);
      assert.equal((await request(undefined, { raw: 'x'.repeat(70_000) })).status, 413);
      assert.equal((await request(undefined, { method: 'GET' })).status, 405);
    });
    await test('HTTP and direct tool calls share checks and receipt signatures', async () => {
      const response = await request(toolCall('conquistador_check', { text: draft, channel: 'email', context }));
      const result = (await response.json()).result.structuredContent;
      assert.deepEqual(result, checked);
      const read = await request(toolCall('conquistador_brief', { task, context }));
      assert.doesNotMatch(JSON.stringify(await read.json()), /PRIVATE_/);
    });
    await test('the official v1 MCP client completes tool discovery and a signed check', async () => {
      const { Client } = await import('mcp-client-v1/client/index.js');
      const { StreamableHTTPClientTransport } = await import('mcp-client-v1/client/streamableHttp.js');
      const client = new Client({ name: 'conquistador-app-v1', version: '1' });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
        assert.equal((await client.listTools()).tools.length, 8);
        const result = await client.callTool({ name: 'conquistador_check', arguments: { text: draft, channel: 'email', context } });
        assert.equal(result.structuredContent.receipt.signature, checked.receipt.signature);
      } finally { await client.close(); }
    });
    await test('the official current MCP client can use the advertised protocol', async () => {
      const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');
      const client = new Client({ name: 'conquistador-app-v2', version: '1' });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
        assert.equal((await client.listTools()).tools.length, 8);
        const result = await client.callTool({ name: 'conquistador_brief', arguments: { task, context, size: 'compact' } });
        assert.equal(result.structuredContent.command, 'outreach');
      } finally { await client.close(); }
    });
    await test('Fetch handlers provide the same tool engine with the app request type', async () => {
      const handle = mcp.createMcpFetchHandler({ token, receiptKey: key });
      const call = (body, headers = {}) => handle(new Request('https://app.example/mcp', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) }));
      const response = await call(toolCall('conquistador_check', { text: draft, channel: 'email', context }));
      assert.deepEqual((await response.json()).result.structuredContent, checked);
      assert.equal((await call(rpc('tools/list'), { origin: 'https://evil.example' })).status, 403);
      assert.equal((await call(rpc('tools/list'), { authorization: '' })).status, 401);
      assert.equal((await call(rpc('tools/list'), { 'mcp-protocol-version': 'invalid' })).status, 400);
      const missing = mcp.createMcpFetchHandler();
      assert.equal((await missing(new Request('https://app.example/mcp', { method: 'POST', body: '{}' }))).status, 503);
      const appAuth = mcp.createMcpFetchHandler({ authorize: req => req.headers.get('x-app-user') === 'allowed' });
      assert.equal((await appAuth(new Request('https://app.example/mcp', { method: 'POST', headers: { 'x-app-user': 'allowed' }, body: JSON.stringify(rpc('tools/list')) }))).status, 200);
      assert.equal((await appAuth(new Request('https://app.example/mcp', { method: 'POST', body: '{}' }))).status, 401);
    });
    await test('the mounted app still answers after clients close', async () => {
      assert.equal((await fetch(`${base}/app`)).status, 200);
    });
  } finally {
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
  await test('the packaged app example serves a direct check and MCP on one port', async () => {
    const { createAppServer } = await import('./server-example.mjs');
    const example = createAppServer({ token, receiptKey: key });
    await new Promise(done => example.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${example.address().port}`;
    try {
      assert.equal((await fetch(url)).status, 200);
      const check = await fetch(`${url}/api/check`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ text: draft, channel: 'email', context }) });
      assert.equal(check.status, 200);
      assert.deepEqual((await check.json()).structuredContent, checked);
      const listed = await fetch(`${url}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(rpc('tools/list')) });
      assert.equal((await listed.json()).result.tools.length, 8);
      assert.equal((await fetch(`${url}/api/check`, { method: 'POST', body: '{}' })).status, 401);
      // The sample must finish its error response before closing an oversized upload.
      const oversized = await fetch(`${url}/api/check`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: 'x'.repeat(70_000) });
      assert.equal(oversized.status, 413);
      assert.deepEqual(await oversized.json(), { error: 'Request too large.' });
      assert.equal((await fetch(url)).status, 200);
    } finally {
      example.closeAllConnections();
      await new Promise(done => example.close(done));
    }
  });
}
writeFileSync(process.argv[2], `${JSON.stringify({ runtime: process.versions, checks }, null, 2)}\n`);
if (checks.some(item => !item.passed)) process.exitCode = 1;
