// Growth doctrine: the funnel-first spine that growth, marketing, sales, and distribution work follows.
// Failure modes covered before implementation:
// 1. The doctrine file is missing, or the parent skill does not link it, so no agent can find it.
// 2. The doctrine grows past the brief's required-file budget, so a brief cannot carry it.
// 3. The doctrine loses a core rule: funnel first, name the stage, fix the narrowest stage,
//    audience-offer-copy order, root-cause steps, the ICE loop, two-lens attribution, or the
//    rule against invented numbers.
// 4. The doctrine drops a funnel motion, so the agent forces every product into one funnel.
// 5. init never records the funnel: the GROWTH.md template has no Funnel section with the motion,
//    stage table, bottleneck, and open gaps, or the interview never asks how a customer converts.
// 6. The Funnel section changes the GROWTH.md schema marker, so existing files read as stale.
// 7. The always-read context standard does not tie growth work to the funnel, so thin routes
//    that load no doctrine never see the rule.
// 8. The doctrine forces false certainty: a bottleneck by rate alone, a single proven cause, a
//    numeric forecast, or questions that never stop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS } from './brief.mjs';
import { GROWTH_MARKER } from './context-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const parent = join(root, 'skills/conquistador');
const read = path => readFileSync(join(parent, path), 'utf8');
const doctrinePath = 'references/growth-doctrine.md';

test('the parent skill links the growth doctrine and the file exists', () => {
  assert.ok(existsSync(join(parent, doctrinePath)), doctrinePath);
  assert.ok(!existsSync(join(parent, 'references/playbook.md')), 'the old playbook is replaced, not kept beside the doctrine');
  assert.match(read('SKILL.md'), /strategy, plans, or diagnosis, read the \[growth doctrine\]\(references\/growth-doctrine\.md\)/);
});

test('the doctrine fits in one brief with room for the command', () => {
  const bytes = Buffer.byteLength(read(doctrinePath));
  assert.ok(bytes <= LIMITS.mustBytes * 0.8, `doctrine is ${bytes} bytes`);
});

test('the doctrine keeps its core rules', () => {
  const doctrine = read(doctrinePath);
  const rules = {
    'money and attention': /Money flows where attention goes/,
    'funnel first': /## 1\. Funnel first[\s\S]*GROWTH\.md/,
    'name the stage': /funnel stage, the awareness stage,\s+the metric/,
    'narrowest stage': /bottleneck/i,
    'retention before reach': /Check retention before large acquisition spend/,
    'bottleneck weighs volume': /volume, the size of its gap, your confidence, and\s+the cost/,
    'graded hypotheses': /supported, rejected, or\s+unresolved/,
    'no forced forecast': /labeled hypothesis or `Open`/,
    'bounded questions': /Ask only those whose answers change the task/,
    '40/40/20': /40% from the audience, 40% from the offer, and 20% from the copy/,
    'diagnosis order': /audience first, the offer second, and the copy last/,
    'big problem, small way': /big problem in a small way, not a small problem in a big way/,
    'root-cause steps': /root cause[\s\S]*hypotheses[\s\S]*data[\s\S]*analyze/i,
    'ICE loop': /Impact, Confidence, and Ease[\s\S]*rank by the total/,
    'expected result before test': /baseline, expected lift/,
    'two lenses': /at\s+least two lenses/,
    'no invented numbers': /Never invent a rate, benchmark,\s+or result/,
    'prestige acts': /Pledge[\s\S]*Turn[\s\S]*Prestige/,
    'seven desires': /pride[\s\S]*greed[\s\S]*sloth[\s\S]*envy[\s\S]*wrath[\s\S]*lust[\s\S]*gluttony/i,
  };
  for (const [name, pattern] of Object.entries(rules)) assert.match(doctrine, pattern, name);
});

test('the doctrine names every funnel motion', () => {
  const doctrine = read(doctrinePath);
  for (const motion of ['Product-led', 'Sales-led', 'Hybrid', 'Transactional', 'Consumer subscription', 'Marketplace', 'Audience-led']) {
    assert.match(doctrine, new RegExp(`^\\| ${motion} \\|`, 'm'), motion);
  }
});

test('init records the funnel in GROWTH.md and asks how customers convert', () => {
  const init = read('commands/init/COMMAND.md');
  const template = init.slice(init.indexOf('## 5. Write GROWTH.md'), init.indexOf('## 6.'));
  assert.ok(template.includes(GROWTH_MARKER), 'schema marker unchanged');
  assert.match(template, /^## Funnel$/m);
  for (const field of ['Motion:', 'Period:', '| Stage |', 'Bottleneck:', 'Open:']) assert.ok(template.includes(field), field);
  assert.ok(template.indexOf('## Funnel') < template.indexOf('## Goals and Metrics'), 'the funnel leads the growth record');
  const interview = init.slice(init.indexOf('## 3. Interview'), init.indexOf('## 4.'));
  assert.match(interview, /funnel/i);
  assert.match(interview, /growth-doctrine\.md/);
});

test('the always-read context standard ties growth work to the funnel', () => {
  const context = read('standards/context.md');
  assert.match(context, /`GROWTH\.md` \| Growth truth: funnel/);
  assert.match(context, /Tie growth work to the funnel stage and metric it moves/);
  assert.match(context, /Ask only for a missing fact or\s+`Open` entry that changes this task/);
});
