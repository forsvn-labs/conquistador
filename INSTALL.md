# Install Conquistador

The default installs one entry point with all 38 outcome methods. Keep installed copies private
while dogfooding.

## Skills, recommended

Use Node 24, Git, an existing coding agent, and a GitHub account with access to the private
repository. From the project where you want to use Conquistador, run:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 add "forsvn-labs/conquistador#dogfood/0.1.0" --skill conquistador
```

The installer detects your agent or asks you to choose one. Keep `--skill conquistador` exactly as
shown. Do not add `--full-depth`, a `--skill` wildcard, or `--all`, and do not install the nested
`skills/conquistador` folder. Your existing agent supplies the model and tools.

### First task

Start a fresh host session in that project. Select Conquistador through `/conquistador`,
`$conquistador`, or the host's skill picker, then give it a task:

```text
/conquistador Use docs/product.md and docs/audience.md to prepare our beta
launch. Deliver landing-page copy, one launch email and a two-week campaign
plan in docs/launch/. Mark claims that need evidence. Keep this as a draft.
```

Replace the paths with files your host can read. Expect finished copy, a plan and stated evidence
gaps. Review the result. See [usage examples](docs/USAGE.md) for other tasks.

### Inventory and installed files

List installed skills from the same project:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 list
```

Expect `conquistador` in the intended scope. This is an inventory check; it does not verify that
the host activated the skill or completed a task.

The normal root payload at `.agents/skills/conquistador/` includes:

```text
.agents/skills/conquistador/
├── SKILL.md
├── skills/
│   ├── conquistador/SKILL.md
│   └── ... outcome methods
├── docs/
├── hosts/coding-agent/
├── tools/
└── runtime/
```

The root install with skills.sh 1.5.26 is complete. It is not a thin stub. Host-specific locations
may differ. Managed compact setup uses `library/` instead of `skills/` and omits the BB adapter
at `hosts/coding-agent/`. Plugin and single-agent harness packages include that adapter.
See [platform details](docs/PLATFORMS.md#coding-agents-recommended).

### Recovery

| Symptom | Next step |
| --- | --- |
| Installed in the wrong project or scope | Use the original installer to remove the unintended copy in its original scope, then run the default command from the intended project and select the intended host |
| Listed but missing in the host | Start a fresh session in the installed project; check the selected host and scope, or the plugin namespace for a plugin install |
| GitHub denies access | Authenticate the account with private repository access; if `gh` works but HTTPS Git fails, run `gh auth setup-git` and retry |
| Parent or method files are missing | Preserve local edits, then reinstall the complete root bundle; use the completeness check below if you have the complete CLI |

Never put a token in a command or MCP configuration. A host may also require explicit skill or
plugin activation.

### Read-only completeness check

From a complete source checkout or distribution with the setup doctor command, run:

```sh
node runtime/bin/conquistador.js setup doctor --path /absolute/path/to/installation
node runtime/bin/conquistador.js setup doctor --path /absolute/path/to/installation --json
```

This is `conquistador setup doctor --path ABS [--json]` through the complete CLI. Skill installation
does not put `conquistador` or a root `doctor` command on your PATH. The check reads local files for
a source/root skill, managed compact install, plugin or single-agent harness, or managed MCP saved
paths. It does not repair files, verify native host activation, or perform or verify account operations.
A successful diagnostic does not replace the fresh-session task above.

### Update or remove the skill

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

## Optional account and job hosts

The complete distribution includes `conquistador connections`, `conquistador jobs`, and
`conquistador integrations`. Start with `conquistador connections setup` to see whether Executor is
installed. [Accounts, tools, and durable jobs](docs/INTEGRATIONS.md) explains how Conquistador helps
install Executor, connect MCP, and add sources, plus the separate Eve app and update checks.
These optional hosts have their own private dependency manifests. Use their documented Bun
installation commands; do not symlink dependencies. No daemon, schedule, paid model, or provider
connection starts during ordinary skill installation.

The frozen v0.1.0 ZIP predates these shortcuts; use its [manual installation reference](docs/INSTALL-REFERENCE.md).
Custom harnesses and experimental portable Grok Bot/Eve contracts remain in
[platform details](docs/PLATFORMS.md). The optional Eve runtime has its own explicit setup described
in [accounts and durable jobs](docs/INTEGRATIONS.md).
[Master-agent modes](docs/MASTER-AGENT.md) states how each installed surface handles specialist
assignments, sequential fallback, and optional hooks.
