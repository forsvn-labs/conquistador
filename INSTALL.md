# Set up Conquistador

Use **one guided setup command**. It asks where you want to use Conquistador, chooses the right
package and prints the next step. For everyday work, choose your coding agent. You get the complete
`/conquistador` skill and all 38 methods, with no runtime service or model account to configure.

You can ask your existing agent:

```text
Install Conquistador in this project from the private forsvn-labs/conquistador
repository, branch dogfood/0.1.0. Follow INSTALL.md and use the managed setup
for this host. Keep the copy private, check its files and show me how to uninstall it.
```

You handle private repository access and any host approval. The agent handles routine local setup.
Keep the installed folder out of public project commits.

## Recommended quick start

Use Node 24. Clone the current private source into a separate folder, then start setup:

```sh
gh repo clone forsvn-labs/conquistador /absolute/path/conquistador -- --branch dogfood/0.1.0 --single-branch
node /absolute/path/conquistador/tools/setup.mjs
```

Replace the example path with a new folder. Choose your coding agent and the project where you
want the skill. Setup prints the destination, local status and activation instructions. Start a
fresh host session, select Conquistador and try [a first task](docs/USAGE.md).

The source folder supplies updates and removal. Keep it available. Setup copies the method
library, not your development dependencies. It does not edit global host settings or start services.
If GitHub denies access, use the right account or request private access. Do not paste credentials
into chat. The frozen v0.1.0 ZIP uses the [older manual commands](docs/INSTALL-REFERENCE.md).

## Update or remove an installation

Use the same setup command again and choose **Status**, **Update** or **Uninstall**. For scripts or
an agent, use the destination printed during installation:

```sh
node /absolute/path/conquistador/tools/setup.mjs status --path /absolute/path/installed-conquistador
node /absolute/path/conquistador/tools/setup.mjs update --path /absolute/path/installed-conquistador
node /absolute/path/conquistador/tools/setup.mjs uninstall --path /absolute/path/installed-conquistador
```

You do not need to remember the original install mode. Obtain the current source before updating;
updating an installed copy does not fetch a release. Setup checks its receipt and refuses to replace
or remove files that you edited. Keep project outputs outside the installed folder.

For plugins and MCP, host registration is a separate step. Disconnect or uninstall in the host
first, then remove the prepared files. Setup prints the relevant instructions and does not claim
the host is connected. It does not erase runtime data, project work, model credentials or shared
host configuration. [Platform details](docs/PLATFORMS.md) pair setup and removal for each route.

Existing skills.sh copies and host-managed plugins keep their original owner. Use their
[update and removal commands](docs/INSTALL-REFERENCE.md#update-or-remove-an-installation);
the managed setup will not take over or delete an unowned installation.

## Where do you want to use it?

| Where | What setup prepares | What you do next |
| --- | --- | --- |
| Codex, Claude Code, Copilot or Cursor | Complete skill in that agent's project folder | Refresh host discovery and use Conquistador |
| A host's plugin manager | One plugin bundle, including the native Claude agent | Run the displayed host registration commands |
| An MCP client | Connector configuration for an existing Conquistador service | Add it to the client; service and model setup stay separate |
| Your own agent host | A complete single-agent package or separate worker/reviewer contracts | Load the contracts through your host adapter |
| Grok Bot or Eve | Experimental instructions only | Native import is unverified; use a supported coding agent for now |

Choose only the row that matches where you work. [Platform details](docs/PLATFORMS.md) cover host
commands, scopes and removal. Skills.sh, Agent Plugins and Docker are available in the
[manual reference](docs/INSTALL-REFERENCE.md) when your setup needs them.

For noninteractive coding-agent setup, name the host and project. For example:

```sh
node /absolute/path/conquistador/tools/setup.mjs install --target codex --project /absolute/path/your-project
```

Supported coding-agent names are `codex`, `claude-code`, `copilot` and `cursor`. Other hosts can
use an explicit destination with `--target skill --path ...`; the host must support that skill
folder. If the CLI is already installed, `conquistador setup` opens the same guide.

## Help

| Message | Next step |
| --- | --- |
| Missing or modified receipt | Preserve the existing folder and choose a new destination; do not edit the receipt |
| Prepared, activation unverified | Complete host registration or refresh discovery, then try a task |
| MCP service is unavailable | Check the service and model configuration in [runtime setup](runtime/README.md) |
| Host command is unavailable | Use the recommended skill route, or follow that host's current plugin controls |

Previews and opted-in reminders are prepared when needed. See [Lavish previews](docs/PREVIEW.md)
and [proactive help](docs/PROACTIVE.md). Setup does not enable hooks, persist learning or authorize
publication. [Usage](docs/USAGE.md) explains what to ask for after installation.
