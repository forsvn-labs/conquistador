# Three-email SaaS sequence with no customers yet

Synthetic instructional scenario. Ledgerline is an invented product. No messages were sent, no
recipient was contacted, and no performance was measured. The example shows a reasoning path for a
cold sequence when the sender has no customers, results, or case studies.

## Input

The founder supplies: "Ledgerline reconciles Stripe and HubSpot revenue nightly and lists each
mismatch with the records behind it; no case studies; plain voice." Segment: RevOps leads at B2B
SaaS companies. No recipient signal. Route: claim-bearing sale, `READY` with conditional
relevance, [saas](../modes/saas.md) plus [early-stage](../modes/early-stage.md) mode.

## Sequence plan

| Touch | New element | Proof substitute | Ask | Subject |
|---|---|---|---|---|
| 1 | Who, why this reader, what the product does, its stage | Founder's reason (A1) | One line on current practice | New |
| 2 | What the output looks like | Sample from synthetic data (A3) | The mismatch they see most | Reply in thread 1 |
| 3 | A trial on their own accounts, with terms to agree | Design-partner offer (A4, A5, A6) | Reply to talk through terms | New |

Spacing is the sender's decision (A8). One reasonable anchor is the reader's month-end close, if
the sender knows when it falls. The copy contains no timing claim that depends on the real gap.

## Good version

The checker skips fenced blocks. To check an email, save it as its own file and run
`node runtime/bin/conquistador.js check FILE --channel email`. Each email below had no findings.

### Email 1

```markdown
---
subject: Stripe and HubSpot revenue that don't match
preheader: A new tool, no customers yet, and one question
---
Hi {{first_name}},

I'm {{sender_name}}, and I'm building Ledgerline. At my last job I matched Stripe invoices to HubSpot deals by hand at every month-end, and I wanted a list of the gaps instead.

Ledgerline compares Stripe and HubSpot revenue every night. It lists each mismatch with the Stripe and HubSpot records behind it. It is new, and no company uses it yet.

I'm writing to RevOps leads at B2B SaaS companies that may bill in Stripe and report revenue from HubSpot. If that is not your setup, tell me and I will not write again.

If it is, I'd like to know how your team matches the two today.
Reply with one line on how you check them.

{{sender_name}}
Ledgerline, {{company_address}}

To unsubscribe, reply "unsubscribe" and I won't email you again.
```

### Email 2 (reply in the email 1 thread; the sending tool sets the subject)

```markdown
---
subject: Stripe and HubSpot revenue that don't match
preheader: What one nightly list looks like, from test accounts
---
Hi {{first_name}},

A description is hard to judge, so here is the format. These three lines come from a Ledgerline run on test accounts with made-up data, not from a customer:

- Test invoice A is paid in Stripe. Its HubSpot deal is still open.
- Test deal B is closed-won in HubSpot. Stripe has no subscription for it.
- Test customer C has a different total in Stripe than in HubSpot.

Each line in the real list names the Stripe record and the HubSpot record behind it.

If your team builds a list like this by hand, I'd like to hear what it misses.
Reply with the mismatch you see most often.

{{sender_name}}
Ledgerline, {{company_address}}

To unsubscribe, reply "unsubscribe" and I won't email you again.
```

### Email 3 (new subject)

```markdown
---
subject: Run Ledgerline on your own Stripe and HubSpot data?
preheader: Terms to agree first, and an easy way out
---
Hi {{first_name}},

I'm {{sender_name}}, the founder of Ledgerline, which lists each mismatch between Stripe and HubSpot revenue. This is my last email about it.

We have no customers yet, so I'm looking for a few RevOps teams to try it on their own accounts and tell me what is wrong with it. You would give read-only access to Stripe and HubSpot and some feedback. You would get the nightly list and direct help from me.

Before you connect anything, we would agree the access, the length of the trial, how either of us can stop, and when I delete the copied data.

If this is not a problem for your team, no reply is needed.
Reply "trial" to talk through the terms.

{{sender_name}}
Ledgerline, {{company_address}}

To unsubscribe, reply "unsubscribe".
```

### Assumptions the sender must confirm

| ID | Statement in copy | Status |
|---|---|---|
| A1 | The founder matched Stripe and HubSpot by hand in an earlier job | Invented for the example. Replace with the true reason, or delete the sentence |
| A2 | The sender is the founder | Change the affiliation lines if someone else sends |
| A3 | The three sample lines | Must be the real output of a real run on test accounts. Replace them with that output |
| A4 | Ledgerline works with read-only access to both systems | Inference. Confirm the actual access scope |
| A5 | The founder can give direct help to each trial team | Capacity. Reduce the offer if not |
| A6 | Copied data is deleted at the end | Confirm the practice exists before the copy promises it |
| A7 | The segment uses Stripe and HubSpot | Unverified. Email 1 states it conditionally and offers a way out |
| A8 | Spacing between touches | Set by the sender; not in the copy |
| A9 | `{{company_address}}` resolves to a real postal address | Verify before any send |

## Weak version

Each flaw is marked with a number in brackets and explained below the email.

```text
Subject: Quick question

Hi {{first_name}}, I hope this email finds you well! [1] I noticed your team is
struggling with revenue reconciliation. [2] Ledgerline is the leading platform for
Stripe and HubSpot reconciliation [3], and teams like yours use it to close the books
faster and stop revenue leakage. [4] Open to a quick call this week? Here is my
calendar, or let me know who owns this. [5]
```

1. Stock opener that adds no context. Repair: start with who is writing and why.
2. Invented observation with no source. Repair: state the situation conditionally.
3. Unsupported superlative from a product with no customers. Repair: describe what it does.
4. Implied customers and an outcome claimed from a capability. Repair: state the stage plainly.
5. Three asks: a call, a calendar link, and a referral. Repair: choose one decision.

```text
Subject: Re: Quick question [6]

Just following up on my last email. [7] Ledgerline runs every night, compares Stripe
and HubSpot, lists every mismatch, shows the records, and supports multi-currency
with a clean dashboard. [8] Open to a quick call this week? [9]
```

6. "Re:" typed on a new message implies a conversation. Repair: a real thread reply or a new subject.
7. Announces a follow-up instead of giving a reason. Repair: lead with the new element.
8. A feature list that repeats email 1 and adds unconfirmed features. Repair: show one new thing.
9. The same ask again. Repair: change the ask or stop.

```text
Subject: Closing your file

We are only taking a handful of pilot customers and spots close Friday. [10] The pilot
is free for three months, then discounted. [11] I'll assume this isn't a priority for
you unless I hear back. [12]
```

10. Scarcity and a deadline the sender never set. Repair: state real capacity without pressure.
11. Invented terms. Repair: name what each side gives and say the terms are to be agreed.
12. Guilt framing that treats silence as a statement. Repair: make "no reply" an accepted answer.

## Why the good version works

- **Email 1** states the stage once and uses the founder's reason as the proof substitute, under
  [early-stage](../modes/early-stage.md). Relevance stays conditional and offers a way out, under
  [cold email frameworks](../frameworks/cold-email-frameworks.md) and
  [selection evidence](../frameworks/personalization-signals.md). The ask is about current
  practice, which the reader can answer without trusting the product ([ctas](../frameworks/ctas.md)).
- **Email 2** adds one asset, a sample built from synthetic data and labelled as such, which
  replaces the feature description of the weak version. It goes in the thread because it depends on
  email 1. The ask changes to the mismatch the reader sees, under
  [sequence mechanics](../frameworks/sequences.md).
- **Email 3** changes the ask to a design-partner trial. It names both sides of the exchange and
  leaves the terms to agree, so no free period, discount, or deadline is invented
  ([outreach decisions](../frameworks/outreach-decisions.md), section 2). It has a new subject and
  restates affiliation because it must stand alone. "Last email" is true only if the sender
  suppresses further touches.
- **All emails** make only the claims the founder supplied, under [proof types](../proof-types.md):
  nightly comparison and a list with the records behind each mismatch. Any reply on any channel
  stops the sequence, under the state table in [the method](../method.md).

No send, contact lookup, scheduling, or external write occurs. Apply the current
[review rubric](../copy-validation-rubric.md) and keep content review separate from action approval.
