// Drive a real terminal program from Node: start it in a pseudo-terminal (tools/e2e/pty-bridge.py),
// wait for text on the screen, press keys, and keep a snapshot of each screen.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Screen } from './vt.mjs';

const bridge = join(dirname(fileURLToPath(import.meta.url)), 'pty-bridge.py');
export const KEYS = { enter: '\r', up: '\x1b[A', down: '\x1b[B', right: '\x1b[C', left: '\x1b[D', space: ' ', escape: '\x1b', ctrlC: '\x03', tab: '\t', backspace: '\x7f' };
// Compare without whitespace or Clack's gutter, so a wrapped line still matches.
const squash = text => text.replace(/[\s│]+/g, '');
// Python from this process's PATH: the program under test may get a much shorter PATH.
const python3 = (process.env.PATH ?? '').split(delimiter).map(folder => join(folder, 'python3')).find(existsSync) ?? 'python3';

export function session(command, args, { cwd, env, columns = 80, rows = 40, python = process.env.CONQUISTADOR_E2E_PYTHON || python3 } = {}) {
  const child = spawn(python, ['-I', bridge, String(columns), String(rows), '--', command, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new Screen(columns, rows);
  let raw = '';
  let stderr = '';
  let exitCode = null;
  const waiters = new Set();
  const notify = () => { for (const waiter of waiters) waiter(); };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => { raw += chunk; screen.write(chunk); notify(); });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = new Promise(resolve => child.on('close', code => { exitCode = code; notify(); resolve(code); }));
  const snaps = [];

  const api = {
    screen,
    get raw() { return raw; },
    get stderr() { return stderr; },
    get exitCode() { return exitCode; },
    // Resolve when the visible screen (and history) contains the text or matches the pattern.
    waitFor(pattern, { timeout = 20_000 } = {}) {
      const test = () => {
        const text = screen.text({ history: true });
        return pattern instanceof RegExp ? pattern.test(text) : squash(text).includes(squash(pattern));
      };
      return new Promise((resolve, reject) => {
        let timer;
        const check = () => {
          if (test()) { clearTimeout(timer); waiters.delete(check); resolve(true); return; }
          if (exitCode !== null) { clearTimeout(timer); waiters.delete(check); reject(Error(`exited ${exitCode} before ${pattern}\n--- screen ---\n${screen.text({ history: true })}${stderr ? `--- stderr ---\n${stderr}` : ''}`)); }
        };
        timer = setTimeout(() => { waiters.delete(check); reject(Error(`timed out waiting for ${pattern}\n--- screen ---\n${screen.text({ history: true })}`)); }, timeout);
        waiters.add(check);
        check();
      });
    },
    // Wait until the output is quiet, so a snapshot shows a whole frame.
    async settle(ms = 250) {
      let last = raw.length;
      for (;;) {
        await new Promise(resolve => setTimeout(resolve, ms));
        if (raw.length === last || exitCode !== null) return;
        last = raw.length;
      }
    },
    async press(...keys) {
      for (const key of keys) {
        child.stdin.write(KEYS[key] ?? key);
        await new Promise(resolve => setTimeout(resolve, 60));
      }
    },
    async type(text) { child.stdin.write(text); await new Promise(resolve => setTimeout(resolve, 60)); },
    async snap(name) {
      await api.settle();
      const item = { name, text: screen.text(), html: screen.html({ title: name }), styled: screen.styled() };
      snaps.push(item);
      return item;
    },
    snaps,
    async exit({ timeout = 30_000 } = {}) {
      const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
      const code = await exited;
      clearTimeout(timer);
      return code;
    },
    kill() { child.kill('SIGKILL'); },
  };
  return api;
}
