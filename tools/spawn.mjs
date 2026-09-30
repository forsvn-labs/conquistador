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

// npm's cmd-shim ends with the file it runs and %*: a JavaScript file right after "%_prog%"
// (Node), or a native program such as "%dp0%\node_modules\PACKAGE\bin\claude.exe" at the start
// of a line. A shim that adds interpreter arguments or sets other variables goes through cmd.exe.
const shimVariables = /^(?:dp0|_prog|PATHEXT)$/i;
function shimTarget(path) {
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { return null; }
  if ([...text.matchAll(/\bSET\s+"?([^="\s]+)=/gi)].some(match => !shimVariables.test(match[1]))) return null;
  const script = /"%_prog%"\s+"%~?dp0%?\\([^"]+\.[mc]?js)"\s+%\*/i.exec(text);
  const program = /^\s*@?"%~?dp0%?\\([^"]+\.(?:exe|com))"\s+%\*\s*$/im.exec(text);
  const target = script ?? program;
  const file = target ? resolve(dirname(path), ...target[1].split(/[\\/]/)) : null;
  return file && isFile(file) ? { file, node: Boolean(script) } : null;
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
  const target = shimTarget(path);
  if (target) return target.node ? { file: process.execPath, args: [target.file, ...args], options: {} } : { file: target.file, args, options: {} };
  const line = [path.replace(meta, '^$1'), ...args.map(escapeArgument)].join(' ');
  return { file: env.ComSpec ?? process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], options: { windowsVerbatimArguments: true } };
}
