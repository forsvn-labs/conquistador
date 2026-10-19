// Executor v2 capability discovery and one explicitly selected read. Provider
// credentials stay in Executor. This module never executes model-supplied code.
import { createHash } from 'node:crypto';
import { executorV2Connection, openExecutorV2Mcp } from './executor-v2.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const executorDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const v2ToolPath = path => typeof path === 'string' && path.length <= 400 &&
  /^tools(?:\.[A-Za-z_][A-Za-z0-9_-]*|\["[A-Za-z0-9_-]+"\])+$/.test(path) &&
  !/(?:__proto__|constructor|prototype)/.test(path);
const appOf = path => /^tools(?:\.([A-Za-z_][A-Za-z0-9_-]*)|\["([A-Za-z0-9_-]+)"\])/.exec(path)?.slice(1).find(Boolean);
const fixedError = error => ['EXECUTOR_AUTH_REQUIRED', 'EXECUTOR_ACCESS_DENIED', 'EXECUTOR_CREDENTIAL_CHANGED',
  'EXECUTOR_CREDENTIAL_ECHO', 'EXECUTOR_ORGANIZATION_REQUIRED', 'INVALID_EXECUTOR_ORIGIN',
  'INVALID_AUTH_ENV', 'INVALID_ORGANIZATION'].includes(error?.code) ? error.code : 'EXECUTOR_V2_UNAVAILABLE';

export async function describeExecutorV2Read(session, tool) {
  if (!v2ToolPath(tool) || appOf(tool) === 'executor') throw Error('INVALID_READ_TOOL');
  const described = await session.call('describe', { paths: [tool] });
  const matches = described?.items?.filter(item => item.path === tool);
  if (matches?.length !== 1 || described.missing?.length || typeof matches[0].signature !== 'string' ||
      matches[0].signature.length > 65536) throw Error('TOOL_DESCRIPTION_REQUIRED');
  return { descriptor: matches[0], digest: executorDigest({ item: matches[0], namespaces: described.namespaces }) };
}

export function executorV2CallValue(result, tool) {
  const execution = result?.execution;
  const call = execution?.value;
  if (result?.status !== 'completed' || execution?.ok !== true || call?.ok !== true || call.path !== tool ||
      call.value?.isError === true) throw Error('EXECUTOR_READ_NOT_COMPLETED');
  return call.value;
}

export async function readinessV2({ map, ids, env, fetchImpl, records, classify }) {
  const report = { schema: 'conquistador.connect/v1', checkedAt: new Date().toISOString(),
    executor: { installed: false, generation: 2, cliRequired: false, server: { state: 'unknown' } }, integrations: [], capabilities: [], next: [] };
  const base = id => ({ id, class: map.capabilities[id].class, description: map.capabilities[id].description,
    recipe: `integrations/${id}.md`, state: 'unknown', integrations: [], tools: [] });
  let session;
  try {
    const connection = executorV2Connection(env);
    report.executor.server = { state: 'unknown', origin: connection.origin };
    session = await openExecutorV2Mcp(connection, { fetchImpl, signal: AbortSignal.timeout(60000) });
    report.executor.server.state = 'running';
    const definitions = await session.listTools();
    if (!['search', 'describe', 'call', 'resume'].every(name => definitions.some(tool => tool.name === name))) throw Error('V2_TOOLS_MISSING');
    const apps = new Set();
    for (const id of ids) {
      const row = base(id), spec = map.capabilities[id], record = records[id];
      const found = new Map();
      let unavailable = false;
      for (const query of spec.search) {
        const result = await session.call('search', { query, limit: 8 });
        if (!Array.isArray(result?.items) || result.items.length > 8) throw Error('DISCOVERY_INVALID');
        unavailable ||= Boolean(result.unavailableApps?.length);
        for (const item of result.items) if (v2ToolPath(item.path) && appOf(item.path) !== 'executor' &&
            (spec.class === 'write' ? classify(item.path) === 'write' : classify(item.path) === 'read')) found.set(item.path, item);
        if (found.size) break;
      }
      // An earlier explicit selection may use a tool outside the search phrases.
      // Re-describe that exact tool; never promote an old record on app name alone.
      if (record?.generation === 2 && record.connectionDigest === connection.identity &&
          v2ToolPath(record.tool) && classify(record.tool) === 'read') {
        try {
          const current = await describeExecutorV2Read(session, record.tool);
          if (current.digest === record.descriptionDigest) {
            found.set(record.tool, current.descriptor);
            const age = Date.now() - Date.parse(record.verifiedAt);
            if (age >= 0 && age < 86400000) Object.assign(row, { state: 'verified', verifiedAt: record.verifiedAt, verifiedTool: record.tool });
          }
        } catch { /* Revoked accounts or changed tools invalidate the old result. */ }
      }
      row.tools = [...found.keys()].slice(0, 3);
      row.integrations = [...new Set(row.tools.map(appOf))];
      row.integrations.forEach(app => apps.add(app));
      if (row.state !== 'verified') row.state = row.tools.length ? 'connected' : unavailable ? 'unknown' : 'missing';
      report.capabilities.push(row);
    }
    report.integrations = [...apps].map(slug => ({ slug, tools: null }));
    if (report.capabilities.some(row => row.state !== 'verified')) report.next.push('Connect accounts and inspect app policies in Executor. Search and describe do not prove provider access. Verify one explicitly selected read with conquistador connect verify.');
  } catch (error) {
    report.executor.error = fixedError(error);
    report.capabilities = ids.map(base);
    report.next.push('Use Executor’s Connect page. Set CONQUISTADOR_EXECUTOR_URL to the API origin, CONQUISTADOR_EXECUTOR_AUTH_ENV to the access-credential variable name, and CONQUISTADOR_EXECUTOR_ORGANIZATION for hosted access. Keep credentials out of chat.');
  } finally { await session?.close(); }
  return report;
}

export async function verifyV2({ capability, tool, input, env, fetchImpl }) {
  let session;
  try {
    const connection = executorV2Connection(env);
    session = await openExecutorV2Mcp(connection, { fetchImpl });
    const description = await describeExecutorV2Read(session, tool);
    const response = await session.call('call', { calls: { path: tool, input } });
    if (['approval-required', 'input-required'].includes(response?.status)) return {
      status: 'paused', capability, tool, reason: 'Executor requires an account or approval. Continue the pending request in the connected agent; do not repeat this call.',
      ...(typeof response.requestId === 'string' && /^(?:apr|elc)_[A-Za-z0-9_-]+$/.test(response.requestId) ? { requestId: response.requestId } : {}),
    };
    const value = executorV2CallValue(response, tool);
    const verifiedAt = new Date().toISOString(), resultBytes = Buffer.byteLength(JSON.stringify(value));
    return { status: 'verified', capability, tool, integration: appOf(tool), verifiedAt, resultBytes,
      record: { generation: 2, tool, integration: appOf(tool), verifiedAt, resultBytes,
        connectionDigest: connection.identity, descriptionDigest: description.digest, argsDigest: executorDigest(input) } };
  } catch (error) { return { status: 'failed', capability, tool, reason: fixedError(error) }; }
  finally { await session?.close(); }
}
