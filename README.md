# Conquistador 0.1.0

Conquistador is a project operator for growth, go-to-market, sales, marketing, and product work
in your coding agent. Give it an outcome and the relevant facts. The parent selects from 38
outcome methods, assigns specialist work when useful, integrates the drafts, and reports review
findings. Your host supplies the model, tools, permissions, and any separate worker contexts.

This source prepares the next private distribution channel, `private-alpha`. The operator changes
are unshipped. No private-alpha branch, tag, version, or release is created by these instructions.
Historical releases remain in [CHANGELOG.md](CHANGELOG.md). Review results before using them.

## Install in one project

Use Node 24, npm, Git, and a GitHub account with access to the private repository. From the
receiving project's root, run this command after the owner makes `private-alpha` available:

```sh
npx -y --ignore-scripts 'forsvn-labs/conquistador#private-alpha' install
npx -y --ignore-scripts 'forsvn-labs/conquistador#private-alpha' operator doctor
```

`npx` keeps Conquistador in npm's cache. It does not add a dependency, `node_modules`, or a
lockfile to the receiving project. The managed folder `.conquistador-operator/` contains the
parent, all methods, the operator profile, portable agent contracts, and the BB adapter. Keep it
out of public commits and keep your outputs elsewhere. Installation starts no global CLI, service,
hook, polling, or transcript capture.

If GitHub denies access, authenticate the intended account and run `gh auth setup-git`; do not put
a token in the command. Until the channel exists, use the supplied npm tarball, source, or ZIP.
Bun users can execute the supplied tarball with `bunx`; the private Git URL is not the documented
Bun path. Every full operator transport installs the same package and must pass the same doctor
checks. Compact skills and MCP are limited host integrations, not equivalent operator installs.
Do not substitute an old dogfood release for this operator. [INSTALL.md](INSTALL.md) covers Bun,
exact release references, lifecycle commands, source recovery, skills, plugins, and MCP.

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
