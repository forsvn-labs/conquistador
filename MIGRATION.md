# Migration

This file maps earlier names to current ones. Old command IDs still route: the routing contract
records each one as a legacy name and an alias, so `/conquistador write-copy` and "use write-copy" load
`copy`.

## October 2026: one skill, commands, and plays

Hosts now register one skill, `conquistador`. Each method is a command in
`skills/conquistador/commands/<command>/COMMAND.md`, and each multi-skill workflow is a play in
`skills/conquistador/plays/<command>.md`. Users type `/conquistador <command> [target]`.

### Commands

| Old ID | Command | File |
|---|---|---|
| `research-positioning` | `position` | `skills/conquistador/commands/position/COMMAND.md` |
| `create-brand` | `brand` | `skills/conquistador/commands/brand/COMMAND.md` |
| `design-pricing-and-packaging` | `pricing` | `skills/conquistador/commands/pricing/COMMAND.md` |
| `research-channel` | `channels` | `skills/conquistador/commands/channels/COMMAND.md` |
| `allocate-marketing-budget` | `budget` | `skills/conquistador/commands/budget/COMMAND.md` |
| `model-growth-funnel` | `funnel` | `skills/conquistador/commands/funnel/COMMAND.md` |
| `diagnose-growth` | `diagnose` | `skills/conquistador/commands/diagnose/COMMAND.md` |
| `prioritize-opportunities` | `prioritize` | `skills/conquistador/commands/prioritize/COMMAND.md` |
| `shape-initiative` | `shape` | `skills/conquistador/commands/shape/COMMAND.md` |
| `decision-panel` | `decide` | `skills/conquistador/commands/decide/COMMAND.md` |
| `plan-campaign` | `campaign` | `skills/conquistador/commands/campaign/COMMAND.md` |
| `create-run-of-show` | `event` | `skills/conquistador/commands/event/COMMAND.md` |
| `write-copy` | `copy` | `skills/conquistador/commands/copy/COMMAND.md` |
| `write-social` | `social` | `skills/conquistador/commands/social/COMMAND.md` |
| `write-outreach` | `outreach` | `skills/conquistador/commands/outreach/COMMAND.md` |
| `write-longform` | `article` | `skills/conquistador/commands/article/COMMAND.md` |
| `create-shortform` | `video` | `skills/conquistador/commands/video/COMMAND.md` |
| `create-paid-campaign` | `ads` | `skills/conquistador/commands/ads/COMMAND.md` |
| `brief-creative` | `creative` | `skills/conquistador/commands/creative/COMMAND.md` |
| `research-content-ideas` | `ideas` | `skills/conquistador/commands/ideas/COMMAND.md` |
| `polish-vietnamese` | `vietnamese` | `skills/conquistador/commands/vietnamese/COMMAND.md` |
| `optimize-search` | `seo` | `skills/conquistador/commands/seo/COMMAND.md` |
| `improve-conversion` | `convert` | `skills/conquistador/commands/convert/COMMAND.md` |
| `audit-marketing` | `audit` | `skills/conquistador/commands/audit/COMMAND.md` |
| `fresh-eyes-review` | `critique` | `skills/conquistador/commands/critique/COMMAND.md` |
| `knowledge-review` | `factcheck` | `skills/conquistador/commands/factcheck/COMMAND.md` |
| `measure-growth` | `measure` | `skills/conquistador/commands/measure/COMMAND.md` |
| `evaluate-paid-campaign` | `results` (mode `ads`) | `skills/conquistador/commands/results/references/modes/ads.md` |
| `evaluate-outreach` | `results` (mode `outreach`) | `skills/conquistador/commands/results/references/modes/outreach.md` |
| `evaluate-shortform` | `results` (mode `video`) | `skills/conquistador/commands/results/references/modes/video.md` |
| `analyze-video` | `watch` | `skills/conquistador/commands/watch/COMMAND.md` |
| `map-user-flow` | `flow` | `skills/conquistador/commands/flow/COMMAND.md` |
| `brief-product-ui` | `ui` | `skills/conquistador/commands/ui/COMMAND.md` |
| `architect-software-system` | `architect` | `skills/conquistador/commands/architect/COMMAND.md` |
| `build-web-app` | `build` (mode `web`) | `skills/conquistador/commands/build/references/modes/web.md` |
| `build-ios-app` | `build` (mode `ios`) | `skills/conquistador/commands/build/references/modes/ios.md` |
| `write-technical-docs` | `docs` | `skills/conquistador/commands/docs/COMMAND.md` |
| `submit-feedback` | `feedback` | `skills/conquistador/commands/feedback/COMMAND.md` |

### Plays

| Old workflow | Play | File |
|---|---|---|
| `launch-product` | `launch` | `skills/conquistador/plays/launch.md` |
| `position-to-campaign` | `gtm` | `skills/conquistador/plays/gtm.md` |
| `target-to-growth-plan` | `plan` | `skills/conquistador/plays/plan.md` |
| `create-landing-page` | `landing` | `skills/conquistador/plays/landing.md` |
| `lifecycle-campaign` | `lifecycle` | `skills/conquistador/plays/lifecycle.md` |
| `referral-loop` | `referral` | `skills/conquistador/plays/referral.md` |
| `outreach-sequence` | `outbound` | `skills/conquistador/plays/outbound.md` |
| `earned-media-outreach` | `press` | `skills/conquistador/plays/press.md` |
| `content-intelligence-loop` | `content` | `skills/conquistador/plays/content.md` |
| `shortform-campaign` | `series` | `skills/conquistador/plays/series.md` |
| `paid-campaign-loop` | `paid` | `skills/conquistador/plays/paid.md` |
| `channel-to-campaign` | `expand` | `skills/conquistador/plays/expand.md` |
| `answer-visibility-monitor` | `answers` | `skills/conquistador/plays/answers.md` |
| `build-programmatic-search` | `pseo` | `skills/conquistador/plays/pseo.md` |
| `content-performance-review` | `report` | `skills/conquistador/plays/report.md` |
| `create-app-preview` | `trailer` | `skills/conquistador/plays/trailer.md` |
| `optimize-app-store-listing` | `appstore` | `skills/conquistador/plays/appstore.md` |
| `creative-asset-review` | `qa` | `skills/conquistador/plays/qa.md` |
| `interactive-campaign` | `interactive` | `skills/conquistador/plays/interactive.md` |
| `measured-initiative-loop` | `experiment` | `skills/conquistador/plays/experiment.md` |
| `specify-product-experience` | `spec` | `skills/conquistador/plays/spec.md` |

A play folder (for example `plays/launch/`) holds the playbooks that were in
`skills/conquistador/references/<old-workflow>/`. Domain restrictions keep the `workflows` field
name; list play names in it.

## Earlier names

Conquistador carries methods curated from earlier FORSVN skill homes. Predecessor history is
preserved in git and inventory records. This file is the public mapping. Current installs resolve by
command name, legacy name, or alias.

### Forward path (documentation mapping only)

| Historical name/path | Current route |
|---|---|
| `meta-skills` | Absorbed external source/submodule (`79eaeef6`, `44231714`); methods now live as Conquistador commands under `skills/conquistador/commands/<command>/` |
| `forsvn-skills` → `forsvn` | Rename recorded at `72cec24f`; install the current plugin by its canonical `conquistador` identity |
| `forsvn-preview` → `conquistador-preview` | Unified at `f1209abc`; historical review runtime with no install alias |

### Reverse path (reversibility without mutation)

Pin the predecessor repository at the recorded commits (`79eaeef6`, `44231714`, `72cec24f`,
`f1209abc`) in Git history. Nothing in this repository mutates, renames, or re-publishes the
predecessor. Reversing means using the predecessor's own history, never an alias this product
provides.

### Private alpha 0.0.6 project layout

The operator root is `.conquistador`, with the parent skill visible as `SKILL.md`. Run
`conquistador operator update` from the receiving project to migrate an unchanged
`.conquistador-operator` copy and prepare the default Codex skill. The guide lets you select
Claude Code, Cursor, Copilot or files-only instead. Existing unchanged managed skills can join
this lifecycle; unowned, edited or differently restricted copies are preserved by refusal.

The operator and its configured native skill update and uninstall together. Keep artifacts outside
both owned folders. If both old and new roots exist, use an explicit `--path` after inspecting them.
Status and doctor can still read the legacy root. Explicit path updates retain that chosen path.

Older runtime data may already occupy `.conquistador/runs`. Installation does not overwrite it.
Keep using that explicit runtime path or move it yourself before choosing the new operator root.
New runtime commands default to `.conquistador-runs`. Existing unmanaged `.conquistador/runs`
remains the default when present so installed product files and run data have
separate lifecycles. No existing runs are moved, reinterpreted or deleted.

### Repair the v0.0.6 global Git launcher

The original v0.0.6 README omitted npm's `--install-links` option. npm 11 could report a successful
global Git install while leaving the executable linked to its temporary acquisition directory.
Remove that dangling package before installing v0.0.7 or later; npm cannot always replace the broken link in
place:

```sh
npm uninstall -g @forsvn/conquistador
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.11
conquistador version
```

This changes the global CLI only. Existing project `.conquistador/` and native skill copies remain
owned and can be updated afterward with `conquistador operator update`.
