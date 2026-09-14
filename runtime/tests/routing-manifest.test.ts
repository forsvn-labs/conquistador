import { describe, expect, it } from "vitest";

import {
  DIRECT_ONLY_ENGINEERING_OUTCOMES,
  DIRECT_ONLY_ENGINEERING_WORKFLOWS,
  PARENT_JOBS,
  hasDirectOnlyEngineeringIntent,
  isDirectOnlyEngineeringOutcome,
  isDirectOnlyEngineeringWorkflow,
} from "../src/routing-manifest.ts";

describe("parent routing manifest", () => {
  it("recognizes explicit engineering requests without capturing marketing mentions", () => {
    for (const prompt of ["Specify the product UI", "Please design a user interface", "Build an iOS app", "Map the onboarding user flow", "Architect the software system", "Write technical docs", "Build a web app", "Could you please specify the product UI"]) {
      expect(hasDirectOnlyEngineeringIntent(prompt), prompt).toBe(true);
    }
    for (const prompt of ["Write launch copy for a web app", "Audit marketing for this software system", "Create a product UI announcement", "Write launch copy for our tool that helps teams build a web app", "Audit our campaign headline: Build an iOS app", "Do not build a web app; write marketing copy"]) {
      expect(hasDirectOnlyEngineeringIntent(prompt), prompt).toBe(false);
    }
  });
  it("keeps three marketing jobs and a closed direct-only engineering boundary", () => {
    expect([...PARENT_JOBS]).toEqual([
      "launch-or-grow",
      "create-or-improve",
      "learn-from-results",
    ]);
    expect([...DIRECT_ONLY_ENGINEERING_OUTCOMES]).toEqual([
      "architect-software-system",
      "brief-product-ui",
      "build-ios-app",
      "build-web-app",
      "map-user-flow",
      "write-technical-docs",
    ]);
    expect([...DIRECT_ONLY_ENGINEERING_WORKFLOWS]).toEqual([
      "specify-product-experience",
    ]);
    expect(isDirectOnlyEngineeringOutcome("map-user-flow")).toBe(true);
    expect(isDirectOnlyEngineeringOutcome("write-copy")).toBe(false);
    expect(isDirectOnlyEngineeringWorkflow("specify-product-experience")).toBe(
      true,
    );
    expect(isDirectOnlyEngineeringWorkflow("landing-page-messaging")).toBe(
      false,
    );
  });
});
