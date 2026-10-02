// `conquistador check`: a deterministic checker for marketing text. No model, no key.
// Exit codes match Impeccable's detector: 0 clean, 2 findings, 1 a target could not be scanned.
// Human output goes to stderr; `--json` prints the findings array to stdout.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { channels, detectChannel, normalizeChannel } from './channels.mjs';
import { extractDocument, scannableExtensions } from './extract.mjs';
import { families, ruleById, rules } from './rules.mjs';

const skippedFolders = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'vendor', '.next', '.nuxt', '.svelte-kit', '.conquistador']);

const maxBytes = 2 * 1024 * 1024;

// Glob subset for config ignores: `**`, `*`, `?`. Patterns match project-relative paths with `/`.
export function globToRegExp(glob) {
  let pattern = '';

  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];

    if (character === '*' && glob[index + 1] === '*') {
      pattern += glob[index + 2] === '/' ? '(?:.*/)?' : '.*';
      index += glob[index + 2] === '/' ? 2 : 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else if (character === '?') {
      pattern += '[^/]';
    } else {
      pattern += /[\\^$.|+()[\]{}]/.test(character) ? `\\${character}` : character;
    }
  }

  return new RegExp(`^${pattern}$`);
}

const stringList = value => (Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : []);

// Read `check.ignoreRules` and `check.ignoreFiles` from `.conquistador/config.json` in the project root.
export function loadConfig(root) {
  const path = join(root, '.conquistador', 'config.json');

  if (!existsSync(path)) return { ignoreRules: [], ignoreFiles: [], path: null };
  try {
    const check = JSON.parse(readFileSync(path, 'utf8'))?.check ?? {};

    return { ignoreRules: stringList(check.ignoreRules), ignoreFiles: stringList(check.ignoreFiles), path };
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error.message}`);
  }
}

const ignoredFile = (file, root, config) => {
  const path = relative(root, file).split(sep).join('/');

  return config.ignoreFiles.some(glob => globToRegExp(glob).test(path) || globToRegExp(glob).test(file.split(sep).join('/')));
};

// Inline waivers in any comment syntax: `conquistador-disable rule-a, rule-b: reason`,
// with `-line` for the same line and `-next-line` for the next nonblank line.
export function waivers(source) {
  const file = new Set();
  const lines = new Map();
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  const add = (line, ids) => lines.set(line, new Set([...(lines.get(line) ?? []), ...ids]));

  for (const [index, line] of raw.entries()) {
    for (const match of line.matchAll(/conquistador-disable(-line|-next-line)?\s+([a-z0-9*][a-z0-9*,\s-]*?)(?=\s*(?::|--(?!>)|-->|\*\/|$))/gi)) {
      const ids = match[2].split(/[\s,]+/).filter(Boolean).map(id => id.toLowerCase());

      if (!match[1]) for (const id of ids) file.add(id);
      if (match[1] === '-line') add(index + 1, ids);
      if (match[1] === '-next-line') {
        const next = raw.findIndex((text, position) => position > index && text.trim() && !/conquistador-disable/.test(text));

        if (next >= 0) add(next + 1, ids);
      }
    }
  }

  return { file, lines };
}

const waived = (finding, waiver) => {
  const matches = set => set && (set.has(finding.rule) || set.has('*'));

  return matches(waiver.file) || matches(waiver.lines.get(finding.line));
};

// Run every rule that applies to the channel and return findings in line order.
export function checkDocument(document, options) {
  const findings = [];

  for (const rule of rules) {
    if (rule.channels && !rule.channels.includes(options.channel)) continue;
    if (options.ignoreRules?.includes(rule.id)) continue;
    let hits = [];

    try { hits = rule.check({ document, channel: options.channel, file: options.file }); } catch { hits = []; }
    for (const hit of hits) {
      findings.push({ rule: rule.id, name: rule.name, family: rule.family, severity: rule.severity, message: rule.message, fix: rule.fix, file: options.file, channel: options.channel, line: hit.line, snippet: hit.snippet });
    }
  }
  const waiver = options.inline === false ? null : waivers(document.source);
  const seen = new Set();

  return findings.filter(finding => {
    const key = `${finding.rule}:${finding.line}:${finding.snippet}`;

    if (seen.has(key) || (waiver && waived(finding, waiver))) return false;
    seen.add(key);

    return true;
  }).sort((left, right) => left.line - right.line || left.rule.localeCompare(right.rule));
}

export function checkText(source, options) {
  const document = extractDocument(source, options.extension ?? '.md');
  const channel = detectChannel(options.file ?? 'stdin.md', document, options.channel);

  return checkDocument(document, { ...options, channel, file: options.file ?? '<text>' });
}

export function checkFile(path, options) {
  if (statSync(path).size > maxBytes) throw new Error(`${path} is larger than 2 MB`);

  return checkText(readFileSync(path, 'utf8'), { ...options, file: options.display ?? path, extension: extname(path) });
}

function walk(folder, found = []) {
  for (const entry of readdirSync(folder, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(folder, entry.name);

    if (entry.isDirectory() && !skippedFolders.has(entry.name)) walk(path, found);
    if (entry.isFile() && scannableExtensions.includes(extname(entry.name).toLowerCase())) found.push(path);
  }

  return found;
}

// Fetch a URL and check its visible text and meta tags. Reads only; never posts.
export async function checkUrl(url, options) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(options.timeout ?? 15_000), headers: { 'user-agent': 'conquistador-check (+https://github.com/forsvn-labs/conquistador)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.1' } });

  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';

  if (!/text\/|html|xml|markdown/i.test(type)) throw new Error(`${url} is ${type || 'not text'}, not a page`);
  const body = await response.text();

  return checkText(body.slice(0, maxBytes), { ...options, file: url, extension: /html|xml/i.test(type) ? '.html' : /markdown/i.test(type) ? '.md' : '.txt', channel: options.channel ?? 'web' });
}

// Scan files, folders, and URLs. Failures are reported per target; the scan continues.
export async function scanTargets(targets, options) {
  const root = options.root ?? process.cwd();
  const config = options.config === false ? { ignoreRules: [], ignoreFiles: [] } : loadConfig(root);
  const findings = [];
  const failures = [];
  let scanned = 0;
  const base = { channel: options.channel, ignoreRules: config.ignoreRules, inline: options.config !== false };

  for (const target of targets) {
    try {
      if (/^https?:\/\//i.test(target)) {
        findings.push(...await checkUrl(target, base));
        scanned += 1;
        continue;
      }
      const path = resolve(root, target);
      const stat = statSync(path);
      const files = stat.isDirectory() ? walk(path) : [path];

      if (!stat.isDirectory() && !scannableExtensions.includes(extname(path).toLowerCase())) throw new Error(`${target} is not a supported file (${scannableExtensions.join(', ')})`);
      for (const file of files) {
        if (ignoredFile(file, root, config)) continue;
        const display = relative(root, file).startsWith('..') ? file : relative(root, file);

        try {
          findings.push(...checkFile(file, { ...base, display }));
          scanned += 1;
        } catch (error) {
          failures.push({ target: display, error: error.message });
        }
      }
    } catch (error) {
      failures.push({ target, error: error.code === 'ENOENT' ? `${target} does not exist` : error.message });
    }
  }

  return { findings, failures, scanned };
}

export const counted = finding => finding.severity !== 'advisory';

export function formatFindings(findings) {
  const out = [];
  const byFile = new Map();

  for (const finding of findings) byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding]);
  for (const [file, items] of byFile) {
    out.push('', `${file} (${items[0].channel})`);
    for (const item of items) {
      out.push(`  line ${item.line}: [${item.rule}] ${item.severity}. ${item.message}`, `    "${item.snippet}"`, `    Fix: ${item.fix}`);
    }
  }

  return out.join('\n');
}

const usage = `Usage: conquistador check [--json] [--channel C] [--no-config] <file|folder|url...>

Checks marketing text with fixed rules. No model and no key.
Reads .md, .mdx, .html, .htm, .txt files, folders of them, and http(s) URLs.

Options:
  --json         Print findings as a JSON array on stdout
  --channel C    Treat every target as channel C: ${Object.keys(channels).join(', ')}
  --no-config    Ignore .conquistador/config.json and inline waivers
  --rules        List every rule and exit
  --help         Show this help

Exit status: 0 no findings (advisories may print), 2 findings, 1 a target could not be scanned.

Ignore rules in .conquistador/config.json: {"check": {"ignoreRules": ["ai-em-dash"], "ignoreFiles": ["drafts/**"]}}
Waive one finding in the file: <!-- conquistador-disable-next-line claim-superlative: G2 Winter 2026 report -->
`;

export async function runCheck(args, io = { stdout: process.stdout, stderr: process.stderr, cwd: process.cwd() }) {
  const json = args.includes('--json');
  const channelIndex = args.findIndex(arg => arg === '--channel' || arg.startsWith('--channel='));
  const channelValue = channelIndex < 0 ? null : args[channelIndex].includes('=') ? args[channelIndex].split('=')[1] : args[channelIndex + 1];
  const targets = args.filter((arg, index) => !arg.startsWith('--') && !(channelIndex >= 0 && !args[channelIndex].includes('=') && index === channelIndex + 1));
  const unknown = args.filter(arg => arg.startsWith('--') && !['--json', '--no-config', '--help', '--rules'].includes(arg) && !arg.startsWith('--channel'));

  if (args.includes('--help')) { io.stdout.write(usage); return 0; }
  if (args.includes('--rules')) {
    const list = rules.map(rule => ({ id: rule.id, family: rule.family, severity: rule.severity, name: rule.name, channels: rule.channels ?? 'all', message: rule.message, fix: rule.fix }));

    io.stdout.write(json ? `${JSON.stringify(list, null, 2)}\n` : `${list.map(rule => `${rule.id.padEnd(26)} ${rule.severity.padEnd(8)} ${families[rule.family]}: ${rule.name}`).join('\n')}\n`);

    return 0;
  }
  if (unknown.length) { io.stderr.write(`Unknown option: ${unknown.join(' ')}\n\n${usage}`); return 1; }
  if (channelIndex >= 0 && !normalizeChannel(channelValue)) { io.stderr.write(`Unknown channel: ${channelValue ?? '(none)'}. Use one of: ${Object.keys(channels).join(', ')}\n`); return 1; }
  if (!targets.length) { io.stderr.write(usage); return 1; }
  let result;

  try {
    result = await scanTargets(targets, { root: io.cwd, channel: channelValue, config: !args.includes('--no-config') });
  } catch (error) {
    io.stderr.write(`conquistador check: ${error.message}\n`);

    return 1;
  }
  const { findings, failures, scanned } = result;
  const primary = findings.filter(counted);

  for (const failure of failures) io.stderr.write(`Error: ${failure.target}: ${failure.error}\n`);
  if (json) {
    io.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  } else if (findings.length) {
    const advisory = findings.length - primary.length;

    io.stderr.write(`${formatFindings(findings)}\n\n${primary.length} finding${primary.length === 1 ? '' : 's'}${advisory ? ` and ${advisory} advisory note${advisory === 1 ? '' : 's'}` : ''} in ${new Set(findings.map(finding => finding.file)).size} of ${scanned} file${scanned === 1 ? '' : 's'}.\n`);
  } else if (!failures.length) {
    io.stderr.write(`No findings in ${scanned} file${scanned === 1 ? '' : 's'}.\n`);
  }

  return failures.length ? 1 : primary.length ? 2 : 0;
}

export { channels, families, rules, ruleById };
