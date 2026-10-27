import { describe, expect, it } from "vitest";

import { normalizeDraft } from "../src/draft-normalizer";

const arms = ["bare", "method"];
const rules = (text: string, stripHeadings: string[] = []) =>
  normalizeDraft(text, { identityTokens: arms, stripHeadings }).removals.map((removal) => removal.rule);

describe("draft normalizer: identity leaks through text", () => {
  it("removes YAML and TOML front matter", () => {
    const yaml = normalizeDraft("---\nskill: copy\narm: method\n---\n\nHello there.\n", { identityTokens: arms });
    expect(yaml.text).toBe("Hello there.");
    expect(yaml.removals[0]).toMatchObject({ rule: "front-matter" });
    expect(yaml.removals[0]!.excerpt).toContain("arm: method");
    expect(normalizeDraft("+++\nmodel = 'x'\n+++\nBody.", { identityTokens: arms }).text).toBe("Body.");
  });

  it("removes metadata fences but keeps deliverable code fences", () => {
    const result = normalizeDraft(
      "Intro.\n\n```yaml\nskill: copy\nstatus: REVISE\nsurface: hero\n```\n\n```js\nconst price = 12;\n```\n",
      { identityTokens: arms },
    );
    expect(result.text).not.toContain("skill: copy");
    expect(result.text).toContain("const price = 12;");
    expect(result.removals.map((removal) => removal.rule)).toEqual(["metadata-fence"]);
  });

  it("unwraps a fence that wraps the whole deliverable, then cleans its inside", () => {
    const result = normalizeDraft(
      "# Pricing section — method arm\n\n```markdown\n## Pricing\n\n$12 a month.\n\n**Readiness:** ready\n```\n\nWord count: 52\n",
      { identityTokens: arms },
    );
    expect(result.text).toBe("## Pricing\n\n$12 a month.");
    expect(result.removals.map((removal) => removal.rule).sort()).toEqual(
      ["arm-label", "length-marker", "readiness-label", "wrapper-fence"].sort(),
    );
  });

  it("does not treat headings inside a code fence as sections", () => {
    const result = normalizeDraft("Keep.\n\n```text\n## Why these choices\nliteral\n```\n\nAfter.", { identityTokens: arms });
    expect(result.text).toContain("## Why these choices");
    expect(result.removals).toEqual([]);
  });

  it("removes arm labels and provenance paragraphs", () => {
    const source = [
      "# Copy · method draft · Brief A (Ledgerly)",
      "",
      "Written after reading `commands/copy/ENTRY.md`, `references/{a,b}.md`,",
      "the walkthrough, and agents `hook` and `critic`.",
      "Run as the sequential fallback.",
      "",
      "Single-context review; not independent corroboration.",
      "",
      "Arm: bare",
      "",
      "Written by Mai, who closed agency books for six years.",
    ].join("\n");
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.text).toBe("Written by Mai, who closed agency books for six years.");
    expect(result.removals.map((removal) => removal.rule)).toEqual(["arm-label", "provenance", "provenance", "metadata-line"]);
  });

  it("removes process preambles and dated header lines seen in real review samples", () => {
    const source = [
      "Written before reading any `flow` file. Facts from Brief B only.",
      "",
      "Routing note: the brief tool returned none for this request.",
      "",
      "**Method rules that changed this draft:**",
      "- Lead with the buyer's moment.",
      "",
      "**Date:** 2026-10-24 | **Mode:** AI search",
      "",
      "## Plan",
      "Ship the page.",
    ].join("\n");
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.text).toBe("## Plan\nShip the page.");
    expect(result.removals.map((removal) => removal.rule)).toEqual(["provenance", "provenance", "provenance", "metadata-line"]);
  });

  it("removes the list that a provenance line introduces with a colon", () => {
    const source = "Method rules that changed this draft:\n\n- ENTRY: one to four briefs.\n- Lead with the change.\n  More on that.\n\n## Ideas\n1. First idea.";
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.text).toBe("## Ideas\n1. First idea.");
    expect(result.removals.map((removal) => removal.rule)).toEqual(["provenance"]);
  });

  it("reports internal agent names as residual leaks", () => {
    expect(normalizeDraft("## Content structure (ai-structure-agent)\nBody.", { identityTokens: arms }).residualLeaks).toEqual(["ai-structure-agent"]);
  });

  it("removes typical rationale, self-score, and review sections with their subsections", () => {
    const source = [
      "## Hero",
      "Headline.",
      "## Why these choices",
      "1. Because.",
      "### Detail",
      "More reasons.",
      "## Section 2",
      "Body two.",
      "## Self-score",
      "| Dimension | Score |",
      "## Critic verdict",
      "PASS.",
      "## Swap test and first-screen test",
      "Pass.",
      "## Claims to verify",
      "| Claim | Evidence |",
      "### Anti-patterns triggered",
      "None.",
      "## 3. Rationale",
      "x",
    ].join("\n");
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.text).toBe("## Hero\nHeadline.\n## Section 2\nBody two.");
    expect(result.removals.every((removal) => removal.rule === "method-section")).toBe(true);
    expect(result.removals.map((removal) => removal.excerpt.split("\n")[0])).toEqual([
      "## Why these choices",
      "## Self-score",
      "## Critic verdict",
      "## Swap test and first-screen test",
      "## Claims to verify",
      "## 3. Rationale",
    ]);
  });

  it("strips extra pack-declared headings", () => {
    expect(rules("## Anchor\nAudience notes.\n\n## Hero\nH1.", ["Anchor"])).toEqual(["method-section"]);
    expect(normalizeDraft("## Anchor\nAudience notes.\n\n## Hero\nH1.", { identityTokens: arms, stripHeadings: ["anchor"] }).text).toBe("## Hero\nH1.");
  });

  it("removes readiness labels, keeping the body under a readiness wrapper heading", () => {
    const source = "## Ready to use\n\n### Hero\n\nH1 text.\n\n**Status:** REVISE pending facts\n\nPASS\n\nGood line [READY] here.\n\n✅ Ready to ship";
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.text).toBe("### Hero\n\nH1 text.\n\nGood line here.");
    expect(result.removals.every((removal) => removal.rule === "readiness-label")).toBe(true);
    expect(result.removals).toHaveLength(5);
  });

  it("keeps experiment and decision vocabulary that is part of the deliverable", () => {
    const source = [
      "**Verdict: Not a real win. Keep A live and rerun the test.**",
      "",
      "- Variant: the same page plus a free 15-minute call option.",
      "- Baseline: 4.0% of visits book. Measure attendance in the control arm.",
      "- Split traffic evenly between the control and treatment variants.",
      "- Status: two of the three clinics are ready to start.",
      "- Confidence: moderate, because 9 bookings is a small sample.",
    ].join("\n");
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.removals).toEqual([]);
    expect(result.text).toBe(source);
  });

  it("still removes arm, condition, verdict, and status labels that identify an arm or grade the draft", () => {
    const source = [
      "Variant: method",
      "Condition: with method",
      "Verdict: PASS",
      "**Status:** REVISE pending facts",
      "Confidence: high",
      "This is the baseline draft.",
      "",
      "Raise the price to $59 for new customers.",
    ].join("\n");
    const result = normalizeDraft(source, { identityTokens: arms });
    expect(result.text).toBe("Raise the price to $59 for new customers.");
    expect(result.removals).toHaveLength(6);
  });

  it("removes length markers", () => {
    const result = normalizeDraft("Body text here (212 words).\n\nWord count: 212\n\n**Length:** 1,200 characters\n\n[~150 words]", { identityTokens: arms });
    expect(result.text).toBe("Body text here.");
    expect(result.removals.map((removal) => removal.rule)).toEqual(["length-marker", "length-marker", "length-marker", "length-marker"]);
  });

  it("removes file names, dropping a parenthetical that only cites a file", () => {
    const result = normalizeDraft("Opening avoids pleasantries (see `references/anti-patterns.md`). Per page-sections.md, price shows.", { identityTokens: arms });
    expect(result.text).toBe("Opening avoids pleasantries. Per [file], price shows.");
    expect(result.removals.map((removal) => removal.rule)).toEqual(["file-name", "file-name"]);
  });

  it("normalizes whitespace style so it cannot identify an arm", () => {
    const a = normalizeDraft("﻿Line one.  \r\n\r\n\r\n\r\nLine two.\r\n\r\n", { identityTokens: arms });
    const b = normalizeDraft("Line one.\n\nLine two.", { identityTokens: arms });
    expect(a.text).toBe(b.text);
  });

  it("reports residual arm names and product names it did not remove", () => {
    const result = normalizeDraft("Pick a payment method today. Built with Conquistador.", { identityTokens: arms });
    expect(result.residualLeaks).toEqual(["method", "conquistador"]);
    expect(normalizeDraft("Clean copy.", { identityTokens: arms }).residualLeaks).toEqual([]);
  });

  it("reports an excerpt for every removal so a human can audit it", () => {
    const result = normalizeDraft("---\na: b\n---\n# X · bare draft\n\nText (9 words)", { identityTokens: arms });
    for (const removal of result.removals) expect(removal.excerpt.trim().length).toBeGreaterThan(0);
    expect(result.words).toBe(1);
  });
});
