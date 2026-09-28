// The capability tour: what Conquistador covers, by area, with example prompts.
// One source for `conquistador tour`, the start picker's area list, the bot pack, and skills/conquistador/welcome.md.
// Every example is also a routing-breadth case (tools/e2e/routing-breadth.mjs), so none can drift.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// `methods` lists the specialists a user meets in this area: method or workflow names.
export const AREAS = Object.freeze([
  {
    id: 'strategy', title: 'Strategy and research',
    covers: 'Positioning, ICP, competitors, pricing, channel choice, budget, growth targets',
    methods: ['research-positioning', 'research-channel', 'design-pricing-and-packaging', 'prioritize-opportunities', 'model-growth-funnel', 'allocate-marketing-budget', 'shape-initiative', 'decision-panel'],
    examples: [
      { prompt: 'Figure out our positioning against the two biggest competitors, with evidence', any: ['research-positioning'] },
      { prompt: 'Model what it takes to hit $50k MRR by June', any: ['model-growth-funnel'] },
    ],
  },
  {
    id: 'launch', title: 'Launches and campaigns',
    covers: 'Product Hunt, Hacker News, App Store, feature launches, seasonal campaigns, webinars, live events',
    methods: ['plan-campaign', 'launch-product', 'create-run-of-show'],
    examples: [
      { prompt: 'Plan a Product Hunt launch for our app in three weeks with no budget', any: ['plan-campaign', 'launch-product'], platforms: ['producthunt'] },
      { prompt: 'Run a webinar to generate B2B pipeline', any: ['create-run-of-show', 'plan-campaign'] },
    ],
  },
  {
    id: 'social', title: 'Social, community, and video',
    covers: 'X, LinkedIn, Reddit, Instagram, Facebook, TikTok, YouTube, Threads, Bluesky, Discord, communities',
    methods: ['write-social', 'research-content-ideas', 'create-shortform', 'analyze-video'],
    examples: [
      { prompt: 'Write LinkedIn thought leadership posts for our CEO', any: ['write-social'], platforms: ['linkedin'] },
      { prompt: 'Script three TikTok videos for our budgeting app', any: ['create-shortform'], platforms: ['tiktok'] },
      { prompt: 'Grow our Discord community from 500 to 5000 members', any: ['research-channel', 'plan-campaign', 'write-social'], none: ['create-run-of-show'] },
    ],
  },
  {
    id: 'search', title: 'Search and AI answers',
    covers: 'Google SEO, programmatic SEO, ChatGPT and Perplexity answers, App Store and Google Play listings',
    methods: ['optimize-search', 'answer-visibility-monitor', 'build-programmatic-search', 'optimize-app-store-listing'],
    examples: [
      { prompt: 'Get our product recommended by ChatGPT and Perplexity', any: ['optimize-search', 'answer-visibility-monitor'] },
      { prompt: 'Optimize our App Store listing screenshots and keywords', any: ['optimize-search', 'create-app-preview'] },
    ],
  },
  {
    id: 'paid', title: 'Paid ads',
    covers: 'Google, Meta, LinkedIn, TikTok, Reddit, and YouTube ads, UGC creators, creative briefs, results reviews',
    methods: ['create-paid-campaign', 'brief-creative', 'evaluate-paid-campaign', 'paid-campaign-loop'],
    examples: [
      { prompt: 'Set up a Google Ads search campaign with a $3k monthly budget', any: ['create-paid-campaign'] },
      { prompt: 'Our Meta ads CPA doubled last week; evaluate the campaign results', any: ['evaluate-paid-campaign'] },
    ],
  },
  {
    id: 'email', title: 'Email, outreach, and PR',
    covers: 'Cold email, sales follow-ups, LinkedIn DMs, welcome and win-back emails, newsletters, press, podcasts, partners',
    methods: ['write-outreach', 'evaluate-outreach', 'lifecycle-campaign', 'earned-media-outreach', 'outreach-sequence'],
    examples: [
      { prompt: 'Write a 4-step cold email sequence to HR directors at mid-size companies', any: ['write-outreach'] },
      { prompt: 'Build a win-back email flow for churned subscribers', any: ['lifecycle-campaign', 'write-copy', 'plan-campaign'], none: ['map-user-flow', 'brief-product-ui'] },
      { prompt: 'Get press coverage in TechCrunch for our Series A', any: ['write-outreach', 'research-channel', 'research-positioning'] },
    ],
  },
  {
    id: 'product', title: 'Growth inside the product',
    covers: 'Onboarding, activation, paywalls, trials, upgrade prompts, referral loops, checkout and page conversion',
    methods: ['improve-conversion', 'map-user-flow', 'design-pricing-and-packaging', 'referral-loop', 'brief-product-ui'],
    examples: [
      { prompt: 'Improve activation in our onboarding; only 20% of signups create a project', any: ['lifecycle-campaign', 'improve-conversion', 'map-user-flow'] },
      { prompt: 'Plan a paywall and trial experiment for our mobile app', any: ['design-pricing-and-packaging', 'improve-conversion'], none: ['allocate-marketing-budget'] },
      { prompt: 'Design a referral program inside the product', any: ['referral-loop'] },
    ],
  },
  {
    id: 'content', title: 'Copy, content, and brand',
    covers: 'Landing and product pages, blog posts, case studies, brand voice and identity, Vietnamese copy',
    methods: ['write-copy', 'write-longform', 'create-brand', 'create-landing-page', 'polish-vietnamese'],
    examples: [
      { prompt: 'Write landing page copy for our AI note-taking app', any: ['write-copy', 'create-landing-page'] },
      { prompt: 'Write a long-form blog post on why spreadsheets fail finance teams', any: ['write-longform'] },
    ],
  },
  {
    id: 'measure', title: 'Measure and learn',
    covers: 'Growth drops, results reviews, campaign and video evaluations, marketing audits, fact checks',
    methods: ['diagnose-growth', 'measure-growth', 'evaluate-shortform', 'audit-marketing', 'knowledge-review', 'fresh-eyes-review'],
    examples: [
      { prompt: 'Our signups dropped 30% last month, find out why', any: ['diagnose-growth'] },
      { prompt: 'Review last quarter\'s growth results and decide what to keep', any: ['measure-growth'] },
    ],
  },
]);

export const ALSO = 'Also: product flows, UI specs, web and iOS builds, system architecture, and technical docs.';


// Short names a user sees in the terminal. The routing-breadth E2E requires one per listed specialist.
export const SPECIALISTS = Object.freeze({
  'research-positioning': 'Positioning research', 'research-channel': 'Channel research', 'design-pricing-and-packaging': 'Pricing and packaging',
  'prioritize-opportunities': 'Opportunity ranking', 'model-growth-funnel': 'Growth model', 'allocate-marketing-budget': 'Budget allocation',
  'shape-initiative': 'Initiative shaping', 'decision-panel': 'Decision panel', 'plan-campaign': 'Campaign planner', 'launch-product': 'Launch playbook',
  'create-run-of-show': 'Run of show', 'write-social': 'Social writer', 'research-content-ideas': 'Content ideas', 'create-shortform': 'Short-form video',
  'analyze-video': 'Video analysis', 'optimize-search': 'SEO, AEO, and ASO', 'answer-visibility-monitor': 'AI answer monitor',
  'build-programmatic-search': 'Programmatic SEO', 'optimize-app-store-listing': 'App store listing', 'create-paid-campaign': 'Paid campaign builder',
  'brief-creative': 'Creative brief', 'evaluate-paid-campaign': 'Paid results review', 'paid-campaign-loop': 'Paid test loop', 'write-outreach': 'Outreach writer',
  'evaluate-outreach': 'Outreach review', 'lifecycle-campaign': 'Lifecycle email', 'earned-media-outreach': 'Press and podcasts', 'outreach-sequence': 'Outbound sequence',
  'improve-conversion': 'Conversion', 'map-user-flow': 'User flows', 'referral-loop': 'Referral loop', 'brief-product-ui': 'Product UI spec', 'write-copy': 'Copywriter',
  'write-longform': 'Long-form writer', 'create-brand': 'Brand', 'create-landing-page': 'Landing page', 'polish-vietnamese': 'Vietnamese editor',
  'diagnose-growth': 'Growth diagnosis', 'measure-growth': 'Results review', 'evaluate-shortform': 'Video results review', 'audit-marketing': 'Marketing audit',
  'knowledge-review': 'Fact check', 'fresh-eyes-review': 'Fresh-eyes review',
});
const label = name => SPECIALISTS[name] ?? name;
const GUIDE_KINDS = ['playbook', 'platform', 'checklist', 'channel', 'workflow'];

// Playbook counts per area, from the same index the brief uses.
export async function depth() {
  const { knowledgeIndex } = await import('./brief.mjs');
  const index = knowledgeIndex(root, { playbooks: [] });
  const counts = {};
  for (const area of AREAS) {
    const names = new Set(area.methods);
    counts[area.id] = index.docs.filter(doc => GUIDE_KINDS.includes(doc.kind)
      && ((doc.method && names.has(doc.method)) || [...names].some(name => doc.key.startsWith(`conquistador/references/${name}/`)))).length;
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
    `Specialists: ${area.methods.map(label).join(', ')}`,
    '',
    'Try:',
    ...area.examples.map(example => `  "${example.prompt}"`),
  ].join('\n');
}

export async function listText() {
  const { counts, total } = await depth();
  const lines = [`Conquistador covers marketing and growth on any platform, in any service, and inside the product.`, `${total} playbooks and guides across ${AREAS.length} areas. Ask your agent for the outcome; it reads the matching playbooks first.`, ''];
  for (const area of AREAS) {
    lines.push(`${area.title} (${counts[area.id]} playbooks)`, `  ${area.covers}`, `  Specialists: ${area.methods.map(label).join(', ')}`);
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
    'product, then ask one question: "What are you working on?" Do not list internal paths or methods.',
    '',
    'Conquistador is a marketing and growth operator. It covers any platform, any service, and growth',
    'inside the product. Each answer uses field-tested playbooks and ends with the playbooks applied.',
    '',
    '| Area | Covers | Specialists |',
    '| --- | --- | --- |',
    ...AREAS.map(area => `| ${area.title} | ${area.covers} | ${area.methods.map(label).join(', ')} |`),
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
