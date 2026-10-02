#!/usr/bin/env node
// E2E: `conquistador review` with the real pinned Proof fork and the real Lavish CLI.
//   R1-R4   install Proof from the pinned commit into an isolated home, open a document, post a
//           comment through the bridge, and read it back with `review poll`.
//   R5-R8   a headless browser opens the review page, shows the channel preview and playbooks,
//           and clicks Approve as the test reviewer; the stamp hash matches the exact text.
//   R9-R11  an agent request cannot approve; `review sync` of an edit clears the stamp; end stops.
//   R12-R13 a kit template opens in Lavish with --no-open and its server answers.
//   node tools/e2e/review.mjs [OUT_DIR] [--home <dir>]
// --home reuses an earlier isolated home so the Proof install is not repeated. A browser comes
// from CHROME_PATH, Google Chrome, Chromium, or the Playwright cache; without one, R5-R8 report
// "not run". Writes OUT_DIR/report.json, report.md, and screenshots. Exit 1 when a check fails.
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from '../spawn.mjs';
import { LAVISH_PACKAGE, PROOF_COMMIT } from '../review.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const argv = process.argv.slice(2);
const homeIndex = argv.indexOf('--home');
const reuseHome = homeIndex >= 0 ? resolve(argv[homeIndex + 1]) : null;
const out = resolve(argv.find((arg, index) => !arg.startsWith('--') && index !== homeIndex + 1) ?? join(root, 'dist/e2e/review'));
const cli = join(root, 'runtime', 'bin', 'conquistador.js');
const sha = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const work = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-review-')));
const home = reuseHome ?? join(work, 'home');
const project = join(work, 'project');
mkdirSync(project, { recursive: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const env = { ...process.env, CONQUISTADOR_HOME: home };
const digest = text => createHash('sha256').update(text, 'utf8').digest('hex');

const checks = [];
const log = [];
const screenshots = [];
function check(id, name, ok, detail = '') {
  checks.push({ id, name, ok: Boolean(ok), detail: String(detail).slice(0, 600) });
  console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail && !ok ? `  ${String(detail).slice(0, 300)}` : ''}`);
}
function notRun(id, name, reason) {
  checks.push({ id, name, ok: null, detail: reason });
  console.log(`- ${id} ${name} (not run: ${reason})`);
}
function review(args, timeout = 900_000) {
  const result = spawnSync(process.execPath, [cli, 'review', ...args], { cwd: project, env, encoding: 'utf8', timeout });
  log.push(`$ conquistador review ${args.join(' ')}\n[exit ${result.status}]\n${result.stdout}${result.stderr}`);
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
const field = (text, name) => new RegExp(`^${name}: (.+)$`, 'm').exec(text)?.[1]?.trim() ?? '';
const sessionFile = file => {
  const folder = join(project, '.conquistador', 'review', 'sessions');
  return readdirSync(folder).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(folder, name), 'utf8'))).find(item => item.file === file);
};
const wait = ms => new Promise(next => setTimeout(next, ms));

// A minimal DevTools protocol client over Node's WebSocket.
function findBrowser() {
  const candidates = [process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
  const cache = process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright') : join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const folder of readdirSync(cache).filter(name => /^chromium(_headless_shell)?-\d+$/.test(name)).sort().reverse()) {
      for (const sub of readdirSync(join(cache, folder))) {
        candidates.push(join(cache, folder, sub, 'chrome-headless-shell'), join(cache, folder, sub, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'), join(cache, folder, sub, 'chrome'));
      }
    }
  }
  return candidates.find(path => path && existsSync(path)) ?? null;
}
async function launchBrowser(binary) {
  const profile = join(work, 'browser');
  mkdirSync(profile, { recursive: true });
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1000', 'about:blank'];
  const { file, args: fileArgs, options } = spawnCommand(binary, args);
  const child = spawn(file, fileArgs, { stdio: 'ignore', ...options });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100 && !existsSync(portFile); attempt += 1) {
    if (child.exitCode !== null) throw new Error(`the browser exited with ${child.exitCode}`);
    await wait(100);
  }
  if (!existsSync(portFile)) { child.kill(); throw new Error('the browser did not open a DevTools port'); }
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(target => target.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((open, fail) => { socket.onopen = open; socket.onerror = fail; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  };
  const send = (method, params = {}) => new Promise((done, fail) => {
    id += 1;
    pending.set(id, message => (message.error ? fail(new Error(message.error.message)) : done(message.result)));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, ms = 30_000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) { if (await evaluate(expression).catch(() => false)) return true; await wait(250); }
    return false;
  };
  const shot = async name => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, name), Buffer.from(data, 'base64'));
    screenshots.push(name);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  const go = async url => { await send('Page.navigate', { url }); await wait(500); };
  return { evaluate, until, shot, go, close: () => { socket.close(); child.kill(); } };
}

const markdown = `---
channel: linkedin
title: Launch post
author: Acme Invoices
headline: Invoicing for freelance designers
---

# Launch day

Freelance designers spend their Fridays chasing invoices. Today we ship automatic reminders that go out on the due date, so you can get back to design work. Reminders stop the moment a client pays, and every reminder uses your own words. Try it free.

## Playbooks applied

- write-social: hook-first opening
- channels/linkedin: fold at 210 characters
`;
const source = join(project, 'launch.md');
writeFileSync(source, markdown);
const file = realpathSync(source);

// R1-R4: Proof install, open, a bridge comment, and poll.
const opened = review([source, '--no-open']);
const installed = existsSync(join(home, 'proof', PROOF_COMMIT.slice(0, 12), '.conquistador-installed'));
check('R1', `Proof installs from the pinned commit ${PROOF_COMMIT.slice(0, 12)} into the isolated home`, installed, opened.stderr.slice(-400));
const url = field(opened.stdout, 'url');
check('R2', 'review opens the document and prints a loopback URL', opened.status === 0 && /^http:\/\/127\.0\.0\.1:\d+\/d\/\w+\?token=/.test(url), opened.stdout + opened.stderr);
const session = existsSync(join(project, '.conquistador', 'review', 'sessions')) ? sessionFile(file) : null;
let commentOk = false;
if (session) {
  const response = await fetch(`${session.baseUrl}/documents/${session.slug}/ops`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}`, 'x-proof-client-version': '0.30.0', 'x-proof-client-build': 'e2e', 'x-proof-client-protocol': '3' },
    body: JSON.stringify({ type: 'comment.add', by: 'human:E2E Reviewer', quote: 'Try it free', text: 'Name the trial length in the CTA.' }),
  });
  commentOk = response.ok;
  check('R3', 'a reviewer comment posts through the Proof bridge', commentOk, `${response.status} ${await response.text()}`.slice(0, 300));
} else check('R3', 'a reviewer comment posts through the Proof bridge', false, 'no review session file');
const polled = review(['poll', source, '--json']);
let pollJson = null;
try { pollJson = JSON.parse(polled.stdout); } catch { pollJson = null; }
const found = pollJson?.feedback?.find(item => item.type === 'comment' && item.text === 'Name the trial length in the CTA.');
check('R4', 'review poll returns the comment with its author and anchor', Boolean(found && found.by === 'human:E2E Reviewer' && found.quote === 'Try it free'), polled.stdout + polled.stderr);

// R5-R8: the review page in a real browser.
const binary = findBrowser();
let browser = null;
let browserError = '';
if (binary && session) {
  try { browser = await launchBrowser(binary); } catch (error) { browserError = error.message; }
}
let approvedSha = '';
if (!browser) {
  const reason = !binary ? 'no Chrome or Chromium found; set CHROME_PATH' : !session ? 'no review session' : `the browser did not start (${browserError})`;
  for (const [id, name] of [['R5a', 'the Proof editor shows the document text'], ['R5', 'the review page shows the LinkedIn channel preview'], ['R6', 'the Playbooks applied panel lists the final section'], ['R7', 'the reviewer approves in the browser'], ['R8', 'the stamp hash equals the SHA-256 of the exact document text']]) notRun(id, name, reason);
} else {
  // The test reviewer's display name, so Proof's first-visit name dialog does not cover the page.
  await browser.go(new URL('/', url).href);
  await browser.evaluate("localStorage.setItem('proof-share-viewer-name', 'E2E Reviewer'); true");
  await browser.go(url);
  const shown = await browser.until("(document.querySelector('#editor .ProseMirror')?.innerText ?? '').includes('Freelance designers')", 45_000);
  check('R5a', 'the Proof editor shows the document text', shown, await browser.evaluate("(document.querySelector('#editor')?.innerText ?? '').slice(0, 200) + ' | status: ' + (document.body.innerText.match(/Connect\\w*|Offline|Live/)?.[0] ?? '')").catch(error => error.message));
  const panel = await browser.until("document.querySelector('.cq-li-text') !== null");
  const preview = panel ? await browser.evaluate("document.querySelector('.cq-li-text').textContent") : '';
  check('R5', 'the review page shows the LinkedIn channel preview', panel && preview.startsWith('Launch day') && preview.endsWith('…'), preview);
  await browser.shot('1-proof-linkedin-preview.png');
  await browser.evaluate("document.querySelector('[data-tab=playbooks]').click()");
  const listed = await browser.until("document.querySelectorAll('.cq-playbooks li').length === 2");
  check('R6', 'the Playbooks applied panel lists the final section', listed, await browser.evaluate("document.querySelector('.cq-body').innerText").catch(() => ''));
  await browser.shot('2-proof-playbooks.png');
  await browser.evaluate("document.querySelector('[data-tab=approval]').click()");
  await browser.until("document.querySelector('.cq-input') !== null");
  // The test reviewer types a name and clicks Approve; the confirm dialog is accepted.
  await browser.evaluate("window.confirm = () => true; const input = document.querySelector('.cq-input'); input.value = 'E2E Reviewer'; [...document.querySelectorAll('.cq-button')].find(b => b.textContent.startsWith('Approve')).click(); true");
  const approved = await browser.until("document.querySelector('.cq-badge')?.textContent === 'Approved'");
  await browser.shot('3-proof-approved.png');
  const afterApprove = JSON.parse(review(['poll', source, '--json']).stdout || '{}');
  const exported = await (await fetch(`${session.baseUrl}/d/${session.slug}?token=${session.accessToken}`, { headers: { accept: 'text/markdown' } })).text();
  approvedSha = afterApprove.approval?.sha256 ?? '';
  check('R7', 'the reviewer approves in the browser; poll reports approver and time', approved && afterApprove.approval?.state === 'approved' && afterApprove.approval.approver === 'E2E Reviewer' && Boolean(afterApprove.approval.approved_at), JSON.stringify(afterApprove.approval));
  const approvedFile = afterApprove.approval?.approved_file;
  check('R8', 'the stamp hash equals the SHA-256 of the exact document text and of the approved copy',
    approvedSha === digest(exported) && approvedSha === afterApprove.approval.current_sha256 && approvedFile && digest(readFileSync(approvedFile, 'utf8')) === approvedSha,
    `stamp ${approvedSha} text ${digest(exported)}`);
}

// R9-R11: agent refusal, edit clears the stamp, end.
if (session) {
  const current = await (await fetch(`${session.baseUrl}/documents/${session.slug}/conquistador/review`, { headers: { authorization: `Bearer ${session.accessToken}` } })).json();
  const refused = await fetch(`${session.baseUrl}/documents/${session.slug}/conquistador/approval`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.ownerSecret}`, 'x-agent-id': 'conquistador' },
    body: JSON.stringify({ approver: 'Agent', sha256: current.sha256 }),
  });
  check('R9', 'an agent request with the owner token cannot approve', refused.status === 403, `${refused.status}`);
} else check('R9', 'an agent request with the owner token cannot approve', false, 'no session');
writeFileSync(source, markdown.replace('Try it free.', 'Start a free 14-day trial.'));
const synced = review(['sync', source]);
const afterSync = JSON.parse(review(['poll', source, '--json']).stdout || '{}');
if (approvedSha) {
  check('R10', 'review sync of an edit clears the approval stamp', synced.status === 0 && afterSync.approval?.state === 'cleared' && afterSync.approval.cleared_reason === 'document changed' && afterSync.approval.current_sha256 !== approvedSha, synced.stdout + synced.stderr + JSON.stringify(afterSync.approval));
  if (browser) {
    await browser.go(url);
    await browser.until("(document.querySelector('#editor .ProseMirror')?.innerText ?? '').includes('14-day trial')", 30_000);
    await browser.until("document.querySelector('.cq-panel') !== null");
    await browser.evaluate("document.querySelector('[data-tab=approval]').click()");
    await browser.until("document.querySelector('.cq-stamp.cq-warn') !== null", 10_000);
    await browser.shot('4-proof-approval-cleared.png');
  }
} else notRun('R10', 'review sync of an edit clears the approval stamp', 'no approval was stamped (R7 did not run)');
check('R10a', 'review sync sends the edit to Proof', synced.status === 0 && afterSync.proof_text?.changed === false, synced.stdout + synced.stderr);
const baseUrl = session?.baseUrl;
const ended = review(['end', source]);
let stopped = false;
for (let attempt = 0; attempt < 20 && baseUrl; attempt += 1) {
  try { await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(500) }); await wait(250); } catch { stopped = true; break; }
}
check('R11', 'review end removes the session and stops the Proof server', ended.status === 0 && stopped && !existsSync(join(project, '.conquistador', 'review', 'proof', 'server.json')), ended.stdout + ended.stderr);

// R12-R13: a kit template in Lavish.
const kitTarget = join(project, 'review', 'social-posts.html');
const copied = review(['kit', 'social-posts', kitTarget]);
const lavish = review([kitTarget, '--no-open'], 300_000);
const lavishServer = field(lavish.stdout, 'server');
const lavishUrl = /url: "?(http:\/\/127\.0\.0\.1:\d+\/session\/[\w-]+)/.exec(lavish.stdout)?.[1] ?? '';
let answered = 0;
try { answered = (await fetch(lavishUrl || lavishServer, { signal: AbortSignal.timeout(5000) })).status; } catch (error) { answered = error.message; }
check('R12', `a kit template opens in ${LAVISH_PACKAGE} with --no-open`, copied.status === 0 && lavish.status === 0 && Boolean(lavishUrl), lavish.stdout + lavish.stderr);
check('R13', 'the Lavish server answers on its own loopback port', answered === 200, `${lavishUrl || lavishServer}: ${answered}`);
if (browser && lavishUrl) {
  await browser.go(lavishUrl);
  await wait(4000);
  await browser.shot('5-lavish-social-posts.png');
}
const lavishEnd = review(['end', kitTarget]);
log.push(`lavish end exit ${lavishEnd.status}`);
browser?.close();

const skipped = checks.filter(item => item.ok === null).length;
const report = {
  schema: 'conquistador.e2e.review/v1', at: new Date().toISOString(), sha, node: process.version, platform: `${process.platform}-${process.arch}`,
  proof: { repository: 'https://github.com/forsvn-labs/proof', commit: PROOF_COMMIT }, lavish: LAVISH_PACKAGE, browser: binary, home, work,
  checks, screenshots, ok: checks.every(item => item.ok !== false) && checks.some(item => item.ok),
};
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'commands.log'), log.join('\n'));
writeFileSync(join(out, 'report.md'), [
  `# Review E2E`, '', `- Commit: ${sha}`, `- Proof: ${PROOF_COMMIT}`, `- Lavish: ${LAVISH_PACKAGE}`, `- Node: ${process.version} on ${report.platform}`, `- Result: ${report.ok ? 'PASS' : 'FAIL'}`, '',
  '| ID | Check | Result |', '|---|---|---|',
  ...checks.map(item => `| ${item.id} | ${item.name} | ${item.ok === null ? `not run: ${item.detail}` : item.ok ? 'pass' : 'FAIL'} |`), '',
  ...screenshots.map(name => `![${name}](${name})`), '',
].join('\n'));
rmSync(work, { recursive: true, force: true });
console.log(`\n${report.ok ? 'PASS' : 'FAIL'} ${checks.filter(item => item.ok).length}/${checks.length - skipped}${skipped ? ` (${skipped} not run)` : ''}: ${join(out, 'report.json')}`);
process.exit(report.ok ? 0 : 1);
