# Partner, investor, intro, creator, and reply emails: annotated pairs

Synthetic instructional examples. Every product, company, person, source, and number below is
invented. No messages were sent, no recipient was contacted, and no performance was measured.
Each strong email passes `node runtime/bin/conquistador.js check FILE --channel email` with no
errors or warnings when saved as its own file. Advisory notes for the address merge tag and the
plain-text preview remain. Word counts exclude the greeting, sign-off, and footer. Structures are
in [the craft reference](../frameworks/cold-email-frameworks.md).

## 10. Partnership · first touch

Supplied: Quarrymint is a budgeting app for freelancers. It has opt-in research data from 2,400
users on how much they set aside for tax, and permission to publish aggregates. Lena writes The
Invoice, a newsletter for freelance designers; its public archive shows three issues this year
answering reader questions about quarterly tax.

**Strong**

```markdown
---
subject: tax set-aside data for The Invoice
touch: first
---
Hi Lena,

Your readers keep asking about quarterly tax; you've answered it in three issues this year.

Quarrymint has opt-in data from 2,400 freelancers on how much they set aside. I'd write a short guide from it for your readers, with no pitch inside, and you'd publish it only if it's good enough.

Worth sending a one-paragraph outline?

Tomas

Quarrymint, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Partnership opportunity!

Hi there! Love your newsletter!! We'd love to explore synergies between our brands.
Quarrymint is the #1 budgeting app for freelancers. Would you be open to a partnership?
Please send your rates and audience stats.
```

**Why the strong one works:** it opens with the overlap fact, states the exact exchange, and
asks for a small yes. **Why the weak one fails:** generic praise, "synergies" with no defined
exchange, an unsupported "#1", and a request that costs the reader work.

## 11. Investor intro · credential-led · first touch

Supplied: Nadia ran nurse scheduling for a 30-clinic network for six years and started Marrowline
in May. 40 clinics pay for it; MRR is $52,000 after five months. She is raising a $2.5M seed.
Marcus's fund thesis page says it backs clinical workflow software.

**Strong**

```markdown
---
subject: Ex-clinic ops | 40 paying clinics, 5 months
touch: first
---
Hi Marcus,

I ran nurse scheduling for a 30-clinic network for six years, then started Marrowline in May.

40 clinics pay for it, at $52,000 MRR after five months.

We're raising a $2.5M seed, and your fund backs clinical workflow software. Open to a 20-minute call next week?

Nadia

Marrowline, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Exciting Opportunity: Revolutionizing Healthcare Workforce Management with AI

Dear Marcus, I hope you're doing well. My name is Nadia and I'm the Founder & CEO of
Marrowline Health. As you know, the healthcare industry is facing unprecedented staffing
challenges. We believe we may have a unique opportunity to transform this space. I would
be honored if you might consider a call at your convenience, or I could send our deck?
```

**Why the strong one works:** the subject is the two strongest facts; the body is three plain
facts and one specific, time-boxed ask. **Why the weak one fails:** a buzzword subject,
pleasantries, a title introduction, industry context the investor knows, hedges, and two asks.

## 12. Intro request · note to the connector

Supplied: Theo and Marcus served on the same nonprofit board. Theo knows Nadia's work. Use the
[intro request](../modes/intro-request.md) mode: one named person, one request, and a paragraph
Theo can forward unchanged.

**Strong**

```markdown
---
subject: intro to Marcus Hale?
touch: forward
---
Hi Theo,

Would you introduce me to Marcus Hale? His fund backs clinical workflow software. No is a fine answer. Here's a paragraph you can forward as is:

"Nadia Rees ran nurse scheduling for a 30-clinic network for six years and started Marrowline in May. 40 clinics now pay for it. She's raising a seed round and would like 20 minutes with Marcus."

Nadia

Marrowline, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Quick favor

Hey Theo! Hope all is well. Do you know any investors who might be interested in
healthcare? Would love any intros you can make! Also, could you share our deck around?
And would you be up for being an advisor?
```

**Why the strong one works:** one named person, a sourced reason, an easy way to say no, and a
forwardable paragraph that stands alone. **Why the weak one fails:** it asks for a list of names
and three favors, and gives the connector nothing to forward.

## 13. Creator sponsorship · first touch

Supplied: Crumbwell is an app that times each sourdough step from the starter's rise. On
21 October 2026 the sender read the comments on Hollis's last ten videos; most threads include a
question about timing. The budget is set for one paid segment. Use the
[creator sponsorship](../modes/creator-sponsorship.md) mode.

**Strong**

```markdown
---
subject: paid sponsorship for your sourdough videos
touch: first
---
Hi Hollis,

This is a paid sponsorship offer. Crumbwell times each sourdough step from your starter's rise, and timing comes up in most of your comment threads.

We'd pay for a 60-second segment inside your normal format, not a separate ad. If you're open to it, what's your rate for one video?

Jules

Crumbwell, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Collab?

Hey!! Love your content! We'd love to collab. We'll send you free product in exchange
for a post. Our app has 50+ features: timers, recipes, journals, community, and more.
Let us know!
```

**Why the strong one works:** it says "paid" first, describes the product in one sentence tied
to the audience, and asks for the creator's rate. **Why the weak one fails:** it hides the terms
behind "collab", offers product as pay without saying so, and lists features.

## 14. Reply to an interested prospect

Supplied: Dana replied to touch 1 of pair 1: "Interesting. How does pricing work?" Pricing,
approved by the founder: one fifth of confirmed over-billing recovered, nothing if none is found, no
setup fee.

**Strong**

```markdown
---
subject: your freight audit analyst role
touch: reply
---
Hi Dana,

Pricing is a fifth of the confirmed over-billing we recover, and nothing if we find none. There's no setup fee.

One run on a month of your invoices would show the number for Harlow. You'd send a CSV export, and I delete it after the run.

Want the export steps?

Rosa

Ospreydesk, {{company_address}}
Reply "unsubscribe" and I won't email you again.
```

**Weak**

```text
Subject: Re: your freight audit analyst role

Great question! Let's hop on a 45-minute demo with my sales team so we can understand
your needs before we discuss pricing. Here's my calendar: {{calendar_link}}
```

**Why the strong one works:** it answers the question first, in full, then offers one next step
with its cost stated. **Why the weak one fails:** it dodges the question and raises the ask.
