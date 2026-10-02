// Bot pack: a system prompt plus upload-ready knowledge files for chat apps that take
// instructions and files but cannot run MCP (custom GPTs, Claude Projects, Grok projects, Gems).
// Apps that accept MCP connectors (Muse, ChatGPT developer mode, Claude.ai) should use
// `conquistador mcp --http` instead; it serves the same playbooks with task-aware briefs.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { knowledgeIndex } from './brief.mjs';
import { productRoot, version } from './agents.mjs';
import { AREAS } from './tour.mjs';

// At most 20 files: the tightest common upload limit.
export const GROUPS = [
  ['01-launch-and-campaigns', ['campaign', 'event', 'budget', 'shape']],
  ['02-positioning-and-brand', ['position', 'brand', 'pricing']],
  ['03-copy', ['copy', 'article', 'vietnamese', 'critique']],
  ['04-social-and-community', ['social', 'ideas', 'channels']],
  ['05-short-form-video', ['video', 'watch', 'creative']],
  ['06-search-and-answer-engines', ['seo']],
  ['07-paid-and-outreach', ['ads', 'outreach', 'results']],
  ['08-conversion-and-growth', ['convert', 'diagnose', 'funnel', 'measure', 'audit', 'prioritize']],
  ['09-decisions-and-knowledge', ['decide', 'factcheck', 'feedback']],
  ['10-product-and-engineering', ['flow', 'ui', 'architect', 'build', 'docs']],
];

const SYSTEM_PROMPT = `You are Conquistador, a marketing and growth operator for any platform, any service, and growth inside the product: strategy, launches, social, search and AI answers, paid ads, email and outreach, in-product growth, content, and measurement.

Your knowledge files are field-tested playbooks. They are the standard your answers are judged against.

For every task:
1. Find the matching playbook file with 00-index.md and read the relevant sections before you answer. Search the knowledge files for the platform, channel, or task the user names.
2. If the user's own playbooks are attached (99-your-playbooks.md), apply them first; they outrank the built-in guidance.
3. Ask at most one question, and only when a missing fact would change the plan. Otherwise state the assumption and continue.
4. Lead with the finished work: the plan, the copy, the diagnosis. Then give two to four reasons tied to the playbooks or the user's facts, and one next step.
5. End with "Playbooks applied": each file and section you used and the rule you took from it.
6. Never invent metrics, customer quotes, testimonials, or product capabilities. Label assumptions.
7. Never publish, send, spend, or change an external system. Draft it and ask the user to approve.
8. Use the user's brand and voice, not yours.
9. If the user has no task yet or asks what you do, list these areas in one short list, give three examples that fit their product, and ask what they are working on: ${AREAS.map(area => area.title).join('; ')}.`;

export const BOT_PACK_MANIFEST = '.conquistador-bot-pack.json';

const BOT_PACK_SCHEMA = 'conquistador.bot-pack/v1';

const digest = value => createHash('sha256').update(value).digest('hex');

const README = (files, userFiles) => `# Conquistador bot pack ${version}

Load this pack into a chat app that supports custom instructions and knowledge files.

1. Paste SYSTEM-PROMPT.md into the app's instructions field.
2. Upload only the knowledge files listed below (${files.length} files${userFiles ? ', including your private playbooks' : ''}).
3. Test with two different jobs, for example: "Write a win-back email flow for churned subscribers" and "Get our product recommended by ChatGPT and Perplexity". Each answer should end with Playbooks applied.

## Included knowledge files

${files.map(file => `- knowledge/${file}`).join('\n')}

${BOT_PACK_MANIFEST} records these files and the generated instructions and README with their SHA-256 hashes. It is ownership metadata, not an upload file. Rebuilding replaces only an unchanged owned pack; keep personal files and edits elsewhere. Older packs without this manifest must be left in place and a new output folder chosen.

| App | Instructions field | Knowledge files |
| --- | --- | --- |
| ChatGPT custom GPT | Configure → Instructions | Configure → Knowledge |
| Claude Project | Project instructions | Project knowledge |
| Grok project | Project instructions | Project files |
| Gemini Gem | Instructions | Knowledge |

These app screens are not verified by Conquistador tests. The file layout is.

## Apps that accept MCP connectors (Muse, ChatGPT developer mode, Claude.ai connectors)

Use the MCP server instead. It picks the playbooks for each task, which files alone cannot do:

    CONQUISTADOR_MCP_TOKEN=choose-a-secret conquistador mcp --http --host 0.0.0.0 --port 8787

Deploy it (Dockerfile in the package runs this command), then add the connector URL
https://YOUR-HOST/mcp with header "Authorization: Bearer <token>".

## Privacy

${userFiles ? 'knowledge/99-your-playbooks.md contains your private playbooks. Upload it only to accounts you control.' : 'No private playbooks are included in this pack.'} Rebuilding this local pack does not remove files already uploaded to a chat app; remove any old private upload there separately.
`;

function writeBotPack(out, index, includeUser) {
  fs.mkdirSync(join(out, 'knowledge'), { mode: 0o700 });
  const write = (path, content) => fs.writeFileSync(join(out, path), content, { mode: 0o600 });
  const users = includeUser ? index.users : [];
  const methods = index.contract.methods;
  const read = path => fs.readFileSync(join(index.packageRoot, path), 'utf8');
  const keep = doc => !['process', 'specialist'].includes(doc.kind);
  const lines = ['# Conquistador knowledge index', '', 'Find the task, then read the listed file and section.', ''];
  const seen = new Set();
  const written = [];

  for (const [file, names] of GROUPS) {
    const parts = [`# ${file.slice(3).replace(/-/g, ' ')}`, ''];
    lines.push(`## ${file}.md`);

    for (const name of names) {
      const method = methods[name];

      if (!method) continue;
      lines.push(`- ${method.label}: ${method.description.split('. ')[0]}.`);
      parts.push(`\n\n# METHOD: ${method.label}\n\n${read(method.path)}`);

      for (const doc of index.docs.filter(item => item.source === 'method' && item.method === name && keep(item)).sort((a, b) => a.key.localeCompare(b.key))) {
        if (seen.has(doc.digest)) { parts.push(`\n\n## PLAYBOOK: ${posix.basename(doc.key)} (same text as an earlier section)`); continue; }

        seen.add(doc.digest);
        parts.push(`\n\n## PLAYBOOK: ${doc.key}\n\n${fs.readFileSync(doc.absolute, 'utf8')}`);
      }
    }

    write(`knowledge/${file}.md`, parts.join('\n'));
    written.push(`${file}.md`);
    lines.push('');
  }

  // Shared channel guides, standards, and plays (with their playbooks) from the parent.
  const shared = index.docs.filter(doc => (doc.source === 'shared' || doc.source === 'play') && ['channel', 'playbook', 'play', 'standard', 'checklist'].includes(doc.kind) && !seen.has(doc.digest));
  write('knowledge/11-channels-standards-workflows.md', ['# Channels, standards, and plays', ...shared.map(doc => `\n\n## ${doc.key}\n\n${fs.readFileSync(doc.absolute, 'utf8')}`)].join('\n'));
  written.push('11-channels-standards-workflows.md');
  lines.push('## 11-channels-standards-workflows.md', '- Channel guides (Product Hunt, Reddit, LinkedIn, X, TikTok, YouTube, Instagram, Hacker News, newsletters), quality and safety standards, and plays (multi-step chains of commands).', '');

  if (users.length) {
    write('knowledge/99-your-playbooks.md', ['# Your playbooks (rank these first)', ...users.map(doc => `\n\n## ${doc.key}\n\n${fs.readFileSync(doc.absolute, 'utf8')}`)].join('\n'));
    written.push('99-your-playbooks.md');
    lines.push('## 99-your-playbooks.md', `- ${users.length} private playbooks from your configured folders. These outrank built-in guidance.`, '');
  }

  const files = ['00-index.md', ...written];
  write('knowledge/00-index.md', lines.join('\n'));
  write('SYSTEM-PROMPT.md', `${SYSTEM_PROMPT}\n`);
  write('README.md', README(files, users.length));

  const manifest = {
    schemaVersion: BOT_PACK_SCHEMA, productVersion: version, users: users.length,
    knowledgeFiles: files,
    files: ['README.md', 'SYSTEM-PROMPT.md', ...files.map(file => `knowledge/${file}`)].sort()
      .map(path => ({ path, sha256: digest(fs.readFileSync(join(out, path))) })),
  };

  write(BOT_PACK_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  return { files, users: users.length };
}

function statAt(path) {
  try { return fs.lstatSync(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// A receipt alone is not enough: verify its complete, unchanged inventory before deleting
// any previous output. Refuse legacy packs, foreign files, local edits, and all symlinks.
function destinationState(out) {
  const stat = statAt(out);

  if (!stat) return null;
  const refuse = reason => { throw Error(`Cannot replace bot pack at ${out}: ${reason}. Choose a new or empty output directory; the existing files have been preserved.`); };

  if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('destination is not a regular directory');
  const identity = `${stat.dev}:${stat.ino}`;
  const entries = fs.readdirSync(out).sort();

  if (!entries.length) return `${identity}:empty`;
  const receiptStat = statAt(join(out, BOT_PACK_MANIFEST));

  if (!receiptStat?.isFile() || receiptStat.isSymbolicLink()) refuse('missing ownership manifest');
  const raw = fs.readFileSync(join(out, BOT_PACK_MANIFEST), 'utf8');
  let manifest;

  try { manifest = JSON.parse(raw); } catch { refuse('invalid ownership manifest'); }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Parse untrusted receipt JSON at the filesystem boundary without string coercion.
  const knowledgeName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*\.md$/.test(value);

  if (manifest?.schemaVersion !== BOT_PACK_SCHEMA || !Array.isArray(manifest.files)
    || !Array.isArray(manifest.knowledgeFiles) || !manifest.knowledgeFiles.every(knowledgeName)
    || !Number.isSafeInteger(manifest.users) || manifest.users < 0) refuse('invalid ownership manifest');
  const files = manifest.files;
  const expected = ['README.md', 'SYSTEM-PROMPT.md', ...manifest.knowledgeFiles.map(file => `knowledge/${file}`)].sort();

  if (!manifest.knowledgeFiles.includes('00-index.md') || new Set(expected).size !== expected.length
    || files.length !== expected.length || files.some((file, i) => file?.path !== expected[i] || !/^[a-f0-9]{64}$/.test(file.sha256))) refuse('invalid ownership inventory');

  if (entries.join('\0') !== [BOT_PACK_MANIFEST, 'README.md', 'SYSTEM-PROMPT.md', 'knowledge'].sort().join('\0')) refuse('unowned files or directories');
  const knowledge = statAt(join(out, 'knowledge'));

  if (!knowledge?.isDirectory() || knowledge.isSymbolicLink()) refuse('knowledge is not a regular directory');

  if (fs.readdirSync(join(out, 'knowledge')).sort().join('\0') !== [...manifest.knowledgeFiles].sort().join('\0')) refuse('unowned or missing knowledge files');

  for (const file of files) {
    const path = join(out, file.path);
    const info = statAt(path);

    if (!info?.isFile() || info.isSymbolicLink() || digest(fs.readFileSync(path)) !== file.sha256) refuse('generated files have local edits or are missing');
  }

  return `${identity}:${digest(raw)}`;
}

export function buildBotPack(out, { root = productRoot, includeUser = true } = {}) {
  out = resolve(out);
  const before = destinationState(out);
  // Excluding private playbooks also avoids indexing/reading their source folders.
  const index = knowledgeIndex(root, includeUser ? {} : { playbooks: [] });
  fs.mkdirSync(dirname(out), { recursive: true });
  const stage = fs.mkdtempSync(join(dirname(out), '.conquistador-bot-stage-'));
  let previous;

  try {
    const result = writeBotPack(stage, index, includeUser);

    if (destinationState(out) !== before) throw Error('Bot pack destination changed during staging. Run again with a new output directory.');

    if (before !== null) {
      previous = fs.mkdtempSync(join(dirname(out), '.conquistador-bot-previous-'));
      fs.renameSync(out, join(previous, 'pack'));

      // Recheck after taking ownership of the old directory too, in case another
      // writer changed it between the preflight and rename. Roll back on any drift.
      if (destinationState(join(previous, 'pack')) !== before) throw Error('Bot pack destination changed during replacement.');
    }

    fs.renameSync(stage, out);

    if (previous) fs.rmSync(previous, { recursive: true });

    return { out, ...result };
  } catch (error) {
    const backup = previous && join(previous, 'pack');

    if (backup && statAt(backup)) {
      // If another process supplied a destination, never delete it to roll back.
      try {
        if (statAt(out)) throw Error('destination is occupied');
        fs.renameSync(backup, out);
      } catch (restoreError) {
        throw Error(`Bot pack replacement failed. Previous output is preserved at ${backup}; inspect it before retrying. ${error.message}`, { cause: restoreError });
      }
    }

    throw error;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });

    // Remove only an empty recovery container; never discard an unrecovered pack.
    if (previous && statAt(previous) && !fs.readdirSync(previous).length) fs.rmdirSync(previous);
  }
}

export function runBotPack(args) {
  let destination = 'conquistador-bot';
  let selected = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--no-private') continue;

    if ((arg === '--out' || arg.startsWith('--out=')) && !selected) {
      destination = arg === '--out' ? args[++index] : arg.slice('--out='.length);

      if (!destination || destination.startsWith('-')) {
        console.error('--out requires an output directory.');

        return 2;
      }

      selected = true;
    } else {
      console.error(`Unsupported bot argument: ${arg}. Use bot [--out DIR] [--no-private]. Nothing written.`);

      return 2;
    }
  }

  const out = resolve(destination);
  const result = buildBotPack(out, { includeUser: !args.includes('--no-private') });
  console.log(`Bot pack written to ${result.out}\n  SYSTEM-PROMPT.md  paste into the app's instructions\n  knowledge/        upload the ${result.files.length} files listed in README.md${result.users ? ` (includes ${result.users} private playbooks; add --no-private to leave them out)` : ''}\n  README.md         per-app steps, and the MCP option for Muse and other connector apps`);

  return 0;
}
