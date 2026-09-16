import assert from 'node:assert/strict';
import { digest, loadAssignment, protocol, validatePlan, validateResult } from './contracts.mjs';
import { attachReceipt, formatEngagementBrief } from './receipt.mjs';

function interruptible(work, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Team execution cancelled or timed out; reconcile accepted work before retrying.'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** The host owns model invocation and permissions. This coordinator never authorizes an action. */
export async function runSpecialistTeam({ plan: input, root, host, parent, signal, onEvent = () => {}, authorize, resolveKnowledge }) {
  const plan = validatePlan(input);
  const isolated = host?.capabilities?.isolatedContexts === true;
  const mode = isolated ? 'isolated-workers' : 'sequential-in-context';
  const executor = isolated ? host : parent;
  assert.equal(typeof executor?.execute, 'function', `${mode} needs an explicit host callback`);
  const controller = new AbortController();
  const abort = AbortSignal.any([controller.signal, AbortSignal.timeout(plan.limits.timeoutSeconds * 1000), ...(signal ? [signal] : [])]);
  const trace = [];
  const emit = (type, detail) => { const event = { sequence: trace.length + 1, type, ...detail }; trace.push(event); onEvent(event); };
  const results = new Map();
  const executions = new Set();
  const dispatchRecords = [];
  const cleanupMilliseconds = executor.cleanupTimeoutMs ?? 5000;
  assert.ok(Number.isInteger(cleanupMilliseconds) && cleanupMilliseconds >= 1 && cleanupMilliseconds <= 90000, 'Invalid cleanup deadline');
  let dispatches = 0;
  emit('team.started', { mode, planDigest: digest(plan), independentReview: false });
  // Validate every method and restriction before the first worker is created.
  const integration = { id: 'integrate', role: 'parent', goal: plan.goal, skills: [], workflows: [], knowledgeHandles: [], dependsOn: plan.assignments.map(t => t.id) };
  const review = { id: 'review', role: 'outcome', goal: 'Review the exact integrated artifact against the goal. Identify contradictions, unsupported claims, and missing deliverables. Return draft or revise; never grant human acceptance.', skills: ['fresh-eyes-review'], workflows: [], knowledgeHandles: [], dependsOn: ['integrate'] };
  const correction = { id: 'correct', role: 'parent', goal: 'Apply one targeted correction to the integrated artifact using only the review findings. Do not rewrite unrelated work or grant human acceptance.', skills: [], workflows: [], knowledgeHandles: [], dependsOn: ['review'] };
  const assets = new Map();
  for (const task of [...plan.assignments, integration, review, correction]) assets.set(task.id, await interruptible(
    () => loadAssignment(root, task, { authorize, resolveKnowledge, requiredTools: isolated ? ['host-worker-context'] : [] }), abort));

  async function execute(assignment, phase, dependencies, integratedDigest = null) {
    const packet = {
      schemaVersion: protocol, runId: plan.id, phase, assignment,
      goal: plan.goal, context: assets.get(assignment.id), dependencies,
      integratedDigest, maxOutputBytes: plan.limits.maxOutputBytes,
      authority: { externalMutation: 'deny', fileMutation: 'deny', delegation: 'deny', humanAcceptance: 'deny' },
    };
    for (let attempt = 1; attempt <= plan.limits.maxAttempts; attempt++) {
      abort.throwIfAborted();
      assert.ok(++dispatches <= plan.limits.maxDispatches, 'Team dispatch budget exhausted');
      emit('assignment.started', { id: assignment.id, phase, attempt, packetDigest: digest(packet) });
      try {
        const dispatchRecord = { assignmentId: assignment.id, executionId: null, settled: false, cleanupFailed: false };
        const work = Promise.resolve().then(() => executor.execute(structuredClone(packet), {
          signal: abort,
          onDispatch: executionId => {
            dispatchRecord.executionId = executionId;
            emit('assignment.dispatched', { id: assignment.id, executionId });
          },
        }));
        dispatchRecord.promise = work;
        dispatchRecords.push(dispatchRecord);
        work.then(() => { dispatchRecord.settled = true; }, error => {
          dispatchRecord.settled = true;
          dispatchRecord.cleanupFailed = error?.cleanupFailed === true;
          dispatchRecord.unverifiedChildId = error?.unverifiedChildId ?? null;
        });
        const response = await interruptible(() => work, abort);
        abort.throwIfAborted();
        assert.ok(response?.executionId && response.isolated === isolated, 'Host execution identity or isolation mismatch');
        if (isolated) assert.ok(!executions.has(response.executionId), 'Host reused a specialist context');
        executions.add(response.executionId);
        const result = validateResult(response.result, packet);
        emit('assignment.finished', { id: assignment.id, phase, executionId: response.executionId, isolated, resultDigest: digest(result), status: result.status });
        return { ...result, executionId: response.executionId, isolated };
      } catch (error) {
        emit('assignment.failed', { id: assignment.id, phase, attempt, retryable: error.preDispatch === true && !abort.aborted });
        // Ambiguous or accepted dispatches must be reconciled, never replayed automatically.
        if (error.preDispatch !== true || abort.aborted || attempt === plan.limits.maxAttempts) throw error;
      }
    }
  }

  const finish = (result, extras = {}) => {
    const attached = attachReceipt({ ...result, mode, trace }, plan, extras);
    emit('team.receipt', {
      receiptDigest: digest(attached.receipt),
      formatError: attached.receiptFormatError,
      independentReview: attached.receipt.independentReview === true,
    });
    return attached;
  };

  try {
    const concurrency = isolated ? Math.min(plan.limits.concurrency, host.capabilities.maxConcurrency) : 1;
    assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4, 'Invalid host concurrency');
    emit('team.brief', { markdown: formatEngagementBrief(plan, { isolated }), isolated });
    const pending = new Map(plan.assignments.map(t => [t.id, t]));
    let primaryFailure;
    while (pending.size) {
      const ready = [...pending.values()].filter(t => t.dependsOn.every(id => results.has(id))).slice(0, concurrency);
      assert.ok(ready.length, 'No runnable assignments');
      // Stop all siblings on failure, then join cleanup before returning.
      const settled = await Promise.allSettled(ready.map(async task => {
        try {
          const dependencies = task.dependsOn.map(id => results.get(id));
          if (dependencies.some(r => r.status === 'blocked')) throw new Error('A required dependency is blocked');
          results.set(task.id, await execute(task, 'work', dependencies));
          pending.delete(task.id);
        } catch (error) { primaryFailure ??= error; controller.abort(); throw error; }
      }));
      const failure = settled.find(r => r.status === 'rejected');
      if (failure) throw primaryFailure;
    }
    if ([...results.values()].some(r => r.status === 'blocked')) {
      emit('team.blocked', { reason: 'required-assignment-blocked' });
      return finish({ status: 'blocked', independentReview: false, results: [...results.values()] });
    }
    // Integration is one explicit parent assignment. It receives every specialist result.
    let integrated = await execute(integration, 'integrate', [...results.values()]);
    let integratedDigest = digest(integrated.artifact);
    if (integrated.status === 'blocked') {
      return finish({ status: 'blocked', independentReview: false, integrated, integratedDigest, results: [...results.values()] });
    }
    let reviewed = await execute(review, 'review', [integrated], integratedDigest);
    let corrected = false;
    const additionalGaps = [];
    if (reviewed.status === 'revise') {
      if (plan.limits.maxDispatches - dispatches >= 2) {
        emit('team.correction', { attempt: 1, reviewDigest: digest(reviewed) });
        const correctedResult = await execute(correction, 'correct', [integrated, reviewed]);
        if (correctedResult.status === 'blocked') {
          additionalGaps.push('Targeted correction was blocked; remaining review findings are unresolved.');
          return finish({
            status: 'blocked', independentReview: isolated, integrated, integratedDigest, review: reviewed,
            results: [...results.values()],
          }, { additionalGaps, corrected: true });
        }
        integrated = correctedResult;
        integratedDigest = digest(integrated.artifact);
        reviewed = await execute(review, 'review', [integrated], integratedDigest);
        corrected = true;
        if (reviewed.status !== 'draft') {
          additionalGaps.push('Material issues remain after one targeted correction and re-review.');
          emit('team.material-failure', { afterCorrection: true, status: reviewed.status });
        }
      } else {
        additionalGaps.push('Review requested revision; remaining dispatch budget prevented a correction pass.');
        emit('team.correction-skipped', { reason: 'dispatch-budget' });
      }
    }
    emit('team.finished', { integratedDigest, independentReview: isolated, humanAccepted: false, corrected });
    return finish({
      status: reviewed.status, independentReview: isolated, humanAccepted: false,
      integrated, integratedDigest, review: reviewed, results: [...results.values()],
    }, { additionalGaps, corrected });
  } catch (error) {
    error.teamTrace = trace;
    throw error;
  } finally {
    controller.abort();
    let timer;
    await Promise.race([
      Promise.allSettled(dispatchRecords.map(record => record.promise)),
      new Promise(resolve => { timer = setTimeout(resolve, cleanupMilliseconds); }),
    ]);
    clearTimeout(timer);
    const unresolved = dispatchRecords.filter(record => !record.settled || record.cleanupFailed || record.unverifiedChildId)
      .map(({ assignmentId, executionId, settled, cleanupFailed, unverifiedChildId }) => ({ assignmentId, executionId, settled, cleanupFailed, unverifiedChildId: unverifiedChildId ?? null }));
    if (unresolved.length) {
      emit('team.cleanup-required', { unresolved });
      throw Object.assign(new Error('Team cleanup is incomplete. Reconcile the recorded dispatches before another run.'), { teamTrace: trace, unresolved });
    }
  }
}
