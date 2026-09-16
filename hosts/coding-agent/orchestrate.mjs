import assert from 'node:assert/strict';
import { digest, loadAssignment, protocol, publicExecutionId, validatePlan, validateResult } from './contracts.mjs';
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
  const correction = { id: 'operator:correct', role: 'parent', goal: 'Apply one targeted correction to the integrated artifact using only the review findings. Do not rewrite unrelated work or grant human acceptance.', skills: [], workflows: [], knowledgeHandles: [], dependsOn: ['review'] };
  const finalReview = { ...review, id: 'operator:final-review', dependsOn: ['operator:correct'] };
  const assets = new Map();
  for (const task of [...plan.assignments, integration, review, correction, finalReview]) assets.set(task.id, await interruptible(
    () => loadAssignment(root, task, { authorize, resolveKnowledge, requiredTools: isolated ? ['host-worker-context'] : [] }), abort));

  async function execute(assignment, phase, dependencies, integratedDigest = null) {
    const packet = {
      schemaVersion: protocol, runId: plan.id, phase, assignment,
      goal: plan.goal, context: assets.get(assignment.id), dependencies,
      integratedDigest, maxOutputBytes: plan.limits.maxOutputBytes,
      authority: { externalMutation: 'deny', fileMutation: 'deny', delegation: 'deny', humanAcceptance: 'deny' },
    };
    const maxAttempts = phase === 'correct' || assignment.id === 'operator:final-review' ? 1 : plan.limits.maxAttempts;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      abort.throwIfAborted();
      assert.ok(++dispatches <= plan.limits.maxDispatches, 'Team dispatch budget exhausted');
      emit('assignment.started', { id: assignment.id, phase, attempt, packetDigest: digest(packet) });
      const dispatchRecord = { assignmentId: assignment.id, executionId: null, settled: false, cleanupFailed: false };
      let accepted = false;
      try {
        const work = Promise.resolve().then(() => executor.execute(structuredClone(packet), {
          signal: abort,
          onDispatch: executionId => {
            accepted = true;
            dispatchRecord.executionId = publicExecutionId(executionId);
            emit('assignment.dispatched', { id: assignment.id, executionId: dispatchRecord.executionId });
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
        accepted = true;
        abort.throwIfAborted();
        assert.ok(response?.executionId && response.isolated === isolated, 'Host execution identity or isolation mismatch');
        if (isolated) assert.ok(!executions.has(response.executionId), 'Host reused a specialist context');
        executions.add(response.executionId);
        const result = validateResult(response.result, packet);
        emit('assignment.finished', { id: assignment.id, phase, executionId: publicExecutionId(response.executionId), isolated, resultDigest: digest(result), status: result.status });
        return { ...result, executionId: response.executionId, isolated };
      } catch (error) {
        emit('assignment.failed', { id: assignment.id, phase, attempt, retryable: error.preDispatch === true && !accepted && !abort.aborted && attempt < maxAttempts && dispatches < plan.limits.maxDispatches });
        // Ambiguous or accepted dispatches must be reconciled, never replayed automatically.
        if (error.preDispatch !== true || accepted || abort.aborted || attempt === maxAttempts) throw error;
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
          if (dependencies.some(r => r.status === 'blocked')) {
            results.set(task.id, { assignmentId: task.id, status: 'blocked', skipped: true });
            emit('assignment.skipped', { id: task.id, reason: 'required-dependency-blocked' });
          } else results.set(task.id, await execute(task, 'work', dependencies));
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
    const integrationResult = integrated;
    let integratedDigest = digest(integrated.artifact);
    if (integrated.status === 'blocked') {
      return finish({
        status: 'blocked', independentReview: false, integrated, integratedDigest,
        integration: integrationResult, results: [...results.values()],
      });
    }
    let reviewed = await execute(review, 'review', [integrated], integratedDigest);
    const firstReview = reviewed;
    let finalReviewResult = null;
    let corrected = false;
    let correctionResult = null;
    const additionalGaps = [];
    if (reviewed.status === 'revise') {
      if (plan.limits.maxDispatches - dispatches >= 2) {
        emit('team.correction', { attempt: 1, reviewDigest: digest(reviewed) });
        correctionResult = await execute(correction, 'correct', [integrated, reviewed]);
        if (correctionResult.status === 'blocked') {
          additionalGaps.push('Targeted correction was blocked; remaining review findings are unresolved.');
          return finish({
            status: 'blocked', independentReview: isolated, integrated, integratedDigest, review: reviewed,
            integration: integrationResult, correction: correctionResult, results: [...results.values()],
          }, { additionalGaps, corrected: false });
        }
        integrated = correctionResult;
        integratedDigest = digest(integrated.artifact);
        finalReviewResult = await execute(finalReview, 'review', [integrated], integratedDigest);
        reviewed = finalReviewResult;
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
      integrated, integratedDigest, review: reviewed, integration: integrationResult,
      correction: correctionResult, firstReview, finalReview: finalReviewResult, results: [...results.values()],
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
