# Anti-Patterns — SEO

> Load when drafting recommendations or evaluating critic-FAIL feedback. Detection rules tell you *how to catch* the failure mode; bad/good examples show *what counts*.

Keep the numbered checks as stable references. Retrieval checks use auditable task evidence, not platform benchmark claims.

Per-pattern ownership maps to `agents/critic-agent.md` Rewrite Routing Table; agent column tells you who to re-dispatch on critic FAIL.

---

## 1. Vague findings

A finding must name the exact page/passage, observed defect and implementable correction.
Synthetic example: a homepage heading says only Welcome; replace it with the product's supplied
category and audience when those facts are supported. Do not attach an invented query share.


## 2. Keyword stuffing (traditional or AI)

**Detection:** findings recommend "include keyword X N times" / "repeat keyword in H1, H2, H3, meta, alt-text" / "density should be 2-3%."

**Bad:** "Use 'project management software' 8 times on the homepage and in every H2."
**Good:** "Update homepage H1 to 'Project management software for engineering teams' (currently 'Welcome to Acme'). Use the supplied product and audience facts; no query-share claim is needed."

**Why it matters:** Repetition can obscure the answer. Review the meaning of each occurrence; do not assign a visibility effect.

**Owned by:** content-quality-agent (traditional) + ai-structure-agent (AI). Critic catches via gate 3 (no vague language) — keyword-density recommendations are also typically vague.

---

## 3. pSEO as a content farm

**Detection:** Programmatic SEO findings recommend "generate 10,000+ pages from [data source]" without per-page uniqueness threshold OR without a quality-gate sample evaluation.

**Bad:** "Build a page for every city × every service combination — 50,000 pages."
**Good:** "Build pages for top 500 city × service combos with: (a) ≥60% unique content per page (CMS plugin enforces); (b) 3 local-specific paragraphs per page; (c) verified data source. Reject the remaining 49,500 — they would be thin."

**Why it matters:** Helpful Content Update explicitly targets thin-template farms; one HCU hit drags entire domain quality.

**Owned by:** programmatic-template-agent (per-page uniqueness definition) + programmatic-quality-agent (sample evaluation + monitoring plan). Critic gate 8 (AI SEO recommendations platform-specific) doesn't catch this — programmatic-quality-agent's self-check does.

---

## 4. Unexamined third-party evidence

A displayed third-party citation is a source to inspect, not a reason to order review quotas or
claim third-party dominance. Check which fact the page supports, ownership, date and limitations.
Report missing evidence as unknown; preserve honest owned product sources when they support the claim.


## 5. Crawler policy treated as a citation outcome

Do not infer that GPTBot, ClaudeBot, PerplexityBot or GoogleOther directives prove citations are
possible or impossible. Record purpose, path, policy and observed response separately. Preserve
intentional restrictions and request owner authority for changes. Local content review can proceed
with access checks pending; do not claim tested live readiness.


## 6. Flat competitor comparison tables

**Detection:** Comparison Pages mode findings show feature-by-feature tables with checkmarks (✓/✗) and no use-case context, no honest competitor strengths section.

**Bad:** Table with 30 features × 5 competitors, all checkmarks, no narrative.
**Good:** "Compare by use case: 'For teams under 10' → us (specific reasons), competitor-X (specific reasons), competitor-Y (specific reasons). Cells carry data ('Up to 25 users / $9/seat'), not symbols."

**Why it matters:** Flat tables don't answer "which is right for me?" — the actual searcher intent. Honest comparison pages rank because they're useful.

**Owned by:** comparison-page-agent. Critic catches via gate 1 (Evidence field; checkmarks = no evidence).

---

## 7. Schema evidence mismatch

Report what the supplied raw HTML, rendered output and validation artifact actually show.
Raw-only evidence cannot establish that rendered schema is absent. Do not assume a CMS injection
mechanism either. Name the missing check and keep it pending. Choose schema from visible supported
content and applicable documentation; validation alone does not establish a citation benefit.


## 8. One-and-done audits

**Detection:** Next Step section is blank, or says "implement and you're done," or has no re-audit timeline.

**Bad:** "Implement the recommendations." (Next Step section)
**Good:** "Quarterly technical re-audit (next: 2026-08-18). Monthly AI visibility check (next: 2026-06-18). Re-run after next Google core update (subscribe to Search Liaison Twitter). When entering new keyword territory (e.g., expanding to EU), trigger full Route E."

**Owned by:** prioritization-agent (Phase 4 Ongoing in Implementation Plan) + `format-conventions.md` Next Step requirement (orchestrator-enforced at merge). No critic gate covers re-audit cadence directly — agent self-check + format template are the safety net.

---

## 9. "Consider improving" recommendations

**Detection:** any Fix field contains hedge words: "consider," "might want to," "could potentially," "it may help to," "think about," "you may want to," "perhaps."

**Bad:** "Consider improving your title tags."
**Good:** "Update the title tag on /pricing from 'Pricing' (7 chars) to 'Project Management Pricing | Plans from $9/mo' (48 chars). Proposed check: compare the supported description with the actual page and inspect the supplied preview; CTR effect remains untested."

**Owned by:** producing agent (whoever generated the finding). Critic gate 3 enforces.

---

## Retrieval-layer failures (10-13)

These apply when AI-SEO (Route B) or Full SEO (Route E) is active. Source of truth for the framework these patterns enforce: `references/retrieval-layer-seo.md`.

---

## 10. Discovery files without a consumer

A proposed llms.txt, llms-full.txt, .md companion or JSON manifest needs an actual use, content
owner, parity/link checks and maintenance plan. Do not require a file hierarchy to pass an audit.
First identify the reader/consumer need and supported answer. A file's existence proves no citation gain.


## 11. Citation used as decoration

A citation must support the adjacent claim under the same scope and conditions. Inspect the
supplied source and preserve its limitations and license. Do not assign retrieval weights from
a source's prestige, traffic or class. Report an inaccessible source instead of inventing its contents.


## 12. Content shaped to a count gate

Word bands, paragraph counts, FAQ quotas and entity quotas do not establish answer quality.
Test whether the passage delivers the question's answer with necessary context and support.
Add or remove structure only to repair a specific navigation, comparison or comprehension defect.


## 13. Unsupported live delivery claim

Fail a claim that retrieval readiness was verified when access evidence is absent or contradicts
it. Interpret canonical, directives and sitemap findings for the specific URL and intended purpose.
Route demonstrated technical defects to the relevant owner. Do not erase a useful offline content
proposal or demand policy changes because a provider outcome remains unobserved.


## Cross-cutting marketing-stack failures (14-17)

These apply across all marketing-skills, not just seo. Same detection/fix shape; ownership clarified.

---

## 14. Polish-Chain on FAIL

**Detection:** Critic returned FAIL and orchestrator dispatched polish-chain (humanmaxxing, vn-tone) on findings that haven't been re-dispatched per Rewrite Routing.

**Bad:** Critic FAILs gate 1 ("Evidence missing in 3 findings") → orchestrator runs humanmax on the whole doc.
**Good:** Critic FAILs gate 1 → orchestrator re-dispatches named agent (e.g., content-quality-agent) with specific feedback → produces revised findings → re-merge → critic re-evaluates. Polish chain ONLY after PASS.

**Owned by:** orchestrator (Step 8 of Dispatch Protocol). Polish-chain is post-PASS only.

---

## 15. Multi-mode in one invocation

**Detection:** invocation says "do audit + AI + programmatic" → orchestrator runs all routes in one pass and merges into one artifact.

**Bad:** One artifact mixing Technical Audit findings, AI SEO recommendations, and Programmatic SEO template specs.
**Good:** Three sequential invocations producing `seo-audit.md`, `seo-ai.md`, `seo-programmatic.md`. Mode is per-artifact. Operator chains: start with Audit (foundational), then AI, then Programmatic.

**Why it matters:** Each mode's critic checklist is mode-specific; mixing dilutes per-mode rigor. Also: per-mode artifact paths are part of the contract; downstream tools (manifest-sync, copywriting reads) expect one mode per file.

**Owned by:** orchestrator (Step 2). Use Route E (Full SEO) only for Technical+AI explicitly; that route produces TWO artifacts.

---

## 16. VN-market output without vn-tone

**Detection:** Cold Start Q4 (geo + language scope) declared a Vietnamese market and the artifact ships without a vn-tone polish pass on user-facing copy (Findings narrative, Priority Actions, Next Step).

**Bad:** Vietnamese-market SEO audit delivered in English-syntax-direct-translated Vietnamese (passive-voice calques, missing particles).
**Good:** Generate findings in English (agents are English-only), then route the artifact through `polish-vietnamese` for the user-facing prose pass. Frontmatter `status: done_with_concerns` if vn-tone not run; recommend the polish step in Next Step.

**Owned by:** orchestrator (Step 8 deliver). Operator may override per scope.

---

## 17. Contract drift

**Detection:** artifact frontmatter missing one of (skill, mode, version, date, status), OR `mode` value not in the enum (audit / ai / programmatic / competitor / aso), OR body missing one of the H2 sections (Diagnosis / Findings / Priority Actions / Implementation Plan / Dependencies / Metrics to Track / Next Step).

**Bad:** Artifact with `mode: technical-audit` (not enum value), missing Dependencies section.
**Good:** `mode: audit` (enum), all 7 H2 sections present even if some are "(none for this mode)".

**Why it matters:** the artifact frontmatter contract reads frontmatter to index; `write-copy` reads body sections by name. Drift breaks downstream tools silently.

**Owned by:** orchestrator (Step 5 merge into artifact template). Critic gate 1 catches missing fields per finding but doesn't validate frontmatter — operator + sync-script catch frontmatter drift.
