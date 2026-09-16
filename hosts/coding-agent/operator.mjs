import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { closed, identifier } from './contracts.mjs';
import { containedPath } from '../../tools/plugin-contracts.mjs';

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

const explicitInvocation = /(?:^|[\s`])[/$@]conquistador(?:[/:][a-z][a-z0-9-]*)?(?=[\s`,.:;!?]|$)/i;
const domainSignals = Object.freeze({
  product: /\b(?:positioning|pricing|packaging|icp|value proposition|product strategy|go-to-market|\bgtm\b|initiative scope)\b/i,
  marketing: /\b(?:campaign plan|launch email|landing-?page copy|brand voice|conversion copy|seo|lifecycle campaign)\b/i,
  growth: /\b(?:growth plan|funnel|retention|activation metric|measurement plan|conversion experiment)\b/i,
  sales: /\b(?:outreach sequence|sales sequence|cold email|qualified leads?|pipeline)\b/i,
  research: /\b(?:market research|competitor research|audience research|channel research|content ideas)\b/i,
  creative: /\b(?:creative brief|ad creative|short-form|storyboard|visual identity)\b/i,
  'product-engineering': /\b(?:user flow|interface spec|product ui|system architecture|build (?:an? )?(?:ios|web) (?:app|experience)|technical documentation)\b/i,
});
const codingAbstain = /\b(?:fix(?:ing)? (?:a |the )?(?:bug|type ?error|compile error|lint)|refactor(?:ing)?|merge conflict|unit tests?|eslint|prettier|null pointer|typescript error)\b/i;
const sourceFile = /(?:^|[\s`'"(])([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|vue|svelte|py|go|rs|java|rb))\b/gi;

export function validateOperatorProfile(value) {
  closed(value, ['schemaVersion', 'activation', 'admittedDomains', 'disclosure', 'backgroundWatch', 'externalMutation']);
  assert.equal(value.schemaVersion, operatorProtocol);
  assert.ok(['manual', 'project', 'off'].includes(value.activation), 'activation must be manual, project, or off');
  assert.ok(Array.isArray(value.admittedDomains) && value.admittedDomains.length > 0, 'admittedDomains required');
  assert.equal(new Set(value.admittedDomains).size, value.admittedDomains.length, 'admittedDomains must be unique');
  for (const domain of value.admittedDomains) {
    identifier(domain);
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
  const paths = [];
  if (existsSync(resolve(root, 'agent/agent.json'))) {
    paths.push('./agent/skills/conquistador/operator-profile.json');
    paths.push('./library/conquistador/operator-profile.json');
  }
  paths.push('./skills/conquistador/operator-profile.json');
  paths.push('./library/conquistador/operator-profile.json');
  paths.push('./agent/skills/conquistador/operator-profile.json');
  return [...new Set(paths)];
}

/** Older v2 packages without a profile degrade to explicit-invocation-only. Invalid profiles fail closed. */
export function loadOperatorProfile(root) {
  for (const relative of profileCandidates(root)) {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) continue;
    const parsed = JSON.parse(readFileSync(containedPath(root, relative, 'file'), 'utf8'));
    return validateOperatorProfile(parsed);
  }
  return defaultInstalledProfile();
}

export function resolveActivation(profile, hostSettings = {}) {
  const installed = validateOperatorProfile(profile).activation;
  const override = hostSettings?.activation;
  if (override === undefined || override === null) return installed;
  if (!['manual', 'project', 'off'].includes(override)) return installed;
  return override;
}

function stripSourceFiles(text) {
  return text.replace(sourceFile, ' ');
}

function admittedDomainHits(text, allowed) {
  return allowed.filter(domain => domainSignals[domain]?.test(text));
}

function abstain(reason) {
  return { action: 'abstain', reason, activation: null };
}

function admit(reason, activation, domains = []) {
  return { action: 'admit', reason, activation, domains };
}

/**
 * Request-time routing only. Never starts a watcher, schedule, or instruction-file edit.
 * Malformed or recursive host input abstains without throwing into the host action.
 */
export function admitRequest(profile, request, hostSettings = {}) {
  try {
    if (request == null || typeof request !== 'object' || Array.isArray(request)) return abstain('malformed-input');
    if (Object.hasOwn(request, '__proto__') || Object.hasOwn(request, 'constructor')) return abstain('malformed-input');
    if (request.recursive === true || request.source === 'conquistador') return abstain('recursive');
    const text = request.text;
    if (typeof text !== 'string' || Buffer.byteLength(text) > 32000) return abstain('malformed-input');
    const validated = validateOperatorProfile(profile);
    const activation = resolveActivation(validated, hostSettings);
    if (activation === 'off') return abstain('activation-off');
    const explicit = explicitInvocation.test(text);
    if (activation === 'manual') return explicit ? admit('explicit-invocation', activation) : abstain('manual-requires-explicit');
    if (explicit) return admit('explicit-invocation', activation);
    const body = stripSourceFiles(text);
    if (codingAbstain.test(text) && admittedDomainHits(body, validated.admittedDomains).length === 0) {
      return abstain('unrelated-coding');
    }
    const domains = admittedDomainHits(body, validated.admittedDomains);
    if (domains.length === 0) return abstain('outside-admitted-domains');
    return admit('project-admitted', activation, domains);
  } catch {
    return { action: 'abstain', reason: 'malformed-input', activation: null, error: '[redacted]' };
  }
}

export function operatorStatus(profile, hostSettings = {}) {
  const validated = validateOperatorProfile(profile);
  return {
    schemaVersion: operatorProtocol,
    activation: resolveActivation(validated, hostSettings),
    installedActivation: validated.activation,
    admittedDomains: validated.admittedDomains,
    disclosure: validated.disclosure,
    backgroundWatch: false,
    hostActivationVerified: false,
    taskExecutionVerified: false,
  };
}

export function profileRelativePath(layout) {
  return posix.join(layout, 'conquistador/operator-profile.json');
}
