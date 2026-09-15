# What Conquistador provides

Conquistador is a product agent toolkit. Users ask the Conquistador parent for an outcome; it owns
method selection, composition, review and the next useful step. A host supplies the model, available
tools, project access and permission controls. Conquistador is not currently a hosted SaaS service.

## User capabilities

| Need | Work Conquistador can help produce |
| --- | --- |
| Product and strategy | Initiative scope, user journeys, pricing, packaging, prioritization and decision reviews |
| Research and positioning | Audience and market research, channel selection, content opportunities and evidence review |
| Launch and growth | Campaign plans, funnel models, budget allocation, diagnosis and measurement plans |
| Creative and content | Brand direction, briefs, copy, social posts, outreach, long-form work, short-form video and event plans |
| Search and conversion | Search/answer visibility review, conversion audits and testable improvements |
| Engineering | Interface specifications, architecture, web/iOS implementation and technical documentation |
| Review and learning | Artifact critique, campaign evaluation, measured next steps and approved durable learning |
| Product feedback | Opt-in redacted issue drafts with exact-payload consent before any submission |

These methods work on supplied context and available host tools. Current research needs access to
current sources. Video analysis needs its declared media/provider setup. Building an app needs the
relevant development tools. Publishing, spend and account changes need authorized connections.
Conquistador prepares missing local prerequisites through the host when permitted. It names remaining
account, tool or input gaps rather than inventing observations or execution.

## Platform and service boundary

| Platform or module | Shipped implementation | Activation and limits |
| --- | --- | --- |
| skills.sh / coding agent | One root skill with all 38 outcomes | CLI installs the complete clean bundle; host discovery and invocation naming apply |
| Claude/Codex plugins | Repo-local marketplaces, methods and icon; one native Claude agent | Documented host activation commands; no central listing or universal alias claim |
| Agent Plugins 1.0.0 | Root `plugin.json` and fixed `skills/` discovery | Compatible client required; hooks and native agents are host-specific |
| Single-agent harness | Parent role and all declared methods | Host supplies agent execution; no service starts on install |
| Advisor/worker harness | Separate role packages and review handoff | Independent review requires separate host contexts |
| MCP | Stdio run, artifact-list, artifact-read and cancel tools | Requires configured Conquistador HTTP service; no approval or publishing tools |
| HTTP and terminal | Durable supported playbooks, structured chat and review boundaries | Node 24, model configuration and separate human authority |
| Local proactive helper | Opt-in event-to-instruction output | Host must invoke and deliver it; no daemon, scheduler or automatic external action |
| Visual review | On-demand Lavish AXI setup, HTML previews and annotations | Agent prepares a cached CLI with telemetry disabled; reachable browser and active polling required |
| Typed catalog | Seventeen operation contracts, adapters and a host-injected bridge | Exact support evidence and connection authority gate dispatch; not turnkey live support |
| Eval Lab | Source SDK, graders, schemas and local examples | Synthetic checks by default; real evaluations need authorized providers, budgets and human review |
| Eve and official Grok Bot | Experimental staging contracts | Import and native execution unverified; not a supported native service claim |

The optional runtime currently has a declared content-intelligence playbook. Other skill routes
remain host methods or guidance unless a corresponding executable graph is supplied and validated.
The built-in served model adapter does not browse, edit files or call external tools. An embedding
host can add the typed operation bridge through its own authenticated Executor connection.

## Proactive responsibilities

When the user invokes Conquistador, it should notice missing context, choose the relevant methods,
carry useful work to completion, review the result and propose the next justified action. It should
not ask the user to manage its internal skill selection.

Outside an active request, proactive behavior needs an explicit host event. The optional
[helper](PROACTIVE.md) offers session-start, before-delivery and results-updated guidance. A reminder
is not execution or authority. No customer scheduling, unattended publishing, automatic spending,
telemetry or unsolicited feedback submission is included.

## Repository layout

The intended public repository is [forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador).
It contains everything needed to install, build and package the product. Remote publication is
pending; the repository link is an intended destination until verified.

Internal research, planning, provenance and source-history preservation belong outside this public
repository. They are never runtime dependencies. The landing site is a separate project and does
not need its source shipped with the product. See [installation](../INSTALL.md) for local commands.
