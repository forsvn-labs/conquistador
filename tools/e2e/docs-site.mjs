#!/usr/bin/env node
// E2E for the Mintlify docs site in docs-site/. Offline unless --live is given. No model.
// Checks that the site is complete and that it says only what the code does: navigation and
// files match, internal links resolve, the CLI, MCP, and check references match the shipped
// code, features newer than npm 0.3.0 are marked "from 0.4.0", moved repository files point to
// the site, and context7.json indexes docs-site/. With --live URL it also requests every page
// from a running `mint dev` and expects HTTP 200.
// Report: dist/e2e/docs-site/report.json and report.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMcpHandler } from '../skills-mcp.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const site = join(root, 'docs-site');
const bin = join(root, 'runtime/bin/conquistador.js');
const args = process.argv.slice(2);
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = resolve(option('--out') ?? join(root, 'dist/e2e/docs-site'));
const live = option('--live');
const SITE_URL = 'https://conquistador.forsvn.com/docs';

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}\n`);
}
const read = file => readFileSync(join(root, file), 'utf8');
const cli = cliArgs => spawnSync(process.execPath, [bin, ...cliArgs], { cwd: root, encoding: 'utf8' });
const git = gitArgs => spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).stdout;
const page = name => (existsSync(join(site, `${name}.mdx`)) ? readFileSync(join(site, `${name}.mdx`), 'utf8') : '');
const list = items => items.slice(0, 12).join(', ') + (items.length > 12 ? ` (+${items.length - 12})` : '');

// F1. docs.json parses and has the four required fields.
let config = null;
try { config = JSON.parse(readFileSync(join(site, 'docs.json'), 'utf8')); } catch (error) { record('docs.json is valid JSON', false, error.message); }
if (config) {
  const missing = ['name', 'theme', 'navigation'].filter(key => !config[key]);
  if (!/^#[0-9a-fA-F]{6}$/.test(config.colors?.primary ?? '')) missing.push('colors.primary');
  record('docs.json has name, theme, colors.primary, and navigation', !missing.length, missing.join(', '));
}

// F2, F3. Every navigation page has a file, and every page file is in the navigation.
const navPages = [];
(function walk(node) {
  if (typeof node === 'string') { navPages.push(node); return; }
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (node && typeof node === 'object') for (const key of ['tabs', 'groups', 'pages', 'anchors', 'dropdowns']) if (node[key]) walk(node[key]);
})(config?.navigation ?? []);
const files = [];
(function collect(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (/\.mdx?$/.test(entry.name) && entry.name !== 'README.md') files.push(relative(site, path).replace(/\.mdx?$/, ''));
  }
})(site);
const missingFiles = navPages.filter(name => !existsSync(join(site, `${name}.mdx`)));
record('every navigation page has a file', navPages.length > 0 && !missingFiles.length, missingFiles.length ? list(missingFiles) : `${navPages.length} pages`);
const orphans = files.filter(name => !navPages.includes(name));
record('every page file is in the navigation', !orphans.length, list(orphans));

// F4. Internal links point at a page or a file in docs-site/.
const broken = [];
for (const name of files) {
  const text = page(name);
  for (const [, target] of text.matchAll(/(?:\]\(|href=")(\/[^)"#\s]*)/g)) {
    const path = target.replace(/^\/|\/$/g, '');
    if (!(path === '' ? navPages.includes('index') : navPages.includes(path) || existsSync(join(site, path)))) broken.push(`${name} -> ${target}`);
  }
}
record('internal links resolve', !broken.length, list(broken));

// F5. The CLI reference covers every command in `help --all`, and names no command the CLI lacks.
const help = cli(['help', '--all']).stdout;
const helpCommands = [...new Set([...help.matchAll(/^ {2}conquistador ([a-z]+)/gm)].map(match => match[1]))];
const dispatcher = new Set([...read('runtime/bin/conquistador.js').matchAll(/["']([a-z]+)["']/g)].map(match => match[1]));
const cliPage = page('reference/cli');
const documented = [...new Set([...cliPage.matchAll(/^#{2,3} `conquistador ([a-z]+)/gm)].map(match => match[1]))];
const required = [...helpCommands, 'check', 'connect', 'review', 'pin', 'unpin'];
const undocumentedCommands = required.filter(name => !documented.includes(name));
record('CLI reference documents every command', !undocumentedCommands.length, undocumentedCommands.length ? list(undocumentedCommands) : `${documented.length} commands`);
const unknownCommands = documented.filter(name => !dispatcher.has(name));
record('CLI reference names only real commands', !unknownCommands.length, list(unknownCommands));

// F6. The MCP reference matches the server's tools and their inputs.
const handler = createMcpHandler({ requireInitialize: false });
const tools = (await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools;
const mcpPage = page('reference/mcp-tools');
const section = (text, heading) => {
  const start = text.indexOf(heading);
  if (start < 0) return '';
  const next = text.slice(start + heading.length).search(/\n## /);
  return text.slice(start, next < 0 ? undefined : start + heading.length + next);
};
const toolGaps = [];
for (const tool of tools) {
  const body = section(mcpPage, `## \`${tool.name}\``);
  if (!body) { toolGaps.push(`${tool.name}: no section`); continue; }
  for (const input of Object.keys(tool.inputSchema.properties ?? {})) if (!body.includes(`\`${input}\``)) toolGaps.push(`${tool.name}.${input}`);
  for (const output of Object.keys(tool.outputSchema?.properties ?? {})) if (!body.includes(`\`${output}\``)) toolGaps.push(`${tool.name} output ${output}`);
}
record('MCP reference documents every tool, input, and output field', !toolGaps.length, toolGaps.length ? list(toolGaps) : `${tools.length} tools`);
const documentedTools = [...mcpPage.matchAll(/^## `(conquistador_[a-z]+)`/gm)].map(match => match[1]);
const unknownTools = documentedTools.filter(name => !tools.some(tool => tool.name === name));
record('MCP reference names only real tools', !unknownTools.length, list(unknownTools));

// F7. The check page lists every rule, and its rule tables name no rule that does not exist.
const rules = JSON.parse(cli(['check', '--rules', '--json']).stdout).map(rule => rule.id);
const contextRule = 'claim-not-in-context'; // Added by conquistador_check when the caller sends context.
const checkPage = page('check');
const missingRules = rules.filter(id => !checkPage.includes(`\`${id}\``));
record('check page lists every rule', !missingRules.length, missingRules.length ? list(missingRules) : `${rules.length} rules`);
const tableRules = [...checkPage.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map(match => match[1]);
const unknownRules = tableRules.filter(id => !rules.includes(id) && id !== contextRule);
record('check page names only real rules', !unknownRules.length, list(unknownRules));

// F8. Everything on main that npm 0.3.0 lacks is marked "from 0.4.0" where it is listed.
const rules030 = [...git(['show', 'v0.3.0:tools/check/rules.mjs']).matchAll(/id: '([a-z0-9-]+)'/g)].map(match => match[1]);
const newRules = rules.filter(id => !rules030.includes(id));
const unmarkedRules = newRules.filter(id => !checkPage.split('\n').some(line => line.includes(`\`${id}\``) && /0\.4\.0/.test(line)));
record('rules newer than 0.3.0 are marked from 0.4.0', newRules.length > 0 && !unmarkedRules.length, unmarkedRules.length ? list(unmarkedRules) : newRules.join(', '));
const tools030 = [...git(['show', 'v0.3.0:tools/skills-mcp.mjs']).matchAll(/name: '(conquistador_[a-z]+)'/g)].map(match => match[1]);
const newTools = tools.map(tool => tool.name).filter(name => !tools030.includes(name));
const unmarkedTools = newTools.filter(name => !/0\.4\.0/.test(section(mcpPage, `## \`${name}\``)));
record('MCP tools newer than 0.3.0 are marked from 0.4.0', newTools.length > 0 && !unmarkedTools.length, unmarkedTools.length ? list(unmarkedTools) : newTools.join(', '));

// F9. Repository files whose content moved point to the site and keep only what tests and
// offline readers need.
const moved = { 'INSTALL.md': 'install/overview', 'docs/CHECK.md': 'check' };
for (const [file, target] of Object.entries(moved)) {
  const text = read(file);
  const lines = text.trim().split('\n').length;
  record(`${file} points to the site`, text.includes(`${SITE_URL}/${target}`) && text.includes(`docs-site/${target}.mdx`) && lines <= 40, `${lines} lines`);
}
record('README links to the docs site', read('README.md').includes(SITE_URL));

// F10. context7.json is valid for the Context7 schema and indexes docs-site/.
try {
  const context7 = JSON.parse(read('context7.json'));
  const known = ['$schema', 'projectTitle', 'description', 'branch', 'folders', 'excludeFolders', 'excludeFiles', 'rules', 'disallow', 'redirect', 'previousVersions', 'url', 'public_key'];
  const unknown = Object.keys(context7).filter(key => !known.includes(key));
  const problems = [
    ...unknown.map(key => `unknown key ${key}`),
    context7.$schema === 'https://context7.com/schema/context7.json' ? null : '$schema',
    Array.isArray(context7.folders) && context7.folders.includes('docs-site') ? null : 'folders must include docs-site',
    (context7.description?.length ?? 0) >= 10 && context7.description.length <= 500 ? null : 'description length 10-500',
    (context7.rules ?? []).every(rule => rule.length >= 1 && rule.length <= 255) ? null : 'rule length 1-255',
  ].filter(Boolean);
  record('context7.json is valid and indexes docs-site/', !problems.length, problems.join(', '));
} catch (error) { record('context7.json is valid and indexes docs-site/', false, error.message); }

// F12. No AI-writing tells or hype in the pages. The check page quotes the rule words on purpose.
const scanned = files.filter(name => name !== 'check').map(name => join(site, `${name}.mdx`));
const scan = spawnSync(process.execPath, [bin, 'check', '--json', '--no-config', '--channel', 'article', ...scanned], { cwd: root, encoding: 'utf8' });
const tells = JSON.parse(scan.stdout || '[]').filter(finding => finding.family === 'ai-tells' && finding.severity !== 'advisory');
record('pages have no AI-writing tells', scan.status !== 1 && !tells.length, tells.length ? list(tells.map(finding => `${relative(site, finding.file)}:${finding.line} ${finding.rule}`)) : `${scanned.length} pages`);

// F14. docs-site/ stays out of the npm package.
const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
try {
  const packed = JSON.parse(pack.stdout)[0].files.map(file => file.path);
  const leaked = packed.filter(path => path.startsWith('docs-site/') || path === 'context7.json');
  record('docs-site/ is not in the npm package', !leaked.length, leaked.length ? list(leaked) : `${packed.length} files packed`);
} catch (error) { record('docs-site/ is not in the npm package', false, `npm pack failed: ${error.message}`); }

// F11. With --live, every page renders through the running preview.
if (live) {
  const failed = [];
  for (const name of navPages) {
    const url = `${live.replace(/\/$/, '')}/${name === 'index' ? '' : name}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const html = await response.text();
      if (response.status !== 200 || !html.includes('<title')) failed.push(`${name} ${response.status}`);
    } catch (error) { failed.push(`${name} ${error.message}`); }
  }
  record('every page renders in the live preview', !failed.length, failed.length ? list(failed) : `${navPages.length} pages at ${live}`);
}

// Report.
mkdirSync(out, { recursive: true });
const report = {
  createdAt: new Date().toISOString(),
  commit: git(['rev-parse', 'HEAD']).trim(),
  node: process.version,
  live: live ?? null,
  pages: navPages.length,
  passed: results.filter(item => item.pass).length,
  total: results.length,
  results,
};
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'report.md'), `# Docs site E2E\n\n${report.createdAt}, commit ${report.commit}, Node ${report.node}${live ? `, live ${live}` : ''}\n\n${report.passed}/${report.total} passed\n\n| Result | Check | Detail |\n|---|---|---|\n${results.map(item => `| ${item.pass ? 'PASS' : 'FAIL'} | ${item.name} | ${item.detail.replaceAll('|', '\\|')} |`).join('\n')}\n`);
process.stdout.write(`\n${report.passed}/${report.total} passed. Report: ${relative(root, join(out, 'report.md'))}\n`);
process.exitCode = report.passed === report.total ? 0 : 1;
