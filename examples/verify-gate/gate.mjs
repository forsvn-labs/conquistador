// The handover gate. A host calls review() with the drafts an agent wants to hand over. It accepts
// them only when conquistador_verify says every draft is the exact text of a clean, signed check
// that used the host's channel and context. Otherwise it rejects the whole delivery and tells the
// agent what to fix, with the blocking findings of each rejected draft. The gate fails closed: when
// the host cannot verify (server down, refused, or not signing receipts), it hands nothing over.
//
// callTool(name, args) returns the tool's structured result. It throws an error with
// `toolError: true` when the tool refuses the arguments, and any other error when the host cannot
// reach the server.

const blockingSeverities = new Set(['error', 'warning']);

export function createHandoverGate({ callTool, channel, context, requireSigned = true }) {
  const expected = { ...(channel === undefined ? {} : { channel }), ...(context === undefined ? {} : { context }) };
  const hostError = message => Object.assign(new Error(message), { hostError: true });

  const call = async (name, args) => {
    try {
      return { value: await callTool(name, args) };
    } catch (failure) {
      if (failure.toolError) return { toolError: failure.message };
      throw hostError(`The host could not reach Conquistador: ${failure.message}`);
    }
  };

  // The findings the agent must fix, from the host's own check of the text it delivered.
  const findingsFor = async text => {
    const { value } = await call('conquistador_check', { text, ...expected });
    return (value?.findings ?? []).filter(finding => blockingSeverities.has(finding.severity))
      .map(({ rule, severity, line, message, fix }) => ({ rule, severity, line, message, fix }));
  };

  const reviewDraft = async (draft, index) => {
    const title = typeof draft?.title === 'string' && draft.title.trim() ? draft.title.trim() : `Draft ${index + 1}`;
    if (typeof draft?.text !== 'string' || !draft.text.trim()) return { title, accepted: false, reason: 'The draft has no text.' };
    if (draft.receipt === undefined || draft.receipt === null) {
      return { title, accepted: false, reason: 'The draft has no receipt. Run conquistador_check on the final text and deliver the receipt it returns.', findings: await findingsFor(draft.text) };
    }
    const verified = await call('conquistador_verify', { text: draft.text, receipt: draft.receipt, ...expected });
    if (verified.toolError) return { title, accepted: false, reason: `The receipt is not usable: ${verified.toolError}` };
    const { valid, clean, signed, reason } = verified.value;
    if (valid && !signed && requireSigned) throw hostError('The Conquistador server does not sign receipts, so the host cannot prove a check ran. Set CONQUISTADOR_RECEIPT_KEY on the server.');
    if (valid && clean) return { title, accepted: true, reason };
    return { title, accepted: false, reason, findings: await findingsFor(draft.text) };
  };

  const feedbackFor = results => {
    const rejected = results.filter(result => !result.accepted);
    const lines = [`The host did not accept the delivery: ${rejected.length} of ${results.length} drafts failed verification. Nothing was handed over.`];
    for (const result of rejected) {
      lines.push('', `${result.title}: ${result.reason}`);
      for (const finding of result.findings ?? []) lines.push(`- line ${finding.line} ${finding.rule} (${finding.severity}): ${finding.message} Fix: ${finding.fix}`);
    }
    const using = [channel && `channel ${channel}`, context && 'the context you were given'].filter(Boolean).join(' and ');
    lines.push('', `Fix each draft, run conquistador_check on its final text${using ? ` with ${using}` : ''}, then deliver every draft again with its exact text and the receipt from its last check.`);
    return lines.join('\n');
  };

  async function review(drafts) {
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return { accepted: false, results: [], delivered: [], feedback: 'Deliver at least one draft, each with its final text and the receipt from its last conquistador_check.' };
    }
    const results = [];
    try {
      for (const [index, draft] of drafts.entries()) results.push(await reviewDraft(draft, index));
    } catch (failure) {
      if (!failure.hostError) throw failure;
      return { accepted: false, results, delivered: [], hostError: failure.message, feedback: `The host could not verify the delivery, so nothing was handed over. ${failure.message}` };
    }
    const accepted = results.every(result => result.accepted);
    // Hand over the texts the gate verified, never a later copy from the agent.
    const delivered = accepted ? drafts.map((draft, index) => ({ title: results[index].title, text: draft.text })) : [];
    return { accepted, results, delivered, feedback: accepted ? `Accepted ${results.length} drafts. The host will hand them over.` : feedbackFor(results) };
  }

  return { review };
}
