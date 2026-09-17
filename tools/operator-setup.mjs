import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { runSetup } from './setup.mjs';

const actions = new Set(['install', 'status', 'doctor', 'update', 'uninstall']);
const pathFlags = new Set(['--project', '--path', '--domain', '--knowledge-roots']);

export const operatorHelp = `Usage:
  conquistador install [--project PATH] [--domain PATH --knowledge-roots PATH]
  conquistador operator install|status|doctor|update|uninstall [--project PATH | --path PATH]

Paths may be relative to the current directory. The default project is the current directory.
The managed operator path is PROJECT/.conquistador. Doctor also accepts --json.`;

function normalizePaths(args, cwd) {
  const normalized = [...args];
  for (let index = 0; index < normalized.length; index++) {
    const flag = normalized[index];
    if (!pathFlags.has(flag)) continue;
    const value = normalized[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a path.`);
    normalized[index + 1] = isAbsolute(value) ? value : resolve(cwd, value);
    index++;
  }
  return normalized;
}

function flagIndexes(args, flag) {
  return args.flatMap((value, index) => value === flag ? [index] : []);
}

export function operatorSetupArgs(argv, cwd = process.cwd()) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return null;
  const [action, ...raw] = argv;
  if (!actions.has(action)) throw new Error('Use install, status, doctor, update, or uninstall.');
  if (raw.includes('--target')) throw new Error('The operator command selects the complete operator package automatically.');
  const rest = normalizePaths(raw, cwd);
  const projects = flagIndexes(rest, '--project');
  const paths = flagIndexes(rest, '--path');
  if (projects.length > 1 || paths.length > 1 || (projects.length && paths.length)) {
    throw new Error('Supply at most one of --project PATH or --path PATH.');
  }
  const projectRoot = projects.length ? rest[projects[0] + 1] : cwd;
  const current = join(projectRoot, '.conquistador');
  const legacy = join(projectRoot, '.conquistador-operator');
  const currentPath = !existsSync(current) && existsSync(legacy) ? legacy : current;
  if (action === 'doctor') {
    if (projects.length) {
      const index = projects[0];
      rest.splice(index, 2);
      rest.push('--path', currentPath);
    } else if (!paths.length) rest.push('--path', currentPath);
    return ['doctor', ...rest];
  }
  if (!projects.length && !paths.length) rest.push('--project', cwd);
  return [action, '--target', 'operator', ...rest];
}

export async function runOperatorSetup(argv, cwd = process.cwd()) {
  try {
    const args = operatorSetupArgs(argv, cwd);
    if (args === null) {
      console.log(operatorHelp);
      return 0;
    }
    return await runSetup(args);
  } catch (error) {
    console.error(`[conquistador-operator] ${error.message}`);
    return 1;
  }
}
