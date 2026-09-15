import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT_PACKAGE_SCHEMA_VERSION, DOMAIN_SCHEMA_VERSION, KNOWLEDGE_ROOTS_SCHEMA_VERSION,
  LOGICAL_TOOLS, PARENT_SKILL, RESTRICTION_NAME, REVIEW_SKILL,
  authorizeLoadedAssignment, authorizeTask, createDomainAuthorizer, loadCanonicalLibrary,
  loadRestriction, parseDomainManifest, parseRestriction, resolveDomainSelection,
  resolveKnowledgeRoot, shouldStageSkillPath,
} from './domain-package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = loadCanonicalLibrary(root);
const manifest = (allowed = {}) => ({
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  id: 'domain:diagnosis',
  agentPackageSchemaVersion: AGENT_PACKAGE_SCHEMA_VERSION,
  allowed: {
    roles: ['data-diagnosis'],
    skills: [],
    workflows: [],
    tools: ['host-model', 'host-filesystem'],
    knowledgeHandles: ['vault:notes'],
    ...allowed,
  },
});
const assignment = (role, extra = {}) => ({
  id: role === 'parent' ? 'integrate' : role === 'outcome' ? 'review' : 'work',
  role, goal: 'Finish one bounded assignment.', skills: [], workflows: [], knowledgeHandles: [], dependsOn: [],
  ...extra,
});

test('canonical library includes parent, review, seven specialists and logical tools', () => {
  assert.ok(library.skills.includes(PARENT_SKILL));
  assert.ok(library.skills.includes(REVIEW_SKILL));
  assert.deepEqual(library.roles, ['ads', 'campaign-data', 'copy', 'creative-assets', 'data-diagnosis', 'dr-landing', 'saas-landing']);
  assert.deepEqual(library.tools, [...LOGICAL_TOOLS]);
});

test('domain closure always adds parent and mandatory review, not write-copy for diagnosis', () => {
  const selection = resolveDomainSelection(root, manifest());
  assert.ok(selection.skills.includes(PARENT_SKILL));
  assert.ok(selection.skills.includes(REVIEW_SKILL));
  assert.ok(selection.skills.includes('diagnose-growth'));
  assert.equal(selection.skills.includes('write-copy'), false);
  assert.deepEqual(selection.roles, ['data-diagnosis']);
  parseRestriction(selection.restriction);
  assert.throws(() => parseDomainManifest(manifest({ skills: [PARENT_SKILL] })), /parent is always included/);
});

test('parent integration with empty skills authorizes; outcome uses any allowed skill', async () => {
  const restriction = resolveDomainSelection(root, manifest()).restriction;
  authorizeTask(restriction, assignment('parent'));
  authorizeTask(restriction, assignment('outcome', { skills: [REVIEW_SKILL] }));
  authorizeTask(restriction, assignment('outcome', { skills: ['diagnose-growth'] }));
  authorizeTask(restriction, assignment('data-diagnosis', { skills: ['diagnose-growth'] }));
  assert.throws(() => authorizeTask(restriction, assignment('outcome')), /existing skill/);
  assert.throws(() => authorizeTask(restriction, assignment('outcome', { skills: ['write-copy'] })), /forbids skill write-copy/);
  assert.throws(() => authorizeTask(restriction, assignment('copy')), /forbids role copy/);
  assert.throws(() => authorizeTask(restriction, assignment('parent', { skills: ['write-copy'] })), /forbids skill write-copy/);
  await createDomainAuthorizer(root, restriction)(assignment('parent'));
});

test('restriction rejects unknown allowed keys and unsafe identifiers', () => {
  const restriction = resolveDomainSelection(root, manifest()).restriction;
  assert.throws(() => parseRestriction({ ...restriction, allowed: { ...restriction.allowed, extra: [] } }), /allowed must list/);
  assert.throws(() => parseRestriction({ ...restriction, allowed: { ...restriction.allowed, roles: ['Copy'] } }), /unsafe role/);
  assert.throws(() => parseRestriction({ ...restriction, allowed: { ...restriction.allowed, skills: [PARENT_SKILL, REVIEW_SKILL, '../x'] } }), /unsafe skill/);
  assert.throws(() => parseRestriction({ ...restriction, allowed: { ...restriction.allowed, workflows: ['Not-a-workflow'] } }), /unsafe workflow/);
});

test('missing restriction is a no-op; present restriction is automatic at the install root', t => {
  const dir = mkdtempSync(join(tmpdir(), 'domain auth '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  authorizeLoadedAssignment(dir, assignment('copy', { skills: ['write-copy'] }));
  assert.equal(loadRestriction(dir), null);
  const restriction = resolveDomainSelection(root, manifest()).restriction;
  writeFileSync(join(dir, RESTRICTION_NAME), `${JSON.stringify(restriction, null, 2)}\n`);
  authorizeLoadedAssignment(dir, assignment('parent'));
  assert.throws(() => authorizeLoadedAssignment(dir, assignment('copy')), /forbids role copy/);
});

test('knowledge handles accept kebab or scope:name; roots stay outside the product', t => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'knowledge roots ')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'notes'));
  const notes = realpathSync(join(dir, 'notes'));
  const config = { schemaVersion: KNOWLEDGE_ROOTS_SCHEMA_VERSION, roots: { 'vault:notes': notes, playbook: notes } };
  assert.equal(resolveKnowledgeRoot('vault:notes', config, { productRoot: root }), notes);
  assert.equal(resolveKnowledgeRoot('playbook', config, { productRoot: root }), notes);
  assert.throws(() => resolveKnowledgeRoot('vault:notes', config, { productRoot: dir }), /outside the product package/);
  assert.throws(() => parseDomainManifest(manifest({ knowledgeHandles: ['../secret'] })), /logical identifiers/);
});

test('skill staging follows restriction without hiding undeclared siblings later', () => {
  const selection = resolveDomainSelection(root, manifest());
  assert.equal(shouldStageSkillPath('skills/diagnose-growth/SKILL.md', selection), true);
  assert.equal(shouldStageSkillPath('skills/write-copy/SKILL.md', selection), false);
  assert.equal(shouldStageSkillPath('skills/conquistador/specialists/data-diagnosis-agent.md', selection), true);
  assert.equal(shouldStageSkillPath('skills/conquistador/specialists/copy-agent.md', selection), false);
  assert.equal(shouldStageSkillPath('docs/USAGE.md', selection), true);
});

test('restriction file must be a regular file', t => {
  const dir = mkdtempSync(join(tmpdir(), 'restriction link '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, RESTRICTION_NAME));
  assert.throws(() => loadRestriction(dir), /regular file/);
  rmSync(join(dir, RESTRICTION_NAME), { recursive: true });
  symlinkSync(dir, join(dir, RESTRICTION_NAME));
  assert.throws(() => loadRestriction(dir), /regular file/);
});
