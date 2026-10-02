import { validateOperatorProfile } from '../hosts/coding-agent/operator.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { inspectMode } from './conquistador-mode.mjs';
import { fileURLToPath } from 'node:url';
import { loadRestriction, shouldStageSkillPath } from './domain-package.mjs';
import { validateContractAgainstInstall } from './routing-contract.mjs';
import { isRuntimeExecutable } from './install-paths.mjs';
import { canonicalText, capabilityCatalog, internalPath, internalText, methodLibrary, methodPath, skillDiscovery, regularFiles, subsetLinks } from './method-library.mjs';

const distribution = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'release/completeness.json';
const receiptPath = '.conquistador-install.json';
const hash = value => createHash('sha256').update(value).digest('hex');
const present = path => { try { lstatSync(path); return true; } catch { return false; } };

// Read only bounded regular files, without following links inside the selected bundle.
function bytesAt(root, path) {
  let current = root;
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw Error(`Invalid resource: ${path}`);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw Error(`Not a regular resource: ${path}`);
    if (index === parts.length - 1 && stat.size > 262144) throw Error(`Resource exceeds diagnostic limit: ${path}`);
  }
  return readFileSync(current);
}
const textAt = (root, path) => bytesAt(root, path).toString('utf8');

export function methodIdentity(text) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1] ?? '';
  return {
    name: /^name: ["']?([^\s"']+)/m.exec(frontmatter)?.[1] ?? null,
    version: /^  version: ["']?([^\s"']+)/m.exec(frontmatter)?.[1] ?? null,
  };
}

function sourceIdentity(path) {
  // Do not attribute the containing user's project commit to an installed skill.
  if (!present(join(path, '.git'))) return { sourceCommit: null, sourceClean: null };
  try {
    const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', path, ...args], {
      encoding: 'utf8', timeout: 4000, maxBuffer: 1048576, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (realpathSync(git('rev-parse', '--show-toplevel')) !== path) throw Error('Not a source root');
    const sourceCommit = git('rev-parse', 'HEAD');
    if (!/^[a-f0-9]{40,64}$/.test(sourceCommit)) throw Error('Invalid commit');
    return { sourceCommit, sourceClean: git('status', '--porcelain', '--untracked-files=normal') === '' };
  } catch { return { sourceCommit: null, sourceClean: null }; }
}

function receiptIdentity(path, inspectReceipt, issues) {
  if (!present(join(path, receiptPath))) return { state: 'absent', productVersion: null, digest: null };
  const integrity = inspectReceipt(path);
  if (integrity.state !== 'unchanged') issues.push('Managed receipt integrity failed; preserve edits before reinstalling.');
  try {
    const record = JSON.parse(textAt(path, receiptPath));
    return { state: integrity.state, mode: integrity.mode ?? null, hosts: integrity.hosts ?? [], nativeSkills: integrity.skills ?? [],
      productVersion: typeof record.productVersion === 'string' ? record.productVersion : null,
      digest: /^[a-f0-9]{64}$/.test(record.digest) ? record.digest : null };
  } catch { return { state: 'invalid', productVersion: null, digest: null }; }
}

function executable(path, permission) {
  if (typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) return false;
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, permission);
    return true;
  } catch { return false; }
}

function connectorTarget(path, issues) {
  const result = { nodeExecutable: false, packageExecutable: false, mode: null };
  try {
    const connector = JSON.parse(textAt(path, 'connector.json'));
    const args = connector.args;
    if (!Array.isArray(args) || ![2, 4].includes(args.length) || args[1] !== 'mcp' ||
        (args.length === 4 && (args[2] !== '--url' || typeof args[3] !== 'string'))) throw Error('Unrecognized connector');
    result.nodeExecutable = executable(connector.command, constants.X_OK);
    result.packageExecutable = executable(args[0], constants.R_OK) && isRuntimeExecutable(args[0]);
    result.mode = args.length === 4 ? 'runtime-bridge' : 'local-methods';
    if (!result.nodeExecutable) issues.push('Saved MCP Node executable is missing or not executable. Recreate the connector with the current Node installation.');
    if (!result.packageExecutable) issues.push('Saved MCP package executable is missing or unreadable. Restore its source/package or recreate the connector.');
    const packagePath = result.packageExecutable ? realpathSync(args[0]) : null;
    if (packagePath && !isRuntimeExecutable(packagePath)) {
      issues.push('Saved MCP package executable resolves outside the expected runtime/bin layout. Recreate the connector.');
      return { checks: result, root: null };
    }
    return { checks: result, root: packagePath ? resolve(dirname(packagePath), '../..') : null };
  } catch {
    issues.push('Managed MCP connector is malformed or unreadable. Recreate it from the complete distribution.');
    return { checks: result, root: null };
  }
}

function inspectLibrary(root, manifest, issues) {
  const layouts = methodLibrary(root);
  if (layouts.length !== 1) {
    issues.push('Cannot identify one complete library. Select the installed bundle root, not the nested parent.');
    return { layout: null, available: 0, expected: manifest.outcomes.length, methods: [] };
  }
  const { layout, internal, entry } = layouts[0];
  const restriction = loadRestriction(root);
  const selection = restriction ? { ...restriction.allowed } : null;
  const selectedFiles = restriction ? regularFiles(join(distribution, 'skills')).filter(path => shouldStageSkillPath(`skills/${path}`, selection)) : null;
  const resourcePath = path => `${layout}/${internal ? internalPath(path) : path}`;
  const originalBytes = (path, bytes) => {
    if (!internal || !path.endsWith('.md')) return bytes;
    const text = bytes.toString('utf8');
    const canonical = canonicalText(text);
    if (internalText(canonical) !== text) throw Error('Noncanonical internal document references');
    return canonical;
  };
  const methods = [];
  for (const expected of [manifest.parent, ...manifest.outcomes]) {
    if (restriction && !restriction.allowed.skills.includes(expected.name)) continue;
    const path = resourcePath(methodPath(expected.name));
    try {
      const text = textAt(root, path);
      const identity = methodIdentity(text);
      const expectedHash = restriction ? hash(subsetLinks(textAt(join(distribution, 'skills'), methodPath(expected.name)), methodPath(expected.name), selectedFiles)) : expected.sha256;
      const valid = identity.name === expected.name && identity.version === expected.version && hash(originalBytes(path, Buffer.from(text))) === expectedHash;
      methods.push({ name: expected.name, version: identity.version, expectedVersion: expected.version, valid });
      if (!valid) issues.push(`Method differs from the doctor release manifest: ${path}`);
    } catch {
      methods.push({ name: expected.name, version: null, expectedVersion: expected.version, valid: false });
      issues.push(`Missing or unreadable method: ${path}`);
    }
  }
  for (const resource of manifest.requiredResources) {
    if (restriction && !shouldStageSkillPath(`skills/${resource.path}`, selection)) continue;
    if (resource.path === 'conquistador/routing-contract.json' && internal) continue;
    const path = resourcePath(resource.path);
    try {
      const expectedHash = restriction && resource.path.endsWith('.md') ? hash(subsetLinks(textAt(join(distribution, 'skills'), resource.path), resource.path, selectedFiles)) : resource.sha256;
      if (hash(originalBytes(path, bytesAt(root, path))) !== expectedHash) issues.push(`Required resource differs from the doctor release manifest: ${path}`);
    } catch { issues.push(`Missing or unreadable resource: ${path}`); }
  }
  try {
    if (internal) {
      if (!textAt(root, entry).includes('](library/conquistador/METHOD.md)')) throw Error('Wrong internal parent');
      if (!present(join(root, 'domain-restriction.json'))) {
        const catalog = capabilityCatalog(join(distribution, 'skills'), [manifest.parent, ...manifest.outcomes].map(method => method.name));
        if (textAt(root, `${layout}/conquistador/catalog.md`) !== catalog) throw Error('Changed capability catalog');
      }
    } else if (layout === 'agent/skills') {
      const agent = JSON.parse(textAt(root, 'agent/agent.json'));
      if (agent.canonicalSkillRoot !== 'agent/skills/conquistador') throw Error('Wrong parent');
    } else if (!textAt(root, 'SKILL.md').includes(`](${layout}/conquistador/SKILL.md)`)) throw Error('Wrong parent');
  } catch { issues.push('Entry point does not resolve the bundled parent contract. Reinstall the complete root bundle.'); }
  return { layout, internal, entry, available: methods.filter(method => method.name !== manifest.parent.name && method.valid).length,
    expected: restriction ? restriction.allowed.skills.length - 1 : manifest.outcomes.length, scope: restriction ? 'domain-subset' : 'complete', methods };
}

export function inspectInstallation(path, inspectReceipt) {
  const issues = [], warnings = [];
  const manifestText = textAt(distribution, manifestPath);
  const manifest = JSON.parse(manifestText);
  const receipt = receiptIdentity(path, inspectReceipt, issues);
  const isConnector = receipt.mode === 'mcp' || present(join(path, 'connector.json'));
  const connector = isConnector ? connectorTarget(path, issues) : null;
  const bundleRoot = isConnector ? connector.root : path;
  let library = { layout: null, available: 0, expected: manifest.outcomes.length, methods: [] };
  let identity = { sourceCommit: null, sourceClean: null };
  let packagedManifest = 'unavailable';
  if (bundleRoot) {
    library = inspectLibrary(bundleRoot, manifest, issues);
    identity = sourceIdentity(bundleRoot);
    if (present(join(bundleRoot, manifestPath))) {
      try {
        packagedManifest = hash(textAt(bundleRoot, manifestPath)) === hash(manifestText) ? 'matches' : 'differs';
      } catch { packagedManifest = 'unreadable'; }
      if (packagedManifest !== 'matches') issues.push('Packaged completeness manifest differs from this doctor. Use the doctor from the same release or reinstall.');
    } else warnings.push('No packaged completeness manifest; checked against this doctor release.');
  }
  if (!identity.sourceCommit) warnings.push('Exact source commit unavailable. Method hashes and receipt integrity do not establish source provenance.');
  else if (!identity.sourceClean) warnings.push('Source checkout has local changes; HEAD does not identify the current files exactly.');
  if (receipt.state === 'absent') warnings.push('No managed receipt. Use the installer or plugin manager that owns this copy for updates.');
  let operatorActivation = null;
  const operatorProfilePresent = Boolean(bundleRoot && library.layout && present(join(bundleRoot, library.layout, 'conquistador/operator-profile.json')));
  if (operatorProfilePresent) {
    try {
      const profile = JSON.parse(textAt(bundleRoot, `${library.layout}/conquistador/operator-profile.json`));
      validateOperatorProfile(profile);
      operatorActivation = profile.activation;
    } catch {
      issues.push('Operator profile is present but invalid; fail closed until it is repaired.');
    }
  }
  let bbAdapterPresent = false;
  if (bundleRoot && library.layout && (library.layout !== 'library' || receipt.mode === 'single-agent')) {
    const resources = manifest.operatorResources ?? [];
    bbAdapterPresent = resources.length > 0;
    for (const resource of resources) {
      try {
        if (hash(bytesAt(bundleRoot, resource.path)) !== resource.sha256) throw Error('Changed operator resource');
      } catch {
        bbAdapterPresent = false;
        issues.push(`Missing or changed operator resource: ${resource.path}`);
      }
    }
    if ((library.layout?.startsWith('agent/skills') || receipt.mode === 'single-agent')) {
      try {
        const installed = JSON.parse(textAt(bundleRoot, 'agent/agent.json'));
        installed.canonicalSkillRoot = 'skills/conquistador';
        const canonical = JSON.parse(textAt(bundleRoot, 'agents/conquistador/agent.json'));
        if (JSON.stringify(installed) !== JSON.stringify(canonical)) throw Error('Changed agent contract');
      } catch { issues.push('Installed operator contract differs from its canonical package.'); }
    }
  }
  let discovery = null;
  if (bundleRoot && library.internal) {
    try {
      discovery = skillDiscovery(bundleRoot);
      if (discovery.count !== 1) issues.push('Lazy package must contain exactly one discoverable SKILL.md.');
    } catch { issues.push('Cannot inspect skill discovery safely.'); }
  }
  let routing = { consistent: false, issues: ['Routing overlay was not checked.'] };
  if (bundleRoot && library.layout) {
    try {
      const checked = validateContractAgainstInstall(bundleRoot, loadRestriction(bundleRoot));
      routing = { consistent: checked.issues.length === 0, methodCount: Object.keys(checked.contract.methods).length, issues: checked.issues };
      issues.push(...checked.issues);
    } catch (error) {
      routing = { consistent: false, issues: [`Routing/resource validation failed: ${error.message}`] };
      issues.push(...routing.issues);
    }
  }

  const status = issues.length ? 'incomplete' : 'local-files-verified';
  const hooks = [];
  if (['.conquistador', '.conquistador-operator'].includes(basename(path))) {
    for (const host of ['codex', 'claude-code']) {
      try {
        const registered = inspectMode({ host, project: dirname(path), scriptPath: join(path, 'tools/conquistador-mode.mjs') });
        hooks.push(registered.config ? inspectMode({ host, project: dirname(path), config: registered.config, scriptPath: join(path, 'tools/conquistador-mode.mjs') }) : registered);
      } catch { hooks.push({ host, state: 'invalid', nativeActivationVerified: false, routingAvailable: false }); }
    }
  }
  return {
    schemaVersion: 'conquistador.install-doctor/v1', status, path, bundleRoot,
    summary: `${library.available} methods available; ${status === 'incomplete' ? 'local checks failed' : 'local files verified'}; routing ${routing.consistent ? 'consistent' : 'unchecked or inconsistent'}; host activation and task execution unverified.`,
    manifest: { schemaVersion: manifest.schemaVersion, sha256: hash(manifestText), packaged: packagedManifest },
    library, discovery, identity, receipt, connector: connector?.checks ?? null,
    bbAdapterPresent,
    operatorProfilePresent,
    operatorActivation,
    routing, hooks,
    hostActivationVerified: false, taskExecutionVerified: false, providerVerified: false,
    issues, warnings,
  };
}

export function runInstallationDoctor(args, inspectReceipt) {
  let path, json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json' && !json) json = true;
    else if (args[i] === '--path' && path === undefined && args[i + 1] && !args[i + 1].startsWith('--')) path = args[++i];
    else throw Error('Usage: conquistador setup doctor --path ABS [--json]');
  }
  if (!path || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) throw Error('Doctor requires --path ABS without control characters.');
  // The selected root may be an installer-owned host link; never mutate its target.
  path = present(path) ? realpathSync(path) : resolve(path);
  const result = inspectInstallation(path, inspectReceipt);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(result.summary);
    console.log(`Path: ${result.path}`);
    console.log(`Source commit: ${result.identity.sourceCommit ?? 'unavailable'}. Receipt: ${result.receipt.state}.`);
    const parent = result.library.methods.find(method => method.name === 'conquistador');
    console.log(`Parent version: ${parent?.version ?? 'unavailable'}. Receipt product version: ${result.receipt.productVersion ?? 'unavailable'}.`);
    if (result.discovery) console.log(`Discovery: ${result.discovery.count} skill entry; name, description and path use ${result.discovery.metadataCharacters} characters. Host loading remains unverified.`);
    for (const hook of result.hooks) console.log(`Hook ${hook.host}: ${hook.state}; routing ${hook.routingAvailable ? 'available' : 'unavailable'}; activation and task observation unverified.${hook.repairRequired ? ' Re-enable through conquistador hooks to repair saved executable paths.' : ''}`);
    if (result.connector) console.log(`Saved MCP Node executable: ${result.connector.nodeExecutable ? 'available' : 'unavailable'}. Package executable: ${result.connector.packageExecutable ? 'available' : 'unavailable'}.`);
    console.log(`BB adapter files: ${result.bbAdapterPresent ? 'present; execution unverified' : 'not present'}.`);
    if (result.receipt.hosts?.includes('bb')) console.log('BB selected: explicit project/environment and team adapter. No BB plugin, native skill registration, or automatic routing was installed.');
    for (const item of result.receipt.nativeSkills ?? []) console.log(`Owned native skill: ${item.host}. Updated and removed with this operator; host discovery remains unverified.`);
    console.log(`Operator profile: ${result.operatorProfilePresent ? `present (activation ${result.operatorActivation ?? 'unparsed'}); host activation unverified` : 'not present; older packages degrade to explicit invocation'}. No daemon or schedule is started.`);
    for (const issue of result.issues) console.log(`FAIL: ${issue}`);
    for (const warning of result.warnings) console.log(`NOTE: ${warning}`);
    console.log(result.issues.length ? 'Next: preserve local edits and repair the failed checks through the original installer.' : 'Next: refresh the host, select Conquistador, and complete one real task. Doctor does not prove that routing ran.');
    console.log('No methods were loaded into the model context by this check.');
  }
  return result.status === 'local-files-verified' ? 0 : 1;
}
