#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAIN_SCHEMA_VERSION, PARENT_SKILL, RESTRICTION_NAME, REVIEW_SKILL, parseRestriction, readDomainManifestFile, resolveDomainSelection, shouldStageSkillPath } from './domain-package.mjs';

import { operatorFiles } from './operator-package.mjs';

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
  const fromPackage = relative(root, target);
  const toPackage = relative(target, root);
  if (!fromPackage || (!fromPackage.startsWith(`..${sep}`) && fromPackage !== '..') ||
      !toPackage || (!toPackage.startsWith(`..${sep}`) && toPackage !== '..')) fail('Install outside the distribution, into a dedicated directory.');
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
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !existsSync(join(root, 'skills', name, 'SKILL.md'))) fail(`Unknown skill: ${name}`);
    copy(`skills/${name}`, `${into}/${name}`);
  };
  const role = (source, into) => {
    const agent = readJson(join(root, source));
    agent.canonicalSkillRoot = `${into}/skills/conquistador`;
    mkdirSync(join(target, into), { recursive: true });
    writeFileSync(join(target, into, 'agent.json'), JSON.stringify(agent, null, 2) + '\n');
    for (const name of new Set(['conquistador', ...agent.mayLoadSkills])) skill(name, `${into}/skills`);
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
    copy('tools/domain-package.mjs');
  }
  if (['plugin', 'single-agent'].includes(mode)) {
    for (const file of operatorFiles) {
      if (file !== 'tools/domain-package.mjs') copy(file);
    }
  }
  if (mode === 'conquistador') {
    copy('tools/entrypoint/SKILL.md', 'SKILL.md');
    copy('skills', 'library');
    copy('skills/conquistador/agents/openai.yaml', 'agents/openai.yaml');
  } else if (mode === 'plugin') {
    for (const path of ['plugin.json', '.claude-plugin', '.codex-plugin', '.agents', 'SKILL.md', 'skills', 'assets']) copy(path);
    copy('agents/conquistador.md');
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
    role('agents/conquistador/agent.json', 'agent');
  } else if (mode === 'squad') {
    copy('agents/squad/squad.json', 'squad.json');
    copy('docs/squad-sequential-fallback.md', 'sequential-fallback.md');
    role('agents/squad/advisor.json', 'advisor');
    role('agents/squad/worker.json', 'worker');
  } else fail(`Unknown install mode: ${mode}`);
  const usage = mode === 'conquistador'
    ? 'Load SKILL.md as the Conquistador skill. It routes through library/conquistador and all bundled outcome methods. Start with /conquistador, or the equivalent named-skill invocation in your host. The operator profile defaults to manual activation; hosts may enable project routing without starting a daemon. Proactive help is opt-in; read docs/PROACTIVE.md. Native BB specialist dispatch (hosts/coding-agent/) requires the complete distribution, not this compact folder.'
    : mode === 'single-agent'
    ? 'Load agent/agent.json and agent/skills/conquistador in your host. The portable master contract, operator profile, specialist roles, and declared outcome skills are bundled. Native dispatch imports hosts/coding-agent/*.mjs. The callable coordinator automatically enforces domain-restriction.json when present. The host supplies isolated worker contexts. setup --target operator installs this package; harness is its compatibility alias. Start a fresh host session and explicitly ask it to read agent/skills/conquistador/SKILL.md and follow it for your task. Project activation requires a host adapter that calls admitRequest at turn start. No generic host registration is created.'
    : mode === 'squad'
      ? 'Load squad.json and each member contract with its own skills directory. Read sequential-fallback.md if your host cannot create separate contexts.'
      : mode === 'eve'
        ? 'Copy agent/instructions.md and agent/skills into an operator-owned Eve application. Read capabilities.md before enabling tools.'
        : mode === 'grok-bot'
          ? 'Use bot-profile.md and packaged-skills through the official Grok Bot app import controls, if supported. Read capabilities.md. Grok CLI is a different host.'
          : mode === 'plugin'
            ? 'Add this directory as a local marketplace in Claude Code or Codex, then install conquistador@conquistador. Other Agent Plugins clients load plugin.json. Claude also discovers the Conquistador agent. Native dispatch imports hosts/coding-agent/*.mjs from this folder. The operator profile defaults to manual activation. No service, hook, watcher, or schedule starts on install; methods declare prerequisites when needed.'
            : `Point your host at skills/${mode.slice(6)}. Read its SKILL.md for inputs, outputs and invocation prerequisites.`;
  writeFileSync(join(target, 'README.md'), `# Conquistador ${mode}\n\n${usage}\n\nRead [Use Conquistador](docs/USAGE.md) for requests, review and correction. Read [Master-agent modes](docs/MASTER-AGENT.md) for specialist execution and host limits. This staged folder contains methods and usage documentation. Run setup status, setup doctor, installation, upgrade, removal, runtime, build, test and package commands from the complete distribution, not this folder. The proactive helper is available only when tools/proactive.mjs is included.${selection ? (mode === 'conquistador' ? ' Domain selection filters the copied methods. This compact skill has no callable loader; its host must enforce domain-restriction.json before loading additional methods or tools.' : ' domain-restriction.json is the load-time allowlist for the callable coordinator; undeclared siblings are refused there even if copied later.') + ' Private knowledge roots stay in operator-owned configuration outside this folder. Direct host file and tool access requires host enforcement.' : ''}\n\nPrepared locally, not live-host verified. This folder is installer-owned. Keep user artifacts elsewhere. Run upgrade or remove from the original complete distribution using the same mode and this destination. Modified files are preserved by refusing replacement.\n`);
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
