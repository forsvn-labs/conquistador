# Sales emails: annotated pairs

Synthetic instructional examples. Every product, company, person, source, and number below is
invented. No messages were sent, no recipient was contacted, and no performance was measured.
Each strong email passes `node runtime/bin/conquistador.js check FILE --channel email` with no
errors or warnings when saved as its own file. Advisory notes for the address merge tag and the
plain-text preview remain. Word counts exclude the greeting, sign-off, and footer. Structures are
in [the craft reference](../frameworks/cold-email-frameworks.md).

## 1. SaaS · strong signal · first touch

Supplied: Ospreydesk checks carrier invoices against contract rates. Customer Fernhill Supply
(permission to name) recovered $41,000 of over-billing in its first quarter. Signal: Harlow
Freight's careers page, read on 3 October 2026, lists a freight audit analyst role. Reader: Dana,
head of logistics.

**Strong**

```markdown
---
subject: your freight audit analyst role
touch: first
---
Hi Dana,

You're hiring a freight audit analyst. If part of that job is catching carrier over-billing, software can do the first pass.

Ospreydesk checks every carrier invoice against your contract rates. Fernhill Supply recovered $41,000 with it in its first quarter.

Worth a look while you hire?

Rosa

Ospreydesk, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Revolutionizing Freight Spend Management with AI-Powered Audit Solutions

Hi Dana, I hope this email finds you well! My name is Rosa and I'm the Co-Founder & CEO
of Ospreydesk. In today's fast-paced logistics landscape, freight costs keep rising. Our
AI-powered platform leverages cutting-edge technology to streamline your audit process,
and we think it could potentially be a great fit. Would you be open to a 30-minute demo,
or I can send over some materials?
```

**Why the strong one works:** the subject and first line use the real signal; one named result
carries the proof; one easy question. **Why the weak one fails:** buzzword subject, pleasantry,
title introduction, industry background, stacked hedges, two asks, and the signal is never used.

## 2. SaaS · no signal · first touch

Supplied: Kelpwise texts dental patients before appointments and lets them confirm or rebook.
Northgate Dental, a four-chair practice (permission to name), went from 14% no-shows to 6% in three
months. No recipient signal: the list is practice owners.

**Strong**

```markdown
---
subject: no-shows at {{practice}}
touch: first
---
Hi {{first_name}},

How many chairs sit empty at {{practice}} in a normal week?

Northgate Dental, a four-chair practice, cut no-shows from 14% to 6% in three months, measured by its own booking system. Kelpwise texts each patient before the visit and lets them confirm or rebook in one tap.

Worth a look?

Sam

Kelpwise, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Quick question

Hi {{first_name}}, I noticed your practice is struggling with no-shows. Kelpwise offers
automated reminders, two-way texting, waitlists, reviews, analytics, and payments.
Practices like yours love it. Book a demo here: {{calendar_link}}
```

**Why the strong one works:** with no signal, it asks about the costly moment and lets a peer
result do the arguing. **Why the weak one fails:** a vague subject, an invented observation, a
feature list, an unsupported "practices like yours", and a calendar link as the first ask.

## 3. SaaS · warm outbound · first touch

Supplied: Priya started a Kelpwise trial this week and has not connected her calendar, so no
reminders have gone out. Setup is a ten-minute call with the founder. The trial terms tell users
the team may contact them about setup.

**Strong**

```markdown
---
subject: your Kelpwise setup
touch: first
---
Hi Priya,

You started a Kelpwise trial this week, but the calendar isn't connected yet, so no reminders have gone out.

Connecting takes about ten minutes on a call with me. Want to do it together this week?

Sam

Kelpwise, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Welcome to the Kelpwise family!

Hi Priya! We're so excited to have you. Here are 7 features to explore: [link] [link]
[link]. Check out our help center, webinar series, and community. Let us know if you
have any questions!
```

**Why the strong one works:** it names the one action she took and the one step that blocks
value, then offers to do that step with her. **Why the weak one fails:** a generic welcome, three
links, and no single next step.

## 4. Services · give-first · first touch

Supplied: Tallowby Studio runs paid search for law firms. On 20 October 2026 Arjun searched the
public results for "divorce lawyer {{city}}" and saw that all three of the firm's ads link to its
homepage, which leads with estate planning. Arjun has two more changes written up.

**Strong**

```markdown
---
subject: your divorce ads in {{city}}
touch: first
---
Hi {{first_name}},

Your three search ads for divorce in {{city}} all send clicks to your homepage, which leads with estate planning.

The first change I'd make: send those clicks to a divorce consultation page with the phone number at the top. I've written up two more changes.

Want them?

Arjun

Tallowby Studio, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Grow your firm with digital marketing

We are a full-service digital agency with 10+ years of experience in SEO, PPC, social
media, and web design. I took a look at your website and there are a lot of
opportunities. Can we schedule a call to discuss how we can help you grow?
```

**Why the strong one works:** it gives a real, checkable piece of work first and asks only
whether to send the rest. **Why the weak one fails:** it describes the agency, gives a vague
"opportunities" claim, and asks for a call before showing anything.

## 5. Services · concrete offer · first touch

Supplied: Tallowby rebuilds the ads and landing page for one practice area in 14 days. The
operator authorizes this term: if cost per booked consultation is not lower after 60 days, the
setup fee is refunded. The written terms exist. No recipient signal and no publishable result.

**Strong**

```markdown
---
subject: cost per consultation at {{firm}}
touch: first
---
Hi {{first_name}},

If paid search brings {{firm}} consultations, I'd like to lower what each one costs.

I rebuild the ads and landing page for one practice area in 14 days. If cost per booked consultation isn't lower after 60 days, I refund the setup fee.

Want the one-page terms?

Arjun

Tallowby Studio, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: 10X YOUR LEADS GUARANTEED!!!

We guarantee to 10x your leads in 30 days or your money back. Only 3 spots left this
month, so reply today to claim yours!
```

**Why the strong one works:** the offer says what, how fast, and the authorized remedy, and the
ask is small. **Why the weak one fails:** an invented guarantee, invented scarcity, a shouting
subject, and nothing the reader can verify.

## 6. Early stage · little proof · first touch

Supplied: Fennick reads CI history and marks tests that fail and pass on the same commit, with
the runs as evidence. Two teams use it in an unpaid pilot; results are not measured; do not name
them. The founder spent two years rerunning flaky suites as a release engineer.

**Strong**

```markdown
---
subject: flaky tests in your CI
touch: first
---
Hi {{first_name}},

How does your team decide whether a failed test is flaky or real?

Fennick reads your CI history and marks tests that fail and pass on the same commit, with the runs as evidence. It's new: two teams use it in a pilot, and we haven't measured results yet. I built it after two years of rerunning suites as a release engineer.

Worth a look?

Ines

Fennick, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: The leading AI test reliability platform

Fennick is trusted by engineering teams to eliminate flaky tests and ship 2x faster.
Teams like yours have cut CI costs dramatically. Want a demo?
```

**Why the strong one works:** the reader's question comes first, the stage is stated once and
plainly, and the founder's reason stands in for missing proof. **Why the weak one fails:** it
upgrades two unpaid pilots to "trusted by engineering teams" and invents an outcome.

## 7. Follow-up · new asset

Supplied: a sample Ospreydesk flag from a run on made-up invoices; the data request (one month of
invoices as a CSV export, deleted after the run) is approved by the founder. Sent in the touch 1
thread.

**Strong**

```markdown
---
subject: your freight audit analyst role
touch: follow-up
---
Hi Dana,

Here's what a flag looks like, from a sample run on made-up invoices:

"Carrier B, invoice 1182: fuel surcharge billed at $1,140, contract cap $880. Over-billed: $260."

Ospreydesk writes a line like that for every mismatch. Want me to run it on one month of your invoices? You'd send a CSV export, and I delete it after the run.

Rosa

Ospreydesk, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Re: following up

Just following up on my email below. Did you get a chance to look? Ospreydesk checks
carrier invoices against contract rates. Let me know!
```

**Why the strong one works:** the new element is something to judge without trusting the
sender, and the ask states what it would take. **Why the weak one fails:** a typed "Re:", no new
element, and a recap of the first pitch.

## 8. Follow-up · new angle, smaller ask

Supplied: Kelpwise lets a patient move an appointment from the text, so the slot can be offered to
someone else. New subject; no reply to touch 1.

**Strong**

```markdown
---
subject: rebooking at {{practice}}
touch: follow-up
---
Hi {{first_name}},

A different angle: many no-shows are patients whose time stopped working, not patients who forgot. Kelpwise lets them move the visit from the text, so your front desk can fill the slot.

Does your front desk handle rebooking by phone today?

Sam

Kelpwise, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Checking in

Hi {{first_name}}, I wanted to bump this to the top of your inbox. Have you had a chance
to think about Kelpwise? Let me know if you'd like to hop on a call.
```

**Why the strong one works:** a new reason (rebooking, not reminding) and a smaller ask the reader
can answer in a line. **Why the weak one fails:** it announces a follow-up and repeats the ask.
Check before sending: "many no-shows are patients whose time stopped working" needs the sender's
own support, or it becomes "some".

## 9. Breakup

Supplied: the sender will stop after this touch and suppress the contact.

**Strong**

```markdown
---
subject: closing the loop on no-shows
touch: breakup
---
Hi {{first_name}},

This is my last email about Kelpwise. If no-shows become a bigger problem at {{practice}}, will you reply to this thread?

Sam

Kelpwise, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Closing your file

I haven't heard back, so I'll assume this isn't a priority for you. Last chance: 50% off
ends Friday.
```

**Why the strong one works:** short, warm, final, and it names the one change that would make
a reply worth sending. **Why the weak one fails:** guilt framing, silence treated as a statement,
and an invented deadline.
