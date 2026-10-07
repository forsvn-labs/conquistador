// Claims in a draft that the caller's context does not support. No model: a number, or a name
// offered as a customer, that does not appear in the context text is a claim to confirm.
// The ask line (a question) and merge tags are skipped: a proposed call length is an offer, not a claim.

const mergeTag = /\{\{[^}]*\}\}|\{[a-z_]+\}|\*\|[A-Z_]+\|\*|%[a-z_]+%/gi;
// A number attached to a hyphenated word ("3-email", "15-minute") describes the message, not a result.
const number = /(?<![\w-])(?:[$€£]\s?)?\d[\d,.]*(?:\s?(?:%|x\b|k\b|m\b|percent\b))?(?!-?\w)/gi;
// "teams like Acme", "used by Acme and Northwind", "customers such as Acme"
const customerLead = /\b(?:teams?|companies|customers|clients|brands|users|founders|leaders)\s+(?:like|such as|including|at)\s+|\b(?:used|trusted|loved|chosen)\s+by\s+/gi;
const properName = /[A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*/g;

// Compare the value with its unit, so 10x does not match 10%. Thousands separators do not count.
const key = value => {
  const amount = value.replace(/[^\d.]/g, '').replace(/\.$/, '');
  const unit = /%|percent/i.test(value) ? '%' : /x$/i.test(value.trim()) ? 'x' : /k$/i.test(value.trim()) ? 'k' : /m$/i.test(value.trim()) ? 'm' : /[$€£]/.test(value) ? value.match(/[$€£]/)[0] : '';
  return amount ? `${amount}${unit}` : '';
};

export function contextClaims(document, context) {
  const known = context.toLowerCase();
  const knownNumbers = new Set((context.match(number) ?? []).map(key).filter(Boolean));
  const findings = [];
  for (const line of document.lines) {
    const text = line.text.replace(mergeTag, ' ');
    if (!text.trim() || /\?\s*$/.test(text.trim())) continue;
    for (const match of text.match(number) ?? []) {
      const value = key(match);
      if (value && !knownNumbers.has(value)) findings.push({ line: line.n, snippet: match.trim(), kind: 'number' });
    }
    for (const lead of text.matchAll(customerLead)) {
      const rest = text.slice(lead.index + lead[0].length);
      for (const name of rest.split(/[,;.!]|\s+(?:and|or)\s+/).slice(0, 4).map(part => part.trim().match(properName)?.[0]).filter(Boolean)) {
        if (!known.includes(name.toLowerCase())) findings.push({ line: line.n, snippet: name, kind: 'customer' });
      }
    }
  }
  return findings.map(({ line, snippet, kind }) => ({
    rule: 'claim-not-in-context', name: 'Claim not in the caller context', family: 'claims', severity: 'warning',
    message: kind === 'number' ? 'This number does not appear in the context you sent.' : 'This customer or user name does not appear in the context you sent.',
    fix: 'Confirm it with the user and add it to the context, or remove it.', line, snippet,
  }));
}
