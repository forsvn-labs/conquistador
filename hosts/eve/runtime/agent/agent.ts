import { defineAgent, defineDynamic } from 'eve';
import identity from '../identity.json' with { type: 'json' };
import { requireIdentity } from './lib/policy.mjs';

export default defineAgent({
  defaultTools: false,
  model: defineDynamic({ events: { 'session.started': () => {
    requireIdentity(identity);
    const model = identity.model as string | null;
    if (!model) throw new Error('An explicit host model is required.');
    return model;
  } } }),
  limits: { maxInputTokensPerSession: 200_000, maxOutputTokensPerSession: 20_000, sessionTimeoutMs: 86_400_000 },
});
