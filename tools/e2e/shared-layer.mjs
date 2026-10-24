// Measure how much shared process text reaches the model next to craft text for typical requests.
// No model or external account. Writes dist/e2e/shared-layer/report.json.
// Surfaces: the conquistador_brief tool, the CLI brief, the invoked parent skill, and the runtime corpus.
// Shared text is the parent skill, required standards, and brief header rules. Craft text is the
// command resources the brief inlines. Tokens are estimated at 4 bytes per token.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConquistador } from '../../api/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const parent = join(root, 'skills/conquistador');
const bytes = text => Buffer.byteLength(text);
const tokens = size => Math.round(size / 4);
const read = path => readFileSync(join(parent, path), 'utf8');
const body = text => text.replace(/^---\n[\s\S]*?\n---\n/, '');

export const tasks = ['Write landing page copy for our SaaS', 'Write a cold outreach sequence to agency COOs', 'Write a LinkedIn post about our product launch'];
// Files every substantial run applies: the parent skill and the required standards in routing-contract.json.
export const sharedFiles = ['SKILL.md', 'standards/quality.md', 'standards/safety.md', 'standards/context.md'];

const contract = JSON.parse(read('routing-contract.json'));
// Parent-level references or standards that a command lists as required, such as a writing guide.
const requiredShared = command => (contract.methods[command]?.requiredResources ?? [])
  .filter(path => /^skills\/conquistador\/(?:references|standards)\/[^/]+\.md$/.test(path))
  .map(path => path.slice('skills/conquistador/'.length));

export function measure() {
  const app = createConquistador();
  const skill = bytes(body(read('SKILL.md')));
  const standards = sharedFiles.slice(1).reduce((total, path) => total + bytes(read(path)), 0);
  const requests = tasks.map(task => {
    const result = app.callTool('conquistador_brief', { task });
    const text = result.content[0].text;
    const first = text.search(/^## .+\nFile: /m);
    const header = bytes(first < 0 ? text : text.slice(0, first));
    const craft = bytes(text) - header;
    const cli = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), 'brief', task, '--full'], { encoding: 'utf8' });
    const required = requiredShared(result.structuredContent.command);
    const requiredBytes = required.reduce((total, path) => total + bytes(read(path)), 0);
    const shared = skill + standards + header + requiredBytes;
    return {
      task,
      command: result.structuredContent.command,
      inlined: result.structuredContent.inlined.map(item => item.path),
      briefBytes: bytes(text),
      cliBriefBytes: bytes(cli.stdout),
      requiredShared: required,
      sharedBytes: { skill, standards, header, required: requiredBytes, total: shared },
      craftBytes: craft,
      tokens: { shared: tokens(shared), craft: tokens(craft), ratio: Number((shared / Math.max(craft, 1)).toFixed(2)) },
    };
  });
  return { skillBytes: skill, standardsBytes: standards, requests };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = measure();
  const sources = Object.fromEntries(sharedFiles.map(path => [path, createHash('sha256').update(read(path)).digest('hex')]));
  const out = join(root, 'dist/e2e/shared-layer');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.json'), `${JSON.stringify({ sources, ...report }, null, 2)}\n`);
  for (const item of report.requests) {
    console.log(`${item.command}: brief ${item.briefBytes} B; shared ${item.sharedBytes.total} B (~${item.tokens.shared} tokens); craft ${item.craftBytes} B (~${item.tokens.craft} tokens); shared/craft ${item.tokens.ratio}`);
  }
  console.log(join(out, 'report.json'));
}
