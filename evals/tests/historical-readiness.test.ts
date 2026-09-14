import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { it, expect } from "vitest";
import { root } from "./helpers";

it("retains the private historical live-readiness authority assertion", () => {
  const readiness = JSON.parse(readFileSync(resolve(root, "../release/evidence/exts-156/live-execution-readiness-v1.json"), "utf8"));
    expect(readiness).toMatchObject({
      executions: { providerCalls: 0, completedCandidateExecutions: 0, humanVerdicts: 0 },
      gates: { exts156: "OPEN", g2: "INCOMPLETE", humanVerdict: "pending", releaseEligible: false, authority: "none" },
      redaction: { credentialValuesRecorded: false, modelOutputsRecorded: false },
    });
    expect(JSON.stringify(readiness)).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
});
