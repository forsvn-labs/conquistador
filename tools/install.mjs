#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAIN_SCHEMA_VERSION, PARENT_SKILL, RESTRICTION_NAME, REVIEW_SKILL, parseRestriction, readDomainManifestFile, resolveDomainSelection, shouldStageSkillPath } from './domain-package.mjs';

import { operatorFiles } from './operator-package.mjs';
import { containsPath } from './install-paths.mjs';
import { stageMethodLibrary } from './stage-method-library.mjs';
import { methodDirectory, methodOwner, methodPath } from './method-library.mjs';
import { projectSkillOwner, skillsManagerOwner } from './project-installation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const receiptName = '.conquistador-install.json';
const fail = message => { throw new Error(message); };
const argv = process.argv.slice(2);
const command = argv[0];
const mode = argv[1];
const destination = argv[2];
let domainPath;
const extra = [];
for (let i = 3; i < argv.length; i += 1) {
  if (argv[i] === '--domain') {
    if (domainPath !== undefined || !argv[i + 1]) fail('Domain flag is incomplete.');
    domainPath = argv[++i];
    continue;
  }
  extra.push(argv[i]);
}
const modes = ['conquistador', 'plugin', 'eve', 'grok-bot', 'single-agent', 'squad'];
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

function filesAt(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name);
    const key = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) fail(`Symlink is forbidden in install payload: ${key}`);
    if (stat.isDirectory()) return filesAt(path, key);
    if (!stat.isFile()) fail(`Unsupported file: ${key}`);
    return [key];
  });
}

function digest(directory) {
  const hash = createHash('sha256');
  for (const path of filesAt(directory).filter(path => path !== receiptName)) {
    hash.update(path).update('\0').update(createHash('sha256').update(readFileSync(join(directory, path))).digest('hex')).update('\n');
  }
  return hash.digest('hex');
}

function safeDestination(path) {
  const target = resolve(path);
  let cursor = target;
  while (true) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail(`Destination crosses a symlink: ${cursor}`);
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (containsPath(root, target) || containsPath(target, root)) fail('Install outside the distribution, into a dedicated directory.');
  return target;
}

function owned(target, expectedMode) {
  if (!existsSync(target) || !lstatSync(target).isDirectory()) fail('Owned install directory is missing.');
  const record = readJson(join(target, receiptName));
  if (record.schemaVersion !== 'conquistador.public-install/v1' || record.mode !== expectedMode || record.digest !== digest(target)) {
    fail('Install receipt differs or files were modified. Preserve your changes and install into a new directory.');
  }
}

function selectionFor(target) {
  if (domainPath) return resolveDomainSelection(root, readDomainManifestFile(domainPath));
  const restrictionFile = join(target, RESTRICTION_NAME);
  if (!existsSync(restrictionFile)) return undefined;
  const restriction = parseRestriction(readJson(restrictionFile));
  return resolveDomainSelection(root, {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    id: restriction.id,
    agentPackageSchemaVersion: restriction.agentPackageSchemaVersion,
    allowed: {
      roles: restriction.allowed.roles,
      skills: restriction.allowed.skills.filter(name => name !== PARENT_SKILL && name !== REVIEW_SKILL),
      workflows: restriction.allowed.workflows,
      tools: restriction.allowed.tools,
      knowledgeHandles: restriction.allowed.knowledgeHandles,
    },
  });
}

function stage(mode, target, selection) {
  const copy = (from, to = from) => {
    const source = join(root, from);
    if (lstatSync(source).isDirectory()) {
      if (selection && (from === 'skills' || from.startsWith('skills/'))) {
        for (const key of filesAt(source)) {
          const sourceKey = `${from}/${key}`;
          if (!shouldStageSkillPath(sourceKey, selection)) continue;
          const dest = join(target, to, key);
          mkdirSync(dirname(dest), { recursive: true });
          cpSync(join(source, key), dest, { errorOnExist: true, force: false });
        }
        return;
      }
      filesAt(source);
    } else if (!lstatSync(source).isFile()) fail(`Invalid source: ${from}`);
    mkdirSync(dirname(join(target, to)), { recursive: true });
    cpSync(source, join(target, to), { recursive: true, errorOnExist: true, force: false });
  };
  const skill = (name, into = 'skills') => {
    if (selection && !selection.skills.includes(name)) return;
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !existsSync(join(root, 'skills', methodPath(name)))) fail(`Unknown skill: ${name}`);
    copy(`skills/${methodDirectory(name)}`, `${into}/${name}`);
    // A standalone command is its own host skill, so its document takes the discoverable name.
    renameSync(join(target, into, name, 'COMMAND.md'), join(target, into, name, 'SKILL.md'));
  };
  const template = readFileSync(join(root, 'tools/entrypoint/SKILL.md'), 'utf8');
  const library = (entry, names) => stageMethodLibrary(join(root, 'skills'), join(target, entry), {
    template, subset: Boolean(selection) || Boolean(names),
    include: key => (!names || names.has(methodOwner(key) && key.startsWith('conquistador/commands/') ? methodOwner(key) : 'conquistador')) && shouldStageSkillPath(`skills/${key}`, selection),
  });
  const role = (source, into) => {
    const agent = readJson(join(root, source));
    agent.canonicalSkillRoot = `${into}/skills/conquistador`;
    mkdirSync(join(target, into), { recursive: true });
    writeFileSync(join(target, into, 'agent.json'), JSON.stringify(agent, null, 2) + '\n');
    library(`${into}/skills/conquistador`, new Set(['conquistador', ...agent.mayLoadSkills]));
  };
  copy('LICENSE');
  copy('NOTICE.md');
  copy('docs/PREVIEW.md');
  copy('docs/LEARNING.md');
  copy('docs/MASTER-AGENT.md');
  copy('docs/USAGE.md');
  copy('docs/PROACTIVE.md');
  if (['conquistador', 'plugin', 'single-agent'].includes(mode)) {
    copy('release/completeness.json');
    copy('tools/proactive.mjs');
    copy('tools/conquistador-mode.mjs');
    for (const file of ['context-selection.mjs', 'domain-package.mjs', 'method-library.mjs', 'plugin-contracts.mjs', 'routing-contract.mjs', 'request-text.mjs']) copy(`tools/${file}`);
  }
  if (['plugin', 'single-agent'].includes(mode)) {
    for (const file of operatorFiles) {
      if (!['tools/domain-package.mjs', 'tools/method-library.mjs', 'tools/plugin-contracts.mjs', 'tools/routing-contract.mjs', 'tools/request-text.mjs', 'tools/context-selection.mjs'].includes(file)) copy(file);
    }
  }
  if (mode === 'conquistador') {
    library('.');
  } else if (mode === 'plugin') {
    // The plugin ships its playbook MCP server and hooks; both run bundled scripts only.
    for (const path of ['plugin.json', 'mcp.json', '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.agents', 'assets', 'hooks', 'mcp/server.mjs', 'tools/skills-mcp.mjs', 'tools/mcp-http.mjs', 'package.json']) copy(path);
    copy('agents/conquistador.md');
    library('skills/conquistador');
  } else if (mode.startsWith('skill:')) {
    const name = mode.slice(6);
    skill(name);
  } else if (mode === 'eve') {
    copy('hosts/eve/instructions.md', 'agent/instructions.md');
    writeFileSync(join(target, 'host.json'), JSON.stringify({ ...readJson(join(root, 'hosts/eve/host.json')), canonicalSkillsRoot: 'agent/skills' }, null, 2) + '\n');
    copy('hosts/eve/capabilities.md', 'capabilities.md');
    copy('skills', 'agent/skills');
  } else if (mode === 'grok-bot') {
    copy('hosts/grok-bot/bot-profile.md', 'bot-profile.md');
    writeFileSync(join(target, 'host.json'), JSON.stringify({ ...readJson(join(root, 'hosts/grok-bot/host.json')), canonicalSkillsRoot: 'packaged-skills' }, null, 2) + '\n');
    copy('hosts/grok-bot/capabilities.md', 'capabilities.md');
    copy('skills', 'packaged-skills');
  } else if (mode === 'single-agent') {
    const agent = readJson(join(root, 'agents/conquistador/agent.json'));
    agent.canonicalSkillRoot = '.';
    mkdirSync(join(target, 'agent'), { recursive: true });
    writeFileSync(join(target, 'agent/agent.json'), JSON.stringify(agent, null, 2) + '\n');
    library('.');
  } else if (mode === 'squad') {
    copy('agents/squad/squad.json', 'squad.json');
    copy('docs/squad-sequential-fallback.md', 'sequential-fallback.md');
    role('agents/squad/advisor.json', 'advisor');
    role('agents/squad/worker.json', 'worker');
  } else fail(`Unknown install mode: ${mode}`);
  const usage = mode === 'conquistador'
    ? 'Load SKILL.md as the Conquistador skill. It routes through library/conquistador/METHOD.md and a filtered capability catalog. There is one discoverable skill; specialist methods load only after routing. Start with /conquistador, or the equivalent named-skill invocation in your host. The operator profile defaults to manual activation; hosts may enable project routing without starting a daemon. Proactive help is opt-in; read docs/PROACTIVE.md. Native BB specialist dispatch (hosts/coding-agent/) requires the complete distribution, not this compact folder.'
    : mode === 'single-agent'
    ? 'Read SKILL.md at the top of this folder or select Conquistador in your configured coding agent. The full method library is in library/. Load agent/agent.json in a portable adapter. The portable master contract, operator profile, specialist roles, and declared outcome methods are bundled. The one discoverable parent contains its internal library under library/ with METHOD.md files. Run conquistador start to see a first task, or conquistador skills to browse the library. Native dispatch imports hosts/coding-agent/*.mjs. The callable coordinator automatically enforces domain-restriction.json when present. The host supplies isolated worker contexts. setup --target operator installs this package; harness is its compatibility alias. Start a fresh host session and explicitly ask it to read SKILL.md and follow it for your task. Project activation requires a host adapter that calls admitRequest at turn start. No generic host registration is created.'
    : mode === 'squad'
      ? 'Load squad.json and each member contract with its own skills directory. Read sequential-fallback.md if your host cannot create separate contexts.'
      : mode === 'eve'
        ? 'Copy agent/instructions.md and agent/skills into an operator-owned Eve application. Read capabilities.md before enabling tools.'
        : mode === 'grok-bot'
          ? 'Use bot-profile.md and packaged-skills through the official Grok Bot app import controls, if supported. Read capabilities.md. Grok CLI is a different host.'
          : mode === 'plugin'
            ? 'Add this directory as a local marketplace in Claude Code or Codex, then install conquistador@conquistador. Other Agent Plugins clients load plugin.json. Only skills/conquistador/SKILL.md is discoverable as a skill; its library/ contains internal METHOD.md files. Claude also discovers the Conquistador agent. Native dispatch imports hosts/coding-agent/*.mjs from this folder. The operator profile defaults to manual activation. No service, hook, watcher, or schedule starts on install; methods declare prerequisites when needed.'
            : `Point your host at skills/${mode.slice(6)}. Read its SKILL.md for inputs, outputs and invocation prerequisites.`;
  writeFileSync(join(target, 'README.md'), `# Conquistador ${mode}\n\n${usage}\n\nRead [Use Conquistador](docs/USAGE.md) for requests, review and correction. Read [Master-agent modes](docs/MASTER-AGENT.md) for specialist execution and host limits. This staged folder contains methods and usage documentation. Run setup status, setup doctor, installation, upgrade, removal, runtime, build, test and package commands from the complete distribution, not this folder. The proactive helper is available only when tools/proactive.mjs is included.${selection ? (mode === 'conquistador' ? ' Domain selection filters the copied methods. This compact skill has no callable loader; its host must enforce domain-restriction.json before loading additional methods or tools.' : ' domain-restriction.json is the load-time allowlist for the callable coordinator; undeclared siblings are refused there even if copied later.') + ' Private knowledge roots stay in operator-owned configuration outside this folder. Direct host file and tool access requires host enforcement.' : ''}\n\nPrepared locally, not live-host verified. This folder is installer-owned. Keep user artifacts elsewhere. Use setup update or setup uninstall with this absolute destination through the original installer. Project operators manage all their paired native skills too. Modified files are preserved by refusing replacement.\n`);
  if (selection) {
    writeFileSync(join(target, RESTRICTION_NAME), `${JSON.stringify(selection.restriction, null, 2)}\n`);
  }
  const record = {
    schemaVersion: 'conquistador.public-install/v1',
    mode,
    productVersion: readJson(join(root, 'package.json')).version,
    digest: digest(target),
    liveHostVerified: false,
    ...(selection ? { domainId: selection.id, agentPackageSchemaVersion: selection.agentPackageSchemaVersion } : {}),
  };
  writeFileSync(join(target, receiptName), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
}

try {
  if (command === 'list' && mode === undefined) {
    console.log([...modes, ...readdirSync(join(root, 'skills')).sort().map(name => `skill:${name}`)].join('\n'));
  } else {
    if (!['install', 'upgrade', 'remove'].includes(command) || !mode || !destination || extra.length || (!modes.includes(mode) && !/^skill:[a-z][a-z0-9-]*$/.test(mode))) {
      fail('Usage: node tools/install.mjs list | install|upgrade|remove MODE ABSOLUTE_DESTINATION');
    }
    const target = safeDestination(destination);
    if (existsSync(join(target, 'project-installation.json'))) fail('This operator owns a native skill too. Use conquistador operator update or uninstall so both copies remain managed.');
    const manager = skillsManagerOwner(target);
    if (manager) fail(`skills.sh owns this copy (${manager}). Use that manager to update or remove it.`);
    const owner = projectSkillOwner(target);
    if (owner) fail(`This skill is owned by ${owner}. Use its operator update or uninstall command.`);
    // The npm package leaves the Eve runtime out; its export needs a repository checkout.
    if (mode === 'eve' && command !== 'remove' && !existsSync(join(root, 'hosts/eve/host.json'))) fail('The Eve export needs a repository checkout: https://github.com/forsvn-labs/conquistador/tree/private-alpha/hosts/eve');
    if (domainPath && !['conquistador', 'plugin', 'single-agent'].includes(mode)) fail('Domain packages apply to conquistador, plugin, and single-agent installs.');
    if (command === 'remove') {
      owned(target, mode);
      rmSync(target, { recursive: true });
      console.log(`Removed owned ${mode} install: ${target}`);
    } else {
      if (command === 'install' && existsSync(target)) fail('Destination exists. Use upgrade for an unchanged owned install, or choose a new directory.');
      if (command === 'upgrade') owned(target, mode);
      const selection = selectionFor(target);
      if (domainPath && command === 'install' && !selection) fail('Domain manifest did not resolve.');
      mkdirSync(dirname(target), { recursive: true });
      const temporary = mkdtempSync(join(dirname(target), '.conquistador-stage-'));
      let previous;
      try {
        stage(mode, temporary, selection);
        if (command === 'upgrade') {
          owned(target, mode);
          previous = mkdtempSync(join(dirname(target), '.conquistador-previous-'));
          renameSync(target, join(previous, 'install'));
        } else if (existsSync(target)) fail('Destination appeared during staging.');
        renameSync(temporary, target);
        if (previous) rmSync(previous, { recursive: true });
      } catch (error) {
        if (previous && !existsSync(target)) renameSync(join(previous, 'install'), target);
        if (existsSync(temporary)) rmSync(temporary, { recursive: true });
        throw error;
      }
      console.log(`Prepared ${mode}: ${realpathSync(target)}. Host activation and live execution remain unverified.`);
    }
  }
} catch (error) {
  console.error(`[conquistador-install] ${error.message}`);
  process.exitCode = 1;
}
