import { describe, expect, it } from "vitest";

import {
  ENGINEERING_OUTCOMES,
  ENGINEERING_WORKFLOWS,
  PARENT_JOBS,
  requestedEngineeringOutcome,
  isEngineeringOutcome,
  isEngineeringWorkflow,
} from "../src/routing-manifest.ts";

describe("parent routing manifest", () => {
  it("recognizes explicit engineering requests without capturing marketing mentions", () => {
    for (const prompt of ["Specify the product UI", "Please design a user interface", "Build an iOS app", "Map the onboarding user flow", "Architect the software system", "Write technical docs", "Build a web app", "Could you please specify the product UI"]) {
      expect(requestedEngineeringOutcome(prompt), prompt).toBeDefined();
    }
    for (const prompt of ["Write launch copy for a web app", "Audit marketing for this software system", "Create a product UI announcement", "Write launch copy for our tool that helps teams build a web app", "Audit our campaign headline: Build an iOS app", "Do not build a web app; write marketing copy"]) {
      expect(requestedEngineeringOutcome(prompt), prompt).toBeUndefined();
    }
  });
  it("recognizes exact engineering outcome names through the parent", () => {
    for (const id of ENGINEERING_OUTCOMES) {
      expect(requestedEngineeringOutcome(`/conquistador ${id}: requested work`)).toBe(id);
      expect(requestedEngineeringOutcome(`Write launch copy about ${id}`)).toBeUndefined();
      expect(requestedEngineeringOutcome(`/conquistador ${id}-example`)).toBeUndefined();
    }
  });
  it("keeps compatible job values and identifies the five engineering outcomes", () => {
    expect([...PARENT_JOBS]).toEqual([
      "launch-or-grow",
      "create-or-improve",
      "learn-from-results",
    ]);
    expect([...ENGINEERING_OUTCOMES]).toEqual([
      "architect",
      "ui",
      "build",
      "flow",
      "docs",
    ]);
    expect([...ENGINEERING_WORKFLOWS]).toEqual([
      "spec",
    ]);
    expect(isEngineeringOutcome("flow")).toBe(true);
    expect(isEngineeringOutcome("copy")).toBe(false);
    expect(isEngineeringWorkflow("spec")).toBe(
      true,
    );
    expect(isEngineeringWorkflow("landing-page-messaging")).toBe(
      false,
    );
  });
});
