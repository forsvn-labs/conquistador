# Writing guide

How strong marketing writing reads. Draft for the reader first, then run
[After drafting](#after-drafting). The customer's brand voice and the channel's own rules win over
this guide. Vietnamese work follows [the Vietnamese standard](../standards/vietnamese.md) and the
`vietnamese` command, including its typography. Examples use a synthetic product, Fernway.

## What strong writing does

1. **Lead with the reader's situation or the strongest fact.** Open with what the reader lives with
   or wants, not with the sender.
   - Weak: "I'm the founder of Fernway, and I spent six years in finance operations."
   - Strong: "Month-end close takes your team nine days. Fernway customers close in two."
2. **Specifics over adjectives.** A number, a name, a time, or a mechanism does the work that an
   adjective only claims. Keep the exact figure: 40% never becomes "significant".
   - Weak: "A fast, powerful way to manage your books."
   - Strong: "Bank sync every hour. Receipts matched before you open the app."
3. **Show the mechanism.** Say how the result happens; then the claim needs no superlative.
4. **One reader, one promise, one ask.** Each email, ad, or section carries one call to action that
   fits the reader's trust at that moment.
   - Strong: "Reply 'close' and I'll send the two-day checklist."
5. **Name the real alternative.** Contrast with what the reader uses today is a core positioning
   move: "Spreadsheets aren't the problem. The month-end chase is." It works when the alternative is
   real. It fails as a reflex or against a straw man.
6. **Commit.** State the position once. Qualify only for a real condition ("teams under 20").
7. **Put the reader in the scene.** "Organizations struggle with retention" becomes "You're losing
   people, and you probably know who's next." Stay neutral in docs.
8. **Cut what does not earn its place.** Each sentence changes what the reader knows, believes, or
   does.
   - Weak: "In order to help you save time, our platform has the ability to reconcile accounts."
   - Strong: "Fernway reconciles your accounts overnight."
9. **Let rhythm follow emphasis.** Vary sentence length on purpose. Give the important idea room
   and the obvious point one line. Keep paragraphs short on screens.

## Register by channel

| Format | Shape | Person | Lead with | Cut |
|---|---|---|---|---|
| Cold email or DM | 3-6 sentences, one ask | I, then you | The reader's situation or why this person | 0-10% |
| Ad | One claim, one proof, one action | you | The strongest fact | 10-20% |
| Landing-page section | Headline plus 1-3 lines | you | A value claim tied to real product behavior | 25-40% |
| Founder post | Short paragraphs, one story or one number | I, we | One moment: a number, a decision, a mistake | 15-25% |
| Forum reply | 1-3 sentence paragraphs | I | Agreement, disagreement, or direct experience | 0-10% |
| Article | 2-5 sentence paragraphs, sections sized by importance | I, we, you | A committed thesis; one named example per section | 15-25% |
| Docs | Even, predictable structure | you, imperative | The task | 10-15% |
| Internal memo | Decision first | we, I | The decision or ask, with owner and date | 30-50% |

"Cut" is how much a first draft usually loses in editing. Starting point (Oct 2026): replace it with
what your own edits show. Other formats take the nearest row. Founder posts, forum replies, and
memos can keep a blunt, one-sided line. Cold email, ads, and landing sections are too short for
looseness; there it reads as careless.

## Voice

Read the voice adjectives from `GROWTH.md`. Each adjective is a constraint:

| Voice | Moves it allows |
|---|---|
| Direct | Short sentences, imperatives, fragments, one-line paragraphs |
| Warm | "You" and "we", asides, the question the reader would ask |
| Technical | Precise terms with inline definitions |
| Playful | Unexpected word pairs, analogy |
| Authoritative | Data and declaratives |
| Honest | Stated limits, "we don't know yet" |
| Provocative | A contrarian claim with its proof |
| Empathetic | The reader's frustration named before the fix |

When two adjectives pull apart, alternate them. A draft has no voice when every sentence runs 12-18
words, no detail shows the writer was there, and a competitor could sign it. Use contractions unless the register is formal.

## Density

Judge information per word, not word count.

- Replace filler: "in order to" with "to", "due to the fact that" with "because", "has the ability
  to" with "can". Delete "it is important to note that".
- Merge paragraphs that repeat a point. Delete a section the reader would not miss.
- Keep what carries meaning: exact numbers, named examples, conditions ("works when X, breaks when
  Y"), the reason for a decision, and the strongest objection with its answer.
- Long-form gate (article, docs, memo, report): if the piece could lose another 40% of its words
  without losing an idea, a datum, an example, or a condition, edit again.

## Punctuation and form

Judgment calls. The checker reports heavy use as advisory, never as a failure.

- Em dashes: one or two per piece are fine. `ai-em-dash` flags three or more at over one per 100 words.
- Colons: fine for lists, labels in docs, times, and a deliberate reveal. In social posts,
  `ai-colon-label` warns on a short label that opens a line ("Hot take: ..."); write the sentence.
- Questions: ask the one the reader would ask. Skip empty hooks ("Sound familiar?").
- Groups of three: use one when there are three things. `ai-triplet` flags several "X, Y, and Z" lines.
- Exclamation marks: one at most (`ai-exclamation`).
- Emoji: where the channel expects them, not as bullets (`ai-emoji-bullets`).

## Tells to remove

### Fix every time

`conquistador check` warns on the first six. Replace each with the concrete thing.

- Stock verbs and adjectives: unlock (`ai-unlock`), elevate (`ai-elevate`), seamless
  (`ai-seamless`), delve (`ai-delve`), game-changer or revolutionary (`ai-game-changer`).
- Buzzwords (`ai-buzzword`): leverage, synergy, cutting-edge, empower, supercharge, next-level,
  transformative, holistic, frictionless, turnkey, unleash.
- Ornament (`ai-purple-prose`): tapestry, testament to, embark on, a world where, the power of.
- Stock openers and closers (`ai-stock-opener`, `ai-fast-paced-world`): "In today's fast-paced
  world", "Imagine a world", "Let's dive in", "In conclusion".
- "It's not just X, it's Y" (`ai-not-just`). Say Y.
- Social posts only: contrast with a vague alternative such as "not vibes"
  (`ai-negative-parallelism`), a colon label (`ai-colon-label`), and a feature list posing as a
  range, "from X to Y" (`ai-false-range`).
- Throat-clearing: "It's important to note", "Let me explain". Start with the claim.
- Meme frames: "X has entered the chat", "It's giving", "What if I told you".
- Permission-seeking closers: "Let me know if you have any questions."

### Judge in context

Fix these when they weaken the piece. Keep a single instance that does a job.

- Hedge stacks. Keep one honest condition.
- Paired synonyms ("clear and concise"). Pick the stronger word.
- An "-ing" tail that restates the sentence (", highlighting the importance of X").
- Vague attribution ("experts say"). Name who, or cut it.
- Trend claims ("X is having a moment") with no signal behind them.
- An aphorism built to be quoted, with no fact in it.
- The same contrast or sentence shape twice in one piece.
- Uniform rhythm: every sentence and section the same length.
- Heavy em dashes, exclamation marks, emoji bullets, or triplets (the advisories above).

## After drafting

1. Run the fast tests in [the quality standard](../standards/quality.md): competitor swap, evidence
   proximity, first screen, and deletion.
2. Check facts. Trace every number, name, customer, quote, and capability to a supplied source. Use
   a quote or a customer name only with consent. Narrow or mark a claim you cannot trace, or ask for
   the evidence. [The safety standard](../standards/safety.md) owns these rules.
3. Run `conquistador check` on substantial text. It flags tells and unsupported claims; it does not
   prove the copy is true or works.
