# Three-touch SaaS sequence with no publishable proof yet

Synthetic instructional scenario. Plinthwise, its founder, its pilot teams, and the sample lines
are invented. No messages were sent, no recipient was contacted, and no performance was measured.
The example shows how to state only the stage the sender confirmed, how to use a proof substitute
only when the sender supplied its input, and how to hold a touch when that input is missing.

## Input

The founder supplies:

- **Product:** "Plinthwise reads the service reports that contractors send as PDFs and lists, for
  each building, which inspections are due or overdue, with the report each date came from."
- **Stage:** "Two facilities teams use it in an unpaid pilot. We have not measured results. No
  case studies. Do not name the pilot teams."
- **Founder's reason:** "I ran facilities for a group of office buildings and copied every
  inspection date from contractor PDFs into a spreadsheet by hand. You may say so."
- **Sample:** three lines from a Plinthwise run on made-up contractor reports, with permission to
  share them (they appear unchanged in email 2).
- **Pilot:** "I want two more pilot teams. A team shares its contractor reports and gives
  feedback; it gets the list and setup help from me." Exit and data-handling terms: not set.
- **Sender and voice:** the founder sends; plain voice.

Segment: facilities managers at companies that run several commercial buildings. No recipient
signal. Route: claim-bearing sale, `READY` with conditional relevance, [saas](../modes/saas.md)
plus [early-stage](../modes/early-stage.md) mode. Confirmed stage: users, but no measured results.

## Sequence plan

| Touch | New element | Proof substitute and its input | Ask | Subject |
|---|---|---|---|---|
| 1 | Who, why this reader, what the product does, its stage | Founder's reason (supplied, with permission) | One line on current practice | New |
| 2 | What the output looks like | Sample from made-up reports (supplied lines, with permission) | The inspection they chase most | Reply in thread 1 |
| 3 | A pilot place | Design-partner offer: **held**, exit and data handling not supplied | None until the gap closes | New |

Spacing is the sender's decision. The copy contains no timing claim that depends on the real gap.

## Good version

The checker skips fenced blocks. To check an email, save it as its own file and run
`node runtime/bin/conquistador.js check FILE --channel email`. Each email below had no findings.

### Email 1

```markdown
---
subject: Inspection dates buried in contractor PDFs
preheader: A new tool in an early pilot, and one question
---
Hi {{first_name}},

I'm {{sender_name}}, and I'm building Plinthwise. I used to run facilities for a group of office buildings, and I copied every inspection date from contractor PDFs into a spreadsheet by hand.

Plinthwise reads those service reports and lists, for each building, which inspections are due or overdue. Each date shows the report it came from. Two facilities teams use it in an unpaid pilot, and we have not measured results yet.

I'm writing to facilities managers who look after several commercial buildings. If contractor reports are not how you track inspections, tell me and I will not write again.

If they are, I'd like to know how your team keeps those dates current today.
Reply with one line on how you track them.

{{sender_name}}
Plinthwise, {{company_address}}

To unsubscribe, reply "unsubscribe" and I won't email you again.
```

### Email 2 (reply in the email 1 thread; the sending tool sets the subject)

```markdown
---
subject: Inspection dates buried in contractor PDFs
preheader: Three lines from a run on made-up reports
---
Hi {{first_name}},

A description is hard to judge, so here is the format. These three lines come from a Plinthwise run on made-up contractor reports, not from a pilot team or a real building:

- Test Building A: fire alarm service overdue, per the last Contractor 1 report.
- Test Building B: lift inspection due, per the last Contractor 2 report.
- Test Building C: no boiler service report found.

Each line in the real list names the report behind it.

If your team keeps a list like this by hand, I'd like to know which inspection is hardest to keep current.
Reply with the one you chase most often.

{{sender_name}}
Plinthwise, {{company_address}}

To unsubscribe, reply "unsubscribe" and I won't email you again.
```

### Touch 3: pre-send gap (no email drafted)

The founder supplied what a pilot team gives and gets, but not how a team leaves the pilot or how
its reports are handled. [Early-stage](../modes/early-stage.md) mode needs both before a
design-partner offer appears in copy, so this touch is held. Ask the sender:

1. How does a pilot team stop, and what happens to its reports when it does?
2. Where are shared reports stored, who can read them, and when are they deleted?
3. Is a new pilot place also unpaid, or are the terms still to be agreed?

When the answers arrive, draft email 3 to stand alone with a new subject: both sides of the
exchange, the exit, the data handling, and one ask (a reply to talk through the terms). If the
sender cannot answer, end the sequence after email 2.

### Before any send

| Item | Source | Check before send |
|---|---|---|
| Founder's reason, product description, sample lines | Supplied by the founder, with permission | Wording in copy matches the input |
| "Two facilities teams use it in an unpaid pilot" | Supplied stage | Still true on the send date; no team named |
| "We have not measured results yet" | Supplied stage | Still true on the send date |
| The segment tracks inspections from contractor reports | Unverified | Email 1 states it conditionally and offers a way out |
| Spacing between touches | Sender's decision | Not in the copy |
| `{{company_address}}` | Placeholder | Resolves to a real postal address |

## Weak version

Each flaw is marked with a number in brackets and explained below the email.

```text
Subject: Quick question

Hi {{first_name}}, I hope this email finds you well! [1] I noticed your team keeps
missing inspection deadlines. [2] Plinthwise is the leading compliance platform for
facilities teams [3], and teams like yours use it to pass every audit. [4] Open to a
quick call this week? Here is my calendar, or let me know who owns this. [5]
```

1. Stock opener that adds no context. Repair: start with who is writing and why.
2. Invented observation with no source. Repair: state the situation conditionally.
3. Unsupported superlative. Repair: describe what the product does.
4. Upgrades the stage: implied customers and a measured outcome the founder never gave. Repair:
   state the confirmed stage, two pilot teams and no measured results.
5. Three asks: a call, a calendar link, and a referral. Repair: choose one decision.

```text
Subject: Re: Quick question [6]

Just following up on my last email. [7] Plinthwise reads PDFs, tracks every
inspection, sends reminders, and syncs with your maintenance system. [8] Open to a
quick call this week? [9]
```

6. "Re:" typed on a new message implies a conversation. Repair: a real thread reply or a new subject.
7. Announces a follow-up instead of giving a reason. Repair: lead with the new element.
8. A feature list that repeats email 1 and adds features the founder never named. Repair: show one
   new thing.
9. The same ask again. Repair: change the ask or stop.

```text
Subject: Closing your file

We're brand new and have no customers yet [10], so we're only taking a handful of
pilot teams and spots close Friday. [11] The pilot is free for three months, then
discounted. [12] I'll assume this isn't a priority for you unless I hear back. [13]
```

10. Downgrades the stage: the founder confirmed two pilot teams. Repair: state the confirmed stage,
    no more and no less.
11. Scarcity and a deadline the sender never set. Repair: state real capacity without pressure.
12. Invented terms in place of the missing input. Repair: hold the touch and ask the sender.
13. Guilt framing that treats silence as a statement. Repair: make "no reply" an accepted answer.

## Why the good version works

- **The stage** appears once, in email 1, exactly as confirmed: two pilot teams, unpaid, no
  measured results, no names. The copy neither calls them customers nor says no one uses the
  product, under [early-stage](../modes/early-stage.md).
- **Email 1** uses the founder's reason because the founder supplied it and allowed it. Relevance
  stays conditional and offers a way out, under
  [cold email frameworks](../frameworks/cold-email-frameworks.md) and
  [selection evidence](../frameworks/personalization-signals.md). The ask is about current
  practice, which the reader can answer without trusting the product ([ctas](../frameworks/ctas.md)).
- **Email 2** adds one asset, the supplied sample, labelled as made-up data. It goes in the thread
  because it depends on email 1. The ask changes to the inspection the reader chases, under
  [sequence mechanics](../frameworks/sequences.md).
- **Touch 3** shows the pre-send gap instead of copy, because the pilot offer lacks its exit and
  data-handling input. The weak version fills the same gap with invented terms and a deadline.
- **All emails** make only the claims the founder supplied, under [proof types](../proof-types.md).
  Any reply on any channel stops the sequence, under the state table in [the method](../method.md).

No send, contact lookup, scheduling, or external write occurs. Apply the current
[review rubric](../copy-validation-rubric.md) and keep content review separate from action approval.
