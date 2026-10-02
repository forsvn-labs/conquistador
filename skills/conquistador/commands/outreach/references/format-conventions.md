# Outreach output contract

Return artifacts inline unless the existing `.forsvn/artifacts/mkt/write-outreach/` store is in
scope. Do not create a private workspace dependency. For persisted drafts use a safe slug derived
from target, channel, and touch; keep different touches and reviewed revisions distinguishable.
Never overwrite a reviewed payload silently.

## Three review artifacts

- `[slug].md`: finished message, email subject if relevant, readiness, and visible pre-send gaps.
- `[slug].rationale.md`: intent, selection evidence/access class, limited inference, claim boundaries,
  recipient decision, exclusions, and proposed action boundary.
- `[slug].critic-score.md`: dimension scores, quoted draft evidence, PASS/FAIL, hard failures,
  applicable denominator, revision count, and remaining concerns.

For one bounded research message these can be short inline blocks. Do not add a reply bank,
follow-up sequence, or campaign metrics unless requested. For a commercial sequence also return
reply handling, channel/compliance checks, planned qualified-conversation definition, owner-set
batch size, cadence, suppression, and stop conditions. These are plans, not observed results.

```yaml
skill: outreach
version: 1
date: YYYY-MM-DD
status: done # done_with_concerns | blocked | needs_context
readiness: READY # NEEDS_SIGNAL for no-pitch research without recipient evidence
channel: email # linkedin-dm | linkedin-connection | twitter-reply | twitter-dm | imessage | sms | upwork-proposal | other-platform
mode: services-sell # saas-sell | partnership-sell | community-sell | no-pitch-research
touch: 1 # integer or breakup
route: compose # reply
critic_total: 40/50
```

`status` records completion of drafting. `readiness` is a legacy editorial label, never action
permission. A completed NEEDS_SIGNAL template remains untargeted. A commercial READY draft without
a signal must disclose conditional relevance and unverified targeting. `blocked` includes failed
claims or unresolved hard gates; do not hide those under a score.

Use [the rubric](copy-validation-rubric.md) for score names and thresholds. N/40 applies only to
no-pitch NEEDS_SIGNAL, with Signal connection N/A. Other routes use N/50. Never fill an N/A cell with
bonus points. A campaign's stricter selection threshold remains applicable.

Use the host's verified channel limits when available; otherwise mark them for pre-send checking.
Do not claim a platform preview width, character cap, deliverability status, or lawful basis from
memory. Explicit approval must identify exact action, payload, recipient scope, account, and timing.
