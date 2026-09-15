import { lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const template = fileURLToPath(new URL('./runtime/', import.meta.url));
const sourceDefault = fileURLToPath(new URL('../../', import.meta.url));
const inside = (parent, child) => child === parent || child.startsWith(parent + sep);

async function collect(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = join(prefix, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) throw new Error(`Unsupported source entry: ${name}`);
    if (entry.isDirectory()) files.push(...await collect(root, name));
    else files.push(name);
  }
  return files;
}

/** Prepare an unstarted native app. Never installs, spawns, or overwrites a path. */
export async function prepareJob({ source = sourceDefault, destination, owner, model }) {
  if (!isAbsolute(destination ?? '')) throw new Error('destination must be an absolute new directory.');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(owner ?? '')) throw new Error('owner must be a non-secret stable identifier.');
  if (!/^[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(model ?? '')) throw new Error('model must be an explicit AI Gateway model ID.');
  const root = await realpath(source);
  for (const candidate of [root, dirname(root)]) {
    try { await lstat(join(candidate, 'domain-restriction.json')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    throw new Error('Domain-restricted sources are not supported by the optional Eve app. Use the existing restricted host.');
  }
  const skills = join(root, 'skills');
  if ((await lstat(skills)).isSymbolicLink()) throw new Error('Canonical skills root cannot be a symlink.');
  const parent = await realpath(dirname(destination));
  if (parent !== resolve(dirname(destination))) throw new Error('Destination parents must not contain symlinks.');
  destination = join(parent, destination.split(sep).at(-1));
  if (inside(root, destination) || inside(template, destination)) throw new Error('Prepare outside the source checkout.');
  const skillFiles = await collect(skills);
  if (!skillFiles.includes(join('conquistador', 'SKILL.md'))) throw new Error('Canonical parent skill is missing.');
  // Stage bytes in memory before creating the destination. Only authored template
  // files are copied; local dependencies, build state, tests and secrets never travel.
  const templateFiles = ['package.json', 'identity.json', 'bun.lock', 'tsconfig.json', '.gitignore', 'client.mjs', 'README.md', 'test/policy.test.mjs', 'test/native.test.mjs',
    ...(await collect(join(template, 'agent'))).filter(p => !p.startsWith(`skills${sep}`)).map(p => join('agent', p))];
  const entries = [];
  for (const name of templateFiles) entries.push([name, await readFile(join(template, name))]);
  for (const name of skillFiles) entries.push([join('agent', 'skills', name), await readFile(join(skills, name))]);
  const hashes = Object.fromEntries(entries.filter(([p]) => p.startsWith(join('agent', 'skills') + sep))
    .map(([p, bytes]) => [p, createHash('sha256').update(bytes).digest('hex')]));
  const identity = { schemaVersion: 'conquistador.eve-app/v1', owner, model, instance: randomBytes(16).toString('hex') };
  await mkdir(destination, { mode: 0o700 });
  for (const [name, bytes] of entries) {
    const target = join(destination, name);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, name === 'identity.json' ? JSON.stringify(identity, null, 2) + '\n' : bytes, { flag: 'wx', mode: 0o600 });
  }
  await writeFile(join(destination, 'conquistador-skills.json'), JSON.stringify({ source: 'canonical skills/', hashes }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { status: 'prepared', app: destination, owner, eve: '0.55.0', started: false,
    next: ['bun install --frozen-lockfile --ignore-scripts', 'bun run check', 'bun run build', 'Configure separate host credentials, then explicitly start the app.'] };
}

export const help = `Optional Eve durable jobs (Node 24)
  prepare --destination ABS_NEW_DIR --owner ID --model PROVIDER/MODEL [--source ROOT]
  submit --app DIR --url ORIGIN --message-file FILE
  status --app DIR --url ORIGIN --session ID
  resume --app DIR --url ORIGIN --session ID --message-file FILE

prepare writes files only. Other commands require an explicitly started owner-isolated
Eve app and CONQUISTADOR_EVE_CALLER_TOKEN in the host environment. No approval API is
exposed here. An operator uses the prepared app's client.mjs respond command separately.
`;

async function runCommand(argv) {
  const { positionals, values } = parseArgs({ args: argv, allowPositionals: true, strict: true,
    options: Object.fromEntries(['destination', 'owner', 'model', 'source', 'app', 'url', 'message-file', 'session'].map(k => [k, { type: 'string' }]).concat([['help', { type: 'boolean' }]])) });
  const action = positionals[0];
  if (values.help || !action) { console.log(help); return 0; }
  if (positionals.length !== 1) throw new Error('Expected one jobs command.');
  const allowed = action === 'prepare' ? ['destination', 'owner', 'model', 'source'] :
    action === 'submit' ? ['app', 'url', 'message-file'] : action === 'status' ? ['app', 'url', 'session'] :
    action === 'resume' ? ['app', 'url', 'session', 'message-file'] : null;
  if (!allowed || Object.keys(values).some(k => !allowed.includes(k))) throw new Error('Unsupported jobs command or option.');
  let result;
  if (action === 'prepare') result = await prepareJob(values);
  else {
    // Import the maintained client implementation here, never executable code from
    // a caller-selected --app directory. Dependencies remain optional until this call.
    const { jobRequest } = await import('./runtime/client.mjs');
    result = await jobRequest({ action, app: values.app, url: values.url, session: values.session, messageFile: values['message-file'] });
  }
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

export async function run(argv) {
  try { return await runCommand(argv); }
  catch {
    console.error('Eve jobs failed. Check arguments, the optional installation, and host configuration. If a request was sent, inspect operator state before retrying.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await run(process.argv.slice(2));
}
