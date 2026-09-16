# Conquistador 0.1.0

Conquistador helps you do elite growth, GTM, sales, marketing, and product knowledge work in your
existing coding agent. Ask for an outcome: prepare a launch, improve a landing page, write outreach,
or decide what to test next. It selects the relevant methods, produces the work, reviews it, and
returns one deliverable with evidence gaps and a next action.

The default install includes all 38 outcome methods. Your host supplies the model, project files,
tools, and permissions. This is a private dogfood build; results still need your review.

## Start here

Use Node 24, Git, an existing coding agent, and a GitHub account with access to this private
repository. Run this from the project where you want to use Conquistador:

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 add "forsvn-labs/conquistador#dogfood/0.1.0" --skill conquistador
```

Choose your host when prompted. Keep `--skill conquistador` as shown. Do not add `--full-depth`,
`--skill '*'`, or `--all`, or install only the nested `skills/conquistador` folder. The root bundle
contains the parent and its methods. No separate clone or runtime setup is required.

## Finish a first task

Start a fresh host session in that project. Select `/conquistador`, `$conquistador`, or Conquistador
in the host's skill picker, then ask:

```text
/conquistador Use docs/product.md and docs/audience.md to prepare our beta
launch. Deliver landing-page copy, one launch email and a two-week campaign
plan in docs/launch/. Mark claims that need evidence. Keep this as a draft.
```

Use your own file paths, or paste the product facts and audience instead. Expect finished copy,
a campaign plan, and stated evidence gaps. Check the result before using it.

Installation is useful when the host can find the complete library and use it on your task.
A skill listing checks inventory; `conquistador setup doctor` checks local completeness. Neither
proves host activation or useful output. [Install, check, and recover](INSTALL.md) covers these
checks. [Usage examples](docs/USAGE.md) show how to request and review the work.

## Connect accounts when the task needs them

Work based on supplied files needs no Executor account. If missing access to a CRM, warehouse,
ads account, or document system blocks a task, Conquistador inspects the available connections.
It helps install Executor or use Executor Cloud when needed, connects the host, guides you through
sign-in, verifies the required operation, and resumes the task. You sign in through the service's
UI, never by pasting a secret into chat. [Connection setup](docs/INTEGRATIONS.md) explains the steps.

Plugins and MCP are alternative installation routes. CLI setup and doctor are installation tools.
Eve jobs, runtime playbooks, previews, and proactive hooks are optional. Ordinary installation
starts no service or schedule. See [installation alternatives](INSTALL.md#alternatives),
[capabilities and limits](docs/SERVICES.md), and [execution modes](docs/MASTER-AGENT.md).

## Private dogfood

Keep installed copies, outputs, and feedback private. The repository requires access and the npm
package remains `private: true`; there is no public registry package or hosted Conquistador SaaS.
Publication, spending, external writes, saved memory, and feedback disclosure need their applicable
human decisions. Automatic cross-run retrieval and global learning are absent.

Use the [dogfood checklist](docs/DOGFOOD.md) to record what worked in your host. For development,
read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).
