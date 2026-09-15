# Conquistador 0.1.0

Ask `/conquistador` for an outcome. Conquistador selects the relevant methods, produces the work,
reviews it, and helps decide the next step. It includes 38 outcome capabilities for product,
research, marketing, growth, creative work, engineering and review.

Install with the [skills CLI](https://www.skills.sh/docs) from a fresh extracted distribution:

```sh
DO_NOT_TRACK=1 npx skills add /absolute/path/extracted-conquistador --skill conquistador --copy
```

Choose your coding agent when prompted. The root skill includes every method. After public repository
setup, the source argument can be `forsvn-labs/conquistador`. That remote command is not available yet.
[Installation](INSTALL.md) also covers Claude/Codex plugins, a native Claude agent, Agent Plugins
1.0.0, compact offline staging and the optional runtime.

Use requests such as:

```text
/conquistador Turn this product into a launch package.
/conquistador Improve our onboarding flow and implement the agreed changes.
/conquistador Review these campaign results and prepare the next experiment.
```

`/conquistador` is the product entry point. Hosts choose their invocation syntax: a slash command,
a named-skill picker, `$conquistador`, or a request to the Conquistador agent. The default install
bundles all methods. Users do not need to choose individual skills or manage routing.

## Choose where it runs

| Interface | What users get | What the host provides |
| --- | --- | --- |
| Coding-agent skill, recommended | One Conquistador entry point and the complete method library | Model, project files, tools and permission UI |
| Claude/Codex or Agent Plugins | Complete methods, repo marketplace metadata and a native Claude agent | Host plugin activation, model and tools |
| Single agent or advisor/worker squad | Portable role contracts and bundled methods | Agent execution and, for independent review, separate contexts |
| Optional Node 24 runtime | Durable supported playbooks, HTTP sessions, terminal chat and MCP artifact access | Configured model and separately authorized integrations |
| Opt-in host-event helper | Reminders to resume work, review a deliverable or assess new results | Event invocation and delivery of the reminder to Conquistador |

[Services and platform support](docs/SERVICES.md) explains the capabilities, prerequisites and
limits. [Proactive help](docs/PROACTIVE.md) documents the local event helper. Installing a skill
starts no service, enables no hooks, and sends no data. Publication, spend and external writes
require the applicable human authority.

For visual review, Conquistador uses [Lavish AXI](docs/PREVIEW.md) through the host's CLI. Users
stay with `/conquistador`; the agent prepares the preview and handles annotations. Lavish is an
optional separate installation. Feedback remains local unless the user explicitly chooses to share it.

[Memory and learning](docs/LEARNING.md) describes an approved private project workflow and the
separate opt-in contribution through `submit-feedback`. Automatic cross-run retrieval and global
learning are not implemented.

## Distribution status

This source is MIT and packageable as version 0.1.0. It is currently unpublished. No npm registry
package, hosted service, native app-store listing or verified Eve/Grok integration is offered.
The optional runtime executes its declared playbooks; it does not turn every skill into an
automated workflow. Local tests establish implementation behavior, not live-provider quality or
human release acceptance.

Intended public source: [forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador).
Publication of this source at that URL is pending. The private source-history archive and landing
repository are not dependencies. No private workspace is needed to use or develop this product.

For development, use Node 24 and run `npm run bootstrap`, `npm run build`, and `npm test`.
[CONTRIBUTING.md](CONTRIBUTING.md) covers packaging; [AGENTS.md](AGENTS.md) covers contributions.
