# Conquistador 0.0.10

Conquistador helps your coding agent do growth, marketing, sales, product and knowledge work.
Give it an outcome and the relevant facts. It selects from 38 methods, names the specialists it
uses, and returns a draft with review findings. Your coding agent supplies the model and tools.

The current private alpha is
[v0.0.10](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.10).
Private alpha and dogfood are the same `0.0.x` channel. Public alpha starts at `0.1.0`.

## Install once, use in each project

Use Node 24 and a GitHub account with access to this private repository:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.10
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

The planned public-alpha installation command is `npm i -g @forsvn/conquistador`. It does not work
for the current private alpha because the registry package does not exist and publication remains
blocked. It becomes the primary command only after the exact public package and clean registry
lifecycle are verified.

Plain `conquistador` installs one complete project operator. It chooses the package; you confirm.
If it cannot tell which coding agent you are using, it asks for one host. The happy path is one
confirmation. Architecture choices stay behind `conquistador --advanced` and explicit setup
commands. No receiving-project package manifest, dependency or lockfile is added.

```text
.conquistador/
  SKILL.md           Start here
  README.md          Usage and lifecycle
  library/           All 38 methods and their resources
  agent/agent.json   Portable operator contract
  hosts/             BB specialist adapter
.agents/skills/conquistador/   Codex native skill, when that host is selected
```

BB uses the complete operator and explicit team adapter. Setup does not register a BB plugin,
provider skill or request router. Claude Code, Cursor and Copilot get their own project skill
directory. Hermes Agent uses `conquistador --bot hermes` and a separate trust step. Each prepared
folder exposes one Conquistador entry; the internal methods load after routing. Hosts that scan
several compatible directories still need discovery checks. The full operator retains the profile,
contracts, schemas and BB adapter.

```sh
conquistador --bot hermes
conquistador --bot grok-bot
conquistador --skills [--host HOST]
conquistador --plugin [--host claude-code|codex|copilot|none]
conquistador --mcp [--host HOST]
conquistador --advanced
```

`install` keeps its documented Codex default. See [installation options](INSTALL.md).

## Start your first task

Open a fresh coding-agent session in that project. Select Conquistador from the skills menu, or ask:

```text
Use Conquistador to draft a launch plan from the product facts in this project.
Mark missing facts. Keep it as a draft.
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
Open a fresh session to check that the host discovers it. Native discovery and task quality
still need an observed task in that host. Installation starts no watcher, hook or service and grants no external-action authority.
Codex and Claude Code can opt into the project-local context hook in
[proactive help](docs/PROACTIVE.md): it ranks the installed methods for each prompt and injects the
relevant method, workflow, resource, and specialist paths. The BB adapter supports explicit
specialist teams with exact-artifact review. Other automatic project routing requires a host
integration. See [execution modes](docs/MASTER-AGENT.md).

Work based on supplied facts needs no connected account. If a task needs live access, follow
[connection setup](docs/INTEGRATIONS.md). Review drafts before use. Publication, spend, sends,
external writes, saved memory and feedback disclosure retain their applicable human decisions.

The repository stays private and npm publication stays disabled. See [private-alpha acceptance](docs/PRIVATE-ALPHA.md),
[version policy](VERSIONS.md), [release history](CHANGELOG.md), and [development](CONTRIBUTING.md).
