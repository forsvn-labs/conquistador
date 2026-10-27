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
    // "Test a price increase without upsetting customers": what follows "without" is a constraint.
    const clause = raw.replace(/\bwithout\b[\s\S]*$/i, '').trim();

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

// The work a clause asks for, before its subject: "write a post announcing our new integration" asks
// for a post. A technical noun in the subject does not make a marketing artifact engineering work.
export function requestOperation(clause) {
  return clause.split(/\b(?:for|about|after|on|announcing|introducing|launching|celebrating|promoting)\b/i)[0];
}

// Users paste a request with supporting context: facts, notes, lists, background paragraphs. A request
// sentence opens with an instruction ("Write a LinkedIn post", "Can you draft", "I need three ads",
// "Fix the handler"); list items and other sentences are context. Returns the request sentences when
// the prompt holds both, otherwise null.
const instruction = String.raw`(?:write|draft|create|make|compose|produce|prepare|generate|give|put together|come up with|turn|rewrite|edit|revise|shorten|polish|translate|review|audit|critique|evaluate|plan|outline|map out|build|design|set up|define|pick|choose|fix|debug|refactor|implement|patch|add|update|migrate|deploy|install|configure)`;
const requestOpener = new RegExp(String.raw`^(?:[^,.;:]{0,60},\s*)?(?:(?:task|request|ask|deliverable|assignment)\s*:\s*)?(?:(?:please|pls|now|so|and|then|also)\s+)*`
  + String.raw`(?:(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|help\s+(?:me|us)\s+(?:to\s+)?|let'?s\s+|(?:i|we)(?:\s+would|'d)?\s+(?:need|want|like)\s+you\s+to\s+)?${instruction}(?=\s+[\w"'$])`
  + String.raw`|(?:i|we)(?:\s+would|'d)?\s+(?:need|want|like)\s+(?:a|an|the|some|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b)`, 'i');
const listItem = /^\s*(?:[-*•–]|\d+[.)])\s+/;
export function requestFocus(prompt) {
  const units = [];

  for (const line of unquotedRequest(prompt).replace(invocation, ' ').split(/\n+/)) {
    if (!/[\p{L}\p{N}]/u.test(line)) continue;
    if (listItem.test(line)) units.push({ text: line, request: false });
    else for (const sentence of line.split(/(?<=[.!?])\s+/)) if (/[\p{L}\p{N}]/u.test(sentence)) units.push({ text: sentence.trim(), request: requestOpener.test(sentence.trim()) });
  }
  const request = units.filter(unit => unit.request);

  return request.length && request.length < units.length ? request.map(unit => unit.text).join('\n') : null;
}

// Admission runs before phrase matching or retrieval. Topic words alone are not a task.
export function requestedBusinessClauses(prompt, options) {
  return requestClauses(prompt, options).filter(clause => {
    const text = normalizeRequest(clause);
    // Definitions are questions, not tasks. "What does it take" and "what is the plan" are tasks.
    if (/\bwhat (?:is|are) (?:a|an)\b|\bwhat does(?: \w+){1,3} mean\b|\bmeaning of\b|\bwhat is the difference\b/.test(text)) return false;
    const productBuild = /\b(?:responsive web app|approved flow|product experience|product requirements|product spec|feature spec|in product ui)\b/.test(text);
    const operation = requestOperation(text);
    // "System" and "test" are also marketing words (a content system, a test budget). They mark
    // engineering only with an engineering verb.
    const engineering = (/\b(?:engineer|engineering|debug|refactor|compile|typecheck|implement|fix|patch|design|build|write|create)\b/.test(operation)
      && /\b(?:queue|api|handler|webhook|database|schema|code|function|component|server|typescript|retry|retries|middleware|bug|error|endpoint|migration|integration)\b/.test(operation))
      || (/\b(?:engineer|engineering|debug|refactor|compile|typecheck|implement|fix|patch)\b/.test(operation) && /\b(?:system|test|tests)\b/.test(operation));
    const technicalSubject = /\b(?:code|handlers?|middleware|ci pipeline|typescript|stack trace)\b/.test(operation);
    return (!engineering && !technicalSubject) || productBuild;
  });
}

export function requestMode(query, play) {
  if (/\b(?:shorten|trim|rephrase|subject line|one headline|single headline|small edit|proofread)\b/i.test(query)) return 'assist';
  return play ? 'workflow' : 'command';
}
