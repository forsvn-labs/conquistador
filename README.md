# Conquistador 0.0.5

Conquistador is a project operator for growth, go-to-market, sales, marketing, and product work
in your coding agent. Give it an outcome and the relevant facts. The parent selects from 38
outcome methods, assigns specialist work when useful, integrates the drafts, and reports review
findings. Your host supplies the model, tools, permissions, and any separate worker contexts.

Version `0.0.5` is the fifth private alpha, continuing the earlier dogfood releases on the
`private-alpha` branch. Private alpha and dogfood are one channel. The future public alpha starts
at `0.1.0`. See [version policy](VERSIONS.md) and [release history](CHANGELOG.md). Review drafts before use.

## Install in one project

Use Node 24, npm, Git, and a GitHub account with access to the private repository. From the receiving
project, run the pinned private release:

```sh
npx -y --ignore-scripts --package=git+https://github.com/forsvn-labs/conquistador.git#v0.0.5 conquistador setup
```

Press Enter for the complete project operator, review the destination, and confirm once. Setup
checks local completeness and prints the first task. It does not register or activate your host.
For automation, replace `setup` with `install`, then run `operator doctor` through the same launcher.

Native skill and staged plugin installs show one Conquistador entry. The parent selects from a
compact internal catalog, shows the relevant public capability and specialist names during work,
and loads only the selected methods. All 38 methods and their resources remain bundled. Individual
specialists are an explicit installation choice, not additional default globals.

The operator folder `.conquistador-operator/` contains the parent, all 38 methods, the manual
operator profile, portable contracts and schemas, and the BB adapter. Keep it out of public
commits and keep outputs elsewhere. The launcher adds no receiving-project dependency manifest,
`node_modules`, or lockfile. Installation starts no service, hook, watcher, or transcript capture.

The guide also explains native plugins, skills, portable agents, and MCP connectors. Each route
states its capability and update owner. Native plugins use their host manager for activation.
[INSTALL.md](INSTALL.md) covers checksum-verified release tarballs, the optional persistent CLI,
Bun, and source/ZIP recovery. This release is verified on macOS with Node 24. Native Windows/Linux
installation and native Codex, Claude, Copilot, Cursor, Eve, and Grok registration remain unverified.

## Start a task

Open a fresh host session in the receiving project and ask:

```text
Read .conquistador-operator/agent/skills/conquistador/SKILL.md and follow it for
this task. Use docs/product.md and docs/audience.md to prepare our beta launch.
Deliver landing-page copy, one launch email, and a two-week campaign plan in
docs/launch/. Mark claims that need evidence. Keep this as a draft.
```

Use your own input paths or paste the facts. This explicit file invocation works without a native
skill registration. If your host cannot read project files, use its skill or MCP route in INSTALL.
The portable JSON contract does not register a native host agent by itself.

For a substantial task, the parent should present an engagement brief and return one deliverable
with an execution receipt. Separate contexts, when used, must have public role labels. Same-context
review must be identified. The [BB adapter](hosts/coding-agent/README.md) provides the executable
team path with exact-digest reviews; ordinary skill use relies on the host following the contract.
A passing doctor checks local files, not host activation or output quality.

Activation defaults to `manual`. Project routing needs a host adapter that calls `admitRequest`
at turn start; setup does not wire it into BB or another host. `off` disables that router, including
explicit admission. See [activation and execution](docs/MASTER-AGENT.md).

## Use accounts only when needed

Work based on supplied facts needs no Executor account. If live access blocks the task, follow
[connection setup](docs/INTEGRATIONS.md). Publication, spend, sends, external writes, saved memory,
and feedback disclosure retain their applicable human decisions. The BB draft adapter authorizes
none of these actions; host permissions enforce access.

The repository stays private and npm publication stays disabled. Keep private knowledge and
credentials outside the installed product. Use the [private-alpha checklist](docs/PRIVATE-ALPHA.md)
for observed results and limits. Development starts with [CONTRIBUTING.md](CONTRIBUTING.md).
