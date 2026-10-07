# conquistador check

`conquistador check` is a deterministic checker for marketing text. It uses no model and no key.
It reads Markdown, MDX, HTML, plain text, folders of those files, and http(s) URLs. It works like
Impeccable's design detector, but for copy.

A clean check is not approval. The checker cannot prove that a claim is true, that a page
converts, or that copy is legal in every market. It finds the mechanical problems so a human
review can spend its time on the rest.

## Run it

```bash
conquistador check landing.html                 # one file
conquistador check marketing/                   # a folder (.md, .mdx, .html, .htm, .txt)
conquistador check https://example.com/pricing  # a page: visible text and meta tags
conquistador check --json emails/               # JSON array on stdout
conquistador check --channel x post.md          # force the channel
conquistador check --no-config drafts/          # ignore config and inline waivers
conquistador check --rules                      # list every rule
```

In a plugin install without the npm CLI, run `node <plugin-root>/tools/check/index.mjs` with the
same arguments.

Human-readable findings go to stderr. `--json` prints the findings array to stdout. Each finding
has `rule`, `name`, `family`, `severity`, `message`, `fix`, `file`, `channel`, `line`, and
`snippet`.

| Exit | Meaning |
| --- | --- |
| 0 | Scan finished with no `error` or `warning` findings. `advisory` findings can still print. |
| 2 | Scan finished with at least one `error` or `warning` finding. |
| 1 | At least one target could not be scanned, or the arguments are wrong. This outranks 2. |

## Channels

The channel decides which channel, email, and link rules run. The checker takes the first match:

1. `--channel <name>`.
2. `channel:` in the front matter, or `<meta name="channel">` in HTML.
3. The file name, then up to three parent folder names. For example `launch-email.md`,
   `x-thread.md`, `linkedin/`, `google-ads-rsa.md`, `meta-ad.md`, `landing.html`.
4. HTML with a form, a button, and an `<h1>` is `landing`. Other HTML is `web`. Other text is
   `general`.

Channels: `x`, `linkedin`, `email`, `landing`, `google-ads`, `meta-ads`, `article`, `social`,
`web`, `general`. Aliases such as `twitter`, `newsletter`, `rsa`, and `facebook` also work.

## File formats

- **Front matter fields** that rules read: `channel`, `subject`, `preheader` (or `preview_text`),
  `title`, `meta_title`, `description`, `meta_description`, `headlines`, `descriptions`, `paths`,
  `primary_text`, `headline`.
- **Label lines** work too: `Subject: ...`, `Preheader: ...`, `Headline 1: ...`,
  `Description 2: ...`, `Path 1: ...`, `Primary text: ...`.
- **Sections** work for ads: a `## Headlines`, `## Descriptions`, or `## Paths` heading followed
  by a list.
- **X and LinkedIn**: each `##` section is one post. Without headings, `---` lines split posts.
- **HTML**: the checker reads `<title>`, `<meta name="description">`, visible text, links, and
  buttons. It skips `<head>`, `<script>`, `<style>`, `<noscript>`, `<template>`, and `<svg>`.
  An element with `preheader` or `preview` in its class or id is the email preheader.
- **Markdown**: the checker skips front matter, fenced code, HTML comments, and MDX imports.

## Ignore findings

Project config in `.conquistador/config.json`:

```json
{
  "check": {
    "ignoreRules": ["ai-em-dash"],
    "ignoreFiles": ["drafts/**", "legal/*.md"]
  }
}
```

Inline waivers travel with the file. They work in any comment syntax. Give a reason.

```html
<!-- conquistador-disable ai-delve: quoting a competitor's page -->
We are #1 on G2. <!-- conquistador-disable-line claim-superlative: G2 Fall 2026 grid -->
<!-- conquistador-disable-next-line claim-number-unsourced: internal benchmark, appendix A -->
```

`conquistador-disable` covers the whole file, `-line` covers its own line, and `-next-line`
covers the next nonblank line. List several rules with commas. `--no-config` turns off both the
config and the inline waivers.

## Edit hook

The plugin runs `hooks/check-hook.mjs` after the agent writes or edits a file:

| Host | Event | Matcher | Output |
| --- | --- | --- | --- |
| Claude Code | `PostToolUse` | `Write\|Edit\|MultiEdit` | `hookSpecificOutput.additionalContext` |
| Codex | `PostToolUse` | `Edit\|Write\|apply_patch` | `hookSpecificOutput.additionalContext` |
| Cursor | `postToolUse` | `Write` | `additional_context` |

The hook checks only marketing files: a file with a `channel:` field, an HTML file, a file whose
name names a channel, or a file in a folder such as `marketing/`, `campaigns/`, `content/`,
`social/`, `ads/`, or `launch/`. It skips code, `README.md` and other project documents, and
folders such as `node_modules/`, `skills/`, `.claude/`, and `dist/`. It reports `error` and
`warning` findings, at most 12 per file. It does not repeat the same findings for the same file
in one session. It never blocks the edit and always exits 0. It reads
`.conquistador/config.json` from the project root.

Turn it off with `CONQUISTADOR_HOOKS=off`, or with `{"hooks": false}` in
`~/.conquistador/config.json`. That also turns off the prompt and stop hooks.

## Rules

Severity `error` and `warning` count toward exit code 2. `advisory` findings print but never fail
a run.

### Unsupported claims (`claims`)

| Rule | Severity | Channels | Flags | Fix |
| --- | --- | --- | --- | --- |
| `claim-superlative` | warning | all | Superlative or ranking claim with no source in the same sentence. | Cite the ranking or study beside the claim, or replace it with a specific, checkable fact. |
| `claim-number-unsourced` | warning | all | Performance number, percentage, or customer count with no source marker. | Add the source (study, dataset, date, sample) next to the number, or remove the number. |
| `claim-proven` | warning | all | "Proven" or "studies show" claim with no citation. | Link the study or dataset, or describe what you observed and where. |
| `claim-absolute` | warning | all | Absolute promise that one failure would make false. | State the real limit, for example the uptime SLA, the security certification, or the error rate. |
| `claim-guarantee` | warning | all | Guarantee or "risk-free" promise with no terms in the same sentence. | Add the terms, for example "30-day refund, no questions asked", and link the policy. |
| `claim-urgency` | warning | all | Urgency phrase with no concrete date or time. Fake deadlines are a dark pattern. | State the real deadline (date, time, time zone), or remove the urgency. |
| `claim-scarcity` | warning | all | Scarcity or demand claim. False low-stock or high-demand messages are a dark pattern. | Confirm the number is true and current and say how it is counted, or remove the claim. |
| `claim-vague-proof` | warning | all | Social proof with no names or sourced count. | Name customers you have permission to name, or give a sourced count with a date. |
| `claim-placeholder` | error | all | Unfilled placeholder text. | Replace the placeholder with the real value before anyone sees this copy. |

### AI-writing tells (`ai-tells`)

| Rule | Severity | Channels | Flags | Fix |
| --- | --- | --- | --- | --- |
| `ai-unlock` | warning | all | "Unlock" is a stock AI-copy verb. | Say what the reader can now do, for example "see every campaign's cost in one table". |
| `ai-elevate` | warning | all | "Elevate" is a stock AI-copy verb. | Name the concrete improvement and, if you have it, the number. |
| `ai-seamless` | warning | all | "Seamless" is a stock AI-copy adjective. | Describe the step that disappears, for example "no export, no CSV". |
| `ai-delve` | warning | all | "Delve" is a strong AI-writing tell. | Use "look at", "cover", or cut the sentence. |
| `ai-game-changer` | warning | all | Hype noun or adjective that makes no checkable claim. | Replace it with the specific change and who it changes it for. |
| `ai-fast-paced-world` | warning | all | Stock scene-setting phrase such as "in today's fast-paced world". | Delete it and start with the reader's problem. |
| `ai-not-just` | warning | all | "It's not just X, it's Y" contrast frame, a common AI-writing pattern. | State Y directly. |
| `ai-buzzword` | warning | all | Buzzword that readers skip. | Replace it with the plain verb or the concrete feature. |
| `ai-purple-prose` | warning | all | Ornamental phrase common in generated text. | Cut it, or replace it with a fact. |
| `ai-stock-opener` | warning | all | Stock opener or closer such as "Imagine a world" or "Ready to take it to the next level?". | Open with the reader's situation; close with the specific next step. |
| `ai-em-dash` | advisory | all | Em dashes are dense in this text, a common AI-writing tell. | Keep one or two. Use periods, commas, or parentheses for the rest. |
| `ai-triplet` | advisory | all | Several "X, Y, and Z" lists. Reflexive groups of three read as generated. | Keep the one list that matters; cut the weakest item from the others. |
| `ai-exclamation` | advisory | all | Many exclamation marks. They lower trust in marketing copy. | Keep at most one. |
| `ai-emoji-bullets` | advisory | all | Lines that start with decorative emoji such as 🚀 or ✅. | Use plain bullets, or keep emoji only where the channel expects them. |

### Vague calls to action (`cta`)

| Rule | Severity | Channels | Flags | Fix |
| --- | --- | --- | --- | --- |
| `cta-click-here` | warning | all | "Click here" says nothing about the destination. | Make the link text the action and the result, for example "Download the 2026 pricing guide". |
| `cta-vague` | warning | all | Link or button text such as "Learn more" or "Submit" that does not say what happens next. | Use a verb and the outcome, for example "See pricing" or "Book a 20-minute demo". |
| `cta-missing` | warning | landing, email | This landing page or email has no call to action. A link, a short line that starts with an action verb, or (in email) a short direct question that asks for a reply or a meeting counts. | Add one primary action with a specific label: a working link, or in a 1:1 email a short direct question that asks for a reply or a meeting. |
| `cta-competing` | advisory | email | More than three different destinations compete for the click. | Pick one primary action. Move the rest to a later email. |

### Channel limits (`channel`)

| Rule | Severity | Channels | Flags | Fix |
| --- | --- | --- | --- | --- |
| `x-length` | error | x | X post is over 280 weighted characters (URLs count 23, CJK and emoji count 2). | Cut the post, or split it into a thread with `---` between posts. |
| `linkedin-length` | error | linkedin | LinkedIn post is over 3,000 characters. | Cut it below 3,000, or move the detail to an article and link it. |
| `linkedin-hook` | warning | linkedin | The first line runs past 150 characters, so LinkedIn hides the end of the hook behind "see more". | Put the hook in the first 150 characters and break the line after it. |
| `meta-title-length` | warning | landing, web, article | Page title is over 60 characters, so search results will likely truncate it. | Put the key words first and keep the title within 60 characters. |
| `meta-title-missing` | warning | landing, web | The page has no <title>. | Add a unique, descriptive <title> of 60 characters or fewer. |
| `meta-description-length` | warning | landing, web, article | Meta description is over 155 characters, so search results will likely truncate it. | Keep the description within 155 characters, with the benefit first. |
| `meta-description-missing` | advisory | landing, web | The page has no meta description, so search engines pick a snippet. | Add <meta name="description"> with a specific summary of 155 characters or fewer. |
| `email-subject-missing` | warning | email | No subject line found. | Add `subject:` to the front matter or a `Subject:` line at the top. |
| `email-subject-length` | warning | email | Subject line is over 60 characters or 9 words, so most inboxes will truncate it. | Cut it to 9 words and 60 characters, with the specific benefit first. |
| `email-preheader-missing` | advisory | email | No preheader. Inboxes then show the first body text, often "View in browser". | Add `preheader:` that extends the subject, not repeats it. |
| `rsa-headline-length` | error | google-ads | Responsive search ad headline is over 30 characters (double-width characters count 2). | Cut the headline to 30 characters. |
| `rsa-description-length` | error | google-ads | Responsive search ad description is over 90 characters. | Cut the description to 90 characters. |
| `rsa-path-length` | error | google-ads | Display URL path field is over 15 characters. | Cut each path field to 15 characters. |
| `rsa-asset-count` | error | google-ads | A responsive search ad needs 3 to 15 headlines and 2 to 4 descriptions. | Add or remove assets to fit the range. |
| `meta-ad-primary-length` | warning | meta-ads | Meta ad primary text is over the recommended 150 characters, so feeds cut it behind "See more". | Put the offer in the first 125 characters and keep the total within 150. |
| `meta-ad-headline-length` | warning | meta-ads | Meta ad headline is over the recommended 27 characters for feed placements. | Cut the headline to 27 characters. |

### Email compliance (`email`)

| Rule | Severity | Channels | Flags | Fix |
| --- | --- | --- | --- | --- |
| `email-unsubscribe-missing` | error | email | Commercial email with no unsubscribe link or instruction. | Add a visible unsubscribe link, or your platform's unsubscribe merge tag. |
| `email-address-missing` | error | email | Commercial email with no physical postal address. | Add your street address, registered PO box, or your platform's address merge tag to the footer. |
| `email-presumed-pain` | warning | email | The email tells the reader they have a problem the sender has not observed, such as "I noticed your team is struggling". | State the observed signal and its source, or write the problem as a condition. |
| `email-relative-time` | warning | email | A phrase such as "I wrote last week" is true only if the real send gap matches. | Write "I wrote earlier" or remove the reference. |
| `email-merge-tag` | advisory | email | The postal address is a merge tag, which the address rule accepts. The email is compliant only if the sending tool fills it. | Confirm the tag resolves to the sender's postal address, or write the address. |
| `email-fake-reply` | error | email | Subject starts with "Re:" or "Fwd:" on a first-touch email. That misrepresents the message. | Remove the prefix. Write a subject that describes the content. |
| `email-subject-shouting` | warning | email | Subject has all-caps words, repeated "!" or "$", or "FREE" in caps. Spam filters and readers both penalize it. | Use sentence case and one plain benefit. |

### Link hygiene (`links`)

| Rule | Severity | Channels | Flags | Fix |
| --- | --- | --- | --- | --- |
| `link-http` | warning | all | Link uses plain http. Browsers mark it "Not secure". | Use the https URL. |
| `link-utm-missing` | warning | email, x, linkedin, social, google-ads, meta-ads | Campaign link has no UTM parameters, so analytics cannot attribute the visit. | Add utm_source, utm_medium, and utm_campaign. |
| `link-utm-incomplete` | warning | all | Link has some UTM parameters but not all of utm_source, utm_medium, and utm_campaign. | Add the missing parameters so the visit is not reported as "(not set)". |
| `link-placeholder` | error | all | Link points at a placeholder such as "#", example.com, or an empty target. | Replace it with the real destination. |

## Sources for limits and rules

| Rule | Limit or basis | Source |
| --- | --- | --- |
| `x-length` | 280 weighted characters. Each URL counts 23. CJK characters and emoji count 2. | X, [Counting characters](https://docs.x.com/fundamentals/counting-characters) |
| `linkedin-length` | 3,000 characters. | LinkedIn, [Single image ads specifications](https://www.linkedin.com/help/lms/answer/a426534) (introductory text) |
| `linkedin-hook` | Keep the hook within 150 characters to avoid truncation behind "see more". | LinkedIn, [Single image ads specifications](https://www.linkedin.com/help/lms/answer/a426534). LinkedIn does not publish the organic cutoff; the checker uses the documented ad value. |
| `meta-title-length` | 60 characters. Google sets no length limit; it truncates title links to fit the device width. 60 is a working budget, so this rule is a warning. | Google Search Central, [Influencing your title links](https://developers.google.com/search/docs/appearance/title-link) |
| `meta-description-length` | 155 characters. Google sets no length limit; it truncates snippets as needed. 155 is a working budget. | Google Search Central, [Control your snippets](https://developers.google.com/search/docs/appearance/snippet) |
| `email-subject-length` | 60 characters and 9 words. | Mailchimp, [Best practices for email subject lines](https://mailchimp.com/help/best-practices-for-email-subject-lines/) |
| `rsa-headline-length`, `rsa-description-length`, `rsa-path-length`, `rsa-asset-count` | Headlines 30, descriptions 90, paths 15. 3 to 15 headlines and 2 to 4 descriptions. Double-width characters count 2. | Google Ads Help, [About responsive search ads](https://support.google.com/google-ads/answer/7684791) |
| `meta-ad-primary-length`, `meta-ad-headline-length` | Primary text 50 to 150 characters, headline 27 characters, for Facebook Feed. Other placements differ. | Meta, [Ads Guide: Facebook Feed image](https://www.facebook.com/business/ads-guide/update/image/facebook-feed) |
| `email-unsubscribe-missing`, `email-address-missing`, `email-fake-reply` | Commercial email needs a valid physical postal address and a clear opt-out. The subject line must reflect the content. | FTC, [CAN-SPAM Act: A Compliance Guide for Business](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) |
| `claim-superlative`, `claim-number-unsourced`, `claim-proven`, `claim-absolute`, `claim-guarantee`, `claim-vague-proof` | Advertisers need a reasonable basis for objective claims before they publish them. | FTC, [Policy Statement Regarding Advertising Substantiation](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) |
| `claim-urgency`, `claim-scarcity` | Fake countdowns and false low-stock or high-demand messages are dark patterns. | FTC, [Bringing Dark Patterns to Light](https://www.ftc.gov/reports/bringing-dark-patterns-light) (2022) |
| `cta-click-here`, `cta-vague` | Link text such as "click here" or "more" fails to describe its purpose. | W3C, [WCAG 2.2 failure F84](https://www.w3.org/WAI/WCAG22/Techniques/failures/F84) |
| `link-utm-missing`, `link-utm-incomplete` | Always set `utm_source`, `utm_medium`, and `utm_campaign`. | Google Analytics Help, [Collect campaign data with custom URLs](https://support.google.com/analytics/answer/10917952) |
| `link-http` | Chrome marks every http page "Not secure". | Chromium Blog, [A secure web is here to stay](https://blog.chromium.org/2018/02/a-secure-web-is-here-to-stay.html) |
| `ai-*` | Words and patterns that editors flag as signs of generated text. These are style rules, not proof of authorship. | Wikipedia, [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) |

Sources were checked on 2026-10-03. Platform limits change; update the rule and this table
together.

## Limits of the checker

- Rules match words and patterns. They do not read meaning. A sourced claim in an unusual format
  can still be flagged; waive it with a reason.
- The checker cannot know whether a deadline, a stock count, or a number is true. It asks for the
  evidence.
- The address and unsubscribe checks look for text and common merge tags. They do not test the
  link or the List-Unsubscribe header.
- URL scans read the HTML that the server returns. They do not run JavaScript.

## Add a rule

Add the rule to `tools/check/rules.mjs` with an `id`, `family`, `severity`, `name`, `message`,
`fix`, and optional `channels`. Add it to this catalog, with a source when it encodes a limit. Add
a bad fixture line under `tools/e2e/fixtures/check/` and its expected id in `tools/e2e/check.mjs`.
Then run `node tools/e2e/check.mjs`.
