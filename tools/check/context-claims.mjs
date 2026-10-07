// Claims in a draft that the caller's context does not support. No model: a number, or a name
// offered as a customer, that does not appear in the context text is a claim to confirm.
// The ask line (a question) and merge tags are skipped: a proposed call length is an offer, not a claim.

const mergeTag = /\{\{[^}]*\}\}|\{[a-z_]+\}|\*\|[A-Z_]+\|\*|%[a-z_]+%/gi;
// A number attached to a hyphenated word ("3-email", "15-minute") describes the message, not a result.
const number = /(?<![\w-])(?:[$€£]\s?)?\d[\d,.]*(?:\s?(?:%|x\b|k\b|m\b|percent\b))?(?!-?\w)/gi;
// "teams like Acme", "used by Acme and Northwind", "customers such as Acme"
const customerLead = /\b(?:teams?|companies|customers|clients|brands|users|founders|leaders)\s+(?:like|such as|including|at)\s+|\b(?:used|trusted|loved|chosen)\s+by\s+/gi;
const properName = /[A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*/g;
const notNames = new Set(['i', 'we', 'you', 'our', 'your', 'they', 'their', 'it', 'this', 'that', 'these', 'those', 'he', 'she', 'my', 'us',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december']);

// Compare the value with its unit, so 10x does not match 10%. Thousands separators do not count.
const key = value => {
  const amount = value.replace(/[^\d.]/g, '').replace(/\.$/, '');
  const unit = /%|percent/i.test(value) ? '%' : /x$/i.test(value.trim()) ? 'x' : /k$/i.test(value.trim()) ? 'k' : /m$/i.test(value.trim()) ? 'm' : /[$€£]/.test(value) ? value.match(/[$€£]/)[0] : '';
  return amount ? `${amount}${unit}` : '';
};

export function contextClaims(document, context) {
  const known = context.toLowerCase();
  // Every number the context mentions counts, including both ends of a range such as 50-500.
  const knownNumbers = new Set([...(context.match(number) ?? []).map(key), ...(context.match(/\d[\d,.]*/g) ?? []).map(key)].filter(Boolean));
  const findings = [];
  for (const line of document.lines) {
    const text = line.text.replace(mergeTag, ' ');
    if (!text.trim() || /\?\s*$/.test(text.trim())) continue;
    for (const match of text.match(number) ?? []) {
      const value = key(match);
      if (value && !knownNumbers.has(value)) findings.push({ line: line.n, snippet: match.trim(), kind: 'number' });
    }
    for (const lead of text.matchAll(customerLead)) {
      // The names run to the end of the clause: "teams like Acme, Northwind, and Initech."
      const clause = text.slice(lead.index + lead[0].length).split(/[.;!?:]/)[0];
      for (const name of clause.split(/,|\s+(?:and|or)\s+/).slice(0, 6).map(part => part.trim().replace(/^and\s+/i, '').match(properName)?.[0]).filter(Boolean)) {
        if (!notNames.has(name.toLowerCase()) && !known.includes(name.toLowerCase())) findings.push({ line: line.n, snippet: name, kind: 'customer' });
      }
    }
  }
  return findings.map(({ line, snippet, kind }) => ({
    rule: 'claim-not-in-context', name: 'Claim not in the caller context', family: 'claims', severity: 'warning',
    message: kind === 'number' ? 'This number does not appear in the context you sent.' : 'This customer or user name does not appear in the context you sent.',
    fix: 'Confirm it with the user and add it to the context, or remove it.', line, snippet,
  }));
}
