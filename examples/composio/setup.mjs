#!/usr/bin/env node
// Documented Composio Custom MCP lifecycle. Preview by default; no saved credentials.
const env = process.env;
const commands = ['register', 'connect', 'discover', 'sync', 'verify'];
const [command = 'register', ...flags] = process.argv.slice(2);
const required = name => { if (!env[name]?.trim()) throw Error(`Set ${name}.`); return env[name].trim(); };
function publicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !url.hostname.includes('.') || /^(?:\d|\[)/.test(url.hostname) || /\.(?:localhost|local|internal)$/.test(url.hostname)) {
    throw Error('Use a public HTTPS endpoint without credentials, query, fragment, or redirects.');
  }
  return url;
}
async function main() {
  if (command === '--help') {
    console.log('node setup.mjs [register|connect|discover|sync|verify] [--apply]\nPreview is the default. See README.md for environment variables and account setup.'); return;
  }
  if (!commands.includes(command) || flags.some(flag => flag !== '--apply')) throw Error('Unknown command or flag. Use --help.');
  const apply = flags.includes('--apply');
  const endpoint = publicUrl(env.CONQUISTADOR_MCP_URL || 'https://mcp.forsvn.com/mcp');
  const auth = env.CONQUISTADOR_AUTH || 'oauth';
  if (!['oauth', 'api-key'].includes(auth)) throw Error('CONQUISTADOR_AUTH must be oauth or api-key.');
  const slug = env.COMPOSIO_TOOLKIT || 'CUSTOM_CONQUISTADOR';
  if (!/^CUSTOM_[A-Z0-9_]+$/.test(slug)) throw Error('COMPOSIO_TOOLKIT must be a returned CUSTOM_* slug.');
  const plan = { mode: apply ? 'apply' : 'preview', command };
  if (command === 'register') {
    const discovery = publicUrl(env.CONQUISTADOR_OAUTH_DISCOVERY_URL || `${endpoint.origin}/.well-known/oauth-authorization-server`).href;
    plan.request = {
      url: 'https://backend.composio.dev/api/v3.1/custom/toolkits/upsert',
      body: { slug: slug.slice(7), toolkit_config: { name: 'Conquistador', app_url: endpoint.href,
        auth_schemes: auth === 'oauth' ? [{ mode: 'DCR_OAUTH', discovery_url: discovery }]
          : [{ mode: 'API_KEY', headers: { Authorization: 'Bearer {{generic_api_key}}' } }],
      } },
    };
  } else if (command === 'sync') {
    plan.request = { url: 'https://backend.composio.dev/api/v3.1/custom/toolkits/sync',
      body: { slug, connected_account_id: required('COMPOSIO_ACCOUNT_ID') } };
  } else {
    const userId = required('COMPOSIO_USER_ID');
    plan.session = { userId, toolkits: [slug] };
    if (command !== 'connect') plan.session.connectedAccounts = { [slug]: [required('COMPOSIO_ACCOUNT_ID')] };
    if (command === 'verify') {
      const tool = required('COMPOSIO_METHODS_TOOL');
      if (tool !== `${slug}_CONQUISTADOR_METHODS`) throw Error('Use the exact discovered Conquistador methods tool slug. No other tools are executed.');
      plan.tool = tool;
    }
  }
  if (!apply) { console.log(JSON.stringify(plan, null, 2)); return; }
  const apiKey = required('COMPOSIO_API_KEY');
  if (plan.request) {
    const response = await fetch(plan.request.url, { method: 'POST', redirect: 'error',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(plan.request.body), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Composio HTTP ${response.status}. Registration conflicts need a new slug or an explicit migration; this script never deletes connections.`);
    const result = await response.json();
    if (!result.slug?.startsWith('CUSTOM_')) throw Error('Composio returned no toolkit slug.');
    console.log(JSON.stringify({ slug: result.slug, version: result.version, synced_count: result.synced_count }, null, 2));
    return;
  }
  const { Composio } = await import('@composio/core');
  const composio = new Composio({ apiKey, allowTracking: false, toolkitVersions: { [slug]: 'latest' } });
  const { userId, ...options } = plan.session;
  const session = await composio.sessions.create(userId, options, { signal: AbortSignal.timeout(30000) });
  if (command === 'connect') {
    const connection = await session.authorize(slug, {}, { signal: AbortSignal.timeout(30000) });
    console.log(JSON.stringify({ connectedAccountId: connection.id, redirectUrl: connection.redirectUrl }, null, 2));
  } else if (command === 'discover') {
    const result = await session.search({ query: 'List Conquistador methods and playbooks', toolkits: [slug] }, { signal: AbortSignal.timeout(30000) });
    console.log(JSON.stringify(result, null, 2));
  } else {
    const result = await session.execute(plan.tool, {}, undefined, { signal: AbortSignal.timeout(30000) });
    if (result.resultType !== 'completed' || result.error || result.data?.isError) throw Error('The methods read failed. Check the selected connection and sync state.');
    console.log(JSON.stringify({ tool: plan.tool, result: result.data }, null, 2));
  }
}
main().catch(error => {
  // SDK exceptions can contain request headers; never print their raw details.
  console.error(error?.constructor === Error ? error.message : 'Composio request failed. Check account state and project logs.');
  process.exitCode = 1;
});
