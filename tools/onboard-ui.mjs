// Look and feel for the first-run flow: brand colors, the wordmark, and a line-based UI for
// --plain and TERM=dumb. Colors come from conquistador-landing src/styles/tokens.css:
// Ember #FF8A4C (Tangerine for text on dark), Sky #BFE0FF. NO_COLOR, TERM=dumb, --plain, and a
// stream that is not a terminal turn every color off.
import { createInterface } from 'node:readline';

export function colorMode({ stream = process.stdout, env = process.env, plain = false } = {}) {
  if (plain || 'NO_COLOR' in env || env.TERM === 'dumb' || !stream.isTTY) return 'none';
  if (/^(?:truecolor|24bit)$/i.test(env.COLORTERM ?? '')) return 'truecolor';
  return /256/.test(env.TERM ?? '') ? '256' : '16';
}

export function paint(mode = colorMode()) {
  const wrap = (open, close) => text => (mode === 'none' ? String(text) : `\x1b[${open}m${text}\x1b[${close}m`);
  const color = (rgb, ansi256, ansi16) => wrap(mode === 'truecolor' ? `38;2;${rgb}` : mode === '256' ? `38;5;${ansi256}` : ansi16, 39);
  return {
    mode,
    brand: color('255;138;76', 209, 33),
    sky: color('191;224;255', 153, 36),
    ok: color('120;200;120', 114, 32),
    bad: color('240;110;100', 203, 31),
    warn: color('255;228;92', 221, 33),
    bold: wrap(1, 22),
    dim: wrap(2, 22),
  };
}

export const wordmark = (p, version) => `${p.brand(p.bold('CONQUISTADOR'))} ${p.dim(version)}`;
export const stepLabel = (p, step, total = 5) => p.dim(`Step ${step} of ${total} · `);

// Wrap plain text to a width, keeping words whole. Long words (paths) are left to wrap.
export function wrapText(text, width) {
  return String(text).split('\n').flatMap(line => {
    if (line.length <= width) return [line];
    const indent = /^\s*/.exec(line)[0];
    const lines = [];
    let current = '';
    for (const word of line.trim().split(/\s+/)) {
      if (current && `${current} ${word}`.length + indent.length > width) { lines.push(indent + current); current = word; } else current = current ? `${current} ${word}` : word;
    }
    if (current) lines.push(indent + current);
    return lines;
  }).join('\n');
}

const CANCEL = Symbol('cancel');

// A Clack-compatible UI that reads whole lines and prints no escape codes. Screen readers,
// TERM=dumb terminals, and logs can follow it.
export function plainUi({ input = process.stdin, output = process.stdout, columns = () => output.columns || 80 } = {}) {
  let reader = null, lines = [], waiting = null, closed = false;
  const width = () => Math.max(40, Math.min(columns(), 100));
  const write = text => output.write(`${wrapText(text, width())}\n`);
  const open = () => {
    if (reader) return;
    reader = createInterface({ input, terminal: false });
    reader.on('line', line => { if (waiting) { const done = waiting; waiting = null; done(line); } else lines.push(line); });
    reader.on('close', () => { closed = true; if (waiting) { const done = waiting; waiting = null; done(null); } });
  };
  // One line of input, or null when input ends or Ctrl-C arrives.
  const ask = prompt => new Promise(resolve => {
    open();
    output.write(prompt);
    const onSignal = () => { output.write('\n'); waiting = null; process.off('SIGINT', onSignal); resolve(null); };
    process.on('SIGINT', onSignal);
    const done = value => { process.off('SIGINT', onSignal); resolve(value); };
    if (lines.length) done(lines.shift());
    else if (closed) done(null);
    else waiting = done;
  });
  const quit = value => value === null || /^q(?:uit)?$/i.test(value.trim());
  const numbered = options => options.map((item, index) => `  ${index + 1}. ${item.label}${item.hint ? ` (${item.hint})` : ''}`);

  const ui = {
    isCancel: value => value === CANCEL,
    intro: title => write(`\n${title}\n`),
    outro: text => write(`\n${text}\n`),
    cancel: text => write(`\n${text}`),
    note: (body, title) => write(`\n${title ? `${title}\n${'-'.repeat(Math.min(width(), String(title).length))}\n` : ''}${body}\n`),
    log: Object.fromEntries(['info', 'step', 'success', 'message'].map(name => [name, text => write(String(text))]).concat([['warn', text => write(`Warning: ${text}`)], ['error', text => write(`Problem: ${text}`)]])),
    spinner: () => ({ start: text => write(`${text} ...`), stop: text => { if (text) write(text); }, message: () => {} }),
    async select({ message, options, initialValue }) {
      const fallback = Math.max(0, options.findIndex(item => item.value === initialValue));
      write(`\n${message}`);
      write(numbered(options).join('\n'));
      for (;;) {
        const answer = await ask(`Enter a number (Enter for ${fallback + 1}, q to cancel): `);
        if (quit(answer)) return CANCEL;
        if (!answer.trim()) return options[fallback].value;
        const index = Number(answer.trim()) - 1;
        if (options[index]) return options[index].value;
        write(`Enter a number from 1 to ${options.length}.`);
      }
    },
    async multiselect({ message, options, initialValues = [], required = true }) {
      write(`\n${message}`);
      write(options.map((item, index) => `  ${index + 1}. [${initialValues.includes(item.value) ? 'x' : ' '}] ${item.label}${item.hint ? ` (${item.hint})` : ''}`).join('\n'));
      for (;;) {
        const answer = await ask('Enter numbers separated by commas (Enter keeps [x], q to cancel): ');
        if (quit(answer)) return CANCEL;
        const picked = answer.trim() ? answer.split(/[\s,]+/).filter(Boolean).map(item => options[Number(item) - 1]?.value) : initialValues;
        if (picked.some(item => item === undefined)) { write(`Use numbers from 1 to ${options.length}.`); continue; }
        if (required && !picked.length) { write('Choose at least one.'); continue; }
        return [...new Set(picked)];
      }
    },
    async confirm({ message, initialValue = true }) {
      for (;;) {
        const answer = await ask(`\n${message} ${initialValue ? '[Y/n]' : '[y/N]'} `);
        if (answer === null || /^q(?:uit)?$/i.test(answer.trim())) return CANCEL;
        if (!answer.trim()) return initialValue;
        if (/^y(?:es)?$/i.test(answer.trim())) return true;
        if (/^n(?:o)?$/i.test(answer.trim())) return false;
      }
    },
    async text({ message, placeholder, initialValue, defaultValue }) {
      const fallback = initialValue ?? defaultValue ?? '';
      const answer = await ask(`\n${message}${fallback ? ` [${fallback}]` : placeholder ? ` (for example: ${placeholder})` : ''}: `);
      if (answer === null) return CANCEL;
      return answer.trim() || fallback;
    },
    close() { reader?.close(); reader = null; },
  };
  return ui;
}
