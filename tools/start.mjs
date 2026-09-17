import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hostFolders, projectIntegration } from './project-installation.mjs';

export function runStart(args, cwd = process.cwd(), list = false) {
  if (args.length && !(args.length === 2 && args[0] === '--project')) throw Error('Usage: conquistador start|skills [--project PATH]');
  const project = args.length ? resolve(cwd, args[1]) : cwd;
  const current = join(project, '.conquistador');
  const path = existsSync(current) ? current : join(project, '.conquistador-operator');
  if (!existsSync(path)) {
    console.log('Conquistador is not installed in this project. Run conquistador setup.'); return 1;
  }
  const entry = existsSync(join(path, 'SKILL.md')) ? join(path, 'SKILL.md') : join(path, 'agent/skills/conquistador/SKILL.md');
  const record = projectIntegration(path);
  if (list) {
    const catalog = existsSync(join(path, 'library/conquistador/catalog.md')) ? join(path, 'library/conquistador/catalog.md') : join(path, 'agent/skills/conquistador/library/conquistador/catalog.md');
    console.log(readFileSync(catalog, 'utf8')); return 0;
  }
  console.log(`Conquistador in ${project}\n`);
  console.log(`Read the skill: ${entry}`);
  for (const item of record?.skills ?? []) console.log(`Native skill (${item.host}): ${join(project, hostFolders[item.host], 'SKILL.md')}`);
  console.log('\nOpen a fresh coding-agent session in this project, select Conquistador, and try:\n');
  console.log('Use Conquistador to draft a launch plan from the product facts in this project.\nShow the selected capabilities. Mark missing facts. Keep it as a draft.');
  console.log(`\nIf the skill is not listed, ask the agent to read ${entry} and follow it.\n`);
  console.log('Explore: conquistador skills\nCheck: conquistador operator doctor\nUpdate: conquistador operator update\nRemove: conquistador operator uninstall');
  console.log('Skill files are installed; host discovery and task quality still need a real task.');
  return 0;
}
