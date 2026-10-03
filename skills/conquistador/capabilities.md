# Capability map

Select the smallest command or play that produces the requested result. Skip a step when accepted
context already supplies its decision. Do not narrate this map.

## Launch or grow this

| User outcome | Command | Add only when needed | Required finish |
|---|---|---|---|
| Shape an ambiguous initiative | `shape` | `decide` for consequential contested options | Bounded decision, exclusions, smallest reversible next move |
| Understand a market, customer, offer, or position | `position` | `factcheck` for conflicting sources; `brand` for durable identity | Evidence-backed position and decision implications |
| Research content opportunities | `ideas` | `channels` for current platform fit | Ranked source-grounded angles and a first brief |
| Diagnose a growth problem | `diagnose` | `measure` for real baselines | First evidenced break and discriminating tests |
| Prioritize opportunities | `prioritize` | `funnel` for numeric feasibility | Forced ranking, cut line, reversal evidence |
| Model a growth or revenue target | `funnel` | `measure` for observed baselines | Inspectable model, sensitivity, constraints, evidence plan |
| Allocate marketing budget | `budget` | `funnel` for target math; `campaign` after allocation | Bounded allocation, marginal logic, reallocation triggers |
| Design pricing and packaging | `pricing` | `position` and `factcheck` for market evidence | Value metric, package/price logic, validation and migration |
| Research or choose a channel | `channels` | `campaign` after the channel role is chosen | Typed evidence, focused recommendation, first test |
| Plan a campaign or launch | `campaign` | Relevant research and creation outcomes | Campaign spine, assets, owners, budget, stop/scale rules |
| Create paid media | `ads` | `creative` for production | Finished ads, creative direction, bounded budget/test |
| Create a run of show | `event` | `campaign` for campaign context | Timed cue sheet, owners, contingencies, follow-up |
| Improve search or answer visibility | `seo` | `copy` for revised pages | Technical/content diagnosis and prioritized correction |

## Create or improve marketing work

| User outcome | Command | Add only when needed | Required finish |
|---|---|---|---|
| Establish a brand foundation | `brand` | `position` for missing market evidence | Usable identity, voice, visual direction, applications |
| Create a production brief | `creative` | Relevant format/method note | Implementation-ready concept, assets, states, acceptance |
| Write product or campaign copy | `copy` | `position` for unresolved claims | Finished native copy with claim boundary |
| Write social/community work | `social` | Relevant channel note | Ready-to-post work, disclosure, reply plan |
| Write direct outreach | `outreach` | `position` for unresolved segment/proof | Signal-led sequence, replies, compliance, evaluation |
| Write long-form work | `article` | `vietnamese` for Vietnamese | Defensible thesis, evidence, objections, finished draft |
| Inspect supplied video | `watch` | Relevant outcome for requested revisions | Timestamped observations, evidence limits, and requested analysis |
| Create short-form video | `video` | Relevant channel and format notes | Hero, true recuts, production spec, learning plan |
| Improve a conversion surface | `convert` | Relevant creation outcome for the revision | Diagnosis, ready revision, one discriminating test |
| Create or revise Vietnamese | `vietnamese` | The outcome owning strategy or channel requirements | Natural Vietnamese with preserved facts and voice |

## Create or improve product and engineering work

Route these outcomes through the parent when the user requests the corresponding work. An incidental
mention of an app, interface, or system in a marketing brief is not an engineering request. Keep
specification, implementation, and external deployment within the user's scope.

| User outcome | Command | Add only when needed | Required finish |
|---|---|---|---|
| Map a product journey | `flow` | `position` for unresolved user evidence | Screens, transitions, states, recovery, validation |
| Specify an interface | `ui` | `flow` when the accepted flow is absent | Traceable components, tokens, states, accessibility, handoff |
| Architect a demanded system | `architect` | Private service-extraction method when justified | Bounded architecture, interfaces, risk, acceptance |
| Build a web or iOS app | `build` | `flow` and `ui` for product truth | Mode `web`: responsive accessible build with browser proof. Mode `ios`: native build with simulator proof |
| Write technical documentation | `docs` | Architecture/implementation evidence | Accurate reader-tested documentation with verification |

## Learn from these results

| User outcome | Command | Add only when needed | Required finish |
|---|---|---|---|
| Learn from aggregate growth results | `measure` | `diagnose` for the first break | Keep/drop/test decision and bounded learning proposal |
| Evaluate real results | `results` | `measure` for business-level synthesis | Mode `ads`: cell diagnosis and attribution limits. Mode `outreach`: delivery and qualified replies. Mode `video`: actual-output review and next brief |
| Audit a marketing package | `audit` | Relevant outcome only for accepted fixes | Severity findings, preserved work, human-review readiness |
| Review a consequential artifact | `critique` | Domain outcome for criteria, never as sole producer/reviewer | Honest independence status, sparse defects, recheck boundary |
| Audit the facts behind a claim | `factcheck` | `decide` when credible positions still conflict | Authority/freshness/uncertainty matrix and recheck trigger |
| Resolve a consequential decision | `decide` | `factcheck` for source conflicts | Chosen position, dissent, uncertainty, criteria, reversal evidence |

## Plays

A play chains commands for a multi-step outcome. Each file in [plays/](plays/) declares its steps in
front matter. Run the steps in order, skip a step whose `when` condition is false, and return one
Review Packet, not one report per step. Keep one decision spine across audience, costly moment,
promise, mechanism, proof, objection, action, primary signal, and decision date.

| Play | Command | Chain |
|---|---|---|
| Check visibility in AI answers | [`answers`](plays/answers.md) | seo → factcheck → measure |
| Optimize an app store listing | [`appstore`](plays/appstore.md) | seo → copy → creative → convert → audit |
| Run a content learning loop | [`content`](plays/content.md) | ideas → social → critique → measure |
| Open a new channel | [`expand`](plays/expand.md) | channels → campaign → social |
| Run a measured growth experiment | [`experiment`](plays/experiment.md) | campaign → outreach → measure |
| Position a product and run its first campaign | [`gtm`](plays/gtm.md) | position → campaign → copy → audit → measure |
| Create an interactive campaign | [`interactive`](plays/interactive.md) | campaign → creative → flow → audit → measure |
| Create a landing page | [`landing`](plays/landing.md) | position → copy → creative → convert → share-card-verification → audit |
| Launch a product or feature | [`launch`](plays/launch.md) | position → campaign → social → copy → creative → event → audit → measure |
| Run a lifecycle campaign | [`lifecycle`](plays/lifecycle.md) | campaign → copy → audit → measure |
| Run an outbound sequence | [`outbound`](plays/outbound.md) | position → outreach → audit → results → measure |
| Run and evaluate a paid campaign | [`paid`](plays/paid.md) | position → ads → budget → creative → audit → results |
| Turn a growth target into a plan | [`plan`](plays/plan.md) | funnel → prioritize → budget → campaign |
| Earn press and media coverage | [`press`](plays/press.md) | channels → position → outreach → audit → results |
| Build programmatic search pages | [`pseo`](plays/pseo.md) | seo → copy → artifact-hygiene → audit |
| Review a rendered creative asset | [`qa`](plays/qa.md) | creative → convert → artifact-hygiene |
| Build a referral loop | [`referral`](plays/referral.md) | audit → measure → campaign → copy |
| Review content performance | [`report`](plays/report.md) | measure → convert → results |
| Run a short-form video series | [`series`](plays/series.md) | ideas → video → video-production → audit → results |
| Specify a product experience | [`spec`](plays/spec.md) | flow → ui → implementation-planning → service-extraction |
| Create an app preview video | [`trailer`](plays/trailer.md) | flow → creative → video-production → audit |

## Setup and review commands

| User outcome | Command | Required finish |
|---|---|---|
| Record product and growth truth | `init` | PRODUCT.md and GROWTH.md with the accepted facts |
| Connect a capability a task needs | `connect` | Readiness table and one verified read |
| Repair install and context drift | `doctor` | Drift report and repaired files |
| Make a shortcut for one command | `pin` | A standalone skill; `unpin` removes it |
| Check marketing text by rules | `check` | Findings with file, rule, and fix |
| Open a deliverable for human review | `review` | Review link; approval stays with the human |

## Opt-in product feedback

| User outcome | Command | Required finish |
|---|---|---|
| Share a Conquistador experience or report a product failure | `feedback` | Minimal redacted draft; exact public payload consent before any verified Executor submission, otherwise honest manual fallback |

An invitation is optional and at most once per session; it neither collects material nor authorizes sending.
