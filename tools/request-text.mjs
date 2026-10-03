// Admission and selection share invocation syntax. Quoted examples do not activate either.
const invocation = /(?:^|[\s`])(?:please\s+)?(?:use|open|run|ask|start)\s+conquistador\b(?:\s*,|\s+to|\s+and)?\s*|\bread\s+\.?conquistador\/skill\.md(?:\s+and\s+follow\s+it)?[.,]?\s*|(?:^|[\s`])[/$@]conquistador(?:[/:][a-z][a-z0-9-]*)?(?=[\s`,.:;!?]|$)/gi;
export function unquotedRequest(prompt) {
  return prompt.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]*"|(?<!\w)'[^'\n]*'(?!\w)/g, ' ');
}
export function explicitInvocation(prompt) {
  return unquotedRequest(prompt).split(/(?<=[.!?;])\s+|\n+|\b(?:and|but)\b/i)
    .some(clause => !/\b(?:do not|don't|never|without)\b/i.test(clause) && new RegExp(invocation.source, 'i').test(clause));
}

// The command after an explicit invocation: "/conquistador launch ...", "$conquistador copy",
// "/conquistador:write-copy", or a prompt that starts with "conquistador seo". Returns the raw word.
const commandInvocation = /(?:^|[\s`])[/$@]conquistador(?:\s+|[:/])([a-z][a-z0-9-]*)\b|^\s*conquistador\s+([a-z][a-z0-9-]*)\b/i;
export function invokedCommand(prompt) {
  const match = commandInvocation.exec(unquotedRequest(prompt));
  return match ? (match[1] ?? match[2]).toLowerCase() : null;
}

export function requestClauses(prompt, { protectedPhrases = [] } = {}) {
  const request = unquotedRequest(prompt).replace(invocation, ' ')
    .replace(/\b[\w/-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|vue|svelte|py|go|rs|java|rb)\b/gi, ' ');

  const protectedSpans = [];

  for (const phrase of [...new Set(protectedPhrases)].sort((a, b) => b.length - a.length)) {
    const words = normalizeRequest(phrase).split(' ').filter(Boolean);

    if (words.length < 2) continue;
    const expression = new RegExp(`(?<![a-z0-9])${words.join('[\\s_-]+')}(?![a-z0-9])`, 'gi');

    for (const match of request.matchAll(expression)) {
      const span = { start: match.index, end: match.index + match[0].length };

      if (!protectedSpans.some(item => span.start < item.end && span.end > item.start)) protectedSpans.push(span);
    }
  }

  const clauses = [];
  let start = 0;

  for (const separator of request.matchAll(/[.!?;\n]+|,|\b(?:and then|then|and|but)\b/gi)) {
    const end = separator.index + separator[0].length;

    if (protectedSpans.some(span => separator.index < span.end && end > span.start)) continue;

    clauses.push(request.slice(start, separator.index));
    start = end;
  }

  clauses.push(request.slice(start));

  const requested = [];

  for (const raw of clauses) {
    const clause = raw.trim();

    if (!clause || /\b(?:do not|don't|dont|never|exclude|skip|without|not asking)\b/i.test(clause)
      || /\b(?:string|fixture|example)\b/i.test(clause)
      || /\b(?:developer context|system context|routing score|smoke_context_|method path)\b/i.test(clause)) continue;

    requested.push(clause.replace(/\b(?:using|with|from|for)\s+(?:this |the |our )?(?:already )?(?:approved|accepted|supplied|existing)\s+[\w -]+/gi, ' '));
  }

  return requested;
}
export function normalizeRequest(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function includesPhrase(text, phrase) {
  return (` ${text} `).includes(` ${normalizeRequest(phrase)} `);
}
