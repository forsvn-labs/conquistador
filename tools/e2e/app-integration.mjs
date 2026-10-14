#!/usr/bin/env node
// Install an actual tarball, then exercise only its public imports from an app.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from '../spawn.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const out = resolve(option('--out') ?? join(root, 'dist/e2e/app-integration'));
const installer = option('--installer') ?? 'npm';
if (!['npm', 'bun'].includes(installer)) throw Error('Use --installer npm or bun.');
const runtime = option('--runtime') ?? process.execPath;
mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'conquistador-app-e2e-'));
const app = join(work, 'app');
const home = join(work, 'home');
mkdirSync(app);
mkdirSync(home);
const env = { ...process.env, CONQUISTADOR_HOME: home, CONQUISTADOR_PLAYBOOKS: join(home, 'playbooks'), CONQUISTADOR_CACHE: join(work, 'cache') };
const checks = [];
const logs = [];
const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), ...(detail ? { detail } : {}) });
const run = (command, commandArgs, cwd = app) => {
  const resolved = spawnCommand(command, commandArgs, env);
  const result = spawnSync(resolved.file, resolved.args, { ...resolved.options, cwd, env, encoding: 'utf8', timeout: 180_000, maxBuffer: 4_000_000 });
  logs.push({ command: [command, ...commandArgs], exit: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message });
  return result;
};
let tarball = option('--package') ? resolve(option('--package')) : undefined;
let packageDigest;
try {
  if (!tarball) {
    const packed = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out], root);
    if (packed.status !== 0) throw Error('npm pack failed.');
    tarball = join(out, JSON.parse(packed.stdout)[0].filename);
  }
  packageDigest = createHash('sha256').update(readFileSync(tarball)).digest('hex');
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'conquistador-app-e2e', private: true, type: 'module' }));
  // These canaries must never reach a deployed caller. Installation itself runs normally.
  mkdirSync(join(home, 'playbooks'));
  writeFileSync(join(home, 'playbooks', 'revenue.md'), '# Revenue outreach cold email\n\nPRIVATE_HOME_CANARY revenue outreach Stripe HubSpot cold email RevOps.\n'.repeat(12));
  writeFileSync(join(app, 'PRODUCT.md'), '# PRIVATE_PROJECT_CANARY\n');
  writeFileSync(join(app, 'GROWTH.md'), '# PRIVATE_GROWTH_CANARY\n');
  const installed = installer === 'bun'
    ? run('bun', ['add', tarball])
    : run('npm', ['install', '--no-audit', '--no-fund', tarball]);
  check(`${installer} adds the tarball as a production dependency`, installed.status === 0 && Boolean(JSON.parse(readFileSync(join(app, 'package.json'))).dependencies?.['@forsvn/conquistador']));
  check('dependency installation starts no TUI or agent setup', !/Select agents|Choose agents|installer review|Conquistador is installed/.test(installed.stdout ?? '') && !existsSync(join(home, 'plugin')) && !existsSync(join(app, '.agents')));
  if (installed.status !== 0) throw Error('Dependency installation failed.');
  const pkg = JSON.parse(readFileSync(join(app, 'node_modules/@forsvn/conquistador/package.json')));
  check('the package publishes root and MCP exports with declarations', Boolean(pkg.exports?.['.']?.types && pkg.exports?.['./mcp']?.types));
  check('the package has no install lifecycle', !['preinstall', 'install', 'postinstall', 'prepare'].some(name => pkg.scripts?.[name]));
  const deps = run('npm', ['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', '@modelcontextprotocol/client@2.3.1', 'mcp-client-v1@npm:@modelcontextprotocol/sdk@1.32.1', 'typescript@7.0.2', '@types/node@24.13.3']);
  check('official MCP clients and the TypeScript compiler install', deps.status === 0);
  cpSync(join(root, 'tools/e2e/app-consumer.mjs'), join(app, 'consumer.mjs'));
  const consumer = run(runtime, ['consumer.mjs', join(out, 'consumer.json')]);
  if (existsSync(join(out, 'consumer.json'))) checks.push(...JSON.parse(readFileSync(join(out, 'consumer.json'))).checks);
  check('the installed consumer completes without a background process', consumer.status === 0, consumer.status === 0 ? undefined : (consumer.stderr || consumer.stdout || 'Consumer failed').slice(-900));
  if (consumer.status === 0) {
    writeFileSync(join(app, 'consumer.mts'), `import { createConquistador, type CheckResult } from '@forsvn/conquistador';
import { createMcpRequestHandler, createMcpFetchHandler } from '@forsvn/conquistador/mcp';
const cq = createConquistador({ receiptKey: 'test-only-signing-key' });
const brief = cq.callTool('conquistador_brief', { task: 'Write an outreach email', size: 'compact' });
const command: string | null | undefined = brief.structuredContent?.command;
const checked = cq.callTool('conquistador_check', { text: 'Compare revenue records.', channel: 'email' });
const check: CheckResult | undefined = checked.structuredContent;
const read = cq.callTool('conquistador_read', { path: 'conquistador/SKILL.md' });
const text: string = read.content[0].text;
createMcpRequestHandler({ token: 'test-only-token', authorize: request => Boolean(request.headers.authorization) });
createMcpFetchHandler({ authorize: async request => Boolean(request.headers.get('authorization')) });
// @ts-expect-error A task is required.
cq.callTool('conquistador_brief', {});
// @ts-expect-error These tools do not send email.
cq.callTool('conquistador_send', {});
// @ts-expect-error Use a supported channel.
cq.callTool('conquistador_check', { text: 'Draft', channel: 'not-a-channel' });
// @ts-expect-error Node and Fetch handlers take different request types.
createMcpFetchHandler({ authorize: request => Boolean(request.headers.authorization) });
void [command, check, text];
`);
    const typed = run(runtime, [join(app, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--types', 'node', 'consumer.mts']);
    check('a strict TypeScript consumer resolves both public imports and rejects invalid calls', typed.status === 0, typed.status === 0 ? undefined : typed.stdout?.slice(-900));
  }
  check('the app tools create no home state or disk cache', !existsSync(join(work, 'cache')) && !existsSync(join(home, 'config.json')) && !existsSync(join(home, 'plugin')));
} catch (error) {
  check('the package integration run completes', false, error.message);
} finally {
  const source = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const dirty = Boolean(spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim());
  const report = { schema: 'conquistador.e2e.app-integration/v1', date: new Date().toISOString(), source, dirty, tarball, sha256: packageDigest, installer, runtime, platform: process.platform, passed: checks.every(item => item.passed), checks, limits: 'Fixed drafts and real installed tools. No model, send, publish, or production deployment.' };
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(out, 'commands.json'), `${JSON.stringify(logs, null, 2)}\n`);
  for (const item of checks) console.log(`${item.passed ? 'pass' : 'FAIL'} ${item.name}`);
  console.log(`Report: ${join(out, 'report.json')}`);
  rmSync(work, { recursive: true, force: true });
  if (!report.passed) process.exitCode = 1;
}
