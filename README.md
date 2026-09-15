# Conquistador 0.1.0

Conquistador is a master agent for product, marketing, growth, and engineering work. Ask for an
outcome. It selects the relevant methods and, when the result crosses capabilities, assigns bounded
work to the specialist team the task needs. It integrates the deliverable, reviews it, and recommends
a next step.

All 38 outcome methods are included. Your host supplies the model, project files, tools and
permission controls. This is a private dogfood build.

## What you get

| Your task | What Conquistador helps deliver | Why it helps |
| --- | --- | --- |
| Prepare a launch | Campaign plan, finished copy, asset requirements and measurement plan | Keeps the audience, promise and next action consistent across the package |
| Improve onboarding or a landing page | Evidence-based diagnosis, revised content or requested implementation, and a test | Connects each change to an observed problem or a labeled assumption |
| Review campaign results | Keep, drop and test decisions with attribution limits | Turns supplied results into a bounded next experiment |
| Build or document a product | Flow or UI specifications, requested web/iOS code, or code-grounded documentation | Carries the requested work through review and reports verification gaps |

These are method contracts, not guarantees of quality or measured lift. See
[how to use Conquistador](docs/USAGE.md) for task inputs and expected deliverables, and
[capabilities and tools](docs/SERVICES.md) for implementation limits.
[Master-agent modes](docs/MASTER-AGENT.md) explains specialist execution across coding agents,
plugins, portable packages, MCP, and the optional runtime.

## Start here

Install the complete skill from your project:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 add "forsvn-labs/conquistador#dogfood/0.1.0" --skill conquistador
```

The installer detects your agent or asks you to choose one. Use Node 24 and a GitHub account with repository access.
No separate clone or runtime setup is needed.

Prefer a [native plugin](INSTALL.md#plugins), [MCP over stdio](INSTALL.md#mcp-over-stdio), or
[a local clone](INSTALL.md#clone-if-you-want-a-local-copy)? Choose that installation method instead.
[Installation and removal](INSTALL.md) keeps the steps for each method together.

Start a fresh host session and give Conquistador a task:

```text
/conquistador Use docs/product.md and docs/audience.md to prepare our beta
launch. Deliver landing-page copy, one launch email and a two-week campaign
plan in docs/launch/. Mark claims that need evidence. Keep this as a draft.
```

Expect finished copy and a plan with owners, timing, measurement and open evidence gaps.
[Usage and examples](docs/USAGE.md) explain inputs, review and follow-up requests.

You do not need to install every optional tool. Conquistador first inspects the CLI, MCP, warehouse,
and Executor routes already available, then prepares the narrow task prerequisite through the host.
For visual feedback, ask for a [Lavish preview](docs/PREVIEW.md). Credentials, paid services and
external actions retain their applicable human authority.

## Private use and current limits

Source lives in [forsvn-labs/conquistador, branch dogfood/0.1.0](https://github.com/forsvn-labs/conquistador/tree/dogfood/0.1.0).
The repository requires account access. Keep installed copies and dogfood artifacts private.
See [private dogfooding](docs/DOGFOOD.md) for a first-use checklist and local feedback drafts.

Project memory requires approval and host file tools. Automatic cross-run retrieval and global
learning are absent. [Memory and learning](docs/LEARNING.md) explains retention and consent.

The source is MIT-licensed; the npm package remains `private: true`. No public registry package,
hosted SaaS, app-store listing or verified native Eve/Grok integration is offered. The runtime
executes its declared playbooks, not all 38 methods. Local tests and install receipts do not prove
live-provider operation, native host activation or human acceptance.

For development, use Node 24 and the commands in [CONTRIBUTING.md](CONTRIBUTING.md).
[AGENTS.md](AGENTS.md) covers contribution rules.
