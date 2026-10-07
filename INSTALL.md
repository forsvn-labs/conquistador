# Install Conquistador

The install guide moved to the docs site: <https://conquistador.forsvn.com/docs/install/overview>.
Its source is in this repository at [`docs-site/install/overview.mdx`](docs-site/install/overview.mdx).

You need Node 22.18 or later. In your project folder, run:

```sh
npx @forsvn/conquistador@latest
```

To keep the `conquistador` command, install it globally (use `-g`):

```sh
npm install -g @forsvn/conquistador
conquistador
```

Exact version from Git:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.3.0
```

| Topic | Page | Source |
|---|---|---|
| Install options and how they overlap | [Install options](https://conquistador.forsvn.com/docs/install/overview) | `docs-site/install/overview.mdx` |
| Agents, folders, and flags | [Coding agents](https://conquistador.forsvn.com/docs/install/coding-agents) | `docs-site/install/coding-agents.mdx` |
| MCP apps, hosted MCP, Executor, chat bots | [Install options](https://conquistador.forsvn.com/docs/install/overview) | `docs-site/install/` |
| Update, doctor, and remove | [Update, check, and remove](https://conquistador.forsvn.com/docs/install/update-remove) | `docs-site/install/update-remove.mdx` |
| Hosted and self-hosted MCP server | [Deployed agents](https://conquistador.forsvn.com/docs/hosted/overview) | `docs-site/hosted/` |
| Troubleshooting | [Troubleshooting](https://conquistador.forsvn.com/docs/troubleshooting) | `docs-site/troubleshooting.mdx` |
| Older routes (`conquistador project`, `--skills`, `--plugin`, `--mcp`, `--bot`, `--advanced`) | [Per-project installation guide](docs/INSTALL-PROJECT.md) | `docs/INSTALL-PROJECT.md` |
