import { explicitInvocation as isExplicitInvocation } from '../../tools/request-text.mjs';
import { posix } from 'node:path';
import { operatorProtocol, admittedDomains, validateOperatorProfile } from '../../tools/operator-profile.mjs';

export { operatorProtocol, admittedDomains, defaultOperatorProfile, validateOperatorProfile,
  defaultInstalledProfile, loadOperatorProfile } from '../../tools/operator-profile.mjs';

const domainSignals = Object.freeze({
  product: /\b(?:positioning|pricing|packaging|icp|value proposition|product strategy|go-to-market|\bgtm\b|initiative scope)\b/i,
  marketing: /\b(?:campaign plan|launch email|landing-?page copy|brand voice|conversion copy|seo|lifecycle campaign)\b/i,
  growth: /\b(?:growth plan|funnel|retention|activation metric|measurement plan|conversion experiment)\b/i,
  sales: /\b(?:outreach sequence|sales sequence|cold email|qualified leads?|sales pipeline)\b/i,
  research: /\b(?:market research|competitor research|audience research|channel research|content ideas)\b/i,
  creative: /\b(?:creative brief|ad creative|short-form|storyboard|visual identity)\b/i,
  'product-engineering': /\b(?:user flow|interface spec|product ui|system architecture|build (?:an? )?(?:ios|web) (?:app|experience)|technical documentation)\b/i,
});
const codingAbstain = /\b(?:fix(?:ing)? (?:a |the )?(?:bug|type ?error|compile error|lint)|refactor(?:ing)?|merge conflict|unit tests?|eslint|prettier|null pointer|typescript error)\b/i;
const sourceFile = /(?:^|[\s`'"(])([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|vue|svelte|py|go|rs|java|rb))\b/gi;

export function resolveActivation(profile, hostSettings = {}) {
  const installed = validateOperatorProfile(profile).activation;
  const override = hostSettings?.activation;
  if (override === undefined || override === null) return installed;
  if (!['manual', 'project', 'off'].includes(override)) return 'off';
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
    const explicit = isExplicitInvocation(text);
    if (activation === 'manual') return explicit ? admit('explicit-invocation', activation) : abstain('manual-requires-explicit');
    if (explicit) return admit('explicit-invocation', activation);
    const body = stripSourceFiles(text);
    if (codingAbstain.test(body)) {
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
