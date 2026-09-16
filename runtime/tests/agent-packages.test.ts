import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
it('preserves the v1 agent and squad contract while explicitly versioning master execution', () => {
  const ajv = new Ajv2020.default({ strict: true });
  const v1 = ajv.compile(json('agents/agent-package.schema.json'));
  const v2 = ajv.compile(json('agents/agent-package-v2.schema.json'));
  const legacy = json('agents/conquistador/compatibility/v1.json');
  const master = json('agents/conquistador/agent.json');
  expect(v1(legacy)).toBe(true); expect(v1(master)).toBe(false);
  expect(v1(json('agents/squad/worker.json'))).toBe(true);
  expect(v1(json('agents/squad/advisor.json'))).toBe(true);
  expect(v2(master)).toBe(true); expect(v2(legacy)).toBe(false);
  expect(v2({ ...master, delegation: { ...master.delegation, maxDelegationsPerRun: 'host-bounded' } })).toBe(false);
});
it('validates the operator profile and execution receipt contracts', () => {
  const ajv = new Ajv2020.default({ strict: true });
  const operator = ajv.compile(json('agents/operator-profile.schema.json'));
  const receipt = ajv.compile(json('agents/execution-receipt.schema.json'));
  const profile = json('skills/conquistador/operator-profile.json');
  expect(operator(profile)).toBe(true);
  expect(operator({ ...profile, backgroundWatch: true })).toBe(false);
  expect(operator({ ...profile, activation: 'watch' })).toBe(false);
  const sample = {
    schemaVersion: 'conquistador.execution-receipt/v1',
    runId: 'draft-launch',
    outcome: 'launch package',
    capabilities: [{ id: 'positioning', label: 'positioning' }],
    specialists: [{ assignmentId: 'copy', label: 'Copy', executionId: 'thr_test', status: 'draft' }],
    mode: 'isolated-workers',
    independentReview: true,
    integratedDigest: `sha256:${'a'.repeat(64)}`,
    evidence: ['supplied product facts'],
    gaps: ['pricing proof'],
    externalActions: [],
    humanAccepted: false,
  };
  expect(receipt(sample)).toBe(true);
  expect(receipt({ ...sample, humanAccepted: true })).toBe(false);
  expect(receipt({ ...sample, externalActions: ['send'] })).toBe(false);
  expect(receipt({ ...sample, integratedDigest: 'sha256:not-a-digest' })).toBe(false);
  expect(receipt({ ...sample, specialists: [{ assignmentId: 'copy', label: 'Copy', executionId: 'x'.repeat(81), status: 'draft' }] })).toBe(false);
  expect(receipt({ ...sample, mode: 'sequential-in-context', independentReview: true })).toBe(false);
  expect(receipt({ ...sample, mode: 'sequential-in-context', independentReview: false })).toBe(true);
});
