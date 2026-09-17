# Conquistador 0.0.7

Conquistador helps your coding agent do growth, marketing, sales, product and knowledge work.
Give it an outcome and the relevant facts. It selects from 38 methods, names the specialists it
uses, and returns a draft with review findings. Your coding agent supplies the model and tools.

This checkout prepares private alpha `0.0.7`. It is not released yet. The latest shipped private
alpha is [v0.0.6](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.6).
Private alpha and dogfood are the same `0.0.x` channel. Public alpha starts at `0.1.0`.

## Install once, use in each project

Use Node 24 and a GitHub account with access to this private repository. When `v0.0.7` ships:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.7
```

Then open a terminal in the project where you want to use it:

```sh
conquistador
```

The first command downloads the CLI once. Later launches start from your installed copy, without
asking GitHub or npm to resolve the package again. `--ignore-scripts` skips automatic npm hooks.
`--install-links` makes npm copy the private Git checkout into its durable global location; without
it, npm 11 can leave the executable linked to temporary acquisition files. No package is published
to the npm registry. GitHub authentication must already work; use
`gh auth setup-git` if your authorized Git client needs configuration.

The guide asks where you will use Conquistador, which coding agent you use, and confirms the
folders it will create. It installs the complete operator in `.conquistador/` and a discoverable
skill for your chosen host. No receiving-project package manifest, dependency or lockfile is added.

```text
.conquistador/
  SKILL.md           Start here
  README.md          Usage and lifecycle
  library/           All 38 methods and their resources
  agent/agent.json   Portable operator contract
  hosts/             BB specialist adapter
.agents/skills/conquistador/   Codex / BB skill, when selected
```

Claude Code, Cursor and Copilot get their own project skill directory. Each host sees one
Conquistador entry; the internal methods load after routing. The full operator retains the
profile, contracts, schemas and BB adapter. The guide also supports skill-only, plugin, harness,
squad and MCP installations. See [installation options](INSTALL.md).

## Start your first task

Open a fresh coding-agent session in that project. Select Conquistador from the skills menu, or ask:

```text
Use Conquistador to draft a launch plan from the product facts in this project.
Show the selected capabilities. Mark missing facts. Keep it as a draft.
```

If the host has not refreshed its skill list, ask it to read `.conquistador/SKILL.md` and follow it.
You do not need to navigate through adapter folders or install the specialists separately.

```sh
conquistador start              # Show the skill location and first task again
conquistador skills             # Browse the available capabilities
conquistador operator doctor    # Check local files and the owned skill copy
conquistador operator update    # Update this project from the installed CLI
conquistador operator uninstall # Remove both unchanged owned copies
```

To upgrade the CLI itself, install the next authorized version with npm, then update the project.
Existing `.conquistador-operator` installations migrate through `conquistador operator update`.
Modified files are preserved. Keep drafts and runtime data outside the owned installation.

## What installation proves

Setup checks local completeness and places the skill in the selected host's discovery directory.
The host loads it in a fresh session. Native discovery and task quality still need a real task in
that host. Installation starts no watcher, hook or service and grants no external-action authority.
The BB adapter supports explicit specialist teams with exact-artifact review. Automatic project
routing requires a host integration. See [execution modes](docs/MASTER-AGENT.md).

Work based on supplied facts needs no connected account. If a task needs live access, follow
[connection setup](docs/INTEGRATIONS.md). Review drafts before use. Publication, spend, sends,
external writes, saved memory and feedback disclosure retain their applicable human decisions.

The repository stays private and npm publication stays disabled. See [private-alpha acceptance](docs/PRIVATE-ALPHA.md),
[version policy](VERSIONS.md), [release history](CHANGELOG.md), and [development](CONTRIBUTING.md).
