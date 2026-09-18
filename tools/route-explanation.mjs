import { resolve } from 'node:path';
import { explainRoute, selectRequestContext } from './context-selection.mjs';
export function runRouteExplanation(args, cwd = process.cwd()) {
  let root = resolve(cwd, '.conquistador');
  let prompt;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--path' && args[i + 1]) root = resolve(cwd, args[++i]);
    else if (args[i] === '--prompt' && args[i + 1] && prompt === undefined) prompt = args[++i];
    else throw Error('Usage: conquistador route --prompt TEXT [--path PACKAGE]');
  }
  if (!prompt) throw Error('Supply --prompt TEXT. Routing is read-only and does not execute a task.');
  console.log(JSON.stringify(explainRoute(selectRequestContext(prompt, { root })), null, 2));
}
