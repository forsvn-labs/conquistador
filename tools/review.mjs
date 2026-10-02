// `conquistador review`: human review of a deliverable. Markdown opens in the FORSVN Proof fork
// (comments, suggestions, channel previews, approval stamp). HTML opens in Lavish.
// Proof installs from a pinned Git commit into ~/.conquistador/proof/ and runs on 127.0.0.1.
// Per-project state lives in .conquistador/review/. An approval stamp is the human decision for
// one exact document hash; it never approves a send, publication, or spend.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from './spawn.mjs';

export const PROOF_REPOSITORY = 'https://github.com/forsvn-labs/proof.git';
export const PROOF_COMMIT = '7e2a457d78ac81eacf94156c810740894e951ab9';
// SHA-256 of the unmodified upstream MIT LICENSE (Every, 2026).
const PROOF_LICENSE_SHA256 = '4648b2d84d492d891c68c4ff906ffd600438b7c7cd2ade0f904abbb404657829';
export const LAVISH_PACKAGE = 'lavish-axi@0.1.80';
const CHECK_AUTHOR = 'ai:conquistador-check';
const AGENT = 'ai:conquistador';
const CLIENT_HEADERS = { 'x-proof-client-version': '0.30.0', 'x-proof-client-build': `conquistador-${PROOF_COMMIT.slice(0, 12)}`, 'x-proof-client-protocol': '3' };
const root = fileURLToPath(new URL('../', import.meta.url));
export const KIT_DIR = join(root, 'kit');

const USAGE = `Usage:
  conquistador review <file.md|file.html> [--no-open]   Open a deliverable for human review
  conquistador review poll <file> [--json] [--wait <seconds>]   New comments, suggestions, and approval
  conquistador review sync <file> [--force]   Send the revised source to the review
  conquistador review end <file>   End the review
  conquistador review kit [<template> <destination.html>]   List or copy an artifact kit template
`;

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const home = () => process.env.CONQUISTADOR_HOME || join(homedir(), '.conquistador');
const out = lines => process.stdout.write(lines.filter(line => line !== null && line !== undefined).join('\n') + '\n');
const quote = text => JSON.stringify(String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 240));

function kindOf(file) {
  const extension = extname(file).toLowerCase();
  if (['.md', '.markdown'].includes(extension)) return 'proof';
  if (['.html', '.htm'].includes(extension)) return 'lavish';
  throw new Error(`Review supports Markdown (.md) and HTML (.html), not ${extension || 'a file without an extension'}.`);
}

// State: .conquistador/review/ in the current project. Session files hold document tokens (mode 0600).
function stateDir(project) { return join(project, '.conquistador', 'review'); }
function sessionKey(file) { return sha256(file).slice(0, 16); }
function sessionPath(project, file) { return join(stateDir(project), 'sessions', `${sessionKey(file)}.json`); }
function readJson(path) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } }
function writePrivate(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* Windows keeps default ACLs. */ }
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function run(command, args, options = {}) {
  const { file, args: fileArgs, options: extra } = spawnCommand(command, args, options.env ?? process.env);
  return spawnSync(file, fileArgs, { encoding: 'utf8', ...options, ...extra });
}
function runChecked(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim().slice(-4000);
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return String(result.stdout ?? '').trim();
}

// The locked Proof toolchain needs Node 22.20+, 24.12+, or 26+.
function nodeIsSupported(version = process.versions.node) {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  return (major === 22 && minor >= 20) || (major === 24 && minor >= 12) || major >= 26;
}

export function proofDir() { return join(home(), 'proof', PROOF_COMMIT.slice(0, 12)); }

// Installs the fork from the pinned commit: shallow fetch, verify, npm ci, build, remove Vite.
export function installProof({ log = process.stderr } = {}) {
  const dir = proofDir();
  const marker = join(dir, '.conquistador-installed');
  if (readJson(marker)?.commit === PROOF_COMMIT && existsSync(join(dir, 'dist', 'index.html'))) return dir;
  if (!nodeIsSupported()) throw new Error(`Proof needs Node 22.20+, 24.12+, or 26+. This is Node ${process.versions.node}.`);
  mkdirSync(dir, { recursive: true });
  const quiet = { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] };
  if (!existsSync(join(dir, '.git'))) {
    if (readdirSync(dir).length > 0) throw new Error(`${dir} is not empty and is not a Proof checkout. Remove it, then try again.`);
    log.write(`Installing Proof ${PROOF_COMMIT.slice(0, 12)} into ${dir}\n`);
    runChecked('git', ['init', '-q'], quiet);
    runChecked('git', ['remote', 'add', 'origin', PROOF_REPOSITORY], quiet);
    runChecked('git', ['fetch', '-q', '--depth=1', 'origin', PROOF_COMMIT], quiet);
    runChecked('git', ['checkout', '-q', '--detach', 'FETCH_HEAD'], quiet);
  }
  const head = runChecked('git', ['rev-parse', 'HEAD'], quiet);
  if (head !== PROOF_COMMIT) throw new Error(`${dir} is at ${head}, not the pinned ${PROOF_COMMIT}. Remove it, then try again.`);
  if (sha256(readFileSync(join(dir, 'LICENSE'), 'utf8')) !== PROOF_LICENSE_SHA256) throw new Error('The Proof checkout LICENSE is not the upstream MIT license.');
  if (runChecked('git', ['status', '--porcelain', '--untracked-files=no'], quiet)) throw new Error(`${dir} has local changes. Remove it, then try again.`);
  log.write('Installing Proof dependencies (npm ci). This takes a few minutes the first time.\n');
  runChecked('npm', ['ci', '--no-audit', '--no-fund'], { ...quiet, timeout: 900_000 });
  runChecked('npm', ['run', 'build'], { ...quiet, timeout: 600_000 });
  // The build-only Vite development server must not stay in the installed runtime.
  rmSync(join(dir, 'node_modules', 'vite'), { recursive: true, force: true });
  if (!existsSync(join(dir, 'dist', 'index.html'))) throw new Error('The Proof editor build did not produce dist/index.html.');
  writeFileSync(marker, JSON.stringify({ commit: PROOF_COMMIT, installedAt: new Date().toISOString() }) + '\n');
  return dir;
}

async function proofHealthy(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1500) });
    const body = await response.json();
    return response.ok && body?.ok === true && body?.buildInfo?.sha === PROOF_COMMIT;
  } catch { return false; }
}

// One Proof server per project, detached, on a free loopback port. Only local settings pass in.
// Proof serves collaboration on /ws of the same port.
async function ensureServer(project) {
  const folder = join(stateDir(project), 'proof');
  const recordPath = join(folder, 'server.json');
  const record = readJson(recordPath);
  if (record && await proofHealthy(record.baseUrl)) return record;
  const dir = installProof();
  mkdirSync(join(folder, 'snapshots'), { recursive: true });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const pass = ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'TMPDIR', 'TEMP', 'TMP', 'LANG'];
  const env = Object.fromEntries(pass.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  Object.assign(env, {
    NODE_ENV: 'production', PORT: String(port), COLLAB_HOST: '127.0.0.1',
    COLLAB_PUBLIC_BASE_URL: `ws://127.0.0.1:${port}/ws`, DATABASE_PATH: join(folder, 'proof.db'),
    SNAPSHOT_DIR: join(folder, 'snapshots'), PROOF_BUILD_SHA: PROOF_COMMIT, PROOF_ENV: 'local', PROOF_PUBLIC_ORIGIN: baseUrl,
    PROOF_CORS_ALLOW_ORIGINS: baseUrl, PROOF_SHARE_MARKDOWN_AUTH_MODE: 'none', PROOF_LEGACY_CREATE_MODE: 'allow',
    COLLAB_PROJECTION_REPAIR_WORKER_ENABLED: 'true', COLLAB_ON_DEMAND_PROJECTION_REPAIR_ENABLED: 'true',
    COLLAB_STARTUP_RECONCILE_ENABLED: 'true', COLLAB_PROJECTION_REPAIR_WORKER_INTERVAL_MS: '500', COLLAB_PROJECTION_REPAIR_WORKER_MIN_CHARS: '0',
  });
  const logFile = join(folder, 'server.log');
  const logFd = openSync(logFile, 'a');
  const { file, args, options } = spawnCommand(process.execPath, ['--import', 'tsx', join(dir, 'server', 'index.ts')], env);
  const child = spawn(file, args, { cwd: dir, env, detached: true, stdio: ['ignore', logFd, logFd], windowsHide: true, ...options });
  child.unref();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await proofHealthy(baseUrl)) {
      const started = { pid: child.pid, baseUrl, port, commit: PROOF_COMMIT, startedAt: new Date().toISOString() };
      writePrivate(recordPath, started);
      return started;
    }
    if (child.exitCode !== null) break;
    await new Promise(wait => setTimeout(wait, 300));
  }
  try { process.kill(child.pid); } catch { /* Already stopped. */ }
  throw new Error(`Proof did not start. Read ${logFile}.`);
}

async function proof(baseUrl, method, path, { token, body, accept, idempotencyKey } = {}) {
  const headers = { ...CLIENT_HEADERS, 'x-agent-id': 'conquistador' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accept) headers.accept = accept;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const send = () => fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  let response;
  try { response = await send(); } catch (error) {
    // Proof closes idle keep-alive sockets; a request on a closed socket fails before it is sent.
    if (!['UND_ERR_SOCKET', 'ECONNRESET', 'EPIPE'].includes(error?.cause?.code)) throw error;
    response = await send();
  }
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { ok: response.ok, status: response.status, text, json };
}
async function proofJson(baseUrl, method, path, options) {
  const result = await proof(baseUrl, method, path, options);
  if (!result.ok) throw new Error(`Proof ${method} ${path} returned ${result.status}${result.json?.code ? ` ${result.json.code}` : ''}: ${result.json?.error ?? result.text.slice(0, 200)}`);
  return result.json;
}
// Proof refuses mutations while its text projection catches up after a write. Retry briefly.
async function mutate(baseUrl, path, options) {
  for (let attempt = 0; ; attempt += 1) {
    const result = await proof(baseUrl, 'POST', path, options);
    if (result.ok || attempt >= 20 || !['PROJECTION_STALE', 'COLLAB_SYNC_FAILED', 'REWRITE_BARRIER_FAILED'].includes(result.json?.code)) return result;
    await new Promise(wait => setTimeout(wait, 500));
  }
}

function frontMatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  const data = {};
  for (const line of match ? match[1].split(/\r?\n/) : []) {
    const pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (pair) data[pair[1].toLowerCase()] = pair[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return data;
}

// Proof rewrites list markers and spacing on its first mutation; compare texts without those.
export function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').split('\n').map(line => line.replace(/^(\s*)[-*+](\s+)/, '$1*$2').replace(/\s+$/, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// `conquistador check --json <file>`: exit 0 clean, 2 findings, 1 scan failure (D5).
function runCheck(file) {
  const cli = join(root, 'runtime', 'bin', 'conquistador.js');
  const result = spawnSync(process.execPath, [cli, 'check', '--json', file], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, CONQUISTADOR_CHECK_HOOK: '0' } });
  if (![0, 2].includes(result.status)) return null;
  try { return parseFindings(JSON.parse(result.stdout)); } catch { return null; }
}
export function parseFindings(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.findings) ? json.findings
    : Array.isArray(json?.files) ? json.files.flatMap(entry => entry.findings ?? []) : [];
  return list.filter(item => item && typeof item === 'object').map(item => ({
    rule: String(item.rule ?? item.ruleId ?? item.id ?? item.antipattern ?? item.family ?? 'check'),
    message: String(item.message ?? item.description ?? item.title ?? ''),
    severity: item.severity ? String(item.severity) : '',
    line: Number.isInteger(item.line) ? item.line : Number.isInteger(item.location?.line) ? item.location.line : null,
    quote: String(item.quote ?? item.text ?? item.match ?? item.snippet ?? item.excerpt ?? item.evidence ?? '').trim(),
  }));
}

// Posts each new finding as a comment through the bridge. Idempotency keys make retries safe.
async function postFindings(session, sourceText) {
  const findings = runCheck(session.file);
  if (findings === null) return { available: false, posted: 0, unanchored: 0 };
  const lines = sourceText.split(/\r?\n/);
  session.findings ??= [];
  let posted = 0;
  let unanchored = 0;
  for (const finding of findings) {
    const candidates = [finding.quote, finding.line ? lines[finding.line - 1]?.replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)])\s+/, '').trim() : ''].filter(Boolean);
    const fingerprint = sha256(JSON.stringify([finding.rule, finding.message, candidates[0] ?? '', finding.line]));
    if (session.findings.includes(fingerprint)) continue;
    let done = false;
    for (const anchor of candidates) {
      const text = `[check: ${finding.rule}${finding.severity ? `, ${finding.severity}` : ''}] ${finding.message}`.trim();
      const result = await mutate(session.baseUrl, `/documents/${encodeURIComponent(session.slug)}/ops`, {
        token: session.accessToken, idempotencyKey: `cq-check-${fingerprint.slice(0, 32)}`,
        body: { type: 'comment.add', by: CHECK_AUTHOR, quote: anchor.slice(0, 500), text },
      });
      if (result.ok) { done = true; break; }
    }
    if (done) { posted += 1; session.findings.push(fingerprint); } else unanchored += 1;
  }
  return { available: true, posted, unanchored, total: findings.length };
}

async function readProof(session) {
  const path = `/documents/${encodeURIComponent(session.slug)}`;
  const [state, review] = await Promise.all([
    proofJson(session.baseUrl, 'GET', `${path}/state`, { token: session.accessToken }),
    proofJson(session.baseUrl, 'GET', `${path}/conquistador/review`, { token: session.accessToken }),
  ]);
  if (typeof review.markdown !== 'string') throw new Error('Proof did not return the document text.');
  // review.markdown is the text without comment and suggestion anchors; the approval hash covers it.
  return { marks: state.marks ?? {}, revision: Number.isInteger(state.revision) ? state.revision : 1, review, text: review.markdown };
}

// Reports new or changed marks since the last poll, in reading order.
export function markChanges(marks, seen) {
  const changes = [];
  const next = {};
  for (const [id, mark] of Object.entries(marks)) {
    if (!mark || mark.kind === 'authored') continue;
    const replies = Array.isArray(mark.thread) ? mark.thread : Array.isArray(mark.replies) ? mark.replies : [];
    const signature = JSON.stringify([mark.kind, mark.text, mark.content, mark.status, Boolean(mark.resolved), replies.length]);
    next[id] = signature;
    if (seen[id] === signature) continue;
    const previous = seen[id] ? JSON.parse(seen[id]) : null;
    if (mark.kind === 'comment') {
      if (!previous && mark.by !== CHECK_AUTHOR) changes.push({ type: 'comment', id, by: mark.by, quote: mark.quote, text: mark.text });
      for (const reply of replies.slice(previous ? previous[5] : 0)) changes.push({ type: 'reply', id, by: reply.by, text: reply.text });
      if (previous && previous[4] !== Boolean(mark.resolved)) changes.push({ type: mark.resolved ? 'resolved' : 'reopened', id, by: mark.by });
    } else if (['insert', 'delete', 'replace'].includes(mark.kind)) {
      changes.push({ type: 'suggestion', id, kind: mark.kind, by: mark.by, quote: mark.quote, content: mark.content ?? '', status: mark.status ?? 'pending' });
    } else if (!previous) {
      changes.push({ type: mark.kind, id, by: mark.by, quote: mark.quote, text: mark.text ?? '' });
    }
  }
  return { changes, seen: next };
}

function requireSession(project, file, kind) {
  const session = readJson(sessionPath(project, file));
  if (!session || session.kind !== kind) throw new Error(`No open review for ${file}. Run: conquistador review ${file}`);
  return session;
}

function openBrowser(url) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  try {
    const { file, args: fileArgs, options } = spawnCommand(command, args);
    spawn(file, fileArgs, { detached: true, stdio: 'ignore', ...options }).on('error', () => {}).unref();
  } catch { /* The URL is printed; the reviewer can open it. */ }
}

async function openProof(project, file, noOpen) {
  const source = readFileSync(file, 'utf8');
  const server = await ensureServer(project);
  let session = readJson(sessionPath(project, file));
  if (session?.kind === 'proof' && session.baseUrl === server.baseUrl
    && (await proof(server.baseUrl, 'GET', `/documents/${encodeURIComponent(session.slug)}/conquistador/review`, { token: session.accessToken })).ok) {
    out(['review: resumed', `file: ${file}`, `url: ${session.url}`, `next: conquistador review poll ${file}`]);
    if (!noOpen) openBrowser(session.url);
    return 0;
  }
  const created = await proofJson(server.baseUrl, 'POST', '/documents', {
    body: { markdown: source, title: frontMatter(source).title || basename(file, extname(file)), role: 'editor', ownerId: 'human:reviewer' },
  });
  const url = `${server.baseUrl}/d/${encodeURIComponent(created.slug)}?token=${encodeURIComponent(created.ownerSecret)}&format=html`;
  session = {
    kind: 'proof', file, slug: created.slug, baseUrl: server.baseUrl, url, ownerSecret: created.ownerSecret, accessToken: created.accessToken,
    syncedText: source, sourceSha256: sha256(source), seen: {}, findings: [], openedAt: new Date().toISOString(),
  };
  const check = await postFindings(session, source);
  // Findings are agent comments; the first poll reports only what the reviewer adds.
  session.seen = markChanges((await readProof(session)).marks, {}).seen;
  writePrivate(sessionPath(project, file), session);
  out([
    'review: opened', `file: ${file}`, `url: ${url}`,
    check.available ? `check: ${check.posted} finding(s) posted as comments${check.unanchored ? `, ${check.unanchored} without an anchor` : ''}` : 'check: not available',
    'help: The reviewer comments, suggests, previews the channel, and can stamp an approval in the Review panel.',
    `next: conquistador review poll ${file}`,
  ]);
  if (!noOpen) openBrowser(url);
  return 0;
}

async function pollProof(project, file, { json, wait }) {
  const path = sessionPath(project, file);
  const session = requireSession(project, file, 'proof');
  const deadline = Date.now() + wait * 1000;
  let current;
  let result;
  for (;;) {
    current = await readProof(session);
    result = markChanges(current.marks, session.seen ?? {});
    const approvalKey = JSON.stringify(current.review.approval);
    if (result.changes.length || approvalKey !== session.approvalKey || Date.now() >= deadline) {
      session.approvalKey = approvalKey;
      break;
    }
    await new Promise(next => setTimeout(next, 2000));
  }
  session.seen = result.seen;
  const source = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const proofSha256 = sha256(current.text);
  const changedInProof = normalizeText(current.text) !== normalizeText(session.syncedText ?? '');
  const base = join(dirname(path), sessionKey(file));
  if (changedInProof) writePrivate(`${base}.proof.md`, current.text);
  const approval = current.review.approval ?? { state: 'none' };
  const approved = approval.state === 'approved' && approval.sha256 === proofSha256;
  if (approved) writePrivate(`${base}.approved.md`, current.text);
  else rmSync(`${base}.approved.md`, { force: true });
  writePrivate(path, session);
  const report = {
    file, url: session.url, feedback: result.changes,
    proof_text: changedInProof ? { changed: true, path: `${base}.proof.md` } : { changed: false },
    approval: {
      state: approval.state, approver: approval.approver ?? null, approved_at: approval.approvedAt ?? null, sha256: approval.sha256 ?? null,
      cleared_reason: approval.clearedReason ?? null, current_sha256: proofSha256,
      matches_source: approved ? approval.sha256 === sha256(source) : false, approved_file: approved ? `${base}.approved.md` : null,
    },
    open_check_findings: current.review.openCheckFindings ?? 0,
  };
  if (json) { process.stdout.write(JSON.stringify(report, null, 2) + '\n'); return 0; }
  const describe = change => {
    if (change.type === 'comment') return `  - comment ${change.id.slice(0, 8)} by ${change.by} on ${quote(change.quote)}: ${quote(change.text)}`;
    if (change.type === 'reply') return `  - reply on ${change.id.slice(0, 8)} by ${change.by}: ${quote(change.text)}`;
    if (change.type === 'suggestion') return `  - suggestion ${change.id.slice(0, 8)} ${change.kind} ${quote(change.quote)}${change.kind === 'delete' ? '' : ` -> ${quote(change.content)}`} (${change.status}) by ${change.by}`;
    return `  - ${change.type} ${change.id.slice(0, 8)} by ${change.by ?? 'reviewer'}`;
  };
  out([
    `file: ${file}`,
    `feedback[${result.changes.length}]:${result.changes.length ? '' : ' none yet'}`, ...result.changes.map(describe),
    changedInProof ? `proof_text: changed in Proof; read ${base}.proof.md and merge it into the source before sync` : 'proof_text: unchanged',
    approval.state === 'approved'
      ? `approval: approved by ${approval.approver} at ${approval.approvedAt}; sha256 ${approval.sha256}; matches_source ${report.approval.matches_source}; approved_file ${report.approval.approved_file}`
      : approval.state === 'cleared' ? `approval: cleared (${approval.clearedReason}); it covered sha256 ${approval.sha256}` : 'approval: none',
    report.open_check_findings ? `open_check_findings: ${report.open_check_findings}` : null,
    'next: Treat each item as a revision request. Revise the source, then run conquistador review sync. An approval covers only that exact text; ask before each send, publish, or spend.',
  ]);
  return 0;
}

async function syncProof(project, file, force) {
  const session = requireSession(project, file, 'proof');
  const source = readFileSync(file, 'utf8');
  const current = await readProof(session);
  if (!force && normalizeText(current.text) !== normalizeText(session.syncedText ?? '')) {
    const proofCopy = join(stateDir(project), 'sessions', `${sessionKey(file)}.proof.md`);
    writePrivate(proofCopy, current.text);
    process.stderr.write(`The text changed in Proof since the last sync. Merge ${proofCopy} into ${file}, then run: conquistador review sync ${file} --force\n`);
    return 1;
  }
  if (normalizeText(current.text) === normalizeText(source)) {
    out(['review: unchanged', `file: ${file}`, `sha256: ${sha256(current.text)}`]);
    return 0;
  }
  const rewrite = baseRevision => mutate(session.baseUrl, `/documents/${encodeURIComponent(session.slug)}/ops`, {
    token: session.accessToken, idempotencyKey: `cq-sync-${sha256(`${session.slug}:${baseRevision}:${source}`).slice(0, 32)}`,
    body: { type: 'rewrite.apply', by: AGENT, content: source, baseRevision, force: true },
  });
  let result = await rewrite(current.revision);
  // A concurrent browser edit moves the revision; retry once from the latest revision.
  if (!result.ok && Number.isInteger(result.json?.latestRevision) && result.json.latestRevision !== current.revision) result = await rewrite(result.json.latestRevision);
  if (!result.ok) throw new Error(`Proof refused the revision (${result.status} ${result.json?.code ?? ''}): ${result.json?.error ?? result.text.slice(0, 200)}`);
  session.syncedText = source;
  session.sourceSha256 = sha256(source);
  const check = await postFindings(session, source);
  const after = await readProof(session);
  writePrivate(sessionPath(project, file), session);
  out([
    'review: synced', `file: ${file}`, `sha256: ${sha256(after.text)}`,
    `approval: ${after.review.approval?.state ?? 'none'}`,
    check.available ? `check: ${check.posted} new finding(s) posted` : 'check: not available',
    `next: conquistador review poll ${file}`,
  ]);
  return 0;
}

async function endProof(project, file) {
  const session = requireSession(project, file, 'proof');
  const base = join(stateDir(project), 'sessions', sessionKey(file));
  for (const suffix of ['.json', '.proof.md', '.approved.md']) rmSync(base + suffix, { force: true });
  const remaining = readdirSync(join(stateDir(project), 'sessions')).filter(name => name.endsWith('.json'))
    .map(name => readJson(join(stateDir(project), 'sessions', name))).filter(item => item?.kind === 'proof');
  let stopped = false;
  const recordPath = join(stateDir(project), 'proof', 'server.json');
  const record = readJson(recordPath);
  if (!remaining.length && record?.pid) {
    try { process.kill(record.pid); stopped = true; } catch { stopped = false; }
    rmSync(recordPath, { force: true });
  }
  out(['review: ended', `file: ${file}`, `document: ${session.slug} stays in ${join(stateDir(project), 'proof')}`, `server: ${stopped ? 'stopped' : remaining.length ? 'still serving other reviews' : 'not running'}`]);
  return 0;
}

// Lavish: one pinned version, telemetry off, a separate state directory and free port per session.
function lavishCommand(args) {
  const bun = run('bun', ['--version']);
  if (!bun.error && bun.status === 0) return ['bunx', [LAVISH_PACKAGE, ...args]];
  return ['npm', ['exec', '--yes', '--ignore-scripts', `--package=${LAVISH_PACKAGE}`, '--', 'lavish-axi', ...args]];
}
function runLavish(session, args, { inherit = false } = {}) {
  // Lavish also binds a Tailscale address when Tailscale runs; an explicit host keeps it on loopback.
  const env = { ...process.env, LAVISH_AXI_TELEMETRY: '0', LAVISH_AXI_HOST: '127.0.0.1', LAVISH_AXI_STATE_DIR: session.stateDir, LAVISH_AXI_PORT: String(session.port) };
  const [command, commandArgs] = lavishCommand(args);
  // A tool directory outside the project keeps a project executable from shadowing the pinned CLI.
  const cwd = join(home(), 'lavish');
  mkdirSync(cwd, { recursive: true });
  const result = run(command, commandArgs, { env, cwd, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], timeout: inherit ? undefined : 180_000 });
  if (result.error) throw result.error;
  if (!inherit) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return result.status ?? 1;
}

async function openLavish(project, file, noOpen) {
  const path = sessionPath(project, file);
  const session = readJson(path)?.kind === 'lavish' ? readJson(path)
    : { kind: 'lavish', file, stateDir: join(stateDir(project), 'lavish', sessionKey(file)), port: await freePort(), openedAt: new Date().toISOString() };
  mkdirSync(session.stateDir, { recursive: true });
  writePrivate(path, session);
  out([`review: lavish ${LAVISH_PACKAGE}`, `file: ${file}`, `server: http://127.0.0.1:${session.port}`]);
  return runLavish(session, [file, ...(noOpen ? ['--no-open'] : [])]);
}

function kit(args) {
  const templates = existsSync(KIT_DIR) ? readdirSync(KIT_DIR).filter(name => name.endsWith('.html')).sort() : [];
  if (!args.length) {
    out([`kit: ${KIT_DIR}`, `templates[${templates.length}]:`, ...templates.map(name => `  - ${name.replace(/\.html$/, '')}`),
      'next: conquistador review kit <template> <destination.html>, fill it with the deliverable and brand values, then conquistador review <destination.html>']);
    return 0;
  }
  const name = args[0].replace(/\.html$/, '');
  if (!templates.includes(`${name}.html`) || !args[1]) { process.stderr.write(`Choose a template (${templates.map(item => item.replace(/\.html$/, '')).join(', ')}) and a destination.\n`); return 2; }
  const destination = resolve(args[1]);
  if (existsSync(destination)) { process.stderr.write(`${destination} exists. Choose another destination.\n`); return 1; }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(KIT_DIR, `${name}.html`), destination);
  out([`kit: copied ${name}`, `file: ${destination}`, `next: conquistador review ${destination}`]);
  return 0;
}

export async function runReview(args, project = process.cwd()) {
  const flags = new Set(args.filter(arg => arg.startsWith('--')));
  const positional = [];
  let wait = 0;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--wait') { wait = Number(args[index + 1]); index += 1; } else if (args[index].startsWith('--wait=')) wait = Number(args[index].slice(7));
    else if (!args[index].startsWith('--')) positional.push(args[index]);
  }
  if (flags.has('--help') || flags.has('-h') || !positional.length) { process.stdout.write(USAGE); return positional.length || flags.has('--help') ? 0 : 2; }
  const known = new Set(['--no-open', '--json', '--force', '--wait']);
  const unknown = [...flags].filter(flag => !known.has(flag.split('=')[0]));
  if (unknown.length || !Number.isFinite(wait) || wait < 0) { process.stderr.write(`Unknown or invalid option: ${unknown.join(' ') || '--wait'}\n${USAGE}`); return 2; }
  try {
    const [first, target] = positional;
    if (first === 'kit') return kit(positional.slice(1));
    const action = ['poll', 'sync', 'end'].includes(first) && target ? first : 'open';
    const given = action === 'open' ? first : target;
    if (!existsSync(given)) throw new Error(`${given} does not exist.`);
    const file = realpathSync(resolve(given));
    const kind = kindOf(file);
    project = resolve(project);
    if (kind === 'lavish') {
      if (action === 'open') return await openLavish(project, file, flags.has('--no-open'));
      const session = requireSession(project, file, 'lavish');
      // Lavish polls by long-poll and applies edits from the file it watches, so sync has nothing to send.
      if (action === 'sync') { out(['review: synced', `file: ${file}`, 'help: Lavish reloads the file when it changes.']); return 0; }
      if (action === 'poll') return runLavish(session, ['poll', file], { inherit: true });
      const status = runLavish(session, ['end', file]);
      runLavish(session, ['stop']);
      rmSync(sessionPath(project, file), { force: true });
      return status;
    }
    if (action === 'open') return await openProof(project, file, flags.has('--no-open'));
    if (action === 'poll') return await pollProof(project, file, { json: flags.has('--json'), wait });
    if (action === 'sync') return await syncProof(project, file, flags.has('--force'));
    return await endProof(project, file);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}
