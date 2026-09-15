import type { Catalog, ConnectionReference } from '../contracts.ts';
import { defineAdapter } from '../adapter.ts';
import { createGithubAdapter } from './github.ts';
import { invariant, validateConnectionReference } from '../validate.ts';
import { deepFreeze, sha256 } from '../canonical.ts';

export type ExecutorRepositoryRead = (
  input: Readonly<{ owner: string; repository: string }>,
  options: Readonly<{ signal?: AbortSignal; deadlineAt: string; connection: Readonly<ConnectionReference>; credential: unknown }>,
) => Promise<{ status: number; headers: Record<string, string>; body: unknown }>;

/** One audited mapping. The host binds it to its discovered Executor operation, never a model-supplied path. */
export function createExecutorGithubRepositoryAdapter(catalog: Catalog, readRepository: ExecutorRepositoryRead, allowedRepositories: readonly string[], connection: ConnectionReference) {
  const allowed = new Set(allowedRepositories);
  validateConnectionReference(connection);
  invariant(connection.provider === 'github' && connection.allowedOperationIds.includes('github.repository.get'), 'Executor repository connection required');
  const binding = deepFreeze(structuredClone(connection));
  const bindingDigest = sha256(binding);
  invariant(allowed.size > 0 && [...allowed].every(id => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(id)), 'exact repository read allowlist required');
  const github = createGithubAdapter(catalog, { async request(request, credential) {
    invariant(request.operationId === 'github.repository.get' && request.method === 'GET' && request.origin === 'https://api.github.com' &&
      !request.query && !request.body, 'Executor mapping supports repository metadata only');
    const match = /^\/repos\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(request.path);
    invariant(match && allowed.has(`${match[1]}/${match[2]}`), 'Repository is outside the host read allowlist');
    const response = await readRepository({ owner: match[1], repository: match[2] }, { signal: request.signal, deadlineAt: request.deadlineAt, connection: binding, credential });
    invariant(response.status === 200, 'Executor repository read did not succeed');
    invariant(response.body && typeof response.body === 'object' &&
      (response.body as Record<string, unknown>).full_name === `${match[1]}/${match[2]}`, 'Executor repository identity changed');
    return response;
  } });
  return defineAdapter({ ...github.manifest, id: 'github.executor-metadata', operationIds: ['github.repository.get'], capabilityIds: ['source.repository.read'] },
    { 'github.repository.get': async (request, context) => {
      invariant(sha256(context.connection) === bindingDigest && request.connectionRef === context.connection.id &&
        sha256(request.expectedPrincipal) === sha256(context.connection.principal) && request.connectionRevision === context.connection.revision &&
        request.connectionEnvironment === context.connection.environment, 'Executor connection binding mismatch');
      return github.handlers['github.repository.get'](request, context);
    } }, catalog);
}
