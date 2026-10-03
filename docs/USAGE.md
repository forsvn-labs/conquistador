# Use Conquistador

Start with one result: a marketing asset, a growth experiment brief, or a product specification.
Conquistador selects relevant methods; you do not need to know their names. Your coding agent
supplies the model, usage plan, file access, tools, and permissions. A short supplied brief works
without a repository or connections to analytics, CRM, email, or advertising accounts.

## Start in your selected agent

The current public npm release is **0.3.0**. Its bare interactive launcher shows the detected
agents, lets you keep or change that list, and asks whether to install for all projects or this
one. To install without the launcher, run `conquistador add AGENT --dry-run`, then
`conquistador add AGENT --yes`, and open that host yourself. See the
[installation guide](https://github.com/forsvn-labs/conquistador/blob/main/INSTALL.md)
for agent IDs, scope, and removal.

In a fresh host session, select Conquistador from the skill picker or use the host's supported
`/conquistador` or `$conquistador` invocation. Claude's plugin may expose the qualified
`/conquistador:conquistador` name. If an invocation is unavailable, check the host's plugin listing
rather than assume that installed files are active.

The plugin exposes one skill, `conquistador`, with 35 commands and 21 plays under it. A staged
compact skill or project operator also exposes one entry and loads its commands after selection.

Include the outcome, audience, source facts, constraints, and output you want. Say whether you
want a **draft**, **specification**, or **implementation**. Use readable file paths or paste a
brief. Keep deliverables outside the installed product folder. The agent should ask only when a
missing fact changes the result or your authority is needed, and continue useful bounded work
with the evidence it has.

The three examples below are **author-written synthetic fixtures**, not observed host/model
outputs, customer results, or human acceptance evidence. Replace their fictional facts with
yours. They demonstrate complete compact outputs and the correction each should survive.

## 1. Marketing: one welcome email

### Copy this task

```text
Use Conquistador to draft one welcome email for fictional Ledgerline, a web app
that helps freelancers create and send invoices. New trial users explicitly opted
into onboarding emails. Our activation event is invoice_sent within seven days of
signup; we do not know whether it predicts retention. Available events are signup,
invoice_created, invoice_sent, unsubscribed, and trial_cancelled. Use a plain,
helpful tone. Return subject, preview, full body, one CTA, eligibility and suppression,
and a small measurement plan. Keep unknown price and destination URL unresolved.
No account setup, sending, publication, or invented customer proof.
```

### Complete example output

**Draft: first-invoice welcome email**

- Subject: Your first invoice starts here
- Preview: Create a draft, check the details, and send it when you're ready.
- Body:

  Welcome to Ledgerline.

  Start by creating an invoice for the work you want to bill. Check the details, then send it
  when you're ready. You can start with a draft if you're not ready to send yet.

  **Create your first invoice** → `[verified invoice-creation URL needed]`

  Your first goal is simple: send one invoice. Start with the invoice you need today.

- CTA: One link, “Create your first invoice”; URL must be verified before sending
- Audience and trigger: Once after signup, only for trial users with the supplied onboarding
  opt-in; proposed timing is immediately after signup, subject to event freshness
- Eligibility at send time: No `invoice_created` or `invoice_sent` event; no `unsubscribed` or
  `trial_cancelled` event. Recheck immediately before a send; missing or delayed state blocks it
- Suppression and duplication: Cancel this email if any exit event arrives before dispatch.
  Use one send record per user and this welcome message; retries must not create a second send.
  Users who already created an invoice need a different next step, outside this one-email scope
- Measurement proposal: Count eligible users, attempted/delivered sends if available, CTA clicks,
  and first `invoice_sent` within seven days. State denominators and event limits. This can
  describe activation after the email, not attribute lift to it or prove retention
- Stop conditions: Pause sending if consent/suppression state is unavailable or duplicate sends
  are observed. This is a proposed rule, not an enabled automation
- Known facts: Product purpose, audience, opt-in, five supplied events, and seven-day activation
- Gaps: CTA URL, sender identity, approved compliance/footer content, and dispatch/event-lag
  behavior. Price is unknown and omitted; no discount, testimonial, or time-saving claim is added
- Next decision: Verify the destination and send-state contract before separately authorizing
  any send. This deliverable remains a draft

### Ask for one revision

> Users can now send an invoice during signup. Make sure someone who already sent one never
> gets this email. Keep the rest of the facts unchanged.

Expected revision: retain the copy and supplied facts; make `invoice_sent` a pre-dispatch exit
regardless of when it occurred, including during signup. If event ordering cannot reliably
establish eligibility, block dispatch rather than assume the event is absent. No new campaign,
sending permission, or retention claim should appear.

## 2. Growth: one bottleneck brief and experiment

### Copy this task

```text
Use Conquistador to diagnose this fictional funnel and propose exactly one small
experiment. Two consecutive four-week periods each had 10,000 visits. Period A had
800 trial starts and 160 paid upgrades; period B had 500 trials and 75 paid upgrades.
In B we changed the signup form and moved half the paid-search budget to a new
audience. Tracking definitions were intended to stay the same but have not been
audited. We have one engineer for two days and no additional media budget. Return
correct rates, competing explanations, evidence that would distinguish them, and
one experiment brief with an actual proposed change, measure, guardrails, owner,
window, and decision rule. Do not claim the form caused the drop. Do not change
tracking, launch an experiment, or spend anything.
```

### Complete example output

**Observed bottleneck:** The first observed funnel break is visit-to-trial. The later
trial-to-paid rate also deteriorated, so fixing signup alone may not fix paid conversion.

| Supplied counts and derived rates | Period A | Period B |
| --- | ---: | ---: |
| Visits | 10,000 | 10,000 |
| Trials | 800 | 500 |
| Paid upgrades | 160 | 75 |
| Visit → trial | 8% | 5% |
| Trial → paid | 20% | 15% |
| Visit → paid | 1.6% | 0.75% |

Visit-to-trial fell 3 percentage points; trial-to-paid fell 5 points; visit-to-paid fell
0.85 points. These are arithmetic observations on supplied totals, not verified comparable
cohorts or causal results. Confirm whether paid upgrades belong to the same trial cohorts and
have equally mature conversion windows before relying on the downstream comparison.

**Competing explanations, ordered by investigation priority rather than proven likelihood:**

1. Measurement or cohort mismatch: changed event capture or upgrade maturity could distort
   rates. Audit definitions, event counts against source records, outages, and cohort windows
2. Form friction: comparable visitors might abandon more after the form change. Compare
   field/error/drop-off patterns within stable source segments and check the actual form diff
3. Audience mix: the new audience may start fewer trials or convert less often. Compare rates
   within old/new audience segments and their visit shares; totals alone cannot distinguish this

**One experiment brief, not launched:**

- Question: Does the changed form reduce trial starts among otherwise comparable visitors?
- Proposed change: Compare the current form with the prior form for the same eligible new-visitor
  traffic. Reuse the actual prior form; its fields were not supplied and must not be invented
- Design: If an existing safe assignment mechanism is available, randomly assign eligible
  visitors 50/50, hold each visitor's assignment stable, and retain source/audience labels.
  Keep traffic budgets and other signup changes fixed. This tests the form while balancing mix
- Primary measure: Trial starts / eligible assigned visitors, with a defined window and event
  deduplication. Do not reuse the supplied visit counts as unique experiment participants
- Guardrails: Signup failures, support problems, and downstream paid conversion for equally
  mature trial cohorts. A tracking outage or harmful signup regression stops interpretation
- Owner and capacity: One engineer, maximum two days for validation and setup review; a product
  owner must be named to approve the design and evaluate results. No extra media budget
- Window: Propose up to four weeks of enrollment, then allow the agreed trial-to-paid window
  to mature. This is a planning assumption, not a justified sample-size guarantee
- Decision rule: Before launch, choose the minimum worthwhile improvement and acceptable
  guardrail bounds from business costs, baseline volume, and a sample-size check. Adopt the
  prior form only if trustworthy results meet those prespecified bounds; otherwise retain the
  current form or report inconclusive. No numerical significance or lift is claimed now
- No-go: Tracking/cohort validity unresolved; old form unavailable; no safe stable assignment;
  unknown conversion window; or setup exceeds two engineering days. Resolve these before
  launch rather than silently broaden scope or substitute an uncontrolled before/after claim
- Next action: Review tracking and the form diff from supplied records. This is a proposed
  investigation, not permission to edit instrumentation, connect an account, or activate a test

### Ask for one revision

> Period B included a tracking outage for three days.

Expected revision: keep the arithmetic as “recorded totals only,” withdraw the assumption of a
fully comparable period, and identify which counts/segments are affected. Reliable full-period
rates remain unknown until counts can be reconstructed or comparable intact windows obtained.
Do not remove outage days from only one side or keep blaming the form. The proposed test remains
blocked on measurement validity.

If you have only total signups and no traffic denominator, conversion rates are unknown. A useful
first result is a bounded evidence-recovery plan, not invented rates or channel blame.

## 3. Product: signup recovery specification

### Copy this task

```text
Use Conquistador to create a specification, not implementation, for saving signup
progress in a fictional web invoicing app. Users lose entered business details
after an email validation error. Existing screens are signup and email verification.
Keep those screens; add no dashboard, social login, or new brand system. Supplied
tokens are color.text.primary, color.action.primary, color.status.error, space.field,
and radius.control; their resolved values are unknown. Return a compact scope,
flow/state map, UI behavior, accessibility requirements, and testable acceptance
criteria. Cover invalid email, duplicate click, network failure, refresh, back,
and resume. Mark privacy/storage lifetime decisions unresolved. Do not write code,
change a tracker, or deploy.
```

### Complete example output

**Problem and scope:** Preserve valid business details when signup encounters a recoverable
error. The success state is reaching the existing email-verification screen after one successful
signup request. Email delivery and verification completion are outside this scope.

**Flow and state map:**

| Screen / state | User action or event | Required behavior / next state |
| --- | --- | --- |
| Signup / editing | Submit invalid email | Keep all other input; show field error; remain on signup |
| Signup / submitting | Repeated click or Enter | Show pending state; accept no second in-flight submission |
| Signup / submitting | Network failure or offline | Keep input in the current view; explain failure and offer retry |
| Signup / submitting | Success | Navigate once to the existing email-verification screen |
| Email verification | Back to signup | Preserve allowable draft state within the active flow; never auto-submit |
| Either screen | Refresh, reopen, or resume | Retention behavior depends on the unresolved storage policy; do not promise recovery across reloads |

**UI and state contract:**

- Signup form → existing fields and inline validation; a failed request must not reset unrelated
  values. Display supplied values as text, not as executable markup
- Submit action → one pending state; retries after an ambiguous response require reconciliation
  or server-supported idempotency before another account-creation request
- Error summary / field error → state the problem and next step; avoid exposing whether an
  address belongs to another person unless existing approved behavior permits it
- Email verification → keep its existing purpose. Back navigation restores only data permitted
  by the chosen policy; secrets must not be retained as part of a business-details draft
- Refresh/resume → unresolved across reloads until an owner approves storage location, fields,
  lifetime, clearing on completion, and shared-device behavior. In-memory recovery within the
  current view is the minimum proposal, not a claim that persistence already exists
- Use `color.text.primary`, `color.action.primary`, `color.status.error`, `space.field`, and
  `radius.control` by name. Do not invent their values or claim contrast is verified

**Accessibility:** Every field has a programmatic label. Associate errors with their fields;
announce submission failure and pending/completed state to assistive technology without repeated
announcements. On invalid submission, focus the error summary or first invalid field consistently;
retain a visible focus indicator and logical keyboard order. Do not communicate errors with color
alone. Check contrast only once resolved token values are supplied.

**Acceptance criteria:**

1. Given valid business details and an invalid email, submission shows the email error and
   retains every unrelated value; correcting the email needs no re-entry of those values
2. Rapid repeated clicks and Enter presses create at most one in-flight request and one
   successful navigation. An uncertain response cannot silently create a duplicate account
3. A simulated offline/network error preserves input in the active view, announces the error,
   and offers a deliberate retry; returning online does not auto-submit
4. Back from email verification follows the agreed draft policy and never initiates signup
   without another user action
5. Refresh/reopen/resume tests are blocked pending the explicit storage/privacy decision;
   the final specification must state exactly what survives each boundary and what is cleared
6. Keyboard and screen-reader review verifies labels, focus, state/error announcements, and
   usable retries; color contrast stays unverified until token values can be measured
7. Every element belongs to signup or email verification. No new dashboard, social login,
   brand tokens, implementation, or deployment is part of this deliverable

**Dependency order and open decisions:** Approve storage/privacy policy and retained fields;
confirm existing API retry/idempotency behavior; supply resolved tokens; refine the acceptance
cases; only then separately authorize implementation. No work has been built or tested here.

### Ask for one revision

> We cannot persist signup details on disk. Keep them only in the current tab, and say what
> happens when the tab closes.

Expected revision: choose JavaScript in-memory state only, with no local storage, session
storage, cookies, server-side draft, or hidden equivalent. A tab close or full page reload loses
unsent details; a reopened tab starts blank. In-app back navigation may restore the current
in-memory state, but cross-document navigation must not promise retention. Browser autofill and
session restoration are outside application memory control and need an explicit privacy check.
Update both the state map and acceptance criteria, replacing the blocked refresh test with an
honest reset expectation. Preserve all other scope and token constraints.

## Review, correct, and continue

Lead with the useful artifact. Look for source-backed facts, labeled assumptions, material gaps,
checks that actually ran, and one next decision. Ask the agent to finish with **Playbooks applied**,
naming the files it actually read and the rules it used. The examples above do not claim a
reading trace. A list of citations alone is neither proof of reading nor proof of useful work.

Give one focused correction in the same thread. The agent should revise affected sections and
retain unchanged facts; it should withdraw a recommendation when new evidence invalidates it.
You should not have to choose another method or repeat the entire brief. Same-context review is
not independent review; larger tasks may use isolated specialists when the host supports them.
See [execution modes](MASTER-AGENT.md).

Draft/specification acceptance does not authorize sending, publishing, spending, implementation,
tracker updates, ongoing monitoring, or saving reusable memory. For a local implementation,
explicitly name the requested change, files, and checks; keep deployment a separate decision.

## Connect only when the next result needs it

Supplied facts and files come first. Name a service only if the task actually needs its data.
Conquistador should check permitted tools, explain the specific missing read or action, help
with the needed connection, verify that operation, and resume the original task. Account login
or MCP discovery does not prove a query works. Never paste credentials into chat. See
[connection guidance](https://github.com/forsvn-labs/conquistador/blob/main/docs/INTEGRATIONS.md).

Hooks denied/off or skills-only installation can still support explicit use: request the task
and playbook reading yourself. Report the lack of hook enforcement rather than claim universal
readiness. Host installation, discovery, trust, knowledge loading, artifact correctness, and human
usefulness remain separate observations.

## Optional routes and private feedback

The project operator is optional. Install it with `conquistador project`; then start a fresh
session in that project and ask the host to read `.conquistador/SKILL.md`. Operator-specific
`start --task`, `operator status`, and `operator doctor` commands apply to that installed route,
not to the default global plugin. Its one-entry inventory is expected. Follow its own update
and removal instructions in the full installation guide.

For visual feedback, use [preview guidance](PREVIEW.md). If no private preview is available,
review the source artifact in chat. Text drafting needs no preview service or runtime.
Eve jobs, runtime playbooks, and [proactive hooks](PROACTIVE.md) need explicit setup;
ordinary installation starts neither a service nor a schedule.

Corrections apply to the current task. Saving them for future work needs approval of the exact
entry and destination under the [memory workflow](LEARNING.md). Feedback remains a local redacted
draft until a recipient, destination, and exact content are approved. No automatic transcript
collection or upload is implied; memory approval is separate from disclosure.

Use the original installer to update/remove each route. A compact skill folder is not a runtime
or development checkout. Links to the `main` branch follow the latest source; pin a release tag or
full commit when recording exact evidence.
