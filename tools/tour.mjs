// The capability tour: what Conquistador covers, by area, with example prompts.
// One source for `conquistador tour`, the start picker's area list, the bot pack, and skills/conquistador/welcome.md.
// Every example is also a routing-breadth case (tools/e2e/routing-breadth.mjs), so none can drift.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// `methods` lists the commands a user meets in this area: command or play names.
export const AREAS = Object.freeze([
  {
    id: 'strategy', title: 'Strategy and research',
    covers: 'Positioning, ICP, competitors, pricing, channel choice, budget, growth targets',
    methods: ['position', 'channels', 'pricing', 'prioritize', 'funnel', 'budget', 'shape', 'decide'],
    examples: [
      { prompt: 'Figure out our positioning against the two biggest competitors, with evidence', any: ['position'] },
      { prompt: 'Model what it takes to hit $50k MRR by June', any: ['funnel'] },
    ],
  },
  {
    id: 'launch', title: 'Launches and campaigns',
    covers: 'Product Hunt, Hacker News, App Store, feature launches, seasonal campaigns, webinars, live events',
    methods: ['campaign', 'launch', 'event'],
    examples: [
      { prompt: 'Plan a Product Hunt launch for our app in three weeks with no budget', any: ['campaign', 'launch'], platforms: ['producthunt'] },
      { prompt: 'Run a webinar to generate B2B pipeline', any: ['event', 'campaign'] },
    ],
  },
  {
    id: 'social', title: 'Social, community, and video',
    covers: 'X, LinkedIn, Reddit, Instagram, Facebook, TikTok, YouTube, Threads, Bluesky, Discord, communities',
    methods: ['social', 'ideas', 'video', 'watch'],
    examples: [
      { prompt: 'Write LinkedIn thought leadership posts for our CEO', any: ['social'], platforms: ['linkedin'] },
      { prompt: 'Script three TikTok videos for our budgeting app', any: ['video'], platforms: ['tiktok'] },
      { prompt: 'Grow our Discord community from 500 to 5000 members', any: ['channels', 'campaign', 'social'], none: ['event'] },
    ],
  },
  {
    id: 'search', title: 'Search and AI answers',
    covers: 'Google SEO, programmatic SEO, ChatGPT and Perplexity answers, App Store and Google Play listings',
    methods: ['seo', 'answers', 'pseo', 'appstore'],
    examples: [
      { prompt: 'Get our product recommended by ChatGPT and Perplexity', any: ['seo', 'answers'] },
      { prompt: 'Optimize our App Store listing screenshots and keywords', any: ['seo', 'trailer'] },
    ],
  },
  {
    id: 'paid', title: 'Paid ads',
    covers: 'Google, Meta, LinkedIn, TikTok, Reddit, and YouTube ads, UGC creators, creative briefs, results reviews',
    methods: ['ads', 'creative', 'results', 'paid'],
    examples: [
      { prompt: 'Set up a Google Ads search campaign with a $3k monthly budget', any: ['ads'] },
      { prompt: 'Our Meta ads CPA doubled last week; evaluate the campaign results', any: ['results'] },
    ],
  },
  {
    id: 'email', title: 'Email, outreach, and PR',
    covers: 'Cold email, sales follow-ups, LinkedIn DMs, welcome and win-back emails, newsletters, press, podcasts, partners',
    methods: ['outreach', 'results', 'lifecycle', 'press', 'outbound'],
    examples: [
      { prompt: 'Write a 4-step cold email sequence to HR directors at mid-size companies', any: ['outreach'] },
      { prompt: 'Build a win-back email flow for churned subscribers', any: ['lifecycle', 'copy', 'campaign'], none: ['flow', 'ui'] },
      { prompt: 'Get press coverage in TechCrunch for our Series A', any: ['outreach', 'channels', 'position'] },
    ],
  },
  {
    id: 'product', title: 'Growth inside the product',
    covers: 'Onboarding, activation, paywalls, trials, upgrade prompts, referral loops, checkout and page conversion',
    methods: ['convert', 'flow', 'pricing', 'referral', 'ui'],
    examples: [
      { prompt: 'Improve activation in our onboarding; only 20% of signups create a project', any: ['lifecycle', 'convert', 'flow'] },
      { prompt: 'Plan a paywall and trial experiment for our mobile app', any: ['pricing', 'convert'], none: ['budget'] },
      { prompt: 'Design a referral program inside the product', any: ['referral'] },
    ],
  },
  {
    id: 'content', title: 'Copy, content, and brand',
    covers: 'Landing and product pages, blog posts, case studies, brand voice and identity, Vietnamese copy',
    methods: ['copy', 'article', 'brand', 'landing', 'vietnamese'],
    examples: [
      { prompt: 'Write landing page copy for our AI note-taking app', any: ['copy', 'landing'] },
      { prompt: 'Write a long-form blog post on why spreadsheets fail finance teams', any: ['article'] },
    ],
  },
  {
    id: 'measure', title: 'Measure and learn',
    covers: 'Growth drops, results reviews, campaign and video evaluations, marketing audits, fact checks',
    methods: ['diagnose', 'measure', 'results', 'audit', 'factcheck', 'critique'],
    examples: [
      { prompt: 'Our signups dropped 30% last month, find out why', any: ['diagnose'] },
      { prompt: 'Review last quarter\'s growth results and decide what to keep', any: ['measure'] },
    ],
  },
]);

export const ALSO = 'Also: product flows (`flow`), UI specs (`ui`), web and iOS builds (`build`), system architecture (`architect`), and technical docs (`docs`).';


// The name a user sees for each command in an area is the command itself.
export const SPECIALISTS = Object.freeze(Object.fromEntries(AREAS.flatMap(area => area.methods).map(name => [name, name])));
const label = name => name;
const GUIDE_KINDS = ['playbook', 'platform', 'checklist', 'channel', 'play'];

// Playbook counts per area, from the same index the brief uses.
export async function depth() {
  const { knowledgeIndex } = await import('./brief.mjs');
  const index = knowledgeIndex(root, { playbooks: [] });
  const counts = {};
  for (const area of AREAS) {
    const names = new Set(area.methods);
    counts[area.id] = index.docs.filter(doc => GUIDE_KINDS.includes(doc.kind)
      && doc.method && names.has(doc.method)).length;
  }
  return { counts, total: index.docs.filter(doc => GUIDE_KINDS.includes(doc.kind)).length };
}

export function mapLines({ width = 26 } = {}) {
  return AREAS.map(area => `${area.title.padEnd(width)} ${area.covers}`);
}

export function areaText(area) {
  return [
    area.covers,
    '',
    `Commands: ${area.methods.map(label).join(', ')}`,
    '',
    'Try:',
    ...area.examples.map(example => `  "${example.prompt}"`),
  ].join('\n');
}

export async function listText() {
  const { counts, total } = await depth();
  const lines = [`Conquistador covers marketing and growth on any platform, in any service, and inside the product.`, `${total} playbooks and guides across ${AREAS.length} areas. Ask your agent for the outcome; it reads the matching playbooks first.`, ''];
  for (const area of AREAS) {
    lines.push(`${area.title} (${counts[area.id]} playbooks)`, `  ${area.covers}`, `  Commands: ${area.methods.map(label).join(', ')}`);
    for (const example of area.examples) lines.push(`  • "${example.prompt}"`);
    lines.push('');
  }
  lines.push(ALSO);
  return lines.join('\n');
}

// The agent-facing copy of the tour. The parent skill shows it when the user asks what Conquistador does.
export async function welcomeMarkdown() {
  const lines = [
    '# Welcome to Conquistador',
    '',
    '<!-- Generated by `node tools/tour.mjs --write`. Edit tools/tour.mjs, not this file. -->',
    '',
    'Show this when the user invokes Conquistador without a task, asks what it can do, or seems new.',
    'Keep it short: show the areas and three or four examples that fit what you know about the user\'s',
    'product, then ask one question: "What are you working on?" Do not list internal paths.',
    '',
    'Conquistador is a marketing and growth operator. It covers any platform, any service, and growth',
    'inside the product. Each answer uses field-tested playbooks and ends with the playbooks applied.',
    'Users can name a command (`/conquistador copy`) or describe the outcome in plain words.',
    '',
    '| Area | Covers | Commands |',
    '| --- | --- | --- |',
    ...AREAS.map(area => `| ${area.title} | ${area.covers} | ${area.methods.map(name => `\`${name}\``).join(', ')} |`),
    '',
    ALSO,
    '',
    '## Example requests',
    '',
  ];
  for (const area of AREAS) {
    lines.push(`**${area.title}**`, '');
    for (const example of area.examples) lines.push(`- ${example.prompt}`);
    lines.push('');
  }
  lines.push(
    '## Make it theirs',
    '',
    '- Product facts: ask for the product, audience, goal, and constraints once, then reuse them.',
    '- Their own playbooks: `conquistador playbooks add DIR` ranks their notes ahead of built-in guidance.',
    '- Live data: connect CRM, ads, analytics, or docs through Executor (see methods/connect-accounts.md).',
    '',
  );
  return lines.join('\n');
}

export const welcomePath = () => join(root, 'skills/conquistador/welcome.md');

export async function runTour(args = []) {
  const wanted = args.find(arg => !arg.startsWith('-'));
  if (wanted) {
    const area = AREAS.find(item => item.id === wanted || item.title.toLowerCase().startsWith(wanted.toLowerCase()));
    if (!area) { console.error(`Unknown area: ${wanted}. Choose from: ${AREAS.map(item => item.id).join(', ')}.`); return 2; }
    console.log(`${area.title}\n\n${areaText(area)}`);
    return 0;
  }
  console.log(await listText());
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) { writeFileSync(welcomePath(), await welcomeMarkdown()); console.log(`Wrote ${welcomePath()}`); }
  else process.exitCode = await runTour(process.argv.slice(2));
}
