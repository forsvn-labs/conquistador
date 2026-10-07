# Product progress

## Unshipped

- **Check receipts and host verification.** A third deployed-agent run (Haiku 4.5, compact brief)
  delivered emails that failed the check (7 errors, including a fake `RE:` subject and an unfilled
  address placeholder) while reporting them clean. `conquistador_check` now returns a receipt for
  the exact text (SHA-256 after line-ending and trailing-space normalization, `clean`, `blocking`,
  channel), signed with `CONQUISTADOR_RECEIPT_KEY`, and `conquistador_verify` lets a host confirm
  the final text against it. Invalid tool arguments now name the arguments the tool takes. INSTALL
  states the model guidance: Sonnet-class or stronger unsupervised; smaller models only with
  host-enforced verification.
- **Rubric gates, compact briefs, and a custom domain.** `conquistador_score` checks a rubric
  self-score against a gate the rubric declares (floors, totals, the concerns band, N/A rules,
  level scales, hard fails); the outreach rubric declares the first gate. `size: "compact"` briefs
  inline only the command and list its core files as required reads (18 KB instead of 42 KB for
  outreach). The Worker serves `mcp.forsvn.com`, where a host-scoped Cloudflare configuration rule
  turns off the browser integrity check, so plain `urllib` clients are not refused.
- **Fixes from the second deployed-agent run.** The context check reads every number in the
  context (so "50-500" covers "50 to 500") and no longer treats pronouns, weekdays, or words after
  the clause as customer names. New email rules flag presumed pain ("I noticed your team is
  struggling"), timing that depends on the send gap ("I wrote last week"), and a postal address
  left as a merge tag. Hosted briefs point single agents to the sequential fallback, "cold email"
  brings the email channel guide, and `welcome.md` no longer enters briefs.
- **Outreach for products with no proof yet.** `outreach` 2.3.0 adds an early-stage mode (honest
  substitutes for proof: a pilot or design-partner offer, a first run on the prospect's data, a
  labelled sample output, the founder's reason, an observed problem), sequence mechanics (one new
  element per touch, spacing from the buyer's cycle, threading, when to stop), and a worked
  3-email SaaS sequence with a weak version and its flaws. `outreach-decisions` stays in Core.
  `outreach` 2.4.0 fixes three findings from the second deployed-agent run: the mode separates
  the proof stages (no users; users but no measured results; results but no publishable case
  study) and forbids upgrading or downgrading the stage; a substitute without sender input becomes
  a pre-send gap; and the worked sequence now uses a different synthetic product (Plinthwise) than
  the Ledgerline e2e task.
- **Hosted briefs and claim checks from the deployed-agent findings.** Every brief starts with the
  route ("Start here") and a rule to lead with the requested deliverable. Over HTTP the brief says
  the agent has no repository, so file-writing steps become content in the answer, and it returns
  structured lists (`inlined`, `readNow`, `readAtStep`, `situational`). `conquistador_read` names
  the cause of a failed read (not found, too large, invalid path) and resolves relative links with
  `from`. `conquistador_check` takes the brief's `context` and flags numbers and customer names
  the context lacks (`claim-not-in-context`).
- **Playbooks distilled from the imported library.** Five read-only workers triaged 205 sources (194
  articles and 11 GTM books in the IPSE vault): 65 had procedures that the library lacked, 7 went
  to the private overlay, 133 were reading material. Four editors applied about 330 rules in our
  own words across 22 commands, 3 channel guides, and 4 plays, with 11 new reference files (for
  example Apple Search Ads, local SEO, creator programs, account programs, intro requests, an app
  onboarding-to-paywall flow, and a misjudgment check for `decide`). Source numbers, benchmarks,
  and deceptive tactics stay out; the rules keep the procedure. Changed commands bump their minor
  version. Apple Search Ads requests now reach the new Apple pack.
- **Tools for deployed agents.** The MCP server adds `conquistador_check` (the rule-based checker
  for text the caller sends) and an optional `context` input on `conquistador_brief`, so an agent
  without a repository gets a self-contained work order. Every brief now requires the check before
  handover. The email `cta-missing` rule accepts a short direct question that asks for a reply.
  The HTTP image now copies `tools/context-files.mjs`; before, a hosted brief failed. The server
  runs as a Cloudflare Worker (`worker.mjs`, `wrangler.toml`) that reads the library from its
  bundle and refuses requests until its token is set. The agent-loop E2E passes in workerd through
  `wrangler dev`, including methods, files, read, and search. Deployed on 2026-10-07 to
  `https://conquistador-mcp.levinhhungg.workers.dev/mcp` (1.95 MiB gzip); the agent-loop E2E passes 7/7
  against it. The deployed Worker is not an npm release. `tools/e2e/agent-loop.mjs` checks the loop over HTTP.
- **Briefs inline each command's Core list.** A brief included only the top three lexical matches,
  so it could leave out files that `COMMAND.md` says to read in full. A Claude agent that used only
  the HTTP endpoint found this on 2026-10-07: the outreach brief carried 2 of its 5 core files.
  The check now returns structured results with a `blocking` count, accepts natural-length action
  lines and reply questions in email, and every brief states that a clean check does not verify facts.
- **Default branch is `main`.** It was `private-alpha`; GitHub redirects old branch links. CI,
  the release steps in CONTRIBUTING, and documentation links now use `main`. The acceptance
  checklist is now `docs/PUBLIC-ALPHA.md`. The `jobs` and Eve export messages link to `main`.
  CHANGELOG and dated review records keep the old name where it was true.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
