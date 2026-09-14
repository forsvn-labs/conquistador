# Install and use the local candidate

The portable ZIP can be installed directly through a compatible host's local-plugin controls.
It contains no runtime, catalog, Eval Lab, host/agent staging packages, or staging helper.
Use the complete distribution for the helper commands and optional modules below.

Run the commands below from the complete distribution root. The distribution
version is 0.1.0; individual skill, module, and schema versions retain their own histories.

## Portable plugin and standalone skills

The root `plugin.json`, `.claude-plugin/`, `.codex-plugin/`, and `skills/` form the portable plugin.
Use the host's local-plugin installation feature with that directory. For a skills-only host,
copy the desired `skills/<name>/` directory into its documented skills directory.

Node is needed only for the staging helper below. Replace destinations with dedicated absolute
paths outside this distribution. The helper never connects to a host account or network.

```sh
node tools/install.mjs list
node tools/install.mjs install plugin /absolute/path/conquistador-plugin
node tools/install.mjs install skill:write-copy /absolute/path/write-copy-install
node tools/install.mjs upgrade plugin /absolute/path/conquistador-plugin
node tools/install.mjs remove plugin /absolute/path/conquistador-plugin
```

An individual install contains `skills/<name>/` and the MIT license. Point the host at that skill
folder. Upgrades and removal require a matching receipt and unchanged files. If you edited an
install, preserve it and stage a fresh directory. Never put user artifacts inside an owned install.

## Eve, official Grok Bot, single agent, and squad

```sh
node tools/install.mjs install eve /absolute/path/conquistador-eve
node tools/install.mjs install grok-bot /absolute/path/conquistador-grok
node tools/install.mjs install single-agent /absolute/path/conquistador-agent
node tools/install.mjs install squad /absolute/path/conquistador-squad
```

For Eve, merge the staged `agent/` instructions and skills into an operator-owned Eve application.
For the official Grok Bot app, use the staged bot profile and packaged skills through the app's
available import controls. This package does not establish that a specific Grok Bot version accepts
that import; a missing import capability remains a compatibility blocker.

For a single agent, load `agent/agent.json` and its parent-only `agent/skills/` directory in a host that
can enforce the declared role. Optional sibling outcomes require their own standalone installs. For a squad, load `squad.json`, the advisor and worker contracts, and their separate
skills directories. A host without separate agent contexts uses `sequential-fallback.md`; that
fallback does not prove independent review. These files are portable contracts, not a native host
agent launcher. Local staging does not prove host execution.

## Optional runner

Use Node 24. Install the pinned runtime dependency with your package manager:

```sh
bun install
node runtime/bin/conquistador.js version
node runtime/bin/conquistador.js --help
node runtime/bin/conquistador.js init
node runtime/bin/conquistador.js doctor
```

The launcher runs the shipped compiled JavaScript. No build or experimental Node flag is required
in this distribution. To develop or compile the runtime separately:

```sh
cd runtime
bun install
bun run build
bun run typecheck:public
bun run test:public
```

The generated configuration has a placeholder model. Set a supported, exact model and its credential
environment variable privately before `serve`. Credentials do not belong in chat, Git, or command
arguments. `doctor` reports missing setup; it does not prove live model access.

```sh
node runtime/bin/conquistador.js route --intent "improve organic content"
node runtime/bin/conquistador.js serve
```

The service accepts structured playbook input. Read the runtime README for the HTTP contract and
separate operator review and action credentials. Use `chat` to collect structured input through
the service; the `eval` CLI verb remains reserved. A runner without an authenticated
judgment provider pauses for judgment rather than inventing an artifact.

## Locally built runtime container

The included Dockerfile builds from this complete distribution root on pinned Node 24.
Run `docker build -t conquistador:0.1.0 .` here. The image runs
as the `node` user and uses `/data` as its writable working directory. Mount a persistent
volume there before setup. Use the exact locally built image:

```sh
docker volume create conquistador-data
docker run --rm -v conquistador-data:/data conquistador:0.1.0 init
docker run --rm -v conquistador-data:/data conquistador:0.1.0 doctor
```

Configure the persisted file and provider environment before running `serve`. A bind
mount must grant write access to the image's `node` user. Creating a local image or
volume is not evidence of a published registry image or live provider support.

## Catalog and Eval Lab

The catalog contains typed contracts and provider adapters. An operation is unsupported until its
required support evidence and connection authority exist. Installing this archive does not promote
fixture evidence to live support.

```sh
cd catalog
bun install
bun run typecheck
bun run test:public
bun run catalog:check
```

The public catalog suite excludes the private G4 evidence and Git candidate-build tests.
Those remain in the full maintainer suite.

The optional Eval Lab is a source SDK with examples, schemas, graders, and tests:

```sh
cd evals
bun install
bun run test:contracts
```

Repository-maintainer inventory and release-evidence commands require private source authorities
and are not supported from the public distribution. Live benchmark execution needs a separately
configured provider, exact run inputs and budget, and review evidence. Local tests are not such runs.

## Release limits

No host listing, provider receipt, human verdict, signature identity, or public promotion is created
by these commands. The candidate remains NO-GO until its applicable acceptance evidence is complete.

## Edit and package the public source

The complete distribution includes editable sources and contributor instructions. See
[CONTRIBUTING.md](CONTRIBUTING.md) for root bootstrap, build, default public tests, and packaging
from a clean public Git commit. Those commands need no private workspace or historical ledger.
The resulting package record is unbound and does not authorize publication.
