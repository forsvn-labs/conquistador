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
    const sandbox = await ctx.getSandbox();
    // Both interpolated values passed the restricted ASCII validation above.
    // Resolve symlinks inside the sandbox before reading any reference bytes.
    const location = await sandbox.run({ command: `
base=$(readlink -f "$HOME/.agents/skills") || exit 1
file=$(readlink -f "$HOME/.agents/skills/${skill}/${path}") || exit 1
case "$file" in "$base/${skill}/"*) printf '%s' "$file" ;; *) exit 1 ;; esac`, abortSignal: ctx.abortSignal });
    if (location.exitCode !== 0 || !location.stdout.startsWith('/')) throw new Error('Select a contained text reference from an installed skill.');
    const stream = await sandbox.readFile({ path: location.stdout, abortSignal: ctx.abortSignal });
    if (!stream) throw new Error('Skill reference was not found.');
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    let text = '', bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64 * 1024) throw new Error('Skill reference exceeds 64 KiB.');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) throw new Error('Skill reference exceeds 64 KiB.');
    return { skill, path, text };
  },
});
