import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const AGENT_PACKAGE_SCHEMA_VERSION = 'conquistador.agent-package/v2';
export const DOMAIN_SCHEMA_VERSION = 'conquistador.domain-package/v1';
export const RESTRICTION_SCHEMA_VERSION = 'conquistador.domain-restriction/v1';
export const KNOWLEDGE_ROOTS_SCHEMA_VERSION = 'conquistador.knowledge-roots/v1';
export const RESTRICTION_NAME = 'domain-restriction.json';
export const LOGICAL_TOOLS = Object.freeze([
  'host-model', 'host-filesystem', 'host-worker-context', 'cli', 'mcp', 'warehouse', 'executor',
]);
export const LOAD_KINDS = Object.freeze(['skill', 'workflow', 'role', 'tool', 'knowledgeHandle']);
export const PROTOCOL_ROLES = Object.freeze(['parent', 'outcome']);
export const PARENT_SKILL = 'conquistador';
export const REVIEW_SKILL = 'fresh-eyes-review';
const NAME = /^[a-z][a-z0-9-]{0,63}$/;
const HANDLE = /^(?:[a-z][a-z0-9-]{0,63}|[a-z][a-z0-9-]*:[a-z][a-z0-9-]*)$/;
const fail = message => { throw new Error(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sortedUnique = values => {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) fail('Domain lists must be string arrays.');
  if (new Set(values).size !== values.length) fail('Domain lists must not contain duplicates.');
  return [...values].sort();
};

export function loadCanonicalLibrary(root) {
  const skillsRoot = join(root, 'skills');
  const workflowsRoot = join(skillsRoot, 'conquistador/workflows');
  const specialistsRoot = join(skillsRoot, 'conquistador/specialists');
  if (!existsSync(join(skillsRoot, 'conquistador/SKILL.md'))) fail('Canonical parent skill is missing.');
  const skills = readdirSync(skillsRoot).sort().filter(name => NAME.test(name) && existsSync(join(skillsRoot, name, 'SKILL.md')));
  const workflows = readdirSync(workflowsRoot).sort()
    .filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).filter(name => NAME.test(name));
  const roles = readdirSync(specialistsRoot).sort()
    .filter(name => name.endsWith('-agent.md')).map(name => name.slice(0, -'-agent.md'.length)).filter(name => NAME.test(name));
  if (!skills.includes('conquistador') || workflows.length === 0 || roles.length === 0) fail('Canonical library is incomplete.');
  return { skills, workflows, roles, tools: [...LOGICAL_TOOLS] };
}

function namesIn(markdown, library) {
  const skills = new Set();
  const workflows = new Set();
  for (const [, name] of markdown.matchAll(/`([a-z][a-z0-9-]*)`/g)) {
    if (library.skills.includes(name)) skills.add(name);
    if (library.workflows.includes(name)) workflows.add(name);
  }
  return { skills, workflows };
}

function roleDependencies(root, library, role) {
  const path = join(root, 'skills/conquistador/specialists', `${role}-agent.md`);
  if (!existsSync(path) || !lstatSync(path).isFile()) fail(`Unknown role: ${role}`);
  return namesIn(readFileSync(path, 'utf8'), library);
}

function workflowDependencies(root, library, workflow) {
  const path = join(root, 'skills/conquistador/workflows', `${workflow}.md`);
  if (!existsSync(path) || !lstatSync(path).isFile()) fail(`Unknown workflow: ${workflow}`);
  return namesIn(readFileSync(path, 'utf8'), library);
}

export function parseDomainManifest(value) {
  if (!isObject(value)) fail('Domain manifest must be an object.');
  const keys = Object.keys(value);
  if (keys.length !== 4 || !['schemaVersion', 'id', 'agentPackageSchemaVersion', 'allowed'].every(key => Object.hasOwn(value, key))) {
    fail('Domain manifest fields must be schemaVersion, id, agentPackageSchemaVersion, and allowed.');
  }
  if (value.schemaVersion !== DOMAIN_SCHEMA_VERSION) fail('Unsupported domain package schema.');
  if (value.agentPackageSchemaVersion !== AGENT_PACKAGE_SCHEMA_VERSION) fail('Domain packages require conquistador.agent-package/v2.');
  if (typeof value.id !== 'string' || !/^domain:[a-z][a-z0-9-]*$/.test(value.id)) fail('Domain id must be domain:<kebab-name>.');
  if (!isObject(value.allowed)) fail('allowed must be an object.');
  const allowedKeys = Object.keys(value.allowed);
  if (allowedKeys.length !== 5 || !['roles', 'skills', 'workflows', 'tools', 'knowledgeHandles'].every(key => Object.hasOwn(value.allowed, key))) {
    fail('allowed must list roles, skills, workflows, tools, and knowledgeHandles.');
  }
  const roles = sortedUnique(value.allowed.roles);
  const skills = sortedUnique(value.allowed.skills);
  const workflows = sortedUnique(value.allowed.workflows);
  const tools = sortedUnique(value.allowed.tools);
  const knowledgeHandles = sortedUnique(value.allowed.knowledgeHandles);
  if (roles.some(name => !NAME.test(name))) fail('Unknown or unsafe role name.');
  if (skills.some(name => !NAME.test(name) || name === 'conquistador')) fail('Select outcome skills by canonical name; the parent is always included.');
  if (workflows.some(name => !NAME.test(name))) fail('Unknown or unsafe workflow name.');
  if (tools.some(name => !LOGICAL_TOOLS.includes(name))) fail('Unknown logical tool handle.');
  if (knowledgeHandles.some(name => !HANDLE.test(name) || name.includes('..') || name.includes('/') || name.includes('\\'))) {
    fail('Knowledge handles must be logical identifiers, not paths.');
  }
  return {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    id: value.id,
    agentPackageSchemaVersion: AGENT_PACKAGE_SCHEMA_VERSION,
    allowed: { roles, skills, workflows, tools, knowledgeHandles },
  };
}

export function resolveDomainSelection(root, manifest) {
  const library = loadCanonicalLibrary(root);
  const parsed = parseDomainManifest(manifest);
  const skills = new Set([PARENT_SKILL, REVIEW_SKILL]);
  const workflows = new Set();
  const roles = new Set();
  const unknown = (kind, name) => fail(`Unknown ${kind}: ${name}`);
  for (const role of parsed.allowed.roles) {
    if (!library.roles.includes(role)) unknown('role', role);
    roles.add(role);
    const deps = roleDependencies(root, library, role);
    for (const name of deps.skills) skills.add(name);
    for (const name of deps.workflows) workflows.add(name);
  }
  for (const name of parsed.allowed.skills) {
    if (!library.skills.includes(name)) unknown('skill', name);
    skills.add(name);
  }
  for (const name of parsed.allowed.workflows) {
    if (!library.workflows.includes(name)) unknown('workflow', name);
    workflows.add(name);
  }
  for (const workflow of workflows) {
    const deps = workflowDependencies(root, library, workflow);
    for (const name of deps.skills) skills.add(name);
  }
  const restriction = {
    schemaVersion: RESTRICTION_SCHEMA_VERSION,
    agentPackageSchemaVersion: AGENT_PACKAGE_SCHEMA_VERSION,
    id: parsed.id,
    allowed: {
      roles: [...roles].sort(),
      skills: [...skills].sort(),
      workflows: [...workflows].sort(),
      tools: parsed.allowed.tools,
      knowledgeHandles: parsed.allowed.knowledgeHandles,
    },
  };
  return {
    id: parsed.id,
    agentPackageSchemaVersion: AGENT_PACKAGE_SCHEMA_VERSION,
    ...restriction.allowed,
    restriction,
  };
}

export function parseRestriction(value) {
  if (!isObject(value) || Object.keys(value).length !== 4 || value.schemaVersion !== RESTRICTION_SCHEMA_VERSION ||
      value.agentPackageSchemaVersion !== AGENT_PACKAGE_SCHEMA_VERSION ||
      typeof value.id !== 'string' || !/^domain:[a-z][a-z0-9-]*$/.test(value.id) || !isObject(value.allowed)) {
    fail('Invalid domain restriction.');
  }
  const allowedKeys = Object.keys(value.allowed);
  if (allowedKeys.length !== 5 || !['roles', 'skills', 'workflows', 'tools', 'knowledgeHandles'].every(key => Object.hasOwn(value.allowed, key))) {
    fail('allowed must list roles, skills, workflows, tools, and knowledgeHandles.');
  }
  const roles = sortedUnique(value.allowed.roles);
  const skills = sortedUnique(value.allowed.skills);
  const workflows = sortedUnique(value.allowed.workflows);
  const tools = sortedUnique(value.allowed.tools);
  const knowledgeHandles = sortedUnique(value.allowed.knowledgeHandles);
  if (roles.some(name => !NAME.test(name))) fail('Unknown or unsafe role name.');
  if (skills.some(name => !NAME.test(name))) fail('Unknown or unsafe skill name.');
  if (workflows.some(name => !NAME.test(name))) fail('Unknown or unsafe workflow name.');
  if (!skills.includes(PARENT_SKILL) || !skills.includes(REVIEW_SKILL)) fail('Domain restriction must include the parent skill and fresh-eyes-review.');
  if (tools.some(name => !LOGICAL_TOOLS.includes(name))) fail('Unknown logical tool handle.');
  if (knowledgeHandles.some(name => !HANDLE.test(name))) fail('Unknown or unsafe knowledge handle.');
  return {
    schemaVersion: RESTRICTION_SCHEMA_VERSION,
    agentPackageSchemaVersion: AGENT_PACKAGE_SCHEMA_VERSION,
    id: value.id,
    allowed: { roles, skills, workflows, tools, knowledgeHandles },
  };
}

export function assertLoadAllowed(restriction, request) {
  if (!isObject(request) || !LOAD_KINDS.includes(request.kind) || typeof request.name !== 'string') fail('Invalid load request.');
  const allowed = restriction?.allowed?.[request.kind === 'skill' ? 'skills' : request.kind === 'workflow' ? 'workflows' : request.kind === 'role' ? 'roles' : request.kind === 'tool' ? 'tools' : 'knowledgeHandles'];
  if (!Array.isArray(allowed) || !allowed.includes(request.name)) fail(`Domain restriction forbids ${request.kind} ${request.name}.`);
  return true;
}

export function loadRestriction(root) {
  const path = join(root, RESTRICTION_NAME);
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) fail('Domain restriction must be a regular file.');
  return parseRestriction(JSON.parse(readFileSync(path, 'utf8')));
}

export function authorizeTask(restriction, task) {
  if (restriction == null) return true;
  if (!isObject(task) || typeof task.role !== 'string') fail('Invalid assignment.');
  const parsed = parseRestriction(restriction);
  if (task.role === 'parent') assertLoadAllowed(parsed, { kind: 'skill', name: PARENT_SKILL });
  else if (task.role === 'outcome') {
    const skills = Array.isArray(task.skills) ? task.skills : [];
    if (!skills.length) fail('Outcome assignment needs an existing skill.');
  } else assertLoadAllowed(parsed, { kind: 'role', name: task.role });
  for (const name of task.skills ?? []) assertLoadAllowed(parsed, { kind: 'skill', name });
  for (const name of task.workflows ?? []) assertLoadAllowed(parsed, { kind: 'workflow', name });
  for (const name of task.knowledgeHandles ?? []) assertLoadAllowed(parsed, { kind: 'knowledgeHandle', name });
  for (const name of task.tools ?? []) assertLoadAllowed(parsed, { kind: 'tool', name });
  return true;
}

export function authorizeLoadedAssignment(root, task) {
  authorizeTask(loadRestriction(root), task);
}

export function createDomainAuthorizer(root, restriction = loadRestriction(root)) {
  return async function authorize(task) {
    authorizeTask(restriction, task);
  };
}

export function parseKnowledgeRoots(value) {
  if (!isObject(value) || value.schemaVersion !== KNOWLEDGE_ROOTS_SCHEMA_VERSION || !isObject(value.roots) || Object.keys(value).length !== 2) {
    fail('Knowledge roots must be an operator-owned object with schemaVersion and roots.');
  }
  const roots = Object.create(null);
  for (const [handle, path] of Object.entries(value.roots)) {
    if (!HANDLE.test(handle)) fail('Unknown or unsafe knowledge handle.');
    if (typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) fail('Knowledge roots must be absolute paths without control characters.');
    roots[handle] = resolve(path);
  }
  return { schemaVersion: KNOWLEDGE_ROOTS_SCHEMA_VERSION, roots };
}

export function resolveKnowledgeRoot(handle, operatorConfig, { productRoot } = {}) {
  if (!HANDLE.test(handle)) fail('Unknown or unsafe knowledge handle.');
  const config = parseKnowledgeRoots(operatorConfig);
  if (!Object.hasOwn(config.roots, handle)) fail('Knowledge handle is not configured.');
  const target = config.roots[handle];
  for (let cursor = target; ; cursor = dirname(cursor)) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail('Knowledge root must not cross a symlink.');
    if (cursor === dirname(cursor)) break;
  }
  if (productRoot) {
    const inside = (a, b) => { const part = relative(a, b); return !part || (part !== '..' && !part.startsWith(`..${sep}`)); };
    if (inside(resolve(productRoot), target)) fail('Knowledge roots must stay outside the product package.');
  }
  return target;
}

export function shouldStageSkillPath(sourceKey, selection) {
  if (!selection) return true;
  const parts = sourceKey.split('/');
  if (parts[0] !== 'skills' || !parts[1]) return true;
  if (!selection.skills.includes(parts[1])) return false;
  if (parts[1] === 'conquistador' && parts[2] === 'workflows' && parts[3]?.endsWith('.md')) {
    return selection.workflows.includes(parts[3].slice(0, -3));
  }
  if (parts[1] === 'conquistador' && parts[2] === 'specialists' && parts[3]?.endsWith('-agent.md')) {
    return selection.roles.includes(parts[3].slice(0, -'-agent.md'.length));
  }
  return true;
}

export function readDomainManifestFile(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) fail('Domain manifest must be an absolute path.');
  if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) fail('Domain manifest must be a regular file.');
  return parseDomainManifest(JSON.parse(readFileSync(path, 'utf8')));
}
