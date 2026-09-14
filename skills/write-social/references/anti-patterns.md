# Social copy anti-patterns

These are original artifact checks. They do not claim measured platform penalties.

## 1. Generic Hook Opener
The opening does not identify a task, reader decision or usable answer. Cite what is missing;
do not reject a phrase solely because it lacks taxonomy membership.

## 2. Unusable CTA path
The copy requests an action without a clear destination, delivery plan or relevant offer.
Check the supplied preview and each step. Unknown visibility stays pending for all formats.

## 3. Format Mismatch
The artifact omits required thread items, slides, caption/script alignment or launch components,
or supplies a different format from the brief. Name the missing production unit and owner.

## 4. Unchecked copy constraints
Counts are missing, inaccurate or compared against an unevidenced platform limit. Record the
account, format, source and scope of supplied constraints; distinguish a local drafting budget.

## 5. Brand-Voice Ignored
The copy contradicts the supplied founder/company voice or lexicon. Cite the instruction and
passage. Do not infer personal experience from founder mode.

## 6. Reading discontinuity
A transition repeats the claim, changes subject without explanation or interrupts the answer.
Name the two passages and the missing connection. Break counts are not performance evidence.

## 7. Pasted-From-Blog Body
The draft retains setup, headings or references that need another document to make sense.
Deliver the promised answer in the requested artifact and identify any deliberate external dependency.

## 8. Engagement-Bait CTA
The request seeks token interactions without delivering value, or manipulates votes/reactions.
Replace it with a useful question or direct action. This safeguard does not need an algorithm claim.

## 9. Unexplained external destination
A URL or profile instruction lacks context, disagrees with the offer or has no delivery owner.
Check destination fit; do not assume an in-body link reduces distribution.

## 10. Hook–Body Disconnect
The opening promises a result or answer the body does not deliver. Cite the promise and missing
support. A claim needs evidence even when the opening sounds specific.

## 11. Polish Chain Routed on FORMAT_FAIL or FAIL Artifact

**Definition:** Orchestrator invokes the optional `editorial-polish` or `polish-vietnamese` sibling skill as a terminal pass on an artifact that critic returned as `fail` OR that format-checker returned as FORMAT_FAIL. Polish skills don't fix critic-fail issues (generic hook, format mismatch) or format-fail issues (hard-cap violation that copywriter couldn't resolve in one revision cycle).

**Detection rule:** If `polish_chain_applied != none` in frontmatter AND (`critic_verdict == fail` OR `status == blocked` from FORMAT_FAIL) = TRIGGERED.

**Owned by:** Orchestrator ([sequential fallback](../fallbacks/sequential.md) polish-chain handoff). Polish chain runs ONLY after PASS or DONE_WITH_CONCERNS.

**Why it fails:** Polishing a critic-failed copy doesn't fix the underlying issue. The polish skill will rewrite Body + CTA but Hook variants stay (per polish-chain contract — preserves A/B comparability), and the failing dimension (typically Hook scroll-stop or Format compliance) won't improve. Operator wastes a polish-skill invocation on copy that needs a copywriter re-run, not a register polish.

---

## 12. Multi-Platform in One Invocation

**Definition:** Operator requests write-social for multiple platforms in a single run (e.g., `/write-social "fire the agency" tiktok+linkedin --variants 2`) or orchestrator silently generates copy for >1 platform.

**Detection rule:** If `platform` frontmatter contains a `+` or `,` or list value (anything other than a single value from `tiktok | reels | shorts | x | linkedin`) = TRIGGERED.

**Owned by:** Orchestrator ([critical gates](critical-gates.md) + [sequential fallback](../fallbacks/sequential.md) — single-platform per invocation). Multi-platform = re-invoke per platform.

**Why it fails:** Each artifact needs its own audience, account constraints, preview and production checks.

---

## 13. Vietnamese-Market Copy Without polish-vietnamese Polish

**Definition:** Brief or topic explicitly targets the Vietnamese market (Vietnamese-language copy required) but `polish_chain_applied: none` in frontmatter — polish-vietnamese terminal pass was skipped.

**Detection rule:** If brief / topic mentions Vietnam, Vietnamese, VN, or supplies Vietnamese-language source text AND `polish_chain_applied != polish-vietnamese` = TRIGGERED.

**Owned by:** Sequential fallback / Cold Start ([critical gates](critical-gates.md) should default `--polish-chain polish-vietnamese` when market signal is Vietnamese). Orchestrator confirms at Cold Start / Warm Start.

**Why it fails:** Vietnamese register polish requires native-register awareness (báo chí for news/professional, semi-casual for B2B SaaS founder voice, bro for indie/casual, pop-marketing for consumer brands). Copywriter-agent generates English-pattern Vietnamese that reads as translated AI output — pronoun drift, missing particles, literal idioms, passive-voice calques. polish-vietnamese is the terminal fix.

---

## 14. Cross-Stack Contract Drift

**Definition:** Refactor or schema change to the artifact frontmatter or required body sections (Hook variants A/B + Body + CTA + Format spec + Critic verdict + Anti-patterns triggered) ships without atomic update of downstream consumers (editorial-polish / polish-vietnamese / eval-loop / operator publish workflow).

**Detection rule:** If a code review or diff modifies `format-conventions.md` § "Frontmatter schema" OR § "Required body sections" OR § "Critic verdict table" without a paired update to:
- optional `editorial-polish` sibling's body-section reader, when installed (reads `## Body` + `## CTA`)
- optional `polish-vietnamese` skill's body-section reader + register hook check, when installed
- optional eval-loop artifact-type classifier, when the local store exists (if `type` field changes; not shipped in this skill)
- optional eval-loop results.tsv ingestion, when the local store exists (if `critic_score` or `critic_verdict` field semantics change)

= TRIGGERED.

**Owned by:** Refactor program — guardrail enforced at PR review time (rule: "artifacts ↔ evals contract is sacred"; schema changes require atomic update in the same commit). The umbrella `agent-skills` repo's refactor protocol documents the full rule; this catalog row is the per-skill instance.

**Why it fails:** Polish-chain skills silently fail (rewrite wrong sections, skip required updates) when frontmatter or body schema drifts. eval-loop ledger ingests stale or malformed scores. Operator publish workflow breaks parse on missing or renamed sections. The cascade is invisible until someone notices a polish run produced an empty or duplicated artifact — by which point multiple downstream artifacts are corrupted.

---

## 15. Internal-bureaucracy native copy / unverified first-person

**Definition:** The customer-facing post uses release-process language (NO-GO, sitting, ZIP vs npm,
four-module ledger, ticket IDs) or first-person lived experience that is not in a verified
operator-experience packet.

**Detection rule:** Native post body contains `NO-GO`, `FOR-`, `ZIP`, `npm tarball`, `releaseRequired`,
or “I live in / I didn’t want” as a claim about the writer, without a cited operator-experience
source → TRIGGERED. “I already work in” as **audience targeting** is not this trigger. Native post
body contains a send/publish gate (“Nothing posts until a human says so”,
“Nothing sends without your approval”) → TRIGGERED; those sentences belong in operator notes.
Population claim with no sample (“Most founders already…”, “Everyone in this role…”) → TRIGGERED.
“Not publicly released” is allowed. Affiliation (“I work on this product”) is allowed.
Audience narrowing (“For people who already draft GTM inside a coding agent”) is allowed when it
does not assert a population fact.

**Owned by:** critic-agent (this sitting). SKILL Stops **Unverified first-person** and
**Internal jargon in native copy** are the vocabulary. This row is a pointer, not a fourth
grouping. Copywriter / launch-copywriter method bullets are out of this unique set.

**Why it fails:** Readers cannot use the post. Internal notes do not cure unsupported claims in the
native copy. A population claim without a sample is not a professional tension.

---

## Changelog
