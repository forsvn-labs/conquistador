import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { requireIdentity, safeOrigin } from './agent/lib/policy.mjs';

/** Thin wrapper over eve/client. No retries of ambiguous submits, no replacement sessions. */
async function requestJob({ action, app, url, session, messageFile, responsesFile }, env) {
  if (!['submit', 'status', 'resume', 'respond'].includes(action)) throw new Error('Unknown job action.');
  if (!app) throw new Error('An owner-isolated --app directory is required.');
  const identity = requireIdentity(JSON.parse(await readFile(join(app, 'identity.json'), 'utf8')));
  const host = safeOrigin(url);
  const token = action === 'respond' ? env.CONQUISTADOR_EVE_OPERATOR_TOKEN : env.CONQUISTADOR_EVE_CALLER_TOKEN;
  if (!token || token.length < 32) throw new Error(`Host ${action === 'respond' ? 'operator' : 'caller'} credential is missing or too short.`);
  if (action !== 'submit' && !/^[A-Za-z0-9_-]{1,200}$/.test(session ?? '')) throw new Error('A durable session ID is required.');
  let message;
  if (action === 'submit' || action === 'resume') {
    if (!messageFile) throw new Error('An explicit --message-file is required.');
    message = await readFile(messageFile, 'utf8');
    if (!message.trim() || Buffer.byteLength(message) > 48 * 1024) throw new Error('Message must contain 1 through 49152 UTF-8 bytes.');
  }
  let responses;
  if (action === 'respond') {
    if (!responsesFile) throw new Error('Operator response requires --responses-file.');
    const bytes = await readFile(responsesFile, 'utf8');
    if (Buffer.byteLength(bytes) > 48 * 1024) throw new Error('Response file is too large.');
    responses = JSON.parse(bytes);
    if (!Array.isArray(responses) || !responses.length) throw new Error('Response file must contain a nonempty array of Eve input responses.');
  }
  const { Client } = await import('eve/client');
  const client = new Client({ host, auth: { bearer: () => token }, redirect: 'error' });
  const signal = AbortSignal.timeout(30_000);
  if (action === 'submit') {
    try {
      const { session: created } = await client.sessions.create({ message, signal });
      return { status: 'accepted', owner: identity.owner, ...created.state };
    } catch {
      // Do not echo a remote body that could contain credentials or private content.
      throw new Error('Submit was not confirmed. Inspect the Eve operator state before retrying; a durable job may already exist.');
    }
  }
  const attached = client.sessions.attach(session);
  if (action === 'status') {
    const events = [];
    for await (const event of attached.stream({ follow: false, signal })) {
      events.push(event);
      if (events.length >= 1000) break;
    }
    return { status: 'observed', owner: identity.owner, ...attached.state, truncated: events.length === 1000, events };
  }
  if (action === 'resume') await attached.send(message, { turnPolicy: 'queue', signal });
  else await attached.respond(responses, { signal });
  return { status: 'accepted', owner: identity.owner, ...attached.state };
}

export async function jobRequest(options, env = process.env) {
  try { return await requestJob(options, env); }
  catch {
    throw new Error('Eve request was not confirmed. Check local arguments, optional dependencies and host configuration. Inspect operator state before retrying any submitted input.');
  }
}

export async function run(argv) {
  const { positionals, values } = parseArgs({ args: argv, allowPositionals: true, strict: true,
    options: Object.fromEntries(['app', 'url', 'session', 'message-file', 'responses-file'].map(k => [k, { type: 'string' }])) });
  if (positionals.length !== 1) throw new Error('Expected submit, status, resume, or operator respond.');
  const result = await jobRequest({ action: positionals[0], app: values.app ?? process.cwd(), url: values.url,
    session: values.session, messageFile: values['message-file'], responsesFile: values['responses-file'] });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run(process.argv.slice(2)).catch(() => { console.error('Eve request failed. Check local arguments, host credentials and operator state before retrying.'); process.exitCode = 1; });
}
