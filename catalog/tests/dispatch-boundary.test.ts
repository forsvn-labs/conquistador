import { describe, expect, it, vi } from 'vitest';
import { Gateway } from '../src/gateway.ts';
import { defineAdapter } from '../src/adapter.ts';
import { FetchProviderTransport } from '../src/providers/transport.ts';
import { connection, manifest, now, operation, request, resolution, result, supportedCatalog } from './helpers.ts';

function delayedGateway() {
  const item = operation('typefully.draft.create');
  const catalog = supportedCatalog([item.id]);
  const handler = vi.fn(async req => result(req, { draftId: 'draft-1', status: 'draft', previewUrl: 'https://typefully.com/draft/1' }));
  const adapter = defineAdapter(manifest(item.provider, [item.id], catalog), { [item.id]: handler }, catalog);
  const reference = connection(item.provider, item.authScopes);
  let time = new Date(now);
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const gateway = new Gateway({ catalog, adapters: { [adapter.manifest.id]: adapter }, connections: { [reference.id]: reference }, now: () => time,
    resolveConnection: async () => { await barrier; return resolution(reference); },
  });
  const req = request(item, { socialSetId: 'set-1', content: 'LOCAL TEST ONLY' });
  req.idempotencyKey = 'same-operation';
  return { gateway, req, handler, release, setTime: (value: Date) => { time = value; } };
}

describe('dispatch after connection resolution', () => {
  it('reserves an idempotency key once across concurrent calls', async () => {
    const test = delayedGateway();
    const pending = Promise.all([test.gateway.execute(test.req), test.gateway.execute(test.req)]);
    test.release();
    const outcomes = await pending;
    expect(test.handler).toHaveBeenCalledTimes(1);
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    expect(outcomes.find(outcome => !outcome.ok)?.error?.code).toBe('replay-denied');
  });
  it.each(['expiry', 'cancellation'])('does not dispatch after %s while resolving', async reason => {
    const test = delayedGateway();
    const controller = new AbortController();
    const pending = test.gateway.execute(test.req, { signal: controller.signal });
    if (reason === 'expiry') test.setTime(new Date(test.req.deadlineAt));
    else controller.abort();
    test.release();
    expect((await pending).ok).toBe(false);
    expect(test.handler).not.toHaveBeenCalled();
  });
});

describe('provider transport origin', () => {
  it.each(['/\\outside.example/path', '/\t/outside.example/path', '/\n/outside.example/path', '//outside.example/path'])('rejects %j before credentials reach fetch', async path => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new FetchProviderTransport(fetcher).request({ provider: 'github', operationId: 'github.repository.get', origin: 'https://api.github.com', method: 'GET', path, authentication: 'bearer', deadlineAt: new Date(Date.now() + 60000).toISOString() }, 'local-test-credential')).rejects.toMatchObject({ kind: 'provider' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
