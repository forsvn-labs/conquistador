import { resolve } from 'node:path';
import { defaultPath, routes, specialistTarget } from './setup-routes.mjs';

// The interactive shell is bundled; source and ZIP setup need no npm bootstrap.
export async function runSetupGuide({ cwd, version, run, ui }) {
  ui ??= await import('./vendor/clack.mjs');
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { hostFolders, projectIntegration } = await import('./project-installation.mjs');
  const checked = value => { if (ui.isCancel(value)) throw Object.assign(Error('Cancelled. No files changed.'), { cancelled: true }); return value; };
  ui.intro(`Conquistador ${version}`);
  ui.log.info(`Growth, marketing, sales, product and knowledge work.\nProject: ${cwd}`);
  try {
    const choice = checked(await ui.select({ message: 'How do you want to use Conquistador?',
      options: [{ value: 'operator', label: 'In my coding agent', hint: 'complete operator + visible skill' },
        ...routes.slice(1).map(route => ({ value: route.id, label: route.label, hint: route.id === 'skill' ? 'skill only; no BB adapter' : undefined }))] }));
    const route = routes.find(route => route.id === choice);
    let target = route.targets[0];
    const args = ['install', '--target', target];
    let path, host = 'none', url;
    if (choice === 'operator') {
      const existing = existsSync(join(cwd, '.conquistador/project-installation.json')) ? projectIntegration(join(cwd, '.conquistador')) : null;
      host = checked(await ui.select({ message: 'Which coding agent will you use?', initialValue: existing?.skills[0]?.host ?? 'codex',
        options: [{ value: 'codex', label: 'Codex / BB', hint: '.agents/skills/conquistador' },
          { value: 'cursor', label: 'Cursor', hint: '.cursor/skills/conquistador' },
          { value: 'claude-code', label: 'Claude Code', hint: '.claude/skills/conquistador' },
          { value: 'copilot', label: 'GitHub Copilot', hint: '.github/skills/conquistador' },
          { value: 'none', label: 'Other / files only', hint: 'read .conquistador/SKILL.md explicitly' }] }));
      path = defaultPath('operator', cwd);
      args.push('--project', cwd, '--host', host);
      if (existsSync(path) || existsSync(join(cwd, '.conquistador-operator'))) args[0] = 'update';
    } else {
      if (route.targets.length > 1) {
        target = checked(await ui.select({ message: 'Choose your integration', options: [...route.targets.map(value => ({ value, label: value })), ...(choice === 'skill' ? [{ value: 'specialist', label: 'One named specialist' }] : [])] }));
        if (target === 'specialist') target = 'skill:' + checked(await ui.text({ message: 'Method name', placeholder: 'write-copy', validate: value => !specialistTarget('skill:' + value) ? 'Enter an outcome method name, such as write-copy.' : undefined }));
        args[2] = target;
      }
      if (choice === 'runtime-mcp') {
        url = checked(await ui.text({ message: 'Existing runtime service origin', placeholder: 'https://runtime.example', validate: value => !value?.trim() ? 'Enter the origin of your existing runtime.' : undefined }));
        args.push('--url', url);
        const source = checked(await ui.text({ message: 'Stable runtime distribution folder', placeholder: 'Enter to use this distribution', defaultValue: '' }));
        if (source) args.push('--runtime-path', resolve(cwd, source));
      }
      path = checked(await ui.text({ message: 'Installation folder', initialValue: defaultPath(target, cwd, url), validate: value => !value?.trim() ? 'Enter a folder.' : undefined }));
      path = resolve(cwd, path); args.push('--path', path);
    }
    const summary = [`${args[0] === 'update' ? 'Update' : 'Install'}: ${choice === 'operator' ? '.conquistador/' : path}`];
    if (choice === 'operator') {
      summary.push('SKILL.md at the top level; all 38 methods in library/.', 'Complete BB adapter, profile, contracts and schemas included.');
      if (host !== 'none') summary.push(`${existsSync(join(cwd, hostFolders[host])) ? 'Adopt/update existing managed skill' : 'Create skill'}: ${hostFolders[host]}`, 'The operator and this skill will update and uninstall together.');
      if (existsSync(join(cwd, '.conquistador-operator'))) summary.push('Migrate the unchanged .conquistador-operator folder.');
    } else summary.push(route.contents, route.boundary);
    ui.note(summary.join('\n'), 'Ready to set up');
    if (choice === 'experimental') { ui.note(await run(args), 'Import guidance'); ui.outro('No files installed.'); return 0; }
    if (!checked(await ui.confirm({ message: 'Apply these changes?', initialValue: true }))) { ui.cancel('Cancelled. No files changed.'); return 0; }
    const progress = ui.spinner(); progress.start('Installing Conquistador');
    try { await run(args); progress.stop('Installed'); } catch (error) { progress.stop('Setup did not complete'); throw error; }
    if (['operator', 'plugin', 'skill', 'harness', 'mcp'].includes(choice) && target !== 'squad' && !target.startsWith('skill:')) {
      progress.start('Checking methods and resources');
      try { await run(['doctor', '--path', path]); progress.stop('Local files verified'); }
      catch (error) { progress.stop('Some checks need attention'); throw error; }
    }
    if (choice === 'operator') {
      const invocation = host === 'none' ? 'Read .conquistador/SKILL.md and follow it.' : 'Use Conquistador';
      ui.note(`1. Open a fresh ${host === 'none' ? 'coding-agent' : host} session in this project.\n2. ${host === 'none' ? 'Use the prompt below.' : 'Select Conquistador from the skills menu, or name it in your prompt.'}\n3. Try:\n\n${invocation} to draft a launch plan from the product facts in this project.\nShow the selected capabilities. Mark missing facts. Keep it as a draft.\n\nRead .conquistador/README.md to explore the library.\nRun conquistador start to show this again.\nManage: conquistador operator status | doctor | update | uninstall`, 'Your first task');
      ui.log.info('Files and skill entry are ready. Your host loads the skill in a fresh session; no background service starts.');
    } else ui.note(await run(['status', '--target', target, '--path', path]), 'Next step');
    ui.outro('Conquistador is ready for your first task.'); return 0;
  } catch (error) {
    if (error.cancelled) { ui.cancel(error.message); return 0; }
    ui.log.error(error.message); ui.outro('Setup stopped. Existing user files were preserved.'); return 1;
  }
}
