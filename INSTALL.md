# Install Conquistador

Choose one method. You do not need all of them. The repository is private for dogfooding, so your
GitHub account needs access. Use Node 24 and Git for the commands below.

## Skills, recommended

From your project, run:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 add "forsvn-labs/conquistador#dogfood/0.1.0" --skill conquistador
```

The installer detects your agent or asks you to choose one. This installs one Conquistador entry point with all 38
outcome methods. Your existing agent supplies the model and tools. Refresh the host and ask
`/conquistador` for a task, or select it in the host's skill picker.

Remove it from the same project with:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 remove conquistador
```

To update this project, preserve local edits and repeat the same `skills add` command.
Agent-run installers can overwrite an existing copy without a prompt. [Other installation scopes](docs/INSTALL-REFERENCE.md#update-or-remove-an-installation)
keep their own update and removal commands.

## Plugins

If you prefer your host's plugin manager, register this repository directly. No separate clone is needed.
For Claude Code, run these in the project:

```sh
claude plugin marketplace add forsvn-labs/conquistador@dogfood/0.1.0 --scope local
claude plugin install conquistador@conquistador --scope local
```

Use the namespaced `/conquistador:conquistador` skill or select the Conquistador agent.
To remove it while keeping plugin data:

```sh
claude plugin uninstall conquistador@conquistador --scope local --keep-data
```

[Codex, Copilot and other plugin hosts](docs/PLATFORMS.md#plugins) have their own commands.
Use the same manager and scope for updates and removal.

## MCP over stdio

Add this server to your MCP client's configuration:

```json
{
  "mcpServers": {
    "conquistador": {
      "command": "npx",
      "args": [
        "--yes",
        "--ignore-scripts",
        "--package=git+https://github.com/forsvn-labs/conquistador.git#dogfood/0.1.0",
        "conquistador",
        "mcp"
      ]
    }
  }
}
```

The client starts and stops the process. Git must already have access to the private repository in
that client's environment. This downloads the package into npm's cache; it does not install a global
CLI or need a public npm package.

The local server lists and reads the bundled methods. Ask your agent to use Conquistador and read
its parent guide first. Your host supplies the model, file tools and approvals. No API key, HTTP
service or background daemon is required. Remove the `conquistador` entry to disconnect it.

[The MCP reference](docs/PLATFORMS.md#mcp) explains tools, updates and the optional runtime bridge.

## Clone, if you want a local copy

```sh
gh repo clone forsvn-labs/conquistador -- --branch dogfood/0.1.0 --single-branch
node conquistador/tools/setup.mjs
```

The guide prepares files for your host. Run it again for status, update or uninstall; it recognizes
the installed folder by its receipt and preserves edited files. Keep the source available for
updates and removal. See [managed setup](docs/PLATFORMS.md#coding-agents-recommended).

You can also run setup on demand without a clone:

```sh
npm exec --yes --ignore-scripts --package=git+https://github.com/forsvn-labs/conquistador.git#dogfood/0.1.0 -- conquistador setup
```

For noninteractive setup, supply the action, host and absolute project path. The same launcher
supports `status`, `update` and `uninstall` with an owned `--path`. Keep npm's cache available while
an MCP client uses a command from it. Download the current source before updating installed files.

## First task and help

Try a [first task](docs/USAGE.md). Keep installed copies out of public commits while dogfooding.
If GitHub denies access, authenticate the correct account. If `gh` works but HTTPS Git does not,
`gh auth setup-git` configures Git to use that account. Never put a token in a command or MCP configuration. A host may require a refresh or explicit plugin/skill activation.

The frozen v0.1.0 ZIP predates these shortcuts; use its [manual installation reference](docs/INSTALL-REFERENCE.md).
Custom harnesses and experimental Grok Bot/Eve contracts remain in [platform details](docs/PLATFORMS.md).
