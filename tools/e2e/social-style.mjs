// Exercise the real copy-check CLI with the user's exact drafts. No model or external account.
// Failure modes: the bad frames pass; ordinary time/price/place/file ranges fail; metadata colons
// fail; the user's original voice is flagged; a high self-score bypasses an AI-style hard failure;
// or the social brief omits the writing resources or edit mode.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief } from '../brief.mjs';
import { evaluateGate, parseGate } from '../rubric-gate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const input = JSON.parse(readFileSync(join(root, 'tools/e2e/fixtures/social-style.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'cq-social-style-'));
const results = [];
try {
  for (const fixture of input.cases) {
    const file = join(work, `${fixture.id}.md`);
    writeFileSync(file, fixture.text);
    const result = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), 'check', file, '--channel=x', '--json', '--no-config'], { encoding: 'utf8' });
    let findings;
    try { findings = JSON.parse(result.stdout); } catch { findings = [{ rule: 'invalid-cli-result' }]; }
    const style = [...new Set(findings.filter(finding => finding.rule.startsWith('ai-')).map(finding => finding.rule))].sort();
    const expected = [...fixture.styleRules].sort();
    const pass = JSON.stringify(style) === JSON.stringify(expected) && result.status === (findings.some(finding => finding.severity !== 'advisory') ? 2 : 0);
    results.push({ name: fixture.id, pass, exit: result.status, style, expected, otherRules: [...new Set(findings.filter(finding => !finding.rule.startsWith('ai-')).map(finding => finding.rule))] });
  }
  const brief = createBrief('Write a tweet announcing our product', { force: true, cwd: work, playbooks: [] });
  const paths = JSON.stringify(brief);
  results.push({ name: 'social core writing resources', pass: paths.includes('references/ai-patterns.md') && paths.includes('references/human-writing-stylebook.md') });
  const writer = readFileSync(join(root, 'skills/conquistador/commands/social/agents/copywriter-agent.md'), 'utf8');
  const method = readFileSync(join(root, 'skills/conquistador/commands/social/COMMAND.md'), 'utf8');
  results.push({ name: 'preserve supplied draft', pass: /edit mode/i.test(method) && /preserve.*wording/is.test(writer) });
  const gate = parseGate(readFileSync(join(root, 'skills/conquistador/commands/social/references/rubric.md'), 'utf8'));
  let verdict;
  try { verdict = evaluateGate(gate, { scores: Object.fromEntries(gate.dimensions.map(name => [name, 10])), hardFails: ['ai-writing-pattern'] }); }
  catch (error) { verdict = { verdict: 'unsupported', error: error.message }; }
  results.push({ name: 'AI pattern overrides high score', pass: verdict.verdict === 'fail', verdict });
} finally { rmSync(work, { recursive: true, force: true }); }
const out = join(root, 'dist/e2e/social-style');
mkdirSync(out, { recursive: true });
const passed = results.filter(result => result.pass).length;
writeFileSync(join(out, 'report.json'), `${JSON.stringify({ source: input.source, total: results.length, passed, results }, null, 2)}\n`);
for (const result of results) console.log(`${result.pass ? 'pass' : 'FAIL'} ${result.name}`);
console.log(`${passed}/${results.length} pass. ${join(out, 'report.json')}`);
process.exitCode = passed === results.length ? 0 : 1;
