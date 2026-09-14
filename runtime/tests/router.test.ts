import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  loadRouterContract,
  routeIntent,
  validateRouterContract,
} from "../src/router.ts";

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(root, "fixtures/router/capability-routes.json");

describe("Capability Router contract", () => {
  it("loads a versioned fail-closed contract that the Portable Plugin does not activate", () => {
    const contract = loadRouterContract();
    expect(contract.schemaVersion).toBe("conquistador.capability-router/v1");
    expect(contract.activationRequiredByPortablePlugin).toBe(false);
    expect(contract.loadsAtPluginRuntime).toBe(false);
    expect(contract.abstention.neverGuess).toBe(true);
    const schema = JSON.parse(readFileSync(resolve(root, "schemas/router.schema.json"), "utf8"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(contract), JSON.stringify(validate.errors)).toBe(true);
    expect(readFileSync(resolve(root, "src/router.ts"), "utf8")).not.toMatch(/createProvider|credentialEnv|OPENAI_API_KEY/);
  });

  it("maps an exact playbook or skill intent and abstains when it cannot justify a route", () => {
    expect(routeIntent("Run the content intelligence loop for our newsletter")).toMatchObject({
      outcome: "playbook",
      targetId: "content-intelligence-loop",
    });
    expect(routeIntent("please write copy for the pricing page")).toMatchObject({
      outcome: "skill",
      targetId: "write-copy",
    });
    expect(routeIntent("")).toMatchObject({ outcome: "abstain", reason: "empty-intent" });
    expect(routeIntent("   ")).toMatchObject({ outcome: "abstain", reason: "empty-intent" });
    expect(routeIntent("help me with marketing")).toMatchObject({
      outcome: "abstain",
      reason: "no-capable-match",
      candidates: [],
    });
  });

  it("abstains on ambiguous intent instead of guessing", () => {
    const decision = routeIntent("write copy and write a social post");
    expect(decision).toMatchObject({ outcome: "abstain", reason: "ambiguous-intent" });
    if (decision.outcome !== "abstain") throw new Error("expected abstention");
    expect(decision.candidates).toEqual(expect.arrayContaining(["skill:write-copy", "skill:write-social"]));
    expect(decision.clarification).toMatch(/Which outcome do you want/);

    const overlap = routeIntent("research content ideas inside the content intelligence loop");
    expect(overlap.outcome).toBe("abstain");
    if (overlap.outcome !== "abstain") throw new Error("expected abstention");
    expect(overlap.reason).toBe("ambiguous-intent");
    expect(overlap.candidates).toEqual(expect.arrayContaining([
      "playbook:content-intelligence-loop",
      "skill:research-content-ideas",
    ]));
  });

  it("rejects a contract that guesses or activates inside the plugin", () => {
    const contract = JSON.parse(readFileSync(fixturePath, "utf8"));
    expect(() => validateRouterContract({ ...contract, loadsAtPluginRuntime: true })).toThrow(/must not load/);
    expect(() => validateRouterContract({ ...contract, abstention: { ...contract.abstention, neverGuess: false } })).toThrow(/never guess/);
    expect(() => validateRouterContract({ ...contract, promptSignals: ["write copy"] })).toThrow(/routing-registry/);
  });
});
