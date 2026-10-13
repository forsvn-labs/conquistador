import { spawn } from 'node:child_process';
import { spawnCommand } from './spawn.mjs';

// Keep the terminal responsive while a package or plugin manager runs. Exact arguments,
// bounded output, and a finite timeout apply on Windows too.
export function runCommand(command, args, { cwd = process.cwd(), env = process.env, timeout = 120_000, onOutput = () => {} } = {}) {
  return new Promise(resolve => {
    let child, timer, settled = false, stdout = '', stderr = '';
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve({ stdout, stderr, ...result }); };

    try {
      const prepared = spawnCommand(command, args, env);
      child = spawn(prepared.file, prepared.args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], ...prepared.options });
    } catch (error) { finish({ status: 1, error: error.message });

 return; }

    const append = (chunk, error) => {
      const text = chunk.toString();

      if (error) stderr = (stderr + text).slice(-2_000_000);
      else stdout = (stdout + text).slice(-2_000_000);
      onOutput(text);
    };

    child.stdout.on('data', chunk => append(chunk, false));
    child.stderr.on('data', chunk => append(chunk, true));
    child.on('error', error => finish({ status: 1, error: error.message }));
    child.on('close', (status, signal) => {
      const result = { status: status ?? 1 };

      if (signal) result.error = `Command stopped (${signal}).`;
      finish(result);
    });
    timer = setTimeout(() => {
      child.kill();
      const force = setTimeout(() => child.kill('SIGKILL'), 1000);
      force.unref();
      child.once('close', () => clearTimeout(force));
      finish({ status: 1, error: `Command timed out after ${Math.ceil(timeout / 1000)} seconds.` });
    }, timeout);
  });
}
