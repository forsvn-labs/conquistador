# Progress

Updated: 2026-11-11 · Stage: live · Health: At risk

The latest package release is 0.13.0 (2026-11-10); [CHANGELOG.md](CHANGELOG.md) holds the
release history. Hosted MCP was last verified at 0.10.1 (2026-10-23). Acceptance gaps remain; migration rechecks neither.

Next action: Hung judges the 8 sealed pairs for the X plays; test the growth doctrine on real tasks with blind comparisons; Hung reviews the draft migration PR; additional acceptance remains the next product work.

## Current state

| State | Item | Evidence | Date |
| --- | --- | --- | --- |
| Merged, not released | Freshness check for dated facts and plays, and the meta-watch workflow. Contributor tooling only; it is not in the npm package, so no release and no changelog entry | [PR #121](https://github.com/forsvn-labs/conquistador/pull/121), [workflow](docs/META-WATCH.md). The check finds 25 dated blocks and 1 overdue: the image-engine reference, verified June 2026. The weekly run fails until someone rechecks that block | 2026-11-11 |
| Shipped | Package 0.13.0: the funnel-first growth doctrine. `init` asks how customers convert and records the funnel first; growth work names the stage and metric it moves | Recorded: Both `@forsvn/conquistador@0.13.0` and `conquistador@0.13.0` are verified as npm latest. [Release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.13.0), [registry evidence](docs/release-0.13.0-verification.json); no model-quality evaluation yet | 2026-11-10 |
| Shipped | Package 0.12.0, including distillation, routing, channel facts, and checker changes | Recorded: Both `@forsvn/conquistador@0.12.0` and `conquistador@0.12.0` are verified as npm latest. [Release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.12.0), [registry evidence](docs/release-0.12.0-verification.json) | 2026-10-29 |
| Shipped | Thin guidance across package surfaces, 0.11.0 | [Release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.11.0), [registry evidence](docs/release-0.11.0-verification.json) | 2026-10-27 |
| Shipped | Four-step installer, 0.10.2 | [Release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.10.2), [registry evidence](docs/release-0.10.2-verification.json) | 2026-10-23 |
| Shipped | Hosted MCP 0.10.1, existing-account Executor routing | [Hosted evidence](docs/hosted-0.10.1-verification.json) | 2026-10-23 |
| Built, not shipped | Project-record migration draft | Branch claude/horsemen-records-20261101; Hung reviews the draft PR | 2026-11-01 |
| Next | Additional native-client, OAuth, ARM, and linked-provider acceptance | [Installation acceptance](docs/INSTALLATION-ACCEPTANCE.md); extend claims only after observed checks | 2026-10-29 |
| In progress | Meta-watch pilot on X: four candidate plays from 11 founder accounts (683 posts) wait for Hung's blind test | Branch `feat/x-plays-candidate`; 8 sealed pairs in the private knowledge folder. No play enters `main` before the verdict. Views measure reach, not customers | 2026-11-11 |
| Next | Growth doctrine on real tasks: blind comparisons of strategy deliverables with and without it | [Doctrine](skills/conquistador/references/growth-doctrine.md); parent skill body 6,495 of 6,500 bytes and required standards 4,589 of 4,600, so deeper wiring needs room first | 2026-11-10 |
| Next | Real-task evaluations and corrections across methods | [Public-alpha checklist](docs/PUBLIC-ALPHA.md) | 2026-10-29 |
| Next | Human blind tests for distilled craft candidates | [Distillation workflow](docs/DISTILL.md); no craft change before verdicts | 2026-10-29 |
| Next | Routing-contract headroom before the next routing change | [Recorded snapshot](docs/progress-log.md); 24 bytes below its 90% safety budget | 2026-10-29 |

## Gates

- Preserve human decisions for sends, publication, spend, external writes, feedback disclosure, and reusable memory. Draft acceptance grants no disclosure or memory consent.
- Releases, marketplace listings, and landing changes need an explicit decision. Source commits, tests, fixtures, and package identity do not prove delivery or model quality. See [the behavior contract](docs/PRODUCT-CONTRACT.md), [public-alpha checklist](docs/PUBLIC-ALPHA.md), [installation acceptance](docs/INSTALLATION-ACCEPTANCE.md), and [version policy](VERSIONS.md).
- Additional-client OAuth consent and native activation, interactive Windows and additional ARM targets, linked-provider lifecycle, and broader model/human acceptance remain unverified. Composio has offline checks only; Browser and Edge runtimes are not certified.
- Keep secrets, OAuth settings, and token storage under their existing owners. Package publication does not verify or redeploy hosted MCP.
- `README.md` is byte-locked by `release/plugin-completeness.json` for 0.12.0, and published READMEs link `main/STATUS.md`. At the next release, point README at PROGRESS.md and regenerate the release manifests. Keep the `STATUS.md` pointer while any published README still links to it.

## Later

- Verify marketplace listings after distribution approval. Build Gemini CLI hooks, consent-bound memory, and expanded method-quality evaluations when prioritized.
- Existing lint diagnostics and optional Promptfoo/node-forge findings remain open. See the [recorded snapshot](docs/progress-log.md).

## 2026-11-11

- Hung agreed to keep the methods current from operators with recent, verifiable results, in
  three layers: principles, dated plays, and dated platform facts. Built `tools/freshness.mjs`
  with 17 tests and a weekly workflow; root tests: 655 of 656 pass, 0 fail.
- Public articles on current practice were mostly vendor marketing with unverified revenue, so
  they count as leads only. The pilot read the posts of 11 founder accounts and wrote four
  candidate plays for X. No method or doctrine text changed on `main`.

## 2026-11-10

- Shipped 0.13.0 at `682d6a9`: both npm packages are verified as latest, with matching release bytes
  and provenance. The CLI-alias job was rerun once after npm made the main version readable.
  Hosted MCP was not redeployed. [Release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.13.0).
- Drafted the funnel-first growth doctrine as a teaching page and as agent guidance.
  The old business playbook, which no command loaded, became `references/growth-doctrine.md`;
  GROWTH.md now leads with a Funnel section. Root tests: 637 of 638 pass, 0 fail, in [PR #119](https://github.com/forsvn-labs/conquistador/pull/119). The parent skill body
  is 6,498 of 6,500 bytes and the required standards 4,595 of 4,600, so deeper wiring needs room first.

## 2026-11-01

- Migrated the root records to PROGRESS. The old STATUS.md and ROADMAP.md are
  retained in commit `0b28958`; the full dated snapshot is in [the progress log](docs/progress-log.md).
  Release, registry, hosted, and task-quality evidence was not refreshed.
- Updated only the approved CHANGELOG and setup-entry test references. Other
  guides retain legacy names outside this migration scope.

## 2026-10-29

- Shipped 0.12.0 at `794c5d41192755818f359d909db4b4a0e8d84728`, with five archives
  matching SHA256SUMS and both npm packages verified in the recorded evidence.
  [PR #112](https://github.com/forsvn-labs/conquistador/pull/112),
  [release PR #113](https://github.com/forsvn-labs/conquistador/pull/113), and
  [publication run](https://github.com/forsvn-labs/conquistador/actions/runs/40916514798).
- Kept distilled craft candidates out of methods pending human blind tests.

## 2026-10-27

- Shipped 0.11.0. Package checks established loading and installation, not model
  quality or external chat-app acceptance. Hosted Worker was not redeployed.

## 2026-10-23

- Shipped 0.10.2 and verified hosted MCP 0.10.1 with an existing Executor account.
- Verified performance source before 0.11.0, without a new deployment or live
  model-quality verdict. Full results and limits remain in [the progress log](docs/progress-log.md).
