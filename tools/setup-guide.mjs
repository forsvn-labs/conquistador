import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defaultPath, routes, specialistTarget } from './setup-routes.mjs';
import { hostFolders, hostLabels, installedHosts, projectIntegration } from './project-installation.mjs';
import { operatorNextSteps, pluginHosts, pluginNextSteps, validateSurfacePlan } from './setup-surfaces.mjs';
import { cancellableUi } from './onboarding-ui.mjs';
import { containsPath, shellCommand } from './install-paths.mjs';

// Choices describe compatible uses. Each resulting folder still has one lifecycle owner.
export async function runSetupGuide({ cwd, version, run, ui }) {
  ui ??= cancellableUi(await import('./vendor/clack.mjs'));
  const completed = [], items = [], notes = [];
  const checked = value => { if (ui.isCancel(value)) throw Object.assign(Error('Cancelled. No files changed.'), { cancelled: true }); return value; };
  const multi = async options => checked(await ui.multiselect({ required: true, ...options }));
  const folder = async (target, url) => resolve(cwd, checked(await ui.text({ message: 'Installation folder', initialValue: defaultPath(target, cwd, url), validate: value => !value?.trim() ? 'Enter a folder.' : undefined })));
  const add = (route, target, path, extra = [], data = {}) => {
    const action = existsSync(path) && route !== 'experimental' ? 'update' : 'install';
    const item = { route, target, path, args: [action, '--target', target, '--path', path, ...extra], ...data };
    items.push(item); return item;
  };
  ui.intro(`Conquistador ${version} advanced setup`);
  ui.log.info(`Combination guide for multiple hosts and custom packages.\nProject: ${cwd}\nSpace selects more than one option. Enter continues. Escape cancels.`);
  try {
    const choices = await multi({ message: 'What would you like to set up?', initialValues: ['operator', 'skill'],
      options: [...routes.map(route => ({ value: route.id, label: route.label, hint: route.id === 'operator' ? 'shared project files and BB adapter' : route.id === 'skill' ? 'Codex, Claude Code, Cursor or Copilot discovery' : undefined })),
        { value: 'specialist', label: 'One named specialist skill', hint: 'an individual method' }] });
    const operatorPath = defaultPath('operator', cwd);
    const legacyPath = join(cwd, '.conquistador-operator');
    const existingPath = existsSync(operatorPath) ? operatorPath : existsSync(legacyPath) ? legacyPath : null;
    const existing = existingPath ? projectIntegration(existingPath) : null;
    const priorHosts = installedHosts(existing);
    let hosts = [], operator, sharedHarness = false;
    if (choices.includes('operator') || choices.includes('skill')) {
      const native = choices.includes('skill');
      const options = [
        ...(native ? Object.keys(hostFolders).filter(host => host !== 'hermes' || choices.includes('operator')).map(value => ({ value, label: hostLabels[value], hint: hostFolders[value] })) : []),
        ...(native && !choices.includes('operator') && !existingPath ? [{ value: 'skill', label: 'Other host / custom skill folder', hint: 'compact library; host manages discovery' }] : []),
        ...(choices.includes('operator') ? [{ value: 'bb', label: 'BB', hint: 'explicit operator and team adapter; no native skill registration' }] : []),
        ...(!native ? [{ value: 'none', label: 'Other host / files only', hint: 'read .conquistador/SKILL.md explicitly' }] : []),
      ];
      hosts = await multi({ message: native ? 'Which hosts will you use?' : 'Where will you use the operator?',
        initialValues: priorHosts.filter(host => options.some(option => option.value === host)).length ? priorHosts.filter(host => options.some(option => option.value === host)) : [native ? 'codex' : 'none'],
        options, validate: values => values.includes('none') && values.length > 1 ? 'Files only must be selected alone.' : undefined });
      if (hosts.includes('cursor') && hosts.some(host => ['codex', 'claude-code'].includes(host))) notes.push('Cursor also reads Codex and Claude skill folders. Check its refreshed Skills list for duplicate Conquistador entries; each folder retains its stated owner.');
      if (hosts.includes('hermes') && hosts.includes('codex')) notes.push('Hermes also reads Codex skill folders under .agents/skills. Check for duplicate Conquistador entries; each folder retains its stated owner. Trust remains a separate hermes skills trust step.');
      if (choices.includes('operator') || existingPath) {
        hosts = [...new Set([...priorHosts, ...hosts])].filter(host => host !== 'none');
        if (!hosts.length) hosts = ['none'];
        operator = { route: 'operator', target: 'operator', project: cwd, path: operatorPath, hosts,
          args: [existingPath ? 'update' : 'install', '--target', 'operator', '--project', cwd, '--hosts', hosts.join(',')] };
        items.push(operator);
        if (existingPath) notes.push('Existing operator-owned hosts are retained. New native hosts join the same update/removal lifecycle.');
        if (existingPath === legacyPath) notes.push('Migrate the unchanged .conquistador-operator folder.');
        for (const host of hosts.filter(host => hostFolders[host])) if (existsSync(join(cwd, hostFolders[host])) && !existing?.skills.some(item => item.host === host)) notes.push(`Adopt the unchanged managed ${hostLabels[host]} skill. Operator uninstall will remove that copy too.`);
        if (hosts.includes('bb')) notes.push('BB uses the complete operator directly. It is not Codex and receives no native skill or plugin registration.');
      } else for (const host of hosts) add('skill', host, host === 'skill' ? await folder(host) : defaultPath(host, cwd));
    }
    for (const choice of choices.filter(choice => !['operator', 'skill'].includes(choice))) {
      const route = routes.find(route => route.id === choice);
      if (choice === 'plugin') {
        const selected = await multi({ message: 'Which plugin managers will use this source?',
          options: route.targets.map(value => ({ value, label: hostLabels[pluginHosts[value]] ?? 'Agent Plugins compatible manager' })) });
        const path = await folder(selected[0]);
        add(choice, selected[0], path, [], { targets: selected });
        if (selected.length > 1) notes.push('Plugin managers share one staged source; each manager owns its activated copy and scope.');
      } else if (choice === 'harness') {
        const target = checked(await ui.select({ message: 'Portable package', options: [{ value: 'harness', label: 'Complete operator contract' }, { value: 'squad', label: 'Separate worker/advisor contracts' }] }));
        if (target === 'harness' && operator) { sharedHarness = true; notes.push('Portable contract: reuse .conquistador/agent/agent.json. No second operator copy or owner.'); }
        else add(choice, target, await folder(target));
      } else if (choice === 'specialist') {
        const name = checked(await ui.text({ message: 'Method name', placeholder: 'write-copy', validate: value => !specialistTarget('skill:' + value) ? 'Enter an outcome method name, such as write-copy.' : undefined }));
        const target = 'skill:' + name; add(choice, target, await folder(target));
      } else if (choice === 'runtime-mcp') {
        const url = checked(await ui.text({ message: 'Existing runtime service origin', placeholder: 'https://runtime.example', validate: value => !value?.trim() ? 'Enter the origin of your existing runtime.' : undefined }));
        const source = checked(await ui.text({ message: 'Stable runtime distribution folder', placeholder: 'Enter to use this distribution', defaultValue: '' }));
        add(choice, 'mcp', await folder('mcp', url), ['--url', url, ...(source ? ['--runtime-path', resolve(cwd, source)] : [])]);
      } else if (choice === 'experimental') {
        const selected = await multi({ message: 'Import guidance', options: route.targets.map(value => ({ value, label: value })) });
        for (const target of selected) add(choice, target, defaultPath(target, cwd));
      } else add(choice, route.targets[0], await folder(route.targets[0]));
    }
    validateSurfacePlan(items);
    if (existingPath && existsSync(join(existingPath, 'domain-restriction.json')) && items.some(item => item.route === 'mcp')) throw Error('This project has a domain-restricted operator. The local MCP server exposes the full library and cannot share that boundary. Choose a separately scoped integration.');
    // Check every destination before any selected integration mutates files.
    for (const item of items.filter(item => item.route !== 'experimental')) {
      await run([...item.args, '--dry-run']);
      // An update without --url preserves runtime mode in the legacy CLI. A local
      // MCP guide choice must not silently retain that different connector kind.
      if (item.route === 'mcp' && item.args[0] === 'update') {
        const file = join(item.path, 'connector.json'), info = lstatSync(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 262144) throw Error('MCP configuration must be a bounded regular file.');
        if (JSON.parse(readFileSync(file, 'utf8')).args?.includes('--url')) throw Error('That folder owns a runtime MCP connector. Select Runtime MCP or choose a different local MCP folder.');
      }
    }
    const summary = items.map(item => {
      const displayPath = containsPath(cwd, item.path) ? relative(cwd, item.path) : item.path;
      if (item.route === 'operator') return `${item.args[0]} ${displayPath}\nRoot SKILL.md, method library, BB adapter, profile and contracts.\nExisting domain restrictions are retained; a new unrestricted install has 38 methods.\nOwned native skills: ${item.hosts.filter(host => hostFolders[host]).map(host => hostFolders[host]).join(', ') || 'none'}.`;
      const route = routes.find(route => route.id === item.route);
      return `${item.route === 'experimental' ? 'Guidance only' : item.args[0]}: ${displayPath}\n${route ? route.contents + '\n' + route.boundary : 'One named method and its resources; no parent router.'}`;
    });
    ui.note([...summary, ...notes].join('\n\n'), 'Review your selections');
    if (items.every(item => item.route === 'experimental')) {
      for (const item of items) ui.note(await run(item.args), 'Import guidance');
      ui.outro('Guidance only. No files installed.'); return 0;
    }
    if (!checked(await ui.confirm({ message: 'Apply these changes?', initialValue: true }))) { ui.cancel('Cancelled. No files changed.'); return 0; }
    for (const item of items) {
      if (item.route === 'experimental') { ui.note(await run(item.args), 'Import guidance'); continue; }
      const progress = ui.spinner(); progress.start(`Setting up ${item.route}`);
      try { await run(item.args); completed.push(item); progress.stop(`${item.route}: local files prepared`); }
      catch (error) { progress.stop(`${item.route}: failed`); throw error; }
      if (existsSync(join(item.path, 'domain-restriction.json'))) ui.note('Domain restriction retained. Receipt integrity was checked; full-library doctor does not certify subset readiness or host enforcement.', 'Restricted library');
      else if (['operator', 'plugin', 'skill', 'harness', 'mcp'].includes(item.route) && item.target !== 'squad') {
        progress.start(`Checking ${item.route}`);
        try { await run(['doctor', '--path', item.path]); progress.stop('Local files verified'); }
        catch (error) { progress.stop('Local check needs attention'); throw error; }
      }
      if (item.route === 'operator') ui.note(operatorNextSteps(item.path, item.hosts, cwd), 'Operator next steps');
      else if (item.route === 'plugin') for (const target of item.targets) ui.note(pluginNextSteps(target, item.path, item.args[0]), `${target}: next steps`);
      else ui.note(await run(['status', '--target', item.target, '--path', item.path]), `${item.target}: next steps`);
    }
    if (sharedHarness) ui.note('Attach .conquistador/agent/agent.json through your consuming adapter. It shares the operator update/removal lifecycle. JSON files do not register a native agent.', 'Portable package next step');
    ui.outro('Selected files are ready. Follow each host or connector activation step above.'); return 0;
  } catch (error) {
    if (error.cancelled && !completed.length) { ui.cancel(error.message); return error.exitCode ?? 0; }
    ui.log.error(error.message);
    if (completed.length) ui.note(completed.map(item => [item.path, ...['doctor', 'uninstall'].map(action => shellCommand(['conquistador', 'setup', action, '--path', item.path]))].join('\n')).join('\n\n'), 'Completed copies retained');
    ui.outro(completed.length ? 'Setup stopped after a partial installation. Completed copies remain owned; inspect them before continuing.' : 'Setup stopped. Review the error before retrying.');
    return error.exitCode ?? 1;
  }
}
