import { readFileSync, readdirSync } from "node:fs";
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
      targetId: "copy",
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
    expect(decision.candidates).toEqual(expect.arrayContaining(["skill:copy", "skill:social"]));
    expect(decision.clarification).toMatch(/Which outcome do you want/);

    const overlap = routeIntent("research content ideas inside the content intelligence loop");
    expect(overlap.outcome).toBe("abstain");
    if (overlap.outcome !== "abstain") throw new Error("expected abstention");
    expect(overlap.reason).toBe("ambiguous-intent");
    expect(overlap.candidates).toEqual(expect.arrayContaining([
      "playbook:content-intelligence-loop",
      "skill:ideas",
    ]));
  });

  it("routes every installed outcome ID and spaced alias to skill guidance", () => {
    // Routed commands only; meta commands (init, pin, check, ...) run when named and are not served.
    const routing = JSON.parse(readFileSync(resolve(root, "../skills/conquistador/routing-contract.json"), "utf8"));
    const ids = readdirSync(resolve(root, "../skills/conquistador/commands"))
      .filter((id) => !id.startsWith(".") && routing.methods[id]?.kind !== "meta").sort();
    expect(ids).toHaveLength(35);
    const contract = loadRouterContract();
    expect(contract.routes.filter((route) => route.target.kind === "skill").map((route) => route.target.id).sort()).toEqual(ids);
    for (const id of ids) {
      for (const alias of [id, id.replaceAll("-", " "), `/conquistador ${id}`]) {
        expect(routeIntent(alias), alias).toMatchObject({ outcome: "skill", targetId: id });
      }
    }
    expect(contract.routes.filter((route) => route.target.kind === "playbook").map((route) => route.target.id))
      .toEqual(["content-intelligence-loop", "creative-production-review", "paid-search-split-landing", "campaign-money-events"]);
  });

  it("abstains when engineering aliases compete with another outcome or playbook", () => {
    for (const prompt of ["build-web-app and write-copy", "map user flow and brief product ui", "build-ios-app in content-intelligence-loop"]) {
      expect(routeIntent(prompt), prompt).toMatchObject({ outcome: "abstain", reason: "ambiguous-intent" });
    }
  });

  it("rejects a contract that guesses or activates inside the plugin", () => {
    const contract = JSON.parse(readFileSync(fixturePath, "utf8"));
    expect(() => validateRouterContract({ ...contract, loadsAtPluginRuntime: true })).toThrow(/must not load/);
    expect(() => validateRouterContract({ ...contract, abstention: { ...contract.abstention, neverGuess: false } })).toThrow(/never guess/);
    expect(() => validateRouterContract({ ...contract, promptSignals: ["write copy"] })).toThrow(/routing-registry/);
  });
});
