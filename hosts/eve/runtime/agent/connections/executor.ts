import { defineDynamic, defineMcpClientConnection } from 'eve/connections';
import { always } from 'eve/tools/approval';
import identity from '../../identity.json' with { type: 'json' };
import { executorSettings } from '../lib/policy.mjs';

export default defineDynamic({ events: { 'turn.started': (_event, ctx) => {
  const settings = executorSettings(identity, ctx.session);
  if (!settings) return null;
  return { executor: defineMcpClientConnection({
    url: settings.url,
    instanceKey: `${identity.instance}:${settings.account}:${settings.url}:${settings.credentialFingerprint}`,
    description: 'Executor tools authorized for this owner. Every call requires separate human approval. Executor owns upstream credentials and action policy.',
    tools: { allow: settings.tools },
    approval: always(),
    auth: { principalType: 'user', getToken: async () => {
      // Resolve again at execution; never return secrets from a dynamic resolver.
      const current = executorSettings(identity, ctx.session);
      if (!current || current.url !== settings.url || current.account !== settings.account ||
          current.token !== settings.token || current.tools.join(',') !== settings.tools.join(',')) {
        throw new Error('Executor configuration changed during the turn. Stop and reconcile before resuming.');
      }
      return { token: current.token };
    } },
  }) };
} } });
