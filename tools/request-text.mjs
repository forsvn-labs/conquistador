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
export function requestClauses(prompt) {
  return unquotedRequest(prompt).replace(invocation, ' ')
    .replace(/\b[\w/-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|vue|svelte|py|go|rs|java|rb)\b/gi, ' ')
    .split(/[.!?;\n]+|,|\b(?:and then|then|and|but)\b/i)
    .map(clause => clause.trim())
    .filter(clause => clause && !/\b(?:do not|don't|dont|never|exclude|skip|without|not asking)\b/i.test(clause))
    .filter(clause => !/\b(?:string|fixture|example)\b/i.test(clause))
    .filter(clause => !/\b(?:developer context|system context|routing score|smoke_context_|method path)\b/i.test(clause))
    .map(clause => clause.replace(/\b(?:using|with|from|for)\s+(?:this |the |our )?(?:already )?(?:approved|accepted|supplied|existing)\s+[\w -]+/gi, ' '));
}
export function normalizeRequest(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function includesPhrase(text, phrase) {
  return (` ${text} `).includes(` ${normalizeRequest(phrase)} `);
}
