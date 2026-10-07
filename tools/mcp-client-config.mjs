// Client configuration for the hosted MCP server with a personal token. The sign-up page and
// `conquistador login` print the same text, so the two never disagree.
// Claude Desktop sends custom headers only through the mcp-remote bridge, which needs Node.js.
export const MCP_REMOTE = 'mcp-remote@0.14.3';

export function clientConfigs({ url, token }) {
  const header = `Authorization: Bearer ${token}`;
  return [
    {
      client: 'Claude Code',
      where: 'Run this in a terminal.',
      text: `claude mcp add --scope user --transport http conquistador ${url} --header "${header}"`,
    },
    {
      client: 'Claude Desktop',
      where: 'Add this to claude_desktop_config.json, then restart Claude Desktop. It needs Node.js.',
      // No space after "Authorization:" in the argument: some platforms split arguments on spaces.
      text: JSON.stringify({ mcpServers: { conquistador: { command: 'npx', args: ['-y', MCP_REMOTE, url, '--header', 'Authorization:${CONQUISTADOR_AUTH}'], env: { CONQUISTADOR_AUTH: `Bearer ${token}` } } } }, null, 2),
    },
    {
      client: 'Cursor',
      where: 'Add this to ~/.cursor/mcp.json.',
      text: JSON.stringify({ mcpServers: { conquistador: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
    },
    {
      client: 'Any MCP client',
      where: 'Use the Streamable HTTP transport.',
      text: `URL: ${url}\nHeader: ${header}`,
    },
  ];
}
