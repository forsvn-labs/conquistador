import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { containedPath } from './plugin-contracts.mjs';

export const operatorProtocol = 'conquistador.operator-profile/v1';

export const admittedDomains = Object.freeze([
  'product', 'marketing', 'growth', 'sales', 'research', 'creative', 'product-engineering',
]);

export const defaultOperatorProfile = Object.freeze({
  schemaVersion: operatorProtocol,
  activation: 'manual',
  admittedDomains: [...admittedDomains],
  disclosure: 'capabilities-and-specialists',
  backgroundWatch: false,
  externalMutation: 'human-gated',
});

export function validateOperatorProfile(value) {
  const required = ['schemaVersion', 'activation', 'admittedDomains', 'disclosure', 'backgroundWatch', 'externalMutation'];
  assert.ok(value != null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, 'Expected object');

  for (const key of required) assert.ok(Object.hasOwn(value, key), `Missing ${key}`);

  for (const key of Object.keys(value)) assert.ok(required.includes(key), `Unknown field ${key}`);
  assert.equal(value.schemaVersion, operatorProtocol);
  assert.ok(['manual', 'project', 'off'].includes(value.activation), 'activation must be manual, project, or off');
  assert.ok(Array.isArray(value.admittedDomains) && value.admittedDomains.length > 0, 'admittedDomains required');
  assert.equal(new Set(value.admittedDomains).size, value.admittedDomains.length, 'admittedDomains must be unique');

  for (const domain of value.admittedDomains) {
    assert.ok(/^[a-z][a-z0-9-]{0,63}$/.test(domain), 'Expected logical identifier');
    assert.ok(admittedDomains.includes(domain), `Unknown admitted domain ${domain}`);
  }

  assert.equal(value.disclosure, 'capabilities-and-specialists');
  assert.equal(value.backgroundWatch, false, 'backgroundWatch must remain false');
  assert.equal(value.externalMutation, 'human-gated');

  return structuredClone(value);
}

export function defaultInstalledProfile() {
  return structuredClone(defaultOperatorProfile);
}

function profileCandidates(root) {
  const paths = ['./agent/skills/conquistador/library/conquistador/operator-profile.json',
    './skills/conquistador/library/conquistador/operator-profile.json'];

  if (existsSync(resolve(root, 'agent/agent.json'))) {
    paths.push('./agent/skills/conquistador/operator-profile.json');
    paths.push('./library/conquistador/operator-profile.json');
  }

  paths.push('./skills/conquistador/operator-profile.json');
  paths.push('./library/conquistador/operator-profile.json');
  paths.push('./agent/skills/conquistador/operator-profile.json');

  return [...new Set(paths)];
}

/** Older v2 packages without a profile use the default only for admission. Invalid profiles fail closed. */
export function loadOperatorProfile(root, { allowMissing = false } = {}) {
  for (const relative of profileCandidates(root)) {
    const absolute = resolve(root, relative);

    try {
      const info = lstatSync(absolute);
      assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= 16384, 'Invalid operator profile file');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    const parsed = JSON.parse(readFileSync(containedPath(root, relative, 'file'), 'utf8'));

    return validateOperatorProfile(parsed);
  }

  return allowMissing ? null : defaultInstalledProfile();
}
