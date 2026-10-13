import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, OWNED, pluginHome, projectFolders, readState } from './agents.mjs';
import { appById } from './mcp-apps.mjs';

// A row represents one removable registration or shared skill folder. Shared folders name all
// affected agents, so removing one cannot silently remove another agent's project skill.
export function managedInstalls(root) {
  const state = readState();
  const items = new Map();

  for (const agent of AGENTS.filter(agent => state.agents?.[agent.id])) {
    const step = agent.install(pluginHome()).find(step => step.skill || step.copy);
    const path = step ? (step.skill ?? step.copy)() : pluginHome();
    const id = agent.how === 'skill' ? `global:${path}` : `agent:${agent.id}`;
    const item = items.get(id) ?? { id, label: '', surface: 'agents', scope: 'global', path, agents: [], labels: [] };
    item.agents.push(agent.id); item.labels.push(agent.label); item.label = item.labels.join(', ');
    items.set(id, item);
  }

  for (const folder of projectFolders(root).filter(folder => existsSync(join(folder.path, OWNED)))) {
    items.set(`project:${folder.path}`, { id: `project:${folder.path}`, label: folder.agents.map(agent => agent.label).join(', '), surface: 'agents', scope: 'project',
      path: folder.path, agents: folder.agents.map(agent => agent.id) });
  }

  for (const [id, installed] of Object.entries(state.mcpApps ?? {})) {
    const app = appById(id);

    if (app) items.set(`app:${id}`, { id: `app:${id}`, label: app.label, surface: 'mcp-apps', app: id, path: installed.path });
  }

  if (state.executor) items.set('executor', { id: 'executor', label: 'Executor', surface: 'executor', slug: state.executor.slug, path: `Source: ${state.executor.name ?? state.executor.slug}` });

  return [...items.values()];
}
