import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startPlaybookRun, resumePlaybookRun } from '../src/runner.ts';
import { testJudgmentProvider } from './judgment-fixture.ts';
import { validatePlaybookRecord } from '../src/registry.ts';

const ids = ['creative-production-review', 'paid-search-split-landing', 'campaign-money-events'];
const folders: string[] = [];
afterEach(() => folders.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function options(id: string) {
  const runsDir = mkdtempSync(resolve(tmpdir(), 'specialist-graph-')); folders.push(runsDir);
  const playbook = JSON.parse(readFileSync(resolve(import.meta.dirname, `../fixtures/playbooks/${id}.json`), 'utf8'));
  validatePlaybookRecord(playbook);
  return { playbook, runsDir, runId: 'graph-test', inputs: { product: 'Synthetic sample', audience: 'Test audience', channel: 'search', goals: 'Test contract boundaries only.' } };
}
describe('specialist graphs through the existing durable runner', () => {
  it.each(ids)('%s stops at a sealed judgment when no model is connected', async id => {
    const opts = options(id);
    const out = await startPlaybookRun(opts);
    expect(out.status).toBe('awaiting-judgment');
    expect(out.state.artifacts['created-artifact']).toBeUndefined();
    const pending = Object.values(out.state.judgments!)[0];
    const request = JSON.parse(readFileSync(resolve(out.directory, pending.requestPath), 'utf8'));
    expect(request.input.payload.assignment.completion).toBeTruthy();
    expect(request.toolPolicy.externalMutation).toBe('deny');
  });
  it.each(ids)('%s traces every draft step and gates the integrated artifact with test-only judgments', async id => {
    const opts = options(id);
    const out = await startPlaybookRun({ ...opts, judgment: testJudgmentProvider() });
    expect(out.status).toBe('awaiting-review');
    expect(out.state.artifacts['created-artifact']).toBeDefined();
    expect(out.trace.filter(e => e.type === 'judgment.completed').every(e => e.detail.evidenceEligible === false)).toBe(true);
    expect(out.state.steps.review.status).toBe('completed');
    const packet = JSON.parse(readFileSync(resolve(out.directory, 'review-packet.json'), 'utf8'));
    expect(packet.boundArtifacts.map((a: {artifactId: string}) => a.artifactId)).toContain('created-artifact');
    expect(packet.actionProposals).toEqual([]);
    if (id === 'campaign-money-events') expect(JSON.stringify(readFileSync(resolve(out.directory, out.state.artifacts['event-bundle'].path), 'utf8'))).toContain('human-action-manifest');
    if (id === 'paid-search-split-landing') {
      expect(out.state.artifacts['dr-page']).toBeDefined(); expect(out.state.artifacts['saas-page']).toBeDefined();
    }
  });
  it.each(ids)('%s resumes an interrupted graph without replaying completed work', async id => {
    const opts = options(id);
    const failId = opts.playbook.stepGraph.nodes.find(n => n.kind === 'skill')!.id;
    const first = await startPlaybookRun({ ...opts, judgment: testJudgmentProvider(), interruptAfter: failId });
    expect(first.status).toBe('cancelled');
    const after = await resumePlaybookRun({ runsDir: opts.runsDir, runId: opts.runId, judgment: testJudgmentProvider() });
    expect(after.status).toBe('awaiting-review');
    expect(after.state.steps['load-context'].attempts).toBe(1);
  });
  it.each(ids)('%s retains a pending judgment across a provider failure', async id => {
    const opts = options(id);
    await expect(startPlaybookRun({ ...opts, judgment: { testOnly: true, execute: async () => { throw new Error('Synthetic provider outage'); } } })).rejects.toThrow('Synthetic provider outage');
    const out = await resumePlaybookRun({ runsDir: opts.runsDir, runId: opts.runId, judgment: testJudgmentProvider() });
    expect(out.status).toBe('awaiting-review');
    expect(out.state.steps['load-context'].attempts).toBe(1);
  });
});
