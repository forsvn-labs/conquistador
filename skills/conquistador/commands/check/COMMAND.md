---
name: check
description: "Run the rule-based marketing checker on a file, folder, or URL and fix what it finds."
metadata:
  version: 1.0.0
---

# Check marketing copy

`conquistador check` runs 51 fixed rules over marketing text. It uses no model and no key, and
it gives the same result every time. List the rules with `conquistador check --rules`. The full
catalog with sources is `docs/CHECK.md` in the Conquistador repository.

## When to run it

- Before you hand over any copy deliverable: landing page, email, social post, ad, article.
- After you finish a draft from `copy`, `social`, `outreach`, `ads`, `article`, `landing`,
  `lifecycle`, or `launch`.
- When the user asks to check, lint, or review copy, or gives you a URL to check.
- The edit hook runs it for you after each write to a marketing file. Treat hook findings the
  same way.

## Run it

```bash
conquistador check --json <file|folder|url>
```

- Add `--channel x|linkedin|email|landing|google-ads|meta-ads|article|social|web` when the
  file name and front matter do not name the channel. Better: add `channel:` to the front matter.
- Without the CLI on PATH (plugin installs), run `node <plugin-root>/tools/check/index.mjs --json <target>`.
- Exit 0: clean. Exit 2: findings. Exit 1: a target could not be read; report it and continue.

## Fix the findings

Work through the findings in order of severity: `error`, then `warning`. `advisory` findings are
optional; fix them when the fix is cheap.

1. **Unsupported claims** (`claim-*`). Use a source the user gave you, or one in `PRODUCT.md` or
   `GROWTH.md`, and put it beside the claim. If no source exists, cut the claim or replace it with
   a specific fact. Never invent a number, source, customer, quote, or deadline to clear a finding.
   If only the user can supply the source, ask in one line.
2. **AI-writing tells** (`ai-*`). Rewrite the sentence with the concrete fact or action. Do not
   swap one stock word for another.
3. **Calls to action** (`cta-*`). Name the action and the result: "Book a 20-minute demo", not
   "Learn more".
4. **Channel limits** (`x-*`, `linkedin-*`, `meta-*`, `email-subject-*`, `rsa-*`). Cut to the
   limit. Keep the benefit and the offer; cut adjectives first.
5. **Email compliance** (`email-*`). Add the unsubscribe link and postal address, or the
   platform's merge tags for them. Remove fake "Re:" and "Fwd:" prefixes.
6. **Link hygiene** (`link-*`). Use https, fill placeholder links, and add `utm_source`,
   `utm_medium`, and `utm_campaign` to campaign links.

## Rerun at most once

After you fix the findings, run the check one more time. Then stop. Report what you fixed and
list the findings you left, each with a reason. Do not loop on the checker.

## Keep an intentional finding

When a finding is intentional and the user agrees, waive it where it lives:

```html
<!-- conquistador-disable-next-line claim-superlative: G2 Fall 2026 grid, linked in footnote 1 -->
```

Use `conquistador-disable-line` for the same line and `conquistador-disable` for the whole file.
Give a reason every time. Add project-wide ignores (`check.ignoreRules`, `check.ignoreFiles` in
`.conquistador/config.json`) only when the user asks.

## Boundaries

A clean check is not approval. It does not prove that a claim is true, that a page converts, or
that copy meets the law in every market. The user still approves each send, publish, and spend.
