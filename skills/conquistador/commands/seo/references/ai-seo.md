---
method_updated: 2026-09-15
last_verified: null
verifier: none
status: draft
---

# Answer visibility audit

Use this method for AI-SEO Route B and Full Route E with `retrieval-layer-seo.md`,
`evidence-classes.md` and, for supplied reports, `live-serp-remediation.md`. It defines checks and
bounded observations. It does not claim that a provider rewards a writing pattern or crawler setting.

## Define the decision

Name the reader question, intended answer, owned page, relevant product fact and next action.
Select only the answer surfaces needed for that decision. Record the actual interface, query,
locale, date, account/session settings and model identifier when exposed. Search-result answers
and chat answers are separate observation groups. AEO and GEO are routing labels here, not a
claim about how a vendor retrieves or trains.

Google AI Overviews, Bing Copilot, ChatGPT, Perplexity, Claude, Gemini, Grok, You.com and Phind
may be named as requested targets. Availability, model version, browsing and source display must
come from supplied evidence or a separately authorized observation. Do not assume a platform's
preferred sources, a private prompt, or a training-versus-search pathway from its name.

## Diagnose from evidence

| Input | Check | Conclusion allowed |
|---|---|---|
| Organic clicks decline | Match query, page, market, device and windows; inspect tracking/index changes | A decline in that series; cause unresolved without further evidence |
| Captured answer cites a competitor | Inspect the actual cited page and supporting passage | That run cited that URL; the missing owned citation is a question to investigate |
| Brand mention without URL | Preserve the response and display state | Mention observed; source and retrieval pathway unknown |
| Referrer sessions | Match normalized host and declared metric/window | Sessions attributed by that analytics field; not total AI influence |
| Direct-traffic increase | Check campaign/tracking changes and other explanations | Unattributed traffic; never relabel it as AI traffic by a heuristic |
| Content or crawler evidence missing | Identify the needed file, response or log | Unavailable check and bounded request, not a fabricated finding |

## Review the answer and its support

Use `retrieval-layer-seo.md` to locate the exact passage, list, table cell or instruction under
review. Read it independently with its heading and necessary qualifiers. Can a reader identify
the subject, answer, conditions, units and source without guessing? Add only the context needed
to repair an identified omission. There is no required word band, number of headings, quotation,
statistic or third-party mention count.

Use a comparison table only for an actual decision with comparable criteria. Preserve units,
plan/version, limitations, date and provenance in each factual cell. Use a procedure when the
reader needs actions, prerequisites and a completion check. Use a definition when the task is
understanding a term. For a research finding, retain population, sampling, period, method,
denominator and uncertainty. Do not manufacture data to make a passage look authoritative.

A source must support the exact claim. An owned product specification can support an owned
capability; an external review does not automatically outrank it. Follow supplied citation chains
to their evidence, note inaccessible sources, and retain licenses and required attribution.
Do not add quotations or named authorities merely to increase citations.

## Plan and record observations

Before any authorized execution, declare queries, audience variants, surfaces, run budget,
comparison, observation window and stop condition. Choose scope from the decision and available
capacity. No fixed query/model/persona count establishes reliability. A missing provider stays
unavailable. Keep repetitions and changes to prompts visible; do not choose only favorable runs.

Record query, persona, surface, model/version or unknown, run id, time, source artifact,
mentioned status, cited URL, displayed supporting passage, accuracy against source and evidence
class. Separate mentions from citations, owned from third-party URLs, and URL resolution from
claim support. Report successes / completed eligible runs with exclusions; a descriptive
fraction has no universal strong/weak threshold. Repeated runs can share dependencies.

Preserve the baseline and exact edits. A post-change citation difference is an observation,
not proof that the edit caused it. Record model, indexing, audience and other content changes.
Use a comparison design only when its assumptions are justified. Do not subtract unrelated
traffic rates and label the result a causal AI lift. When no test ran, deliver the plan and unknowns.

## Analytics identifiers and source handling

The following existing host identifiers are candidates to match against supplied referrer data,
not a complete or verified attribution list:

`chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `www.perplexity.ai`, `claude.ai`,
`copilot.microsoft.com`, `gemini.google.com`, `bard.google.com`, `you.com`, `phind.com`,
`meta.ai`, `chat.mistral.ai`, `mistral.ai`, `kagi.com`, `arc.net`.

Parse a URL to its hostname and compare exact normalized hosts. Do not match arbitrary substrings
such as chatgpt.com inside another domain or a query string. Check whether a supplied analytics
field holds a hostname, source label or source/medium before filtering. Missing referrer stays
unknown. Preserve raw source values privately under the task's data policy.

| Existing technical interface | Task-local verification before use |
|---|---|
| GA4 Session source, Google Tag Manager, `ai_driven_session` | Field semantics, event scope, consent and deduplication; label any event by what was actually observed |
| Plausible `/api/v1/stats/aggregate`, `site_id`, `period`, `date`, `filters`, `visit:source`, `metrics` | Installed/API version, filter syntax and returned units; a legacy identifier is not a current recipe |
| Vercel `@vercel/analytics`, `track`, `document.referrer` | Installed package contract and event permission; do not install or dispatch just to audit |
| Fathom `https://api.usefathom.com/v1/aggregations`, `entity`, `entity_id`, `aggregates`, `date_from`, `date_to`, `referrer_hostname` | Request schema and aggregation scope in supplied documentation |
| Pirsch `/api/v1/statistics/visitor`, `referrer` | Whether filter uses host or source name, and metric scope |

Keep sessions, pageviews, unique visitors and conversions distinct. Do not sum distinct-user
counts across host groups unless the source guarantees disjoint populations. A dashboard names
metric, denominator, source, period, comparison and gaps. Referral counts do not count citations.

## Optional machine-readable content

Treat `/llms.txt`, `/llms-full.txt`, per-URL `.md`, `/.well-known/llms.json` and `/pricing.md`
as optional delivery proposals. Identify the actual consumer and its supplied contract before
implementation. Do not infer provider adoption, guaranteed parsing or mandatory file tiers.
Check each link, access boundary, content parity, canonical owner, update process and size budget.
A duplicate pricing file needs the same plan/version/currency/date as the authoritative page.
Never refresh a date without reviewing the underlying facts.

For an agreed Markdown link index, a synthetic local example is:

```markdown
# Example product

> Import review documentation.

## Documentation

- [Recover rejected rows](https://example.invalid/docs/recovery): Required fields and retry steps.

## Optional

- [Historical changes](https://example.invalid/docs/history): Prior version notes.
```

This demonstrates a local artifact, not a provider-recognized specification. Retain any applicable
license notices when using supplied specifications or code. Existing generator identifiers
`generateLLMsText()`, `generate_llms_text()`, `/v1/llmstxt`, `generate-llmstxt` and
`github.com/firecrawl/create-llmstxt-py` require current task-local support checks; their presence
here is not a recommendation to execute them. Mintlify output also needs parity and link review.
MCP is a separate tool/resource integration decision with authorization and maintenance costs;
it is not a required SEO upgrade or a substitute for a clear page.

## robots.txt AI Bot Allowlist

This heading remains for existing consumers. Audit policy; do not apply a blanket allowlist.
Preserve exact identifiers in supplied directives and logs, including `GPTBot`, `ChatGPT-User`,
`ClaudeBot`, `PerplexityBot`, `GoogleOther`, `Google-Extended`, `Bingbot`, `Applebot-Extended`,
`Bytespider` and `cohere-ai`. Similar names are not interchangeable controls.

For each relevant identifier record its documented purpose from supplied source evidence,
robots.txt rule/group/path, response status, authentication/network restrictions and observed
fetch evidence if any. Keep training, search indexing and user-triggered retrieval purposes
separate; unknown purpose remains unknown. A user-agent string alone does not authenticate a bot.
A directive is a policy signal, not proof of fetch, indexing, citation, or exclusion from every
answer pathway. Respect intentional restrictions. Any change requires the owner's exact scope.

Route a demonstrated access defect to technical review with URL, evidence and responsible owner.
Do not block local content repair merely because live access is untested. Keep deployment and
claims of live retrieval readiness pending until the relevant checks are resolved.

## Handoff

Use Issue / Impact / Evidence / Fix / Priority and the retrieval extension fields. Impact describes
the observed defect or reader cost; numeric effect forecasts need task evidence. Preserve before/
after artifacts, unresolved checks, owners, action boundaries and a next observation. Local
review does not prove ranking, retrieval, traffic, provider support or release readiness.
