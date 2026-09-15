import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const packagePattern = /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/;
const modules = [
  { id: 'eve', directory: 'hosts/eve/runtime', package: 'eve', upstream: 'https://github.com/vercel/eve' },
  { id: 'executor', directory: 'hosts/executor', package: 'executor', upstream: 'https://github.com/UsefulSoftwareCo/executor' },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function integrationPins(directory = root) {
  return modules.map(module => {
    const bytes = readFileSync(join(directory, module.directory, 'package.json'));
    const manifest = JSON.parse(bytes);
    if (manifest.private !== true) throw new Error('Optional integration packages must remain private.');
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    if (!Object.hasOwn(dependencies, module.package)) throw new Error(`Missing ${module.id} dependency.`);
    const packages = Object.entries(dependencies).map(([name, version]) => {
      if (!packagePattern.test(name) || typeof version !== 'string' || !versionPattern.test(version)) {
        throw new Error('Integration dependencies require exact package versions.');
      }
      return { name, version };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const lock = readFileSync(join(directory, module.directory, 'bun.lock'));
    return { ...module, packages, manifestDigest: digest(bytes), lockDigest: digest(lock) };
  });
}

async function releaseMetadata(name, fetchImpl, signal) {
  // Only public package names from the reviewed manifests leave this process.
  const response = await fetchImpl(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
    signal, redirect: 'error', headers: { accept: 'application/json' },
  });
  if (!response.ok || !response.body) throw new Error('Registry unavailable.');
  let length = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > 512 * 1024) throw new Error('Registry response exceeded the limit.');
    chunks.push(Buffer.from(chunk));
  }
  const release = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (release.name !== name || typeof release.version !== 'string' || !versionPattern.test(release.version) ||
      typeof release.dist?.integrity !== 'string' || !/^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/.test(release.dist.integrity)) {
    throw new Error('Registry metadata did not match the requested package.');
  }
  return { version: release.version, integrity: release.dist.integrity };
}

export async function checkIntegrationReleases(pins, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const packages = new Map(pins.flatMap(module => module.packages).map(pkg => [pkg.name, pkg]));
  const releases = new Map();
  // Keep concurrency bounded even when a host package adds dependencies.
  const names = [...packages.keys()];
  for (let index = 0; index < names.length; index += 4) {
    await Promise.all(names.slice(index, index + 4).map(async name => {
      const controller = new AbortController();
      let timer;
      try {
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Registry deadline exceeded.')); }, timeoutMs);
        });
        const release = await Promise.race([releaseMetadata(name, fetchImpl, controller.signal), timeout]);
        releases.set(name, release);
      } catch {
        // Fetch errors may include URLs or proxy headers. Keep report errors fixed and non-secret.
        releases.set(name, { error: 'registry-check-failed' });
      } finally { clearTimeout(timer); }
    }));
  }
  return pins.map(module => ({
    ...module,
    packages: module.packages.map(pkg => {
      const release = releases.get(pkg.name);
      return release.error ? { ...pkg, state: 'unknown', error: release.error }
        : { ...pkg, latest: release.version, integrity: release.integrity,
          state: pkg.version === release.version ? 'current' : 'review-required' };
    }),
  }));
}

export async function runIntegrationReleases(args, { stdout = process.stdout, stderr = process.stderr, directory = root } = {}) {
  if (args.length === 0 || args.length === 1 && ['help', '--help'].includes(args[0])) {
    stdout.write('Usage: conquistador integrations status|check-updates\n' +
      'status reads the exact local dependency pins and lock digests.\n' +
      'check-updates reads public npm release metadata; it never installs, upgrades, or grants access.\n' +
      'Exit codes: 0 current, 1 release review needed, 2 check unavailable or invalid input.\n');
    return 0;
  }
  if (args.length !== 1 || !['status', 'check-updates'].includes(args[0])) {
    stderr.write('Use integrations status or check-updates without additional arguments.\n');
    return 2;
  }
  try {
    const pins = integrationPins(directory);
    const modules = args[0] === 'status' ? pins : await checkIntegrationReleases(pins);
    stdout.write(JSON.stringify({ schemaVersion: 'conquistador.integration-releases/v1',
      checkedAt: new Date().toISOString(), mode: args[0], modules,
      compatibility: 'not-established-by-release-metadata', modified: false,
    }, null, 2) + '\n');
    if (modules.some(module => module.packages.some(pkg => pkg.state === 'unknown'))) return 2;
    return modules.some(module => module.packages.some(pkg => pkg.state === 'review-required')) ? 1 : 0;
  } catch {
    stderr.write('Integration manifest or lockfile unavailable or invalid. Use the complete distribution with exact dependency pins.\n');
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runIntegrationReleases(process.argv.slice(2));
}
