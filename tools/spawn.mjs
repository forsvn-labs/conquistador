// Starts a command the same way on every platform, with exact arguments.
// On Windows, npm, npx, and agent CLIs installed with npm are .cmd files. Node starts a .cmd file
// only through cmd.exe, and cmd.exe splits and expands unescaped arguments (spaces, &, |, %).
// So: an npm shim runs its JavaScript file with this Node, npm and npx run their CLI file, and
// any other .cmd or .bat file goes through cmd.exe with every argument escaped.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { delimiter, dirname, extname, join, resolve } from 'node:path';

const windows = process.platform === 'win32';
const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };

function find(command, env) {
  if (/[\\/]/.test(command)) return command;
  const extensions = (env.PATHEXT ?? process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).map(item => item.toLowerCase());
  // A name without an extension on Windows is usually npm's shell-script shim, which Windows cannot run.
  const names = extensions.includes(extname(command).toLowerCase()) ? [command] : extensions.map(item => command + item);
  const path = Object.entries(env).find(([name]) => name.toUpperCase() === 'PATH')?.[1] ?? '';
  for (const folder of path.split(delimiter)) {
    if (!folder) continue;
    for (const name of names) if (isFile(join(folder, name))) return join(folder, name);
  }
  return command;
}

// npm's cmd-shim ends with: "%_prog%"  "%dp0%\node_modules\PACKAGE\cli.js" %*
function shimScript(path) {
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { return null; }
  if (!/node(?:\.exe)?/i.test(text)) return null;
  const match = /"%~?dp0%?\\([^"]+)"\s+%\*/i.exec(text);
  const script = match ? resolve(dirname(path), match[1]) : null;
  return script && isFile(script) ? script : null;
}

// Escaping for cmd.exe /d /s /c, as in cross-spawn: quote for the C runtime, then escape cmd.exe
// metacharacters with ^.
const meta = /([()\][%!^"`<>&|;, *?])/g;
const escapeArgument = value => `"${String(value).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`.replace(meta, '^$1');

// Returns what to pass to spawn or spawnSync: { file, args, options }.
export function spawnCommand(command, args = [], env = process.env) {
  if (!windows) return { file: command, args, options: {} };
  const path = find(command, env);
  if (!/\.(?:cmd|bat)$/i.test(path)) return { file: path, args, options: {} };
  const name = /^(npm|npx)\.cmd$/i.exec(path.split(/[\\/]/).pop())?.[1]?.toLowerCase();
  const cli = name && join(dirname(path), 'node_modules', 'npm', 'bin', `${name}-cli.js`);
  if (cli && existsSync(cli)) return { file: process.execPath, args: [cli, ...args], options: {} };
  const script = shimScript(path);
  if (script) return { file: process.execPath, args: [script, ...args], options: {} };
  const line = [path.replace(meta, '^$1'), ...args.map(escapeArgument)].join(' ');
  return { file: env.ComSpec ?? process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], options: { windowsVerbatimArguments: true } };
}
