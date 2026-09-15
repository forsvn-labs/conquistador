import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStackSession, type StackConfig, type StackDemand } from '../src/stack.ts';
import { createExecutorGithubRepositoryAdapter } from '../src/providers/executor-github.ts';
import { candidateBuildId, catalog, connection, now, resolution, root, supportedCatalog } from './helpers.ts';

function setup(supported = true) {
  const cat = supported ? supportedCatalog(['github.repository.get']) : catalog();
  let calls = 0;
  const conn = connection('github', ['metadata:read']);
  conn.allowedOperationIds = ['github.repository.get'];
  const adapter = createExecutorGithubRepositoryAdapter(cat, async () => {
    calls++;
    return { status: 200, headers: { date: 'Tue, 11 Aug 2026 00:00:00 GMT' }, body: { id: 1, name: 'sample', full_name: 'sample/sample', private: false, topics: [] } };
  }, ['sample/sample'], conn);
  const extension = JSON.parse(readFileSync(resolve(root, 'fixtures/v1/extensions/host-tool.json'), 'utf8'));
  const config: StackConfig = {
    catalog: cat, adapters: { [adapter.manifest.id]: adapter }, connections: { [conn.id]: conn },
    resolveConnection: async ref => resolution(ref), now: () => now, candidateBuildId,
    routes: [{ id: 'host.repository-read', kind: 'executor', adapterId: adapter.manifest.id, connectionRef: conn.id, extension }],
    policy: { executorOnly: true, allowedOperationIds: ['github.repository.get'], allowedDataClasses: ['public', 'internal'], maximumUnits: 2, maximumCost: 0 },
  };
  const demand: StackDemand = { operationId: 'github.repository.get', capabilityId: 'source.repository.read', principal: conn.principal, environment: 'sandbox', maxUnits: 1, maxCost: 0 };
  return { config, demand, calls: () => calls };
}

describe('existing stack negotiation', () => {
  it('selects the exact route, executes via Gateway, and returns a payload-free setup receipt', async () => {
    const { config, demand, calls } = setup();
    const stack = createStackSession(config);
    expect(stack.inspect(demand).status).toBe('ready');
    const out = await stack.read(demand, { input: { owner: 'sample', repository: 'sample' }, timeoutSeconds: 30 });
    expect(out.outcome?.ok).toBe(true); expect(calls()).toBe(1);
    expect(out.outcome?.result?.freshnessAt).toBe('2026-08-11T00:00:00.000Z');
    expect(out.receipt).toMatchObject({ status: 'succeeded', liveSupportPromoted: false });
    expect(JSON.stringify(out.receipt)).not.toMatch(/sample\/sample|synthetic-test-material|account-1/);
  });
  it('does not turn a fixture route into supported live execution', async () => {
    const { config, demand, calls } = setup(false);
    const stack = createStackSession(config);
    const out = await stack.read(demand, { input: {}, timeoutSeconds: 10 });
    expect(out.selection.status).toBe('unsupported'); expect(calls()).toBe(0);
    config.candidateVerification = { candidateBuildId, operationIds: ['github.repository.get'] };
    expect(createStackSession(config).inspect(demand).status).toBe('verification-only');
  });
  it('fails closed for absent systems, wrong principals, missing connections and non-Executor routes', () => {
    const { config, demand } = setup();
    expect(createStackSession(config).inspect({ ...demand, operationId: 'warehouse.orders.read' }).status).toBe('unsupported');
    expect(createStackSession(config).inspect({ ...demand, principal: { ...demand.principal, accountId: 'another' } }).status).toBe('connection-required');
    config.connections = {};
    expect(createStackSession(config).inspect(demand).status).toBe('connection-required');
    config.routes[0].kind = 'cli';
    expect(createStackSession(config).inspect(demand).status).toBe('unsupported');
  });
  it('blocks writes, confidential data, route drift and aggregate budget overruns', async () => {
    const { config, demand } = setup();
    expect(createStackSession(config).inspect({ ...demand, operationId: 'typefully.draft.create', capabilityId: 'distribution.draft.create' }).status).not.toBe('ready');
    config.policy.allowedDataClasses = [];
    expect(createStackSession(config).inspect(demand).status).toBe('policy-denied');
    config.policy.allowedDataClasses = ['public', 'internal'];
    const stack = createStackSession(config);
    await Promise.all([1, 2].map(() => stack.read(demand, { input: { owner: 'sample', repository: 'sample' }, timeoutSeconds: 10 })));
    expect(stack.inspect(demand).status).toBe('policy-denied');
    config.routes[0].extension.operations[0].catalog!.operationId = 'github.issue.list';
    expect(() => createStackSession(config)).toThrow();
  });
  it('preserves the fixed metadata read allowlist and records denied reads without provider calls', async () => {
    const { config, demand, calls } = setup();
    const out = await createStackSession(config).read(demand, { input: { owner: 'private', repository: 'other' }, timeoutSeconds: 10 });
    expect(out.outcome?.ok).toBe(false); expect(calls()).toBe(0);
  });
  it('does not execute a bound Executor adapter for a different connected account', async () => {
    const { config, demand, calls } = setup();
    config.connections['github.primary'].principal.accountId = 'second-account';
    const out = await createStackSession(config).read({ ...demand, principal: config.connections['github.primary'].principal }, { input: { owner: 'sample', repository: 'sample' }, timeoutSeconds: 10 });
    expect(out.outcome?.ok).toBe(false); expect(calls()).toBe(0);
  });
  it('bounds an uncooperative host resolver and retains the unknown read reservation', async () => {
    const { config, demand, calls } = setup();
    config.policy.maximumUnits = 1;
    config.resolveConnection = () => new Promise(() => {});
    const stack = createStackSession(config);
    const controller = new AbortController();
    const pending = stack.read(demand, { input: { owner: 'sample', repository: 'sample' }, timeoutSeconds: 30, signal: controller.signal });
    controller.abort();
    const out = await pending;
    expect(out.receipt).toMatchObject({ status: 'unknown', catalogReceiptDigest: null });
    expect(out.outcome).toBeNull(); expect(calls()).toBe(0);
    expect(stack.inspect(demand).status).toBe('policy-denied');
  });
});
