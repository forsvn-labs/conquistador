// conquistador signals [--json] [--no-executor]
// Reads the project and reports what the no-argument menu needs to recommend the next command.
// Read-only. It never starts a server: Executor is asked for integrations only when a daemon for
// this folder already answers.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { onPath } from './agents.mjs';
import { contextFiles, describeContext, projectRoot } from './context-files.mjs';
import { spawnCommand } from './spawn.mjs';

export const SIGNALS_SCHEMA = 'conquistador.signals/v1';
const DAY = 86_400_000;
const RECENT_DAYS = 14;

// Folders that never hold the product's own surfaces: output, dependencies, templates, and fixtures.
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.vercel',
  '.output', 'coverage', 'Pods', 'DerivedData', 'vendor', 'target', '.venv', 'venv', '__pycache__', '.cache', '.gradle',
  '.conquistador', '.rifts', '.idea', '.vscode', 'tmp', 'template', 'templates', 'example', 'examples', 'fixtures',
  '__fixtures__', 'samples', 'test', 'tests', '__tests__']);
const LIMITS = Object.freeze({ depth: 6, entries: 6000, manifests: 40, snippets: 20, snippetBytes: 200_000, paths: 5 });

const MANIFEST = /(?:^|\/)(?:package\.json|Podfile|Package\.swift|Package\.resolved|build\.gradle(?:\.kts)?|requirements\.txt|pyproject\.toml|Gemfile|go\.mod|composer\.json|pubspec\.yaml|Cargo\.toml)$/;
const SNIPPET = /(?:^|\/)(?:(?:public\/|src\/)?index\.html?|(?:src\/)?app\/layout\.[jt]sx?|(?:src\/)?pages\/_(?:app|document)\.[jt]sx?|(?:src\/)?layouts\/[^/]+\.astro|(?:src\/)?app\.html|nuxt\.config\.[jt]s)$/;

// Stack hints: category, provider, pattern over dependency names, manifest text, and page snippets.
const STACK = [
  ['analytics', 'Google Analytics', /googletagmanager\.com|\bgtag\(|react-ga4?\b|@next\/third-parties|vue-gtag|google-analytics/i],
  ['analytics', 'Plausible', /plausible/i],
  ['analytics', 'Fathom', /usefathom|fathom-client/i],
  ['analytics', 'Vercel Analytics', /@vercel\/analytics/i],
  ['analytics', 'Umami', /umami/i],
  ['analytics', 'Segment', /@segment\/|analytics-node|cdn\.segment\.com|segment-analytics/i],
  ['analytics', 'Firebase Analytics', /firebase\/analytics|firebase-analytics|FirebaseAnalytics|@react-native-firebase\/analytics/i],
  ['analytics', 'Microsoft Clarity', /clarity\.ms|@microsoft\/clarity/i],
  ['productAnalytics', 'PostHog', /posthog/i],
  ['productAnalytics', 'Mixpanel', /mixpanel/i],
  ['productAnalytics', 'Amplitude', /amplitude/i],
  ['productAnalytics', 'Heap', /heap-api|heapanalytics|@heap\//i],
  ['productAnalytics', 'Pendo', /pendo/i],
  ['productAnalytics', 'Hotjar', /hotjar/i],
  ['email', 'Resend', /\bresend\b/i],
  ['email', 'SendGrid', /sendgrid/i],
  ['email', 'Postmark', /postmark/i],
  ['email', 'Mailgun', /mailgun/i],
  ['email', 'Loops', /loops-so|\bloops\b/i],
  ['email', 'Customer.io', /customerio|customer\.io/i],
  ['email', 'Mailchimp', /mailchimp/i],
  ['email', 'Kit (ConvertKit)', /convertkit/i],
  ['email', 'Brevo', /brevo|sib-api/i],
  ['email', 'Klaviyo', /klaviyo/i],
  ['email', 'Amazon SES', /client-ses|aws-sdk-ses/i],
  ['email', 'React Email', /@react-email\//i],
  ['email', 'Nodemailer', /nodemailer/i],
  ['payments', 'Stripe', /stripe/i],
  ['payments', 'Paddle', /paddle/i],
  ['payments', 'Lemon Squeezy', /lemonsqueezy|lemon-squeezy/i],
  ['payments', 'Polar', /@polar-sh\//i],
  ['payments', 'RevenueCat', /revenuecat|react-native-purchases|purchases_flutter|purchases-ios/i],
  ['payments', 'Braintree', /braintree/i],
  ['payments', 'Chargebee', /chargebee/i],
  ['cms', 'Contentful', /contentful/i],
  ['cms', 'Sanity', /@sanity\/|next-sanity|\bsanity\b/i],
  ['cms', 'Payload', /payloadcms|\bpayload\b/i],
  ['cms', 'Strapi', /strapi/i],
  ['cms', 'Prismic', /prismic/i],
  ['cms', 'Storyblok', /storyblok/i],
  ['cms', 'TinaCMS', /tinacms/i],
  ['cms', 'Keystatic', /keystatic/i],
  ['cms', 'Ghost', /@tryghost\//i],
  ['cms', 'WordPress', /wordpress|wp-content/i],
  ['cms', 'Contentlayer', /contentlayer/i],
  ['auth', 'Clerk', /@clerk\//i],
  ['auth', 'Auth.js', /next-auth|@auth\/core/i],
  ['auth', 'Better Auth', /better-auth/i],
  ['auth', 'Supabase', /supabase/i],
  ['auth', 'Firebase Auth', /firebase\/auth|FirebaseAuth|@react-native-firebase\/auth/i],
  ['auth', 'Auth0', /auth0/i],
  ['auth', 'WorkOS', /workos/i],
  ['auth', 'Kinde', /kinde/i],
  ['auth', 'Lucia', /\blucia\b/i],
];
const STACK_KEYS = ['analytics', 'productAnalytics', 'email', 'payments', 'cms', 'auth'];

const WEB_FRAMEWORK = /^(?:next|react-dom|vue|nuxt|svelte|@sveltejs\/kit|astro|gatsby|@remix-run\/[a-z-]+|@react-router\/dev|solid-js|@angular\/core|preact|vite|@11ty\/eleventy|hugo-bin)$/;
const NATIVE_BOTH = /^(?:react-native|expo)$/;

// Marketing surfaces by path. Each pattern returns the surface root (a file or a folder).
const SURFACES = {
  landing: [/^(?:[^/]+\/){0,2}(?:public\/|src\/)?index\.html?$/, /^(?:[^/]+\/){0,2}(?:src\/)?app\/(?:\([^/]+\)\/)?page\.(?:[jt]sx?|mdx)$/, /^(?:[^/]+\/){0,2}(?:src\/)?pages\/index\.(?:[jt]sx?|astro|vue|svelte|mdx?)$/, /^(?:[^/]+\/){0,2}(?:src\/)?routes\/(?:\+page\.svelte|_index\.[jt]sx?|index\.[jt]sx?)$/, /^(?:.*\/)?landing(?:\.[\w.]+)?(?=\/|$)/i],
  pricing: [/^(?:.*\/)?(?:pricing|plans)(?:\.[\w.]+)?(?=\/|$)/i],
  blog: [/^(?:.*\/)?(?:blog|posts|articles)(?=\/|$)/i],
  docs: [/^(?:.*\/)?(?:docs|documentation|guides)(?=\/|$)/i],
  changelog: [/^(?:.*\/)?(?:CHANGELOG|CHANGES|HISTORY|RELEASES)(?:\.mdx?|\.txt)?$/i, /^(?:.*\/)?changelog(?=\/|$)/i],
  appStore: [/^(?:.*\/)?fastlane\/metadata(?=\/|$)/, /^(?:.*\/)?(?:app-?store|play-?store|store-?listing)(?:\.[\w.]+)?(?=\/|$)/i, /^(?:.*\/)?metadata\/[a-z]{2}(?:-[A-Za-z]{2,4})?\/(?:description|keywords|promotional_text|subtitle|name)\.txt$/],
};
const SURFACE_PATHS = Object.values(SURFACES).flat();
const DEV_DOCS = /(?:^|\/)(?:AGENTS|CLAUDE|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY|LICENSE|NOTICE|INDEX|MIGRATION)(?:\.md)?$/i;
const MARKETING_DIRS = /(?:^|\/)(?:marketing|content|copy|emails?|campaigns?|landing|press|social|ads|launch)(?:\/)/i;

// A file a marketer would review: a surface, a marketing folder, or prose that is not contributor docs.
export function isMarketingFile(path) {
  const file = path.split(sep).join('/');
  if (/(?:^|\/)(?:PRODUCT|GROWTH|README)\.md$/i.test(file)) return true;
  if (DEV_DOCS.test(file)) return false;
  if (MARKETING_DIRS.test(file) || SURFACE_PATHS.some(pattern => pattern.test(file))) return true;
  return /\.(?:mdx?|html?)$/i.test(file);
}

function walk(root) {
  const files = [];
  const dirs = [];
  const queue = [['', 0]];
  while (queue.length && files.length + dirs.length < LIMITS.entries) {
    const [folder, depth] = queue.shift();
    let entries = [];
    try { entries = readdirSync(join(root, folder), { withFileTypes: true }); } catch { continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.github')) continue;
        dirs.push(path);
        // An Xcode bundle is a platform signal, not a folder to read.
        if (depth + 1 < LIMITS.depth && !/\.(?:xcodeproj|xcworkspace|xcassets)$/.test(entry.name)) queue.push([path, depth + 1]);
      } else if (entry.isFile()) files.push(path);
    }
  }
  return { files, dirs, truncated: queue.length > 0 };
}

const read = (path, limit = LIMITS.snippetBytes) => {
  try { return statSync(path).size > 4 * limit ? '' : readFileSync(path, 'utf8').slice(0, limit); } catch { return ''; }
};

function manifests(root, files) {
  const names = new Set();
  const texts = [];
  for (const file of files.filter(item => MANIFEST.test(item)).slice(0, LIMITS.manifests)) {
    const text = read(join(root, file));
    if (/(?:^|\/)package\.json$/.test(file)) {
      try {
        const json = JSON.parse(text);
        for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) for (const name of Object.keys(json[field] ?? {})) names.add(name);
      } catch { /* A broken manifest gives no hints. */ }
    } else texts.push(text);
  }
  return { names, texts };
}

function detectStack(names, texts) {
  const haystack = [...names, ...texts].join('\n');
  const stack = Object.fromEntries(STACK_KEYS.map(key => [key, []]));
  for (const [key, provider, pattern] of STACK) if (pattern.test(haystack) && !stack[key].includes(provider)) stack[key].push(provider);
  return stack;
}

// React Native, Expo, and Flutter ship to the native folders they have, or to both when none exist yet.
function detectPlatforms({ files, dirs }, names, texts, recorded) {
  const has = pattern => files.some(file => pattern.test(file)) || dirs.some(dir => pattern.test(dir));
  const text = texts.join('\n');
  const cross = [...names].some(name => NATIVE_BOTH.test(name)) || has(/(?:^|\/)pubspec\.yaml$/);
  const iosFolder = has(/^ios(?:\/|$)/);
  const androidFolder = has(/^android(?:\/|$)/);
  const both = cross && !iosFolder && !androidFolder;
  const web = [...names].some(name => WEB_FRAMEWORK.test(name)) || has(/^(?:public\/|src\/)?index\.html?$/) || /\brails\b|\bdjango\b/i.test(text);
  const ios = has(/\.(?:xcodeproj|xcworkspace)$/) || has(/(?:^|\/)Podfile$/) || /\.iOS\(/.test(text) || (cross && iosFolder) || both;
  const android = has(/(?:^|\/)AndroidManifest\.xml$/) || /com\.android\.(?:application|library)/.test(text) || (cross && androidFolder) || both;
  return { found: [web && 'web', ios && 'ios', android && 'android'].filter(Boolean), recorded };
}

function detectSurfaces({ files, dirs }) {
  const surfaces = {};
  for (const [name, patterns] of Object.entries(SURFACES)) {
    const roots = new Set();
    for (const path of [...dirs, ...files]) {
      for (const pattern of patterns) {
        const match = pattern.exec(path);
        if (match) { roots.add(match[0]); break; }
      }
    }
    // Keep the shallowest roots: "content/blog" covers "content/blog/hello.mdx".
    const sorted = [...roots].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
    const kept = sorted.filter((path, index) => !sorted.slice(0, index).some(parent => path.startsWith(`${parent}/`)));
    surfaces[name] = { count: kept.length, paths: kept.slice(0, LIMITS.paths) };
  }
  return surfaces;
}

function git(args, cwd) {
  const { file, args: fileArgs, options } = spawnCommand('git', args);
  const result = spawnSync(file, fileArgs, { cwd, encoding: 'utf8', timeout: 3_000, stdio: ['ignore', 'pipe', 'ignore'], ...options });
  // trimEnd only: porcelain lines start with a status column that may be a space.
  return result.status === 0 ? result.stdout.trimEnd() : null;
}

// The branch this work merges into: the remote default, else main or master.
function baseBranch(root, branch) {
  const remote = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], root);
  for (const name of [remote, 'origin/main', 'main', 'origin/master', 'master'].filter(Boolean)) {
    if (name.replace(/^origin\//, '') === branch) return null;
    if (git(['rev-parse', '--verify', '--quiet', name], root) !== null) return name;
  }
  return null;
}

// Marketing files changed in the working tree, plus those this branch changed since its base.
function gitSignals(root) {
  if (git(['rev-parse', '--is-inside-work-tree'], root) !== 'true') return { isRepo: false, branch: null, base: null, changedMarketingFiles: [], changedCount: 0, latestTag: null };
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  const base = branch && branch !== 'HEAD' ? baseBranch(root, branch) : null;
  const dirty = (git(['status', '--porcelain', '-uall'], root) ?? '').split('\n').filter(Boolean).map(line => line.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
  const branchFiles = base ? (git(['diff', '--name-only', `${base}...HEAD`], root) ?? '').split('\n').filter(Boolean) : [];
  const changed = [...new Set([...dirty, ...branchFiles])].filter(isMarketingFile).sort();
  const tag = (git(['for-each-ref', '--sort=-creatordate', '--count=1', '--format=%(refname:short)%09%(creatordate:short)', 'refs/tags'], root) ?? '').split('\t');
  return { isRepo: true, branch, base, changedMarketingFiles: changed.slice(0, 20), changedCount: changed.length, latestTag: tag[0] ? { name: tag[0], date: tag[1] || null } : null };
}

// The newest dated release in CHANGELOG.md, and whether "Unreleased" has entries.
export function changelogRelease(text) {
  const headings = [...text.matchAll(/^#{2,3}\s+(.+)$/gm)];
  let unreleased = false;
  let latest = null;
  headings.forEach((heading, index) => {
    const title = heading[1].trim();
    const body = text.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? text.length);
    if (/^\[?unreleased\]?/i.test(title)) { unreleased ||= /^\s*[-*]\s+\S/m.test(body); return; }
    const version = /\[?v?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)\]?/.exec(title)?.[1];
    const date = /(\d{4}-\d{2}-\d{2})/.exec(title)?.[1] ?? null;
    if (!latest && (version || date)) latest = { version: version ?? null, date };
  });
  return { unreleased, latest };
}

function launchSignals(root, surfaces, gitInfo, now) {
  const changelog = surfaces.changelog.paths.find(path => !path.includes('/')) ?? surfaces.changelog.paths[0];
  const release = changelog ? changelogRelease(read(join(root, changelog))) : { unreleased: false, latest: null };
  const candidates = [
    release.latest?.date && { source: changelog, version: release.latest.version, date: release.latest.date },
    gitInfo.latestTag?.date && { source: 'git tag', version: gitInfo.latestTag.name, date: gitInfo.latestTag.date },
  ].filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  // Calendar days in local time: git prints tag dates in local time, and people date changelogs that way.
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const latest = candidates[0] ? { ...candidates[0], daysAgo: Math.round((midnight - new Date(`${candidates[0].date}T00:00:00`).getTime()) / DAY) } : null;
  const hint = release.unreleased ? 'unreleased' : latest && latest.daysAgo >= 0 && latest.daysAgo <= RECENT_DAYS ? 'recent-release' : null;
  return { hint, unreleased: release.unreleased, latest };
}

const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };

async function answers(record, timeout) {
  try {
    await fetch(`http://${record.hostname || 'localhost'}:${record.port}/`, { signal: AbortSignal.timeout(timeout), redirect: 'manual' });
    return true;
  } catch { return false; }
}

// Executor's CLI starts a daemon for its working folder when none answers. So the CLI runs only
// when a daemon record for this exact folder exists, its process lives, and its port answers.
export async function executorSignals(root, { env = process.env, home = homedir(), probeTimeout = 800, cliTimeout = 5_000, call = true } = {}) {
  const installed = Boolean(onPath('executor'));
  const folder = env.EXECUTOR_DATA_DIR || join(home, '.executor');
  let records = [];
  try {
    records = readdirSync(folder).filter(name => /^daemon-.*\.json$/.test(name)).map(name => {
      try { const { hostname, port, pid, scopeId } = JSON.parse(readFileSync(join(folder, name), 'utf8')); return { hostname, port, pid, scopeId: scopeId ?? null }; } catch { return null; }
    }).filter(record => record && Number.isInteger(record.port) && Number.isInteger(record.pid) && alive(record.pid));
  } catch { records = []; }
  const answering = [];
  for (const record of records) if (await answers(record, probeTimeout)) answering.push(record);
  const advice = 'Open Executor.app or run `executor web`, then run `conquistador connect`.';
  if (!answering.length) return { status: installed ? 'not running' : 'not installed', installed, integrations: null, scope: null, advice: installed ? advice : 'Run `conquistador connect` to install Executor.' };
  const scoped = answering.find(record => record.scopeId === `cwd:${root}`);
  if (!scoped) return { status: 'running', installed, integrations: null, scope: 'other folder', advice: 'Executor runs for another folder. Run `conquistador connect` here to use it.' };
  if (!call || !installed) return { status: 'running', installed, integrations: null, scope: 'this folder', advice: null };
  const { file, args, options } = spawnCommand('executor', ['tools', 'integrations']);
  const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', timeout: cliTimeout, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  return { status: 'running', installed, integrations: result.status === 0 ? countIntegrations(result.stdout) : null, scope: 'this folder', advice: result.status === 0 ? null : 'Executor did not list integrations in time. Run `conquistador connect`.' };
}

// The CLI output format is not a stable contract: accept JSON, else count listed rows.
export function countIntegrations(output) {
  try {
    const value = JSON.parse(output);
    if (Array.isArray(value)) return value.length;
    if (Array.isArray(value?.integrations)) return value.integrations.length;
  } catch { /* Plain text. */ }
  return output.split('\n').map(line => line.trim()).filter(line => line && !/^(?:integrations?\b|name\b|[-=─\s|]+$|no integrations)/i.test(line)).length;
}

export async function collectSignals(cwd = process.cwd(), { executor = true, now = Date.now(), env = process.env, home = homedir() } = {}) {
  const root = projectRoot(cwd);
  const tree = walk(root);
  const context = contextFiles(cwd).map(describeContext);
  const product = context.find(file => file.kind === 'product') ?? null;
  const growth = context.find(file => file.kind === 'growth') ?? null;
  const { names, texts } = manifests(root, tree.files);
  const snippets = tree.files.filter(file => SNIPPET.test(file)).slice(0, LIMITS.snippets).map(file => read(join(root, file)));
  const surfaces = detectSurfaces(tree);
  const gitInfo = gitSignals(root);
  const rel = path => relative(root, path).split(sep).join('/') || '.';
  return {
    schema: SIGNALS_SCHEMA,
    root,
    context: {
      product: product && { path: rel(product.path), schema: product.schema, platform: product.platform },
      growth: growth && { path: rel(growth.path), schema: growth.schema, open: growth.open },
      design: tree.files.includes('DESIGN.md') ? 'DESIGN.md' : null,
    },
    hasCode: tree.files.some(file => MANIFEST.test(file)) || tree.dirs.some(dir => /^(?:src|app|pages|lib)$/.test(dir)),
    platform: detectPlatforms(tree, names, texts, product?.platform ?? null),
    stack: detectStack(names, [...texts, ...snippets]),
    surfaces,
    launch: launchSignals(root, surfaces, gitInfo, now),
    git: { isRepo: gitInfo.isRepo, branch: gitInfo.branch, base: gitInfo.base, changedMarketingFiles: gitInfo.changedMarketingFiles, changedCount: gitInfo.changedCount },
    executor: executor ? await executorSignals(root, { env, home }) : { status: 'skipped', installed: null, integrations: null, scope: null, advice: null },
    truncated: tree.truncated,
  };
}

function summary(signals) {
  const list = items => (items.length ? items.join(', ') : 'none found');
  const lines = [
    `Project: ${signals.root}`,
    `Context: PRODUCT.md ${signals.context.product ? 'yes' : 'missing'}, GROWTH.md ${signals.context.growth ? 'yes' : 'missing'}`,
    `Platform: ${signals.platform.recorded ?? list(signals.platform.found)}`,
    ...Object.entries(signals.stack).map(([key, value]) => `Stack ${key}: ${list(value)}`),
    `Surfaces: ${list(Object.entries(signals.surfaces).filter(([, value]) => value.count).map(([key, value]) => `${key} (${value.paths.join(', ')})`))}`,
    `Launch: ${signals.launch.hint ?? 'no recent release'}${signals.launch.latest ? ` (latest ${signals.launch.latest.version ?? ''} ${signals.launch.latest.date}, ${signals.launch.latest.daysAgo} days ago)` : ''}`,
    `Changed marketing files: ${list(signals.git.changedMarketingFiles)}`,
    `Executor: ${signals.executor.status}${signals.executor.integrations === null ? '' : `, ${signals.executor.integrations} integrations`}`,
  ];
  if (signals.executor.advice) lines.push(`  ${signals.executor.advice}`);
  if (!signals.context.growth) lines.push('', 'Next: run /conquistador init in your agent.');
  return lines.join('\n');
}

export async function runSignals(args, cwd = process.cwd()) {
  const unknown = args.filter(arg => !['--json', '--no-executor'].includes(arg));
  if (unknown.length) { process.stderr.write('Usage: conquistador signals [--json] [--no-executor]\n'); return 2; }
  const signals = await collectSignals(cwd, { executor: !args.includes('--no-executor') });
  console.log(args.includes('--json') ? JSON.stringify(signals, null, 2) : summary(signals));
  return 0;
}
