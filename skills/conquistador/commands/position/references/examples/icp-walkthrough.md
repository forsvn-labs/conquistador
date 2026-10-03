# Example — Full ICP Walkthrough (Route B, fictional fixture)

> Load when an operator is learning the skill OR when synthesis-agent needs to see a worked example
> of the dispatch → critic → PASS arc end-to-end.
>
> **This is an explicitly fictional training fixture.** Every persona, product, quote, community,
> metric, and date below is invented for illustration. No real person, community, platform post, or
> market figure is cited or implied. All evidence is labeled with non-attributed source IDs
> (`SRC-01` … `SRC-n`) that exist only inside this document's provenance table. Never reuse these
> quotes, sources, or figures in real work; rerun the method against live, verifiable evidence.

---

## Brief

> "Research my ICP for a project management tool aimed at engineering teams."

Fictional product used throughout: **ProjectSync** — async project visibility for engineering teams.

---

## Provenance table (the fixture's spine)

Every quote and habitat claim in this walkthrough resolves to exactly one row here. A claim whose
source ID is missing from this table is unprovenanced and must fail Gate 1.

| Source ID | Fictional provenance record |
|---|---|
| SRC-01 | Community thread, practitioner forum, collected day −14, organic recruitment, bias: complainers overrepresented |
| SRC-02 | Review-site excerpt, collected day −13, self-selected reviewers, bias: polarized ratings |
| SRC-03 | Professional-network post, collected day −12, follower graph, bias: performative tone |
| SRC-04 | Practitioner chat channel excerpt, collected day −11, invite-only community, bias: senior-heavy sample |
| SRC-05 | Long-form practitioner interview (fictional), conducted day −10, recruited from SRC-01 thread, bias: single voice |

The table is deliberately minimal: it records **class, collection offset relative to run day 0, and
recruitment mechanism**, not a real venue name. In a real run these rows must point to citable,
verifiable locations instead.

---

## Step 0: Pre-Dispatch (fictional auto-scan)

Auto-scan of the supplied README + pricing page returned:

- Product: ProjectSync — async project visibility for engineering teams
- Buyer: Engineering managers at mid-size SaaS companies
- Problem: Hours lost to status updates nobody reads
- Pricing: $12/seat/mo, free for teams ≤5

Warm Start prompt emitted; operator confirmed geo focus (US + EU) and Route B (Full ICP).

Generated `product-context.md` with 8 sections plus canonical terminology (`project`, `update`,
`team`, `seat`).

---

## Layer 1: Parallel Dispatch

### Persona Agent returns (fictional)

> **Persona 1: The Overwhelmed EM** — 30–38, engineering manager, mid-size SaaS, 50–200 engineers.
> Goals: ship on schedule without burning out the team; give leadership visibility without
> micromanaging. Frustrations: status-update compilation crowds out real work [SRC-01].

### VoC Collector Agent returns (fictional quotes, all resolved)

> 18 quotes across 5 categories, each tagged with a source ID from the provenance table. Key
> mechanism quotes:
>
> - "No single tool shows me what my team actually shipped this week." — [SRC-01]
> - "My skip-level keeps asking me for updates I can't produce fast enough." — [SRC-03]
> - "I spent my whole Sunday catching up on status email." — [SRC-02]

### Habitat Agent returns (fictional)

Five named *classes* of habitat (practitioner forum, manager forum, professional network, short-post
network, practitioner chat) with H/M/L density and Lurker/Engager/Creator engagement, each row keyed
to a source ID. No real community names are used because this fixture has no live data behind them.

---

## Layer 2: Sequential Dispatch

1. **Pain analysis:** Status Update Theater → hidden spreadsheet workarounds → fear of looking
   disorganized; trigger: weekly reporting cadence [SRC-01, SRC-04]. Two further pains follow.
2. **Decision psychology:** trigger — promoted to manage a second team; biases — status quo and loss
   aversion; objections traced to roots ("We already have Jira" → sunk cost) [SRC-05].
3. **Synthesis:** Top 3 emotional drivers, each traced to 2+ attributed quotes:
   - Fear of being perceived as unable to scale [SRC-03, SRC-01]
   - Resentment of work that adds no value [SRC-01, SRC-02]
   - Pride in protecting the team's focus time [SRC-04, SRC-03]

---

## Critic Gate → conditional demonstration

### PASS case (all provenance resolves)

- **Gate 1 (VoC Evidence Integrity):** PASS — every quote carries a source ID, and every ID resolves
  to a provenance-table row.
- Gates 2–10 pass as in a real run: habitat specificity, driver traceability, decision-psychology
  specificity, quote volume, persona constraint, brief alignment, confidence labels, sample-bias
  acknowledgment, ≥5 sources per persona.

### FAIL case (provenance missing) — this fixture must not PASS here

Now remove the attribution from one synthesis quote:

> "My skip-level keeps asking me for updates I can't produce fast enough."

No source ID. The critic verdict is **FAIL**, not "PASS with reservations":

```markdown
## Verdict: FAIL

### Failure 1
**Section:** Top 3 Emotional Drivers, driver 1, quote 1
**Issue:** Quote carries no source ID and matches no provenance-table row.
**Standard violated:** Gate 1 (VoC Evidence Integrity)
**Specific fix:** Attach the source ID and confirm it resolves to a provenance record with class,
collection date, recruitment mechanism, and stated bias — or delete the quote.
**Agent to re-dispatch:** synthesis-agent

Verdict is binary. An unprovenanced quote makes the whole artifact FAIL even if every other gate
passes. Fabricating an attribution to satisfy the gate is a worse violation than the missing one.
```

This is the rule the fixture exists to teach: **a provenance gap is a FAIL, never a silent pass and
never something to paper over with an invented citation.**

---

## What this example does NOT show

- Real communities, platforms, people, dates, or market numbers — none exist behind this fixture.
- A critic FAIL→rewrite cycle beyond the provenance demonstration above; see
  `agents/icp-critic-agent.md` § "FAIL example."
- Route A / Route C variants, `--fast` mode, multi-persona artifacts — same structure as a real
  walkthrough would show; nothing here depends on fiction versus fact.
