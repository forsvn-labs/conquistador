# Install Conquistador

The next proposed channel is `private-alpha`. These operator changes have not shipped. Product
version remains 0.1.0. The channel commands below become usable only when the owner makes that
private Git branch available. No tag or release is implied. Until then, use a supplied complete
npm tarball, source copy, or ZIP containing this implementation.

## Project operator, recommended

Use Node 24, npm, Git, a coding agent that can read project files, and a GitHub account with access
to the private repository. From the receiving project, run this command after `private-alpha`
exists:

```sh
npx -y --ignore-scripts 'forsvn-labs/conquistador#private-alpha' install
npx -y --ignore-scripts 'forsvn-labs/conquistador#private-alpha' operator doctor
```

`npx` obtains the package through Git and runs its declared `conquistador` executable from
npm's cache. It does not add a dependency, `node_modules`, or a lockfile to the receiving project.
Use the exact release tag or commit from the private-alpha release notes when repeatable bytes
matter; the channel branch can advance. If GitHub denies access, authenticate the intended account
and run `gh auth setup-git`. Do not put a token in the command.

This creates `.conquistador-operator/` with `agent/agent.json`, the parent and 38 methods under
`agent/skills/`, the operator profile, contract schemas, compatibility v1 metadata, and
`hosts/coding-agent/`. The `harness` target with `--path ABS` installs the same single-agent package.
Keep the folder private and outputs outside it. No global CLI, host registration, daemon, poller,
background capture, or external operation starts. No source checkout or development bootstrap is
required.

If you received the release tarball, npm and Bun can execute that exact local file:

```sh
npx -y --ignore-scripts \
  --package=/absolute/path/forsvn-conquistador-0.1.0.tgz conquistador install

bunx --package /absolute/path/forsvn-conquistador-0.1.0.tgz \
  conquistador install
```

Choose one command. The Bun launcher follows the package's Node shebang, so Node 24 remains a
prerequisite. For this private repository, use the release tarball with Bun; the private HTTPS Git
form is not a supported path. Verify a downloaded tarball against the release `SHA256SUMS` before
running it.

### Capability parity

The package transport must not change the installed operator. These routes install the complete
operator into `.conquistador-operator/`:

| Transport | Command input | Capability contract |
| --- | --- | --- |
| npm private Git | Exact branch, tag, or commit | Complete operator |
| npm tarball | Verified release `.tgz` | Complete operator |
| Bun tarball | The same verified release `.tgz` | Complete operator |
| Source clone or ZIP | The same release source | Complete operator |

For the same release bytes, each route must produce the same managed receipt digest. `operator
doctor --json` must report 38 methods, the operator profile, and the BB adapter. It also reports
host activation and task execution as unverified until the host runs a task. Release validation
must fail if a transport omits a method, schema, agent contract, profile, or adapter.

Skills, plugins, and MCP below connect Conquistador to specific hosts. They have their own discovery
and execution behavior. A compact skill copy omits the BB adapter. Local MCP lists and reads methods
but does not run the complete operator. These integrations must not be presented as substitutes for
the complete operator unless they pass the same package and host checks.

Start a fresh host session in that project and ask:

```text
Read .conquistador-operator/agent/skills/conquistador/SKILL.md and follow it for
this task. Use docs/product.md and docs/audience.md to prepare our beta launch.
Deliver landing-page copy, one launch email and a two-week campaign plan in
docs/launch/. Mark claims that need evidence. Keep this as a draft.
```

Use your own inputs. This explicit file request loads the parent without assuming that your host
understands portable JSON agents. If the host cannot read files, choose a skills/plugin or MCP
route below. In BB, the explicit [team command](hosts/coding-agent/README.md#run-a-team) executes
specialists when needed. Setup does not automatically call it or register project routing.

The installed profile defaults to `manual`. A host integration can call `admitRequest` at each
user turn with a host-owned `activation` override. `project` enables conservative request routing;
`off` makes the router abstain, including explicit invocation. No generic host setting is installed.
Keep activation settings outside the managed package. [Activation details](docs/MASTER-AGENT.md)
include the API and limits.

Use the same package source for each lifecycle command. For the private Git channel:

```sh
CONQUISTADOR_PACKAGE='forsvn-labs/conquistador#private-alpha'
npx -y --ignore-scripts "$CONQUISTADOR_PACKAGE" operator status
npx -y --ignore-scripts "$CONQUISTADOR_PACKAGE" operator doctor
npx -y --ignore-scripts "$CONQUISTADOR_PACKAGE" operator update
npx -y --ignore-scripts "$CONQUISTADOR_PACKAGE" operator uninstall
```

For an update, replace the package reference with the exact newer release tag or commit you intend
to install. Reuse the local tarball form when that is your distribution. Status verifies owned
files; doctor verifies library completeness. Both leave host activation and execution unverified.
Edited files cause update/removal to refuse. Preserve edits and use a new folder if needed. Before
removal, disable any host routing, detach the contract, and stop active teams. Uninstall leaves
host settings and running agents alone. Refresh the host after update/removal.

## Host skill integration

Use this integration when the host needs native skill discovery. The host decides which files it
loads and whether it can create specialist contexts, so installation alone does not establish full
operator parity. Its private-alpha command is proposed until the channel exists. For immediate use,
install from the [supplied local source](docs/INSTALL-REFERENCE.md#skillssh-from-a-local-source).


Use Node 24, Git, an existing coding agent, and a GitHub account with access to the private
repository. From the project where you want to use Conquistador, run:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 add "forsvn-labs/conquistador#private-alpha" --skill conquistador
```

Choose your host when prompted. Keep `--skill conquistador` as shown. Do not add `--full-depth`,
`--skill '*'`, or `--all`. Do not install only the nested `skills/conquistador` folder: it needs
its sibling methods. The pinned root install copies the complete bundle.

### First task

Start a fresh host session in the receiving project. Select `/conquistador`, `$conquistador`, or
the host's skill picker, then give it a real task:

```text
/conquistador Use docs/product.md and docs/audience.md to prepare our beta
launch. Deliver landing-page copy, one launch email and a two-week campaign
plan in docs/launch/. Mark claims that need evidence. Keep this as a draft.
```

Use your own paths, or paste the relevant facts. Expect finished copy, a plan, evidence gaps, and
for this multi-part task a short engagement brief plus an execution receipt. Review the output.
[More task examples](docs/USAGE.md) explain direct work, isolated teams, same-context review,
project activation, inputs, corrections, and follow-up. No provider account, Executor service, or
runtime is required for work based on supplied context.

### What successful installation means

Check these separately:

1. Run `DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 list` from the same project to check inventory.
   Confirm the intended host and scope.
2. Use the doctor below to check local file completeness.
3. Start a fresh session and finish the first task. A listing or doctor result cannot
   establish activation or the quality of that result.

The normal destination is `.agents/skills/conquistador/`, with host links or copies as selected
by the installer. Inside it are root `SKILL.md`, `skills/conquistador/SKILL.md`, all outcome
folders under `skills/`, the operator profile, supporting docs, `release/completeness.json`, tools, and runtime source.
The code files are available but do not start automatically. Skill installation adds no global CLI,
daemon, watcher, or schedule. The operator profile defaults to `manual` activation.

Managed compact setup places methods under `library/` and omits `hosts/coding-agent/`. It is a
reduced integration. Plugin and operator/harness packages include that BB adapter. All three include
the methods, but executing specialists still depends on the host. [Platform details](docs/PLATFORMS.md)
describe locations and host registration.

### Read-only completeness check

For a root skill copy that contains the doctor, run from the receiving project:

```sh
node .agents/skills/conquistador/runtime/bin/conquistador.js operator doctor \
  --path "$PWD/.agents/skills/conquistador"
```

Adjust the path if your installer chose another location. From a complete source checkout or
extracted distribution, inspect any supported installed copy with:

```sh
node runtime/bin/conquistador.js operator doctor --path /absolute/path/to/installation --json
```

Omit `--json` for readable output. Expect:

```text
38 methods available; local files verified; host activation and task execution unverified.
```

The doctor compares method versions, content hashes, and supporting resources with its release
manifest. It reports source Git identity and cleanliness where available, managed receipt
integrity, operator-profile presence, and product version where present. A copy without Git has an
unknown source commit. A digest does not prove provenance, routing, or load methods into model
context. Files ready is not host activation. If the host cannot activate the operator package,
the first task should explain that host's invocation step.

For managed MCP, it also checks the saved Node executable and package script, then the library the
script resolves to. A matching receipt cannot hide paths lost after a source move, Node replacement,
or npm-cache cleanup. The check changes no files, runs no saved executable, and contacts no service.

Exit code 0 means local checks passed; 1 means a failed check or invalid input. Domain-restricted
and standalone method installs do not satisfy this full-library check. If manifests differ, use
the doctor from the same release or preserve edits and reinstall. Older releases, including
`v0.1.0-dogfood.3`, predate this doctor; use a complete source/distribution that includes it.
Bare `conquistador doctor` is the separate runtime diagnostic.

### Recovery

| Symptom | Action |
| --- | --- |
| GitHub denies access | Sign in with the account that has repository access. If `gh` works but HTTPS Git fails, run `gh auth setup-git` and retry. |
| Installed in the wrong project or scope | Remove through the original installer in that scope, then install from the intended project for the intended host. |
| Listed but missing in the host | Check the project, host, and scope; start a fresh session. Plugin installs use the host's plugin invocation. |
| Doctor reports missing or changed files | Preserve edits, then repair or reinstall through the original installer. Do not rewrite the receipt to force a pass. |
| Doctor passes but the task fails | Record the host, build, task, and failure in private-alpha notes. Local completeness does not prove execution. |
| Managed MCP has stale executable paths | Restore the source/package or recreate the connector with the current Node installation. Update the client's registration if its path changed. |

Never place tokens in chat, commands, or MCP configuration. [Dogfood notes](docs/PRIVATE-ALPHA.md) keep
observations separate from installation checks.

### Update or remove the skill

Preserve local edits before updating, then repeat the same pinned `skills add` command in the same
project and scope. The branch can advance, and an agent-run installer can replace files without a
prompt. Keep outputs outside the installed folder. After updating, check completeness, refresh the
host, and repeat a small task.

Remove from the original project with:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 remove conquistador
```

Use the original plugin manager or managed installer for copies it owns. The
[deep reference](docs/INSTALL-REFERENCE.md#update-or-remove-an-installation) lists their lifecycles.

## Alternatives

Choose one route. None is an additional prerequisite for the recommended operator install.

### Plugins

For Claude Code, run from the receiving project:

```sh
claude plugin marketplace add forsvn-labs/conquistador@private-alpha --scope local
claude plugin install conquistador@conquistador --scope local
```

Use `/conquistador:conquistador` or select the Conquistador agent. The host owns activation and
updates. [Plugin commands](docs/PLATFORMS.md#plugins) cover Claude, Codex, and Copilot, including
removal. Keep the original scope and manager.

### MCP over stdio

For an MCP client, add:

```json
{
  "mcpServers": {
    "conquistador": {
      "command": "npx",
      "args": [
        "--yes",
        "--ignore-scripts",
        "--package=git+https://github.com/forsvn-labs/conquistador.git#private-alpha",
        "conquistador",
        "mcp"
      ]
    }
  }
}
```

Git in the client's environment must have private repository access. The package stays in npm's
cache; no public npm package or global CLI is required. The client starts and stops the process.
It lists and reads methods; your agent supplies the model, project tools, and permissions. Ask it
to read the parent guide first. Remove the client entry to disconnect.
[The MCP reference](docs/PLATFORMS.md#mcp) covers updates and the separate runtime bridge.

### CLI setup

The recommended package runner also opens the interactive guide:

```sh
npx -y --ignore-scripts 'forsvn-labs/conquistador#private-alpha' setup
```

For other targets, select them in that guide or replace the operator arguments. The command can
prepare an owned compact copy, plugin folder, or MCP connector. Status checks local integrity;
doctor checks completeness. Neither registers or activates the host. Keep the cached package
available while a saved MCP connector points to it.

### Clone for recovery or development

```sh
gh repo clone forsvn-labs/conquistador -- --branch private-alpha --single-branch
node conquistador/runtime/bin/conquistador.js install --project /absolute/path/to/receiving-project
```

Use a separate receiving project. Keep the source for managed updates and removal. This path is
useful when the package runner cannot use your Git credentials or when you need to inspect the
source before installation. For frozen ZIPs, custom hosts, and runtime operators, use the
[manual reference](docs/INSTALL-REFERENCE.md).

## Optional account and job hosts

Start the task before setting up accounts. When missing live access blocks it, Conquistador helps
connect Executor and resumes the work. Eve is for explicitly requested durable jobs. The runtime
executes its declared playbooks, not all 38 methods. None starts during skill installation.
[Accounts and durable jobs](docs/INTEGRATIONS.md) explains these paths and their separate checks.
