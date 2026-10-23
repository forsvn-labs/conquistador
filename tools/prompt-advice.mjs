// One advisory event owner for native plugins and explicitly configured project hooks.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { unreadFiles } from './read-evidence.mjs';
import { createBrief, formatReadingList, knowledgeFileEvidence } from './brief.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

const ttl = 12 * 60 * 60 * 1000;

export function hooksEnabled(env = process.env) {
  if (['0', 'off', 'false', 'no', 'disabled'].includes(String(env.CONQUISTADOR_HOOKS ?? '').toLowerCase())) return false;

  try { return JSON.parse(readFileSync(join(env.CONQUISTADOR_HOME || join(homedir(), '.conquistador'), 'config.json'), 'utf8')).hooks !== false; }
  catch { return true; }
}

function statePath(input) {
  const id = input.session_id ?? input.conversation_id ?? input.sessionId;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the host session identifier before deriving a state path.
  if (typeof id !== 'string' || !id) return null;
  const scope = resolve(input.cwd ?? process.cwd());

  return join(process.env.CONQUISTADOR_STATE || join(tmpdir(), 'conquistador-hooks'), 'advice', digest(scope + '\0' + id) + '.json');
}

function readState(input) {
  try {
    const path = statePath(input);

    if (!path || statSync(path).size > 32768) return null;
    const value = JSON.parse(readFileSync(path, 'utf8'));

    return Date.now() - value.createdAt < ttl ? value : null;
  } catch { return null; }
}

function save(input, value) {
  const path = statePath(input);

  if (!path) return;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
}

function boundary(input) {
  try {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the optional host transcript path before filesystem access.
    if (typeof input.transcript_path !== 'string' || statSync(input.transcript_path).size > 32 * 1024 * 1024) return null;
    const bytes = readFileSync(input.transcript_path);

    return { path: resolve(input.transcript_path), size: bytes.length, digest: digest(bytes) };
  } catch { return null; }
}

export function activeMarketingTask(input) {
  if (!hooksEnabled()) return false;
  const state = readState(input);

  return state?.active === true && ['copy', 'social', 'outreach', 'article', 'ads', 'video', 'vietnamese'].includes(state.command);
}

export function promptAdvice(input, { root, projectOptIn = false } = {}) {
  if (!hooksEnabled()) return '';
  const prompt = input.prompt ?? input.user_prompt ?? input.text;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the host prompt at the event boundary.
  if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) > 32000) {
    const path = statePath(input);

    if (path) rmSync(path, { force: true });

    return '';
  }

  const previous = readState(input);
  const brief = createBrief(prompt, { root, automatic: !projectOptIn, cwd: input.cwd ?? process.cwd() });

  if (brief.action !== 'brief') {
    const path = statePath(input);

    if (path) rmSync(path, { force: true });

    return '';
  }

  const now = boundary(input);
  const context = formatReadingList(brief);
  const resources = [...brief.methods, ...brief.must].map(item => ({ ...knowledgeFileEvidence(item), path: item.path, absolute: item.absolute }));
  const signature = digest(JSON.stringify([brief.mode, brief.methods.map(item => item.name), resources.map(item => item.sha256)]));
  const promptDigest = digest(prompt);

  const duplicate = now && previous?.boundary && previous.promptDigest === promptDigest && previous.signature === signature
    && JSON.stringify(previous.boundary) === JSON.stringify(now);

  let reused = false;

  if (!duplicate && previous?.signature === signature && previous.boundary && now?.path === previous.boundary.path && now.size >= previous.boundary.size) {
    const transcript = readFileSync(now.path);

    if (digest(transcript.subarray(0, previous.boundary.size)) === previous.boundary.digest) {
      reused = resources.length > 0 && unreadFiles({ must: resources }, transcript.subarray(previous.boundary.size).toString('utf8')).length === 0;
    }
  }

  save(input, { createdAt: Date.now(), active: brief.action === 'brief', command: brief.methods[0]?.name, signature, promptDigest, boundary: reused ? previous.boundary : now });

  return duplicate || reused ? '' : context;
}
