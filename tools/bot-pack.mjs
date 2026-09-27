// Bot pack: a system prompt plus upload-ready knowledge files for chat apps that take
// instructions and files but cannot run MCP (custom GPTs, Claude Projects, Grok projects, Gems).
// Apps that accept MCP connectors (Muse, ChatGPT developer mode, Claude.ai) should use
// `conquistador mcp --http` instead; it serves the same playbooks with task-aware briefs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { knowledgeIndex } from './brief.mjs';
import { productRoot, version } from './agents.mjs';
import { AREAS } from './tour.mjs';

// At most 20 files: the tightest common upload limit.
export const GROUPS = [
  ['01-launch-and-campaigns', ['plan-campaign', 'create-run-of-show', 'allocate-marketing-budget', 'shape-initiative']],
  ['02-positioning-and-brand', ['research-positioning', 'create-brand', 'design-pricing-and-packaging']],
  ['03-copy', ['write-copy', 'write-longform', 'polish-vietnamese', 'fresh-eyes-review']],
  ['04-social-and-community', ['write-social', 'research-content-ideas', 'research-channel']],
  ['05-short-form-video', ['create-shortform', 'evaluate-shortform', 'analyze-video', 'brief-creative']],
  ['06-search-and-answer-engines', ['optimize-search']],
  ['07-paid-and-outreach', ['create-paid-campaign', 'evaluate-paid-campaign', 'write-outreach', 'evaluate-outreach']],
  ['08-conversion-and-growth', ['improve-conversion', 'diagnose-growth', 'model-growth-funnel', 'measure-growth', 'audit-marketing', 'prioritize-opportunities']],
  ['09-decisions-and-knowledge', ['decision-panel', 'knowledge-review', 'submit-feedback']],
  ['10-product-and-engineering', ['map-user-flow', 'brief-product-ui', 'architect-software-system', 'build-ios-app', 'build-web-app', 'write-technical-docs']],
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

const README = (files, userFiles) => `# Conquistador bot pack ${version}

Load this pack into a chat app that supports custom instructions and knowledge files.

1. Paste SYSTEM-PROMPT.md into the app's instructions field.
2. Upload every file in knowledge/ (${files} files${userFiles ? ', including your private playbooks' : ''}).
3. Test with two different jobs, for example: "Write a win-back email flow for churned subscribers" and "Get our product recommended by ChatGPT and Perplexity". Each answer should end with Playbooks applied.

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
${userFiles ? '\n## Privacy\n\nknowledge/99-your-playbooks.md contains your private playbooks. Upload it only to accounts you control.\n' : ''}`;

export function buildBotPack(out, { root = productRoot, includeUser = true } = {}) {
  const index = knowledgeIndex(root);
  mkdirSync(join(out, 'knowledge'), { recursive: true });
  const methods = index.contract.methods;
  const read = path => readFileSync(join(index.packageRoot, path), 'utf8');
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
      for (const doc of index.docs.filter(item => item.method === name && keep(item)).sort((a, b) => a.key.localeCompare(b.key))) {
        if (seen.has(doc.digest)) { parts.push(`\n\n## PLAYBOOK: ${posix.basename(doc.key)} (same text as an earlier section)`); continue; }
        seen.add(doc.digest);
        parts.push(`\n\n## PLAYBOOK: ${doc.key}\n\n${readFileSync(doc.absolute, 'utf8')}`);
      }
    }
    writeFileSync(join(out, 'knowledge', `${file}.md`), parts.join('\n'));
    written.push(`${file}.md`);
    lines.push('');
  }
  // Shared channel guides, standards, and composition workflows from the parent.
  const shared = index.docs.filter(doc => doc.source === 'shared' && ['channel', 'playbook', 'workflow', 'standard', 'checklist'].includes(doc.kind) && !seen.has(doc.digest));
  writeFileSync(join(out, 'knowledge', '11-channels-standards-workflows.md'), ['# Channels, standards, and workflows', ...shared.map(doc => `\n\n## ${doc.key}\n\n${readFileSync(doc.absolute, 'utf8')}`)].join('\n'));
  written.push('11-channels-standards-workflows.md');
  lines.push('## 11-channels-standards-workflows.md', '- Channel guides (Product Hunt, Reddit, LinkedIn, X, TikTok, YouTube, Instagram, Hacker News, newsletters), quality and safety standards, and multi-step workflows.', '');
  if (includeUser && index.users.length) {
    writeFileSync(join(out, 'knowledge', '99-your-playbooks.md'), ['# Your playbooks (rank these first)', ...index.users.map(doc => `\n\n## ${doc.key}\n\n${readFileSync(doc.absolute, 'utf8')}`)].join('\n'));
    written.push('99-your-playbooks.md');
    lines.push('## 99-your-playbooks.md', `- ${index.users.length} private playbooks from your configured folders. These outrank built-in guidance.`, '');
  }
  writeFileSync(join(out, 'knowledge', '00-index.md'), lines.join('\n'));
  writeFileSync(join(out, 'SYSTEM-PROMPT.md'), `${SYSTEM_PROMPT}\n`);
  writeFileSync(join(out, 'README.md'), README(written.length + 1, index.users.length > 0));
  return { out, files: ['00-index.md', ...written], users: index.users.length };
}

export function runBotPack(args) {
  const outIndex = args.indexOf('--out');
  const out = resolve(outIndex >= 0 ? args[outIndex + 1] : 'conquistador-bot');
  const result = buildBotPack(out, { includeUser: !args.includes('--no-private') });
  console.log(`Bot pack written to ${result.out}\n  SYSTEM-PROMPT.md  paste into the app's instructions\n  knowledge/        upload these ${result.files.length} files${result.users ? ` (includes ${result.users} private playbooks; add --no-private to leave them out)` : ''}\n  README.md         per-app steps, and the MCP option for Muse and other connector apps`);
  return 0;
}
