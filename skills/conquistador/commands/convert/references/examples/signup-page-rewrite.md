# Signup page rewrite, before and after

The product, customers, people, traffic, and numbers on this page are invented for teaching. The
method is in [page conversion craft](../page-conversion-craft.md).

**Crewlog** (invented): daily site logs. Audience: small building contractors. Site leads take
photos and a voice note; Crewlog drafts the log with date, crew, and work done for the client.
14-day trial with no card, then $29 per active site a month; logs export as PDF.
Customer: Ridgeback Builders. Its site lead files each daily log in 6 minutes instead of about 30 at the end
of the day (interview, August 2026).

Traffic: most visitors come from a social ad that says "Daily site logs from your phone." The page
gets about 1,500 visitors a month, and 3% start a trial (analytics, September 2026).

## Before

**Weak**

> The future of construction documentation
>
> Crewlog is an AI-powered platform that helps construction teams streamline reporting and boost productivity. Trusted by contractors everywhere.
>
> Full name · Company · Phone · Job title · Company size · Password · How did you hear about us?
>
> [Submit]
>
> Pricing: contact us for details.

## Diagnosis

Read with the seven visitor questions:

- **Match fails.** The ad promised daily logs from a phone; the page talks about "construction
  documentation". The visitor is not sure they are in the right place.
- **Clarity fails.** "AI-powered platform" does not say what Crewlog does or who it is for.
- **Value and proof fail.** No outcome, and "trusted by contractors everywhere" names no one, while a
  sourced result (6 minutes instead of 30) sits unused.
- **Anxiety is high.** The price is hidden behind "contact us", and the phone field suggests a sales
  call. Recordings (invented) show visitors pausing at the phone field and leaving.
- **Friction is high.** Seven fields and a password before the visitor sees anything.
- **The button hides the commitment.** "Submit" does not say what happens next.

Break ladder: Attention and Comprehension (match and clarity) come first, then Friction.

## After

**Strong** (check: landing; leads with: want; form: long)

> Daily site logs from your phone. Done before you leave the site.
>
> Snap a few photos, record a voice note, and Crewlog drafts the log your client expects. Ridgeback Builders' site lead files each one in 6 minutes instead of about 30 at the end of the day.
>
> Work email
>
> What do you mostly build? Homes · Commercial · Renovation
>
> Start my 14-day trial
>
> No card. $29 per active site a month after the trial. Export every log as a PDF any time.

*Operator note:* "6 minutes instead of about 30" is one site lead at Ridgeback Builders, from an
interview in August 2026. Confirm permission to name Ridgeback. Left out on purpose: a separate
"how it works" line, because the subhead already carries it.

## Why each change

- The headline repeats the ad's words, so the visitor knows they are in the right place, then adds
  the want: the log is finished on site, not at night.
- The subhead carries the mechanism and one proof point, exact. Its source goes in the operator
  note, not on the page.
- Two fields replace seven. The build-type question stays because onboarding uses it to pick a log
  template; the phone field goes, and with it the fear of a sales call.
- The button says what the visitor gets. The line under it answers card, price, and lock-in.

## The one test

The false and vague claims ship as fixes without a test; they cannot be supported either way. The
open question is whether the shorter form lowers lead quality.

- **Hypothesis:** the seven-field form, not the copy, is the main barrier for visitors who reach it.
- **Change:** two-field form against seven-field form, with the new copy in both arms.
- **Primary outcome:** trials that create a first log within three days, per visitor.
- **Guardrail:** share of trials from building contractors.
- **Sizing:** with the formula in the craft file, p = 0.03 and d = 0.01 needs about 4,700 visitors
  per variant. At 1,500 visitors a month, the test cannot finish in a useful window.
- **Decision:** ship the two-field form on the recording evidence, watch the guardrail for four
  weeks, and revert if the contractor share drops. Keep testing for higher-traffic steps.

Deploying the page and changing the form need the owner's approval.
