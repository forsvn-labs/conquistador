# Conquistador 0.1.0

Private dogfood build. Start with [the dogfood guide](docs/DOGFOOD.md).

Ask `/conquistador` for an outcome. Conquistador selects the relevant methods, produces the work,
reviews it, and helps decide the next step. It includes 38 outcome capabilities for product,
research, marketing, growth, creative work, engineering and review.

Your coding agent can perform the installation for you. Once Conquistador is available, ask for
the outcome; it handles routine missing-tool setup as needed. You do not need to install each
method or optional utility.

Install with the [skills CLI](https://www.skills.sh/docs) from a fresh extracted distribution:

```sh
DO_NOT_TRACK=1 npx skills add /absolute/path/extracted-conquistador --skill conquistador --copy
```

Choose your coding agent when prompted. The root skill includes every method. Use the supplied
private distribution for now; remote installation of this build is not configured.
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
optional tool that the agent acquires on demand. Its launcher disables command telemetry. Feedback
stays in the review session unless the user explicitly chooses to share it.

[Memory and learning](docs/LEARNING.md) describes an approved private project workflow and the
separate opt-in contribution through `submit-feedback`. Automatic cross-run retrieval and global
learning are not implemented.

## Distribution status

This source is MIT and packageable as version 0.1.0. It stays private while we dogfood it.
The root package sets `private: true` to block npm publication. No registry package, public release,
hosted service, native app-store listing or verified Eve/Grok integration is offered.
The optional runtime executes its declared playbooks; it does not turn every skill into an
automated workflow. Local checks do not establish real-task quality or human acceptance.

Repository identity: [forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador).
Use the supplied local package until this build is synchronized to a verified private remote.
The source-history archive and landing repository are not installation dependencies. Keep dogfood
notes and customer material in your private project, outside the installed product.

For development, use Node 24 and run `npm run bootstrap`, `npm run build`, and `npm test`.
[CONTRIBUTING.md](CONTRIBUTING.md) covers packaging; [AGENTS.md](AGENTS.md) covers contributions.
