import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const parent = 'skills/conquistador';
const review = `${parent}/plays/report`;
const conventions = `${review}/references/format-conventions.md`;
const example = `${review}/references/examples/content-eval-cycle-walkthrough.md`;
const read = path => readFileSync(resolve(root, path), 'utf8');
const prose = path => read(path).replace(/\s+/g, ' ');

test('play and operating contract distinguish executable fixture coverage from live acceptance', () => {
  const graph = JSON.parse(read('runtime/fixtures/playbooks/content-intelligence-loop.json'));
  assert.equal(graph.executionStatus, 'executable');
  assert.equal(graph.activation.requiredByPortablePlugin, false);
  assert.ok(graph.gates.review.length > 0);
  assert.match(prose(graph.proseSource), /runtime\/fixtures\/playbooks\/content-intelligence-loop\.json/);
  assert.match(prose(graph.proseSource), /stops at human review/);
  for (const path of [`${parent}/SKILL.md`, graph.proseSource]) assert.doesNotMatch(prose(path), /release-required-unimplemented/);
  const contract = prose('docs/MASTER-AGENT.md');
  assert.match(contract, /locally implemented and verified with synthetic fixtures/i);
  assert.match(contract, /Live execution, provider behavior and human acceptance remain unverified/);
  assert.match(contract, /no execution authority/);
});

test('medium-confidence single-cycle example cannot promote a durable learning', () => {
  const text = read(example);
  assert.match(text, /^- Confidence: medium$/m);
  assert.match(text, /^- Promote to `learnings\.md`: no$/m);
  assert.doesNotMatch(text, /Promote to `learnings\.md`: yes|promotion = \*\*yes\*\*|promote-with-watch/);
  assert.match(text, /working hypothesis/i);
  const denied = read(conventions).split('\n').find(line => line.startsWith('| **no** |'));
  assert.ok(denied, 'Promotion table must state when learning is ineligible');
  assert.match(denied, /Medium, low or blocked confidence/);
  assert.match(denied, /single observation or two-cycle result/);
  assert.match(prose(`${review}/agents/critic-agent.md`), /9\. Learning promoted from medium, low or blocked confidence, a single observation or two-cycle result/);
});

test('persistence needs exact-entry and destination consent without absent helper commands', () => {
  assert.match(prose(conventions), /Before any persistent write, show the exact entry and destination and obtain explicit user approval/);
  assert.match(prose(conventions), /A critic PASS is a quality check, not write permission/);
  assert.match(prose(conventions), /Approval to save an evaluation or ledger row does not authorize a learning write/);
  assert.match(prose(example), /No files were written and no learning was promoted/);
  for (const path of [conventions, example, `${review}/references/rubric.md`, `${review}/agents/critic-agent.md`]) {
    assert.doesNotMatch(read(path), /(?:bun|node|npx)\s+scripts\/(?:append-loop-result|manifest-sync)\.ts/);
  }
  assert.match(prose(conventions), /does not include `scripts\/append-loop-result\.ts` or `scripts\/manifest-sync\.ts`/);
  for (const helper of ['append-loop-result.ts', 'manifest-sync.ts']) {
    assert.equal(existsSync(resolve(root, 'scripts', helper)), false, 'Reassess the documented helper boundary if one is shipped');
  }
  assert.match(read(`${review}/references/rubric.md`), /Score the proposed row before any append/);
});

test('new persistence links reach the canonical standard and consent section', () => {
  for (const path of [conventions, example, `${review}/references/rubric.md`, `${review}/agents/critic-agent.md`]) {
    const links = [...read(path).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];
    assert.ok(links.length > 0, path);
    for (const [, href] of links) {
      if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;
      const [relative, fragment] = href.split('#');
      const target = resolve(root, dirname(path), relative);
      assert.ok(existsSync(target), `${path}: ${href}`);
      if (fragment === 'persistence-consent') assert.match(readFileSync(target, 'utf8'), /^## Persistence consent$/m);
    }
  }
  assert.match(read(conventions), /\[shared learning standard\]\(\.\.\/\.\.\/\.\.\/standards\/learning\.md\)/);
});
