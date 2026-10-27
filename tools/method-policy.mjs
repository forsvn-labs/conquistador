// Owner decision, 27 Oct 2026. Every default loader uses this policy.
// Detailed files remain available for explicit reads and future blind tests.
export const UNCHANGED_COMMANDS = Object.freeze(['architect', 'build', 'docs', 'ui', 'init', 'doctor', 'pin',
  'connect', 'review', 'feedback', 'check', 'factcheck', 'vietnamese']);
export const KEPT_PLAYS = Object.freeze(['outbound', 'spec']);
const kept = new Set(['outreach', 'social', ...UNCHANGED_COMMANDS]);
const SALES_PAGE = /\bsales (?:pages?|letters?)\b/i;

export function isThinCommand(name, task = '') {
  return !kept.has(name) && !(name === 'copy' && SALES_PAGE.test(task));
}

export const isThinPlay = name => !KEPT_PLAYS.includes(name);
export const commandDocumentFor = (name, task = '') => isThinCommand(name, task) ? 'ENTRY.md' : 'COMMAND.md';
