import { defineTool } from 'eve/tools';

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
    const text = await ctx.getSkill(skill).file(path).text();
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) throw new Error('Skill reference exceeds 64 KiB.');
    return { skill, path, text };
  },
});
