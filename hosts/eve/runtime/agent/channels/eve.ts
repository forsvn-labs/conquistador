import { eveChannel } from 'eve/channels/eve';
import { defineChannel } from 'eve/channels';
import identity from '../../identity.json' with { type: 'json' };
import { authenticate } from '../lib/policy.mjs';

const channel = eveChannel({
  auth: request => authenticate(request, identity),
  audience: 'private',
  uploadPolicy: 'disabled',
  turnPolicy: 'queue',
});

// Callback capability URLs are not a second approval route. This app has no
// subagents or interactive OAuth, so expose only the session APIs it uses.
const paths = new Set([
  '/eve/v1/health', '/eve/v1/info', '/eve/v1/session',
  '/eve/v1/session/:sessionId', '/eve/v1/session/:sessionId/stream',
]);
export default defineChannel({ ...channel, routes: channel.routes?.filter(route => paths.has(route.path)) });
