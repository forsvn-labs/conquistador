// Offline behavioral audit. No models, providers, or user configuration are used.
// Failure modes: engineering false positives, quoted/negated activation, disabled-profile
// bypass, excessive context for small tasks, repeated injection, stop enforcement, and
// loss of legitimate marketing routes. --strict fails on the proposed admission contract.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'conquistador-behavior-'));
const keys = ['CONQUISTADOR_HOME', 'CONQUISTADOR_CACHE', 'CONQUISTADOR_STATE', 'CONQUISTADOR_PLAYBOOKS', 'CONQUISTADOR_HOOKS', 'GROK_HOOK_EVENT'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
Object.assign(process.env, {
  CONQUISTADOR_HOME: join(temporary, 'home'), CONQUISTADOR_CACHE: join(temporary, 'cache'),
  CONQUISTADOR_STATE: join(temporary, 'state'), CONQUISTADOR_PLAYBOOKS: '', CONQUISTADOR_HOOKS: '',
});
delete process.env.GROK_HOOK_EVENT;

try {
  const { createBrief, packBrief } = await import('../tools/brief.mjs');
  const { selectRequestContext } = await import('../tools/context-selection.mjs');
  const { advisory } = await import('../tools/proactive.mjs');
  const { createConquistador } = await import('../api/index.mjs');
  const { isMarketingFile } = await import('../tools/check/channels.mjs');
  const cases = [
    ['Help me engineer a mail outreach system', false],
    ['Implement the API handler for cold email retries', false],
    ['Debug the outreach webhook', false],
    ['Design the database schema for a sales pipeline', false],
    ['Do not write cold email copy', false],
    ['Explain the string "write a cold email" in this fixture', false],
    ['Fix a TypeScript compile error', false],
    ['What does outreach mean?', false],
    ['Write a cold email to a qualified prospect', true],
    ['Shorten the subject line of this cold email', true],
    ['Plan our go-to-market strategy', true],
    ['Draft a product requirements document for an outreach system', true],
    ['Write a cold email and implement its retry handler', true],
  ];
  const hook = (event, input) => {
    const child = spawnSync(process.execPath, [join(root, 'hooks/conquistador-hook.mjs'), 'codex', event], {
      cwd: temporary, env: process.env, input: JSON.stringify(input), encoding: 'utf8', timeout: 15000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, '');
    return child.stdout.trim() ? JSON.parse(child.stdout) : null;
  };
  const rows = cases.map(([prompt, expectedAutoBrief]) => {
    const route = selectRequestContext(prompt, { root });
    const brief = createBrief(prompt, { root, playbooks: [], persistCache: false, cwd: null });
    const pack = packBrief(brief);
    const compact = packBrief(brief, { compact: true });
    const files = [...(brief.play ? [brief.play] : []), ...brief.methods, ...brief.must];
    const injection = hook('prompt', { prompt });
    return {
      prompt, expectedAutoBrief, route: route.action, routeReason: route.reason,
      brief: brief.action, commands: brief.methods.map(item => item.name), play: brief.play?.name ?? null,
      files: files.length, sourceBytes: files.reduce((sum, item) => sum + Buffer.byteLength(readFileSync(item.absolute)), 0),
      fullBytes: brief.action === 'brief' ? Buffer.byteLength(pack.text) : 0,
      compactBytes: brief.action === 'brief' ? Buffer.byteLength(compact.text) : 0,
      compactRequiredReads: compact.structured.readNow.length,
      hookBytes: Buffer.byteLength(injection?.hookSpecificOutput?.additionalContext ?? ''),
      admissionPass: Boolean(injection?.hookSpecificOutput?.additionalContext) === expectedAutoBrief,
    };
  });
  const copiedRoot = join(temporary, 'disabled-package');
  cpSync(join(root, 'skills'), join(copiedRoot, 'skills'), { recursive: true });
  writeFileSync(join(copiedRoot, 'skills/conquistador/operator-profile.json'), JSON.stringify({ activation: 'off' }));
  const disabledPrompt = 'Write a cold email';
  const disabled = {
    routeReason: selectRequestContext(disabledPrompt, { root: copiedRoot }).reason,
    brief: createBrief(disabledPrompt, { root: copiedRoot, playbooks: [], persistCache: false, cwd: null }).action,
  };
  const transcript = join(temporary, 'transcript.jsonl');
  writeFileSync(transcript, '');
  const input = { prompt: cases[0][0], session_id: 'review-engineering', transcript_path: transcript };
  const first = hook('prompt', input);
  const second = hook('prompt', input);
  writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { content: 'Here is the system design.' } }) + '\n');
  const stop = hook('stop', { ...input, stop_hook_active: false, last_assistant_message: 'Here is the system design.' });
  const repeatStop = hook('stop', { ...input, stop_hook_active: false });
  const api = createConquistador();
  const apiResult = api.callTool('conquistador_brief', { task: cases[1][0] });
  const config = { schemaVersion: 1, enabled: true, events: ['before-delivery'] };
  const report = {
    node: process.version, rows, disabled,
    lifecycle: {
      repeatedPromptSameContext: JSON.stringify(first) === JSON.stringify(second),
      engineeringStopDecision: stop?.decision ?? null, repeatedStopDecision: repeatStop?.decision ?? null,
      staticBeforeDeliveryInstructions: advisory('before-delivery', config).instructions.length,
    },
    api: { engineeringCommand: apiResult.structuredContent?.command ?? null, isError: apiResult.isError ?? false },
    fileClassification: ['outreach/architecture.md', 'docs/architecture.md', 'admin/index.html'].map(file => ({
      file, marketing: isMarketingFile(file, { data: {} }),
    })),
    admissionFailures: rows.filter(row => !row.admissionPass).length,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--strict') && (report.admissionFailures || disabled.brief !== 'none' || stop?.decision === 'block')) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
