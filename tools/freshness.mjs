#!/usr/bin/env node
// Contributor-only check: finds every dated block in the method library and reports the blocks
// that are past their review date. See docs/META-WATCH.md.
//
//   node tools/freshness.mjs [--root <folder>] [--now YYYY-MM-DD] [--max-age-days 90]
//                            [--soon-days 30] [--json]
//
// Exit codes: 0 every block is current, 1 a block is overdue or invalid, 2 usage or scan error.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE = String.raw`[A-Za-z]{3,9}\.?\s+\d{4}|\d{4}-\d{2}(?:-\d{2})?`;
const MARKER = new RegExp(String.raw`\((checked|verified|observed)\s+(${DATE})([^)]*)\)`, 'gi');
const REVIEW = new RegExp(String.raw`review by\s+(${DATE})`, 'i');
const DAY = 86_400_000;

const endOfMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0));

// Returns { date, start } or { error }. A month-precision date resolves to the last day of the
// month; `start` is the first day, which the future-date check uses.
function parseDate(raw) {
  const numeric = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (numeric) {
    const [year, month, dayOfMonth] = [Number(numeric[1]), Number(numeric[2]) - 1, numeric[3] && Number(numeric[3])];
    if (month < 0 || month > 11) return { error: `unknown month in "${raw}"` };
    if (!dayOfMonth) return { date: endOfMonth(year, month), start: new Date(Date.UTC(year, month, 1)) };
    const date = new Date(Date.UTC(year, month, dayOfMonth));
    if (date.getUTCMonth() !== month) return { error: `unknown day in "${raw}"` };
    return { date, start: date };
  }
  const named = raw.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  const name = named[1].toLowerCase();
  const month = MONTHS.findIndex(short => name === short || (name.startsWith(short) && FULL[short] === name));
  if (month < 0) return { error: `unknown month in "${raw}"` };
  const year = Number(named[2]);
  return { date: endOfMonth(year, month), start: new Date(Date.UTC(year, month, 1)) };
}

const FULL = {
  jan: 'january', feb: 'february', mar: 'march', apr: 'april', may: 'may', jun: 'june',
  jul: 'july', aug: 'august', sep: 'september', oct: 'october', nov: 'november', dec: 'december',
};

export function parseMarkers(text) {
  const blocks = [];
  for (const match of text.matchAll(MARKER)) {
    const word = match[1].toLowerCase();
    const block = {
      kind: word === 'observed' ? 'plays' : 'facts',
      marker: match[0],
      line: text.slice(0, match.index).split('\n').length,
    };
    const dated = parseDate(match[2]);
    if (dated.error) {
      blocks.push({ ...block, invalid: dated.error });
      continue;
    }
    block.date = dated.date;
    block.start = dated.start;
    const review = match[3].match(REVIEW);
    if (review) {
      const reviewed = parseDate(review[1]);
      if (reviewed.error) block.invalid = reviewed.error;
      else if (reviewed.date < dated.start) block.invalid = 'review date is before the observed date';
      else block.reviewBy = reviewed.date;
    } else if (block.kind === 'plays') {
      block.invalid = 'an observed block needs "review by <month year>"';
    }
    blocks.push(block);
  }
  return blocks;
}

function markdownFiles(root) {
  const files = [];
  const walk = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) files.push(path);
    }
  };
  walk(root);
  return files;
}

export function scan(root, { now = new Date(), maxAgeDays = 90, soonDays = 30 } = {}) {
  const blocks = [];
  for (const path of markdownFiles(root)) {
    const file = relative(root, path).split(sep).join('/');
    for (const block of parseMarkers(readFileSync(path, 'utf8'))) {
      const entry = { file, ...block };
      if (!entry.invalid && entry.start > now) entry.invalid = 'date is in the future';
      if (!entry.invalid) {
        entry.due = entry.reviewBy ?? new Date(entry.date.getTime() + maxAgeDays * DAY);
        entry.status = now > entry.due ? 'overdue' : entry.due.getTime() - now.getTime() <= soonDays * DAY ? 'soon' : 'current';
      } else {
        entry.status = 'invalid';
      }
      delete entry.start;
      blocks.push(entry);
    }
  }
  if (!blocks.length) throw new Error(`No dated block found under ${root}. Check the folder.`);
  const pick = status => blocks.filter(block => block.status === status);
  return { blocks, overdue: pick('overdue'), invalid: pick('invalid'), soon: pick('soon') };
}

const iso = date => (date ? date.toISOString().slice(0, 10) : '');

function parseArgs(argv) {
  const options = { root: join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'conquistador'), now: new Date(), maxAgeDays: 90, soonDays: 30, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      index += 1;
      if (argv[index] === undefined) throw new Error(`${flag} needs a value.`);
      return argv[index];
    };
    const days = minimum => {
      const number = Number(value());
      if (!Number.isInteger(number) || number < minimum) throw new Error(`${flag} needs a whole number of days, at least ${minimum}.`);
      return number;
    };
    if (flag === '--root') options.root = value();
    else if (flag === '--now') {
      const raw = value();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) throw new Error('--now needs a date as YYYY-MM-DD.');
      options.now = new Date(`${raw}T00:00:00Z`);
    } else if (flag === '--max-age-days') options.maxAgeDays = days(1);
    else if (flag === '--soon-days') options.soonDays = days(0);
    else if (flag === '--json') options.json = true;
    else throw new Error(`Unknown option ${flag}.`);
  }
  return options;
}

function main(argv) {
  let options;
  let report;
  try {
    options = parseArgs(argv);
    report = scan(options.root, options);
  } catch (error) {
    console.error(error.message);
    console.error('Usage: node tools/freshness.mjs [--root <folder>] [--now YYYY-MM-DD] [--max-age-days 90] [--soon-days 30] [--json]');
    return 2;
  }
  const row = block => ({ file: block.file, line: block.line, kind: block.kind, marker: block.marker, status: block.status, date: iso(block.date), due: iso(block.due), ...(block.invalid ? { invalid: block.invalid } : {}) });
  if (options.json) {
    console.log(JSON.stringify({ now: iso(options.now), maxAgeDays: options.maxAgeDays, blocks: report.blocks.map(row), overdue: report.overdue.map(row), invalid: report.invalid.map(row), soon: report.soon.map(row) }, null, 2));
  } else {
    const list = (title, blocks, detail) => {
      if (!blocks.length) return;
      console.log(`\n${title} (${blocks.length})`);
      for (const block of blocks) console.log(`  ${block.file}:${block.line}  ${block.marker}  ${detail(block)}`);
    };
    console.log(`Freshness on ${iso(options.now)}: ${report.blocks.length} dated blocks, ${report.overdue.length} overdue, ${report.invalid.length} invalid, ${report.soon.length} due soon.`);
    list('Overdue: check each block against a current source, then update its date', report.overdue, block => `due ${iso(block.due)}`);
    list('Invalid: fix the marker', report.invalid, block => block.invalid);
    list(`Due in the next ${options.soonDays} days`, report.soon, block => `due ${iso(block.due)}`);
  }
  return report.overdue.length || report.invalid.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
