import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function runHooks(args) {
  const projectIndex = args.indexOf('--project');
  if (projectIndex < 0 || !args[projectIndex + 1]) throw Error('Supply --project ABS for hook ownership.');
  const project = resolve(args[projectIndex + 1]);
  const install = ['.conquistador', '.conquistador-operator'].map(name => join(project, name, 'tools/conquistador-mode.mjs')).find(existsSync);
  if (!install && args[0] === 'enable') throw Error('Install this project operator before enabling hooks.');
  // Bind routing to the installed library and its domain restriction, not the global CLI library.
  const { main } = install ? await import(pathToFileURL(install)) : await import('./conquistador-mode.mjs');
  console.log(JSON.stringify(main(args), null, 2));
}
