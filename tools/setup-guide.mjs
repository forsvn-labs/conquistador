import { resolve } from 'node:path';
import { defaultPath, routes, specialistTarget } from './setup-routes.mjs';

// Collect a plan only. The caller validates it before asking to apply changes.
export async function collectSetupArgs(question, write = console.log, cwd = process.cwd()) {
  write(`Project: ${cwd}. Default: the complete project operator with manual activation.`);
  write(routes[0].contents);
  write('Use setup status|doctor|update|uninstall with --target or --path to manage an existing copy.');
  write('Where will you use Conquistador?');
  routes.forEach((route, index) => write(`${index + 1}. ${route.label}`));
  const choice = (await question('Route [1]: ')).trim() || '1';
  const route = routes.find((entry, index) => choice === String(index + 1) || choice === entry.id);
  if (!route) throw Error('Unknown route. Use setup list to see the choices.');
  let target = route.targets[0];
  if (route.targets.length > 1) {
    target = (await question(`Target (${route.targets.join(', ')}${route.id === 'skill' ? ', or skill:NAME for one specialist' : ''}) [${target}]: `)).trim() || target;
    if (!route.targets.includes(target) && !(route.id === 'skill' && specialistTarget(target))) throw Error('Choose a target from this route.');
  }
  const args = ['install', '--target', target];
  let url;
  if (route.id === 'runtime-mcp') {
    url = (await question('Existing runtime service origin (required): ')).trim();
    if (!url) throw Error('Runtime MCP needs an existing service origin. Choose local MCP for methods only.');
    args.push('--url', url);
    const runtime = (await question('Stable runtime distribution folder (Enter for this distribution): ')).trim();
    if (runtime) args.push('--runtime-path', resolve(cwd, runtime));
  }
  if (target === 'operator') {
    args.push('--project', cwd);
  } else {
    const suggested = defaultPath(target, cwd, url);
    const path = (await question(`Owned installation folder [${suggested}]: `)).trim();
    args.push('--path', resolve(cwd, path || suggested));
  }
  return args;
}
