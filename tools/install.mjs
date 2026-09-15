#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const receiptName = '.conquistador-install.json';
const [command, mode, destination, ...extra] = process.argv.slice(2);
const modes = ['conquistador', 'plugin', 'eve', 'grok-bot', 'single-agent', 'squad'];
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const fail = message => { throw new Error(message); };

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

function stage(mode, target) {
  const copy = (from, to = from) => {
    const source = join(root, from);
    if (lstatSync(source).isDirectory()) filesAt(source);
    else if (!lstatSync(source).isFile()) fail(`Invalid source: ${from}`);
    mkdirSync(dirname(join(target, to)), { recursive: true });
    cpSync(source, join(target, to), { recursive: true, errorOnExist: true, force: false });
  };
  const skill = (name, into = 'skills') => {
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
  if (['conquistador', 'plugin', 'single-agent'].includes(mode)) {
    copy('tools/proactive.mjs');
    copy('docs/PROACTIVE.md');
  }
  if (mode === 'conquistador') {
    copy('tools/entrypoint/SKILL.md', 'SKILL.md');
    copy('skills', 'library');
    copy('skills/conquistador/agents/openai.yaml', 'agents/openai.yaml');
  } else if (mode === 'plugin') {
    for (const path of ['plugin.json', '.claude-plugin', '.codex-plugin', 'skills', 'assets']) copy(path);
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
    copy('agents/squad/sequential-fallback.md', 'sequential-fallback.md');
    role('agents/squad/advisor.json', 'advisor');
    role('agents/squad/worker.json', 'worker');
  } else fail(`Unknown install mode: ${mode}`);
  const usage = mode === 'conquistador'
    ? 'Load SKILL.md as the Conquistador skill. It routes through library/conquistador and all bundled outcome methods. Start with /conquistador, or the equivalent named-skill invocation in your host. Proactive help is opt-in; read docs/PROACTIVE.md.'
    : mode === 'single-agent'
    ? 'Load agent/agent.json and agent/skills/conquistador in your host. All declared outcome skills are bundled; the parent selects only the methods needed for the request.'
    : mode === 'squad'
      ? 'Load squad.json and each member contract with its own skills directory. Read sequential-fallback.md if your host cannot create separate contexts.'
      : mode === 'eve'
        ? 'Copy agent/instructions.md and agent/skills into an operator-owned Eve application. Read capabilities.md before enabling tools.'
        : mode === 'grok-bot'
          ? 'Use bot-profile.md and packaged-skills through the official Grok Bot app import controls, if supported. Read capabilities.md. Grok CLI is a different host.'
          : mode === 'plugin'
            ? 'Point your coding-agent host local-plugin installer at this directory. The plugin starts no service. Skills declare any prerequisites needed when invoked.'
            : `Point your host at skills/${mode.slice(6)}. Read its SKILL.md for inputs, outputs and invocation prerequisites.`;
  writeFileSync(join(target, 'README.md'), `# Conquistador ${mode}\n\n${usage}\n\nPrepared locally, not live-host verified. This folder is installer-owned. Keep user artifacts elsewhere. Run upgrade or remove from the original complete distribution using the same mode and this destination. Modified files are preserved by refusing replacement.\n`);
  const record = { schemaVersion: 'conquistador.public-install/v1', mode, productVersion: readJson(join(root, 'package.json')).version, digest: digest(target), liveHostVerified: false };
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
    if (command === 'remove') {
      owned(target, mode);
      rmSync(target, { recursive: true });
      console.log(`Removed owned ${mode} install: ${target}`);
    } else {
      if (command === 'install' && existsSync(target)) fail('Destination exists. Use upgrade for an unchanged owned install, or choose a new directory.');
      if (command === 'upgrade') owned(target, mode);
      mkdirSync(dirname(target), { recursive: true });
      const temporary = mkdtempSync(join(dirname(target), '.conquistador-stage-'));
      let previous;
      try {
        stage(mode, temporary);
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
