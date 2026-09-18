import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { installedHosts, projectIntegration } from './project-installation.mjs';
import { operatorNextSteps } from './setup-surfaces.mjs';

export function runStart(args, cwd = process.cwd(), list = false) {
  if (args.length && !(args.length === 2 && args[0] === '--project')) throw Error('Usage: conquistador start|skills [--project PATH]');
  const project = args.length ? resolve(cwd, args[1]) : cwd;
  const current = join(project, '.conquistador');
  const path = existsSync(current) ? current : join(project, '.conquistador-operator');
  if (!existsSync(path)) {
    console.log('Conquistador is not installed in this project. Run conquistador.'); return 1;
  }
  const entry = existsSync(join(path, 'SKILL.md')) ? join(path, 'SKILL.md') : join(path, 'agent/skills/conquistador/SKILL.md');
  const record = projectIntegration(path);
  if (list) {
    const catalog = existsSync(join(path, 'library/conquistador/catalog.md')) ? join(path, 'library/conquistador/catalog.md') : join(path, 'agent/skills/conquistador/library/conquistador/catalog.md');
    console.log(readFileSync(catalog, 'utf8')); return 0;
  }
  console.log(`Conquistador in ${project}\n`);
  console.log(`Read the skill: ${entry}`);
  console.log(operatorNextSteps(path, installedHosts(record)));
  console.log(`\nIf native discovery is unavailable, ask the agent to read ${entry} and follow it.\n`);
  console.log('Explore: conquistador skills\nCheck: conquistador doctor\nUpdate: conquistador update\nRemove: conquistador uninstall');
  console.log('Skill files are installed; host discovery and task quality still need a real task.');
  return 0;
}
