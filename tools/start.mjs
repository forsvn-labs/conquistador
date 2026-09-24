import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { installedHosts, projectIntegration } from './project-installation.mjs';
import { operatorNextSteps } from './setup-surfaces.mjs';
import { FIRST_TASKS } from './onboarding-parse.mjs';

export function runStart(args, cwd = process.cwd(), list = false) {
  let project = cwd;
  let task = 'launch-plan';
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--project' && args[i + 1]) project = resolve(cwd, args[i + 1]);
    else if (!list && args[i] === '--task' && Object.hasOwn(FIRST_TASKS, args[i + 1])) task = args[i + 1];
    else throw Error('Usage: conquistador start [--project PATH] [--task launch-plan|diagnose-growth|review-results|write-copy]; conquistador skills [--project PATH]');
  }
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
  console.log(operatorNextSteps(path, installedHosts(record), project, FIRST_TASKS[task]));
  console.log(`\nIf native discovery is unavailable, ask the agent to read ${entry} and follow it.\n`);
  console.log('Explore: conquistador skills\nCheck: conquistador doctor\nUpdate: conquistador update\nRemove: conquistador uninstall');
  console.log('Skill files are installed; host discovery and task quality still need a real task.');
  return 0;
}
