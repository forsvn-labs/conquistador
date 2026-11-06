import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Failure modes: ordinary docs preload the archive; historical roles block delivery;
// requested mode references cannot be resolved through the shared contract.
test('ordinary docs keep historical pipelines optional and mode references available', () => {
  const { methods: { docs } } = JSON.parse(readFileSync(new URL('../skills/conquistador/routing-overlay.json', import.meta.url)));
  assert.deepEqual(docs.requiredResources, []);
  assert.deepEqual(docs.conditionalResources, []);
  for (const mode of ['sync', 'audit', 'release-notes', 'ship-log'])
    assert.ok(docs.optionalResources.includes(`references/modes/${mode}.md`));
});
