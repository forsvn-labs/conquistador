import { defineTool } from 'eve/tools';
import { readFile } from 'eve/tools/read_file';

export default defineTool({
  description: 'Read a contained reference from an installed canonical skill. No general filesystem access.',
  inputSchema: {
    type: 'object', additionalProperties: false, required: ['skill', 'path'],
    properties: { skill: { type: 'string' }, path: { type: 'string' } },
  },
  async execute({ skill, path }, ctx) {
    if (typeof skill !== 'string' || typeof path !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(skill) || path.length > 240 ||
        !/^[A-Za-z0-9_./-]+\.(md|txt|json|yaml|yml|csv|tsv)$/.test(path) ||
        path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
      throw new Error('Select a contained text reference from an installed skill.');
    }
    const result = await readFile.execute({ filePath: `$HOME/.agents/skills/${skill}/${path}`, limit: 2000 }, ctx);
    if (!('content' in result)) throw new Error('Skill reference did not return a text result.');
    const text = result.content;
    if (result.truncated) throw new Error('Skill reference was truncated. Select a smaller reference.');
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) throw new Error('Skill reference exceeds 64 KiB.');
    return { skill, path, text };
  },
});
