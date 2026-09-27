# Read-only Conquistador playbook MCP server over HTTP, for bots and remote apps.
# Build from the repository root:  docker build -f mcp/Dockerfile -t conquistador-mcp .
# Run:  docker run -p 8787:8787 -e CONQUISTADOR_MCP_TOKEN=secret conquistador-mcp
# Core Node modules only; no dependency install.
FROM node:24-alpine
WORKDIR /app
COPY package.json LICENSE NOTICE.md ./
COPY skills ./skills
COPY mcp/server.mjs ./mcp/server.mjs
COPY tools/skills-mcp.mjs tools/mcp-http.mjs tools/brief.mjs tools/context-selection.mjs tools/request-text.mjs tools/routing-contract.mjs tools/domain-package.mjs tools/method-library.mjs tools/plugin-contracts.mjs ./tools/
ENV PORT=8787 CONQUISTADOR_CACHE=/tmp/conquistador-cache
EXPOSE 8787
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "mcp/server.mjs", "--http", "--host", "0.0.0.0"]
