import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containedPath } from './plugin-contracts.mjs';
import { methodDocument, methodLibrary } from './method-library.mjs';
import { assertLoadAllowed, loadRestriction } from './domain-package.mjs';

export const ROUTING_CONTRACT_SCHEMA = 'conquistador.routing-contract/v1';
export const ROUTING_OVERLAY_SCHEMA = 'conquistador.routing-overlay/v1';
export const KNOWLEDGE_INDEX_SCHEMA = 'conquistador.knowledge-index/v1';
export const ASSIGNMENT_BUDGET_BYTES = 196608;
export const ASSIGNMENT_BUDGET_FILES = 100;
const NAME = /^[a-z][a-z0-9-]{0,63}$/;
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = message => { throw new Error(message); };

const CONTRACT_CANDIDATES = [
  'library/conquistador/routing-contract.json',
  'skills/conquistador/library/conquistador/routing-contract.json',
  'agent/skills/conquistador/library/conquistador/routing-contract.json',
  'skills/conquistador/routing-contract.json',
];
const OVERLAY_CANDIDATES = [
  'library/conquistador/routing-overlay.json',
  'skills/conquistador/library/conquistador/routing-overlay.json',
  'agent/skills/conquistador/library/conquistador/routing-overlay.json',
  'skills/conquistador/routing-overlay.json',
];
function readContained(root, path, maximum = 262144) {
  if (typeof path !== 'string' || path.startsWith('/') || /[\\\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '..' || part === '.')) fail('Invalid contained resource path.');
  let cursor = root;
  for (const part of path.split('/')) {
    cursor = join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) fail('Routing resources must not cross symlinks.');
  }
  const absolute = containedPath(root, `./${path}`, 'file');
  const info = lstatSync(absolute);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) fail('Invalid Conquistador routing resource.');
  return readFileSync(absolute, 'utf8');
}

function jsonAt(root, path, maximum = 262144) {
  return JSON.parse(readContained(root, path, maximum));
}

function frontmatter(markdown) {
  const body = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? '';
  const field = name => new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(body)?.[1]?.trim() ?? '';
  const decode = value => {
    if (value.startsWith('"')) {
      try { return JSON.parse(value); } catch { return value.slice(1, -1); }
    }
    return value.replace(/^'|'$/g, '');
  };
  return { name: decode(field('name')), description: decode(field('description')) };
}

function labelsFromMap(markdown) {
  const labels = new Map();
  for (const row of markdown.split('\n')) {
    const match = /^\| ([^|]+) \| `([a-z][a-z0-9-]+)` \|/.exec(row);
    if (match) labels.set(match[2], match[1].trim());
  }
  return labels;
}

function linkedMarkdown(ownerPath, markdown) {
  const owner = posix.dirname(ownerPath);
  const out = [];
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    const link = match[1];
    if (/^(?:[a-z]+:|\/)/i.test(link) || !link.endsWith('.md')) continue;
    const path = posix.normalize(posix.join(owner, decodeURIComponent(link)));
    if (!path.startsWith(`${owner}/`) || out.includes(path)) continue;
    out.push(path);
  }
  return out;
}

function overlayPath(root) {
  return OVERLAY_CANDIDATES.find(path => existsSync(join(root, path))) ?? null;
}

function contractPath(root) {
  return CONTRACT_CANDIDATES.find(path => existsSync(join(root, path))) ?? null;
}

export function readOverlay(root = moduleRoot) {
  const path = overlayPath(root);
  if (!path) fail('Missing Conquistador routing overlay.');
  const overlay = jsonAt(root, path);
  if (!overlay || overlay.schemaVersion !== ROUTING_OVERLAY_SCHEMA) fail('Invalid routing overlay.');
  return overlay;
}

function firstPurpose(markdown) {
  const body = markdown.replace(/^# .*\n+/, '').trim();
  return body.split(/\n\s*\n/).find(value => value && !value.startsWith('#'))?.replace(/\s+/g, ' ').trim() ?? '';
}

export function buildRoutingContract(root = moduleRoot) {
  const layouts = methodLibrary(root);
  if (layouts.length !== 1) fail('Ambiguous or missing Conquistador method library.');
  const library = layouts[0];
  const parentPath = posix.join(library.layout, 'conquistador');
  const overlay = readOverlay(root);
  const document = library.internal ? methodDocument : 'SKILL.md';
  const capabilities = readContained(root, posix.join(parentPath, 'capabilities.md'));
  const labels = labelsFromMap(capabilities);
  const methods = {};
  for (const name of readdirSync(join(root, library.layout)).sort()) {
    if (name === 'conquistador' || !NAME.test(name)) continue;
    const path = posix.join(library.layout, name, document);
    if (!existsSync(join(root, path))) continue;
    const markdown = readContained(root, path);
    const metadata = frontmatter(markdown);
    if (metadata.name !== name || !metadata.description) fail(`Invalid method metadata: ${name}`);
    const spec = overlay.methods?.[name];
    if (!spec) fail(`Missing routing declaration: ${name}`);
    const resourcePath = value => {
      if (typeof value !== 'string' || value.startsWith('/') || value.split('/').some(part => !part || part === '..' || part === '.')) fail(`Invalid resource declaration: ${name}`);
      const target = posix.join(posix.dirname(path), value);
      readContained(root, target);
      return target;
    };
    const required = spec.requiredResources.map(resourcePath);
    const conditional = spec.conditionalResources.map(item => ({ path: resourcePath(item.path), when: item.when }));
    const optional = spec.optionalResources.map(resourcePath);
    const declared = [...required, ...conditional.map(item => item.path), ...optional];
    for (const resource of linkedMarkdown(path, markdown)) {
      if (!declared.includes(resource)) fail(`Undeclared resource phase: ${resource}`);
    }
    methods[name] = {
      name,
      label: labels.get(name) ?? name.replaceAll('-', ' '),
      description: metadata.description,
      path,
      kind: spec.kind ?? 'create',
      explicitOnly: spec.explicitOnly === true || overlay.explicitOnly?.includes(name) === true,
      intents: [...(spec.intents ?? [])],
      exclusions: [...(spec.exclusions ?? [])],
      requiredResources: required,
      conditionalResources: conditional.map(item => item.path),
      resourceConditions: conditional,
      optionalResources: optional,
      workflows: [],
      roles: [],
      knowledgeHandles: [...(spec.knowledgeHandles ?? [])],
    };
  }
  const expected = Object.keys(overlay.methods ?? {});
  if (Object.keys(methods).length === 38) {
    for (const name of expected) {
      if (!methods[name]) fail(`Routing overlay names missing method: ${name}`);
    }
    const extra = Object.keys(methods).filter(name => !expected.includes(name));
    if (extra.length) fail(`Routing overlay omitted methods: ${extra.join(', ')}`);
  }

  const workflows = [];
  const workflowDir = posix.join(parentPath, 'workflows');
  if (existsSync(join(root, workflowDir))) {
    for (const file of readdirSync(join(root, workflowDir)).sort()) {
      if (!file.endsWith('.md')) continue;
      const name = file.slice(0, -3);
      if (!NAME.test(name)) continue;
      const path = posix.join(workflowDir, file);
      const markdown = readContained(root, path);
      const dependencies = [...markdown.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(match => match[1])
        .filter((value, index, all) => overlay.methods[value] && all.indexOf(value) === index);
      if (dependencies.some(value => !methods[value])) continue;
      workflows.push({
        name,
        label: name.replaceAll('-', ' '),
        description: firstPurpose(markdown),
        path,
        dependencies,
        executableGraph: false,
      });
      for (const dependency of dependencies) {
        if (!methods[dependency].workflows.includes(name)) methods[dependency].workflows.push(name);
      }
    }
  }

  const roles = [];
  const rosterPath = posix.join(parentPath, 'specialists/roster.md');
  if (existsSync(join(root, rosterPath))) {
    for (const row of readContained(root, rosterPath).split('\n')) {
      const match = /^\| \[([^\]]+)\]\(([^)]+-agent\.md)\) \| ([^|]+) \| ([^|]+) \|/.exec(row);
      if (!match) continue;
      const name = posix.basename(match[2], '-agent.md');
      const rolePath = posix.normalize(posix.join(posix.dirname(rosterPath), match[2]));
      const dependencies = [...readContained(root, rolePath).matchAll(/`([a-z][a-z0-9-]+)`/g)].map(item => item[1])
        .filter((value, index, all) => overlay.methods[value] && all.indexOf(value) === index);
      if (dependencies.some(value => !methods[value])) continue;
      roles.push({
        name,
        label: match[1],
        description: match[3].trim(),
        path: posix.normalize(posix.join(posix.dirname(rosterPath), match[2])),
        dependencies,
      });
      for (const dependency of dependencies) {
        if (!methods[dependency].roles.includes(name)) methods[dependency].roles.push(name);
      }
    }
  }

  const parentMethods = {};
  for (const [name, spec] of Object.entries(overlay.parentMethods ?? {})) {
    const path = posix.join(parentPath, spec.path);
    if (!existsSync(join(root, path))) fail(`Missing parent method: ${name}`);
    parentMethods[name] = {
      name,
      label: spec.label,
      path,
      intents: [...(spec.intents ?? [])],
    };
  }

  return {
    schemaVersion: ROUTING_CONTRACT_SCHEMA,
    parentPath,
    document,
    requiredStandards: ['quality', 'safety', 'context'].map(name => posix.join(parentPath, `standards/${name}.md`)),
    channelLocks: overlay.channelLocks ?? {},
    parentMethods,
    methods,
    unavailableMethods: expected.filter(name => !methods[name]).map(name => ({ name, kind: overlay.methods[name].kind,
      intents: overlay.methods[name].intents, exclusions: overlay.methods[name].exclusions,
      explicitOnly: overlay.methods[name].explicitOnly === true || overlay.explicitOnly.includes(name) })),
    workflows,
    roles,
  };
}

export function validateRoutingContract(value) {
  if (!value || value.schemaVersion !== ROUTING_CONTRACT_SCHEMA) fail('Invalid routing contract.');
  if (!value.methods || typeof value.methods !== 'object') fail('Routing contract is missing methods.');
  const names = Object.keys(value.methods);
  if (!names.length) fail('Routing contract must describe at least one method.');
  for (const name of names) {
    if (!NAME.test(name)) fail(`Invalid method id: ${name}`);
    const method = value.methods[name];
    if (method.name !== name || !method.path || !method.label) fail(`Incomplete routing record: ${name}`);
    for (const field of ['requiredResources', 'conditionalResources', 'optionalResources', 'intents', 'exclusions']) {
      if (!Array.isArray(method[field])) fail(`Invalid ${field} for ${name}`);
    }
  }
  return value;
}

export function loadRoutingContract(root = moduleRoot) {
  const path = contractPath(root);
  if (path) {
    let contract = validateRoutingContract(jsonAt(root, path, 512000));
    const libraries = methodLibrary(root);
    if (libraries.length !== 1) fail('Missing or ambiguous method library.');
    const [library] = libraries;
    const oldRoot = posix.dirname(contract.parentPath);
    if (oldRoot !== library.layout) {
      const rebase = value => typeof value === 'string' && value.startsWith(`${oldRoot}/`)
        ? `${library.layout}/${value.slice(oldRoot.length + 1)}`
        : Array.isArray(value) ? value.map(rebase)
          : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebase(item)])) : value;
      contract = rebase(contract);
    }
    for (const method of Object.values(contract.methods)) containedPath(root, `./${method.path}`, 'file');
    return contract;
  }
  fail('Missing Conquistador routing contract.');
}

export function writeRoutingContract(root = moduleRoot, destination) {
  const contract = buildRoutingContract(root);
  validateRoutingContract(contract);
  const target = destination ?? join(root, contract.parentPath, 'routing-contract.json');
  writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`);
  return contract;
}

export async function resolveOptionalKnowledge(handle, { resolveKnowledge, index } = {}) {
  const listed = index?.handles?.some(item => item.handle === handle) === true;
  if (typeof resolveKnowledge === 'function') {
    try {
      const body = await resolveKnowledge(handle);
      if (typeof body === 'string' && body.trim()) return { handle, status: 'resolved', body, gap: null };
      return { handle, status: 'missing-source', body: null, gap: `Knowledge ${handle} resolved empty.` };
    } catch {
      return { handle, status: 'missing-source', body: null, gap: `Knowledge ${handle} is configured but unavailable.` };
    }
  }
  if (listed) {
    return { handle, status: 'missing-resolver', body: null, gap: `Knowledge ${handle} is listed but this host has no resolver.` };
  }
  return { handle, status: 'missing-source', body: null, gap: `Optional knowledge ${handle} is not configured.` };
}

function resourceExists(root, path) {
  try {
    readContained(root, path);
    return true;
  } catch {
    return false;
  }
}

export function prepareAssignmentResources(root, methodName, { extra = [], includeConditional = false } = {}) {
  const contract = loadRoutingContract(root);
  const method = contract.methods[methodName];
  if (!method) fail(`Unknown method: ${methodName}`);
  const required = [method.path, ...contract.requiredStandards, ...method.requiredResources];
  const deferred = [
    ...method.resourceConditions.map(item => ({ ...item, phase: 'conditional', requiredWhenApplicable: true })),
    ...method.optionalResources.map(path => ({ path, phase: 'optional' })),
  ];
  const extraPaths = extra.filter(path => typeof path === 'string');
  for (const path of extraPaths) {
    if (![...required, ...deferred.map(item => item.path)].includes(path)) fail('Extra context must be a declared method resource.');
    if (!required.includes(path)) required.push(path);
  }
  if (includeConditional) {
    for (const item of deferred.filter(value => value.phase === 'conditional')) {
      if (!required.includes(item.path)) required.push(item.path);
    }
  }
  const missing = required.filter(path => !resourceExists(root, path));
  if (missing.length) fail(`Required method resource missing: ${missing[0]}`);
  return {
    method: methodName,
    required: [...new Set(required)],
    deferred: deferred.filter(item => !required.includes(item.path)),
  };
}

// Hosts can fetch a method stage without expanding the entire link graph into one prompt.
export function loadAssignmentResource(root, methodName, path) {
  const restriction = loadRestriction(root);
  if (restriction) assertLoadAllowed(restriction, { kind: 'skill', name: methodName });
  const contract = loadRoutingContract(root);
  const method = contract.methods[methodName];
  if (!method) fail('Unknown method resource owner.');
  const owner = posix.dirname(method.path);
  if (!path.startsWith(`${owner}/`) || path.split('/').includes('..')) fail('Resource is outside the assigned method.');
  return loadBoundedDocuments(root, [path]);
}

export function loadBoundedDocuments(root, paths, { budgetBytes = ASSIGNMENT_BUDGET_BYTES, budgetFiles = ASSIGNMENT_BUDGET_FILES } = {}) {
  const methods = [];
  const seen = new Set();
  let contextBytes = 0;
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    const body = readContained(root, path);
    contextBytes += Buffer.byteLength(body);
    if (contextBytes > budgetBytes || seen.size > budgetFiles) {
      fail(`Selected method context exceeds budget while loading ${path}. Split the assignment; do not omit required instructions.`);
    }
    methods.push({ path, body });
  }
  return { methods, contextBytes };
}

export function validateContractAgainstInstall(root, restriction) {
  const contract = loadRoutingContract(root);
  const issues = [];
  for (const path of contract.requiredStandards) if (!resourceExists(root, path)) issues.push(`Missing standard: ${path}`);
  if (JSON.stringify(contract) !== JSON.stringify(buildRoutingContract(root))) issues.push('Routing contract differs from its installed declarations and contents.');
  for (const method of Object.values(contract.methods)) {
    if (restriction) {
      try { assertLoadAllowed(restriction, { kind: 'skill', name: method.name }); }
      catch { issues.push(`Contract includes forbidden method: ${method.name}`); continue; }
    }
    if (!resourceExists(root, method.path)) issues.push(`Missing method: ${method.path}`);
    for (const path of [...method.requiredResources, ...method.conditionalResources, ...method.optionalResources]) {
      if (!resourceExists(root, path)) issues.push(`Missing required resource for ${method.name}: ${path}`);
    }
  }
  for (const workflow of contract.workflows ?? []) {
    if (restriction) {
      try { assertLoadAllowed(restriction, { kind: 'workflow', name: workflow.name }); }
      catch { continue; }
    }
    if (!resourceExists(root, workflow.path)) issues.push(`Missing workflow: ${workflow.path}`);
    for (const name of workflow.dependencies) {
      if (restriction) {
        try { assertLoadAllowed(restriction, { kind: 'skill', name }); }
        catch { issues.push(`Workflow ${workflow.name} depends on omitted method ${name}`); }
      }
    }
  }
  for (const role of contract.roles ?? []) {
    if (!resourceExists(root, role.path)) issues.push(`Missing role: ${role.path}`);
    if (restriction) {
      try { assertLoadAllowed(restriction, { kind: 'role', name: role.name }); }
      catch { issues.push(`Contract includes forbidden role: ${role.name}`); }
    }
    for (const name of role.dependencies) if (!contract.methods[name]) issues.push(`Role ${role.name} depends on missing method ${name}`);
  }
  for (const method of Object.values(contract.parentMethods)) if (!resourceExists(root, method.path)) issues.push(`Missing parent method: ${method.name}`);
  return { contract, issues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  if (action !== 'write') fail('Usage: node tools/routing-contract.mjs write');
  writeRoutingContract();
}
