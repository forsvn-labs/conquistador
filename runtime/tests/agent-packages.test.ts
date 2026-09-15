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
