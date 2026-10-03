import { DEFAULT_SKILLS_ROOT } from "../src/skill-assets.ts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { loadCorpusDescriptor } from "../src/corpus.ts";
import {
  validatePlaybookRecord,
  validatePlaybookRegistry,
  validateSkillRecord,
  validateSkillRegistry,
  type PlaybookRecord,
  type SkillRecord,
} from "../src/registry.ts";

const root = resolve(import.meta.dirname, "..");
const skillsRoot = DEFAULT_SKILLS_ROOT;
const workflowsDir = resolve(skillsRoot, "conquistador/plays");
const fixturePath = resolve(root, "fixtures/playbooks/content-intelligence-loop.json");

function compileSchema() {
  const schema = JSON.parse(readFileSync(resolve(root, "schemas/registry.schema.json"), "utf8"));
  return {
    schema,
    validate: new Ajv2020({ strict: false, formats: { "date-time": true } }).compile(schema),
  };
}

function playbookFixture(): PlaybookRecord {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as PlaybookRecord;
}

function validSkill(overrides: Record<string, unknown> = {}): SkillRecord {
  return {
    schemaVersion: "conquistador.skill-record/v1",
    id: "copy",
    version: "2.1.0",
    kind: "outcome-skill",
    trigger: {
      description: "Write or rewrite finished product-marketing copy.",
      examples: ["write landing page copy", "improve this ad"],
    },
    inputs: {
      version: "1.0.0",
      fields: [{ name: "brief", type: "string", required: true, description: "What to write and for whom." }],
    },
    outputs: {
      version: "1.0.0",
      deliverable: "Paste-ready copy plus one next action.",
      fields: [{ name: "copy", type: "string", required: true, description: "Finished copy." }],
    },
    compatiblePlaybooks: ["content-intelligence-loop"],
    toolRequirements: { capabilityIds: [], requiredForStandalone: false },
    qualityCriteria: [{ id: "specific-and-credible", description: "Copy is specific, credible, and on-brand." }],
    failureBehavior: { onInvalidInput: "reject", onMissingTools: "degrade-to-local", onQualityFail: "stop" },
    provenance: {
      sourcePath: "skills/skills/copy",
      independentlyVersioned: true,
      recordedAt: "2026-08-20T00:00:00.000Z",
    },
    installEligibility: {
      independentlyInstallable: true,
      requiresSiblingSkill: false,
      requiresPlaybookRunner: false,
      requiresRegistryActivation: false,
      requiresGeneratedCatalog: false,
    },
    ...overrides,
  } as SkillRecord;
}

describe("Skill Registry contract", () => {
  it("accepts an independently installable outcome skill", () => {
    const record = validSkill();
    expect(() => validateSkillRecord(record)).not.toThrow();
    const { validate } = compileSchema();
    expect(validate(record), JSON.stringify(validate.errors)).toBe(true);
  });

  it("fails closed when a skill requires a sibling, runner, registry, or generated catalog", () => {
    const eligibility = validSkill().installEligibility;
    expect(() => validateSkillRecord(validSkill({ installEligibility: { ...eligibility, independentlyInstallable: false } }))).toThrow(/independently installable/);
    expect(() => validateSkillRecord(validSkill({ installEligibility: { ...eligibility, requiresSiblingSkill: true } }))).toThrow(/sibling skill/);
    expect(() => validateSkillRecord(validSkill({ installEligibility: { ...eligibility, requiresPlaybookRunner: true } }))).toThrow(/playbook runner/);
    expect(() => validateSkillRecord(validSkill({ installEligibility: { ...eligibility, requiresRegistryActivation: true } }))).toThrow(/registry activation/);
    expect(() => validateSkillRecord(validSkill({ installEligibility: { ...eligibility, requiresGeneratedCatalog: true } }))).toThrow(/generated catalog/);
  });

  it("rejects routing-registry metadata on a skill record", () => {
    const record = validSkill() as SkillRecord & { promptSignals?: string[] };
    record.promptSignals = ["write copy"];
    expect(() => validateSkillRecord(record)).toThrow(/routing-registry/);
  });

  it("refuses to activate the skill registry for the Portable Plugin", () => {
    expect(() =>
      validateSkillRegistry({
        schemaVersion: "conquistador.skill-registry/v1",
        productVersion: "1.0.0",
        activationRequiredByPortablePlugin: true,
        loadsAtPluginRuntime: false,
        records: [validSkill()],
      }),
    ).toThrow(/not required by the Portable Plugin/);
    const registry = {
      schemaVersion: "conquistador.skill-registry/v1" as const,
      productVersion: "1.0.0" as const,
      activationRequiredByPortablePlugin: false as const,
      loadsAtPluginRuntime: false as const,
      records: [validSkill()],
    };
    expect(() => validateSkillRegistry(registry)).not.toThrow();
  });
});

describe("Playbook Registry contract", () => {
  it("accepts the content-intelligence-loop record as executable", () => {
    const record = playbookFixture();
    expect(() => validatePlaybookRecord(record)).not.toThrow();
    expect(record.id).toBe("content-intelligence-loop");
    expect(record.canonicalId).toBe("playbook:content-intelligence-loop");
    expect(record.executionStatus).toBe("executable");
    expect(record.notExecutableReason).toBeUndefined();
    expect(record.version).toBe("1.0.0");
    expect(record.proseSource).toBe("skills/conquistador/plays/content.md");
    expect(record.stepGraph.nodes.map((node) => node.id)).toEqual([
      "load-context",
      "pull-signals",
      "normalize-data",
      "rank-opportunities",
      "select-hypothesis",
      "create-artifact",
      "specialist-review",
      "approved-action",
      "observe-results",
      "measure-and-decide",
      "store-learning",
    ]);
    expect(record.gates.review).toHaveLength(1);
    expect(record.gates.action).toHaveLength(1);
    expect(record.activation.requiredByPortablePlugin).toBe(false);
    const { validate } = compileSchema();
    expect(validate(record), JSON.stringify(validate.errors)).toBe(true);
  });

  it("fails closed without a step graph, artifacts, or gates", () => {
    const missingGraph = playbookFixture() as unknown as Record<string, unknown>;
    delete missingGraph.stepGraph;
    expect(() => validatePlaybookRecord(missingGraph)).toThrow(/without a step graph fails closed/);

    const emptyGraph = playbookFixture();
    emptyGraph.stepGraph = { nodes: [] };
    expect(() => validatePlaybookRecord(emptyGraph)).toThrow(/two or more steps/);

    const missingArtifacts = playbookFixture() as unknown as Record<string, unknown>;
    delete missingArtifacts.artifacts;
    expect(() => validatePlaybookRecord(missingArtifacts)).toThrow(/without artifacts fails closed/);

    const emptyArtifacts = playbookFixture();
    emptyArtifacts.artifacts = [];
    expect(() => validatePlaybookRecord(emptyArtifacts)).toThrow(/without artifacts fails closed/);

    const missingGates = playbookFixture() as unknown as Record<string, unknown>;
    delete missingGates.gates;
    expect(() => validatePlaybookRecord(missingGates)).toThrow(/without gates fails closed/);

    const emptyReview = playbookFixture();
    emptyReview.gates = { ...emptyReview.gates, review: [] };
    expect(() => validatePlaybookRecord(emptyReview)).toThrow(/without a review gate fails closed/);
  });

  it("rejects a prose sequence, one-step graph, or claimed execution", () => {
    expect(() => validatePlaybookRecord({ steps: ["pull data", "write a post"] })).toThrow(/prose sequence is not a playbook/);
    expect(() => validatePlaybookRecord("# Content loop\n\n1. Research.\n2. Write.")).toThrow(/must be an object/);

    const oneStep = playbookFixture();
    oneStep.stepGraph = { nodes: [oneStep.stepGraph.nodes[0]] };
    expect(() => validatePlaybookRecord(oneStep)).toThrow(/two or more steps/);

    const live = playbookFixture() as unknown as Record<string, unknown>;
    live.executionStatus = "live";
    expect(() => validatePlaybookRecord(live)).toThrow(/not admitted without a runner trace/);

    const unimplemented = playbookFixture();
    unimplemented.executionStatus = "unimplemented";
    unimplemented.notExecutableReason = "No runner trace exists yet.";
    expect(() => validatePlaybookRecord(unimplemented)).not.toThrow();
  });

  it("fails closed when an executable playbook still claims it cannot execute", () => {
    const record = playbookFixture() as unknown as Record<string, unknown>;
    record.notExecutableReason = "Do not execute";
    expect(() => validatePlaybookRecord(record)).toThrow(/cannot declare a notExecutableReason/);
  });

  it("keeps review and action gates separate and human-owned", () => {
    const modelReview = playbookFixture();
    modelReview.gates.review[0] = { ...modelReview.gates.review[0], modelCannotSatisfy: false as unknown as true };
    expect(() => validatePlaybookRecord(modelReview)).toThrow(/cannot satisfy a review gate/);

    const collapsed = playbookFixture();
    collapsed.gates.action[0] = { ...collapsed.gates.action[0], id: "final-review" };
    expect(() => validatePlaybookRecord(collapsed)).toThrow(/must remain separate/);
  });

  it("rejects a cycle and a step that names no skill, script, or tool", () => {
    const cyclic = playbookFixture();
    cyclic.stepGraph.nodes[0] = { ...cyclic.stepGraph.nodes[0], dependsOn: ["store-learning"] };
    expect(() => validatePlaybookRecord(cyclic)).toThrow(/cycle/);

    const emptyUses = playbookFixture();
    emptyUses.stepGraph.nodes[0] = { ...emptyUses.stepGraph.nodes[0], uses: {} };
    expect(() => validatePlaybookRecord(emptyUses)).toThrow(/exactly one of skill, script, tool operation, or branch/);
  });

  it("does not treat the 21 play Markdown files as registry entries", () => {
    const files = readdirSync(workflowsDir).filter((name) => name.endsWith(".md")).sort();
    expect(files).toHaveLength(21);
    expect(files).toContain("content.md");
    for (const name of files) {
      const content = readFileSync(resolve(workflowsDir, name), "utf8");
      expect(() => JSON.parse(content)).toThrow();
      expect(() => validatePlaybookRecord(content)).toThrow(/must be an object/);
      expect(() =>
        validatePlaybookRecord({
          id: name.replace(/\.md$/, ""),
          kind: "prose-composition-source",
          steps: content.split("\n").filter((line) => /^\d+\./.test(line.trim())),
        }),
      ).toThrow(/prose sequence is not a playbook|must be an object|undeclared field|kind must be/);
    }
    const fixture = playbookFixture();
    expect(fixture.provenance.proseCompositionKind).toBe("compatibility-map-only");
    expect(readFileSync(fixturePath, "utf8")).not.toContain("prose-composition-source");
  });

  it("publishes a closed registry schema and a non-activating playbook registry", () => {
    const { schema, validate } = compileSchema();
    expect(schema.$id).toBe("https://forsvn.com/schemas/conquistador/registry-v1.json");
    expect(schema.$defs.PlaybookRecord.additionalProperties).toBe(false);
    expect(schema.$defs.SkillRecord.additionalProperties).toBe(false);
    expect(schema.$defs.PlaybookRecord.properties.stepGraph.properties.nodes.minItems).toBe(2);
    expect(schema.$defs.InstallEligibility.properties.independentlyInstallable.const).toBe(true);
    const registry = {
      schemaVersion: "conquistador.playbook-registry/v1" as const,
      productVersion: "1.0.0" as const,
      activationRequiredByPortablePlugin: false as const,
      loadsAtPluginRuntime: false as const,
      records: [playbookFixture()],
    };
    expect(() => validatePlaybookRegistry(registry)).not.toThrow();
    expect(validate(registry), JSON.stringify(validate.errors)).toBe(true);
    expect(() => validatePlaybookRegistry({ ...registry, activationRequiredByPortablePlugin: true })).toThrow(
      /not required by the Portable Plugin/,
    );
    expect(() => validatePlaybookRegistry({ ...registry, leaves: ["copy"] })).toThrow(/customer-managed catalog/);
  });
});

describe("Portable Plugin boundary", () => {
  it("loads the authored corpus without registry activation", () => {
    const corpus = loadCorpusDescriptor(skillsRoot);
    expect(corpus.defaultAgent).toBe("conquistador");
    expect(corpus.skillIds).toContain("copy");
    expect(corpus.skillIds).toContain("ideas");
    expect(existsSync(resolve(skillsRoot, "../hooks/skill-registry.json"))).toBe(false);
    expect(existsSync(resolve(skillsRoot, "conquistador/skill-registry.json"))).toBe(false);
    const contract = readFileSync(resolve(skillsRoot, "../docs/MASTER-AGENT.md"), "utf8");
    expect(contract).toMatch(/play file is composition prose with no execution authority/i);
    const corpusSource = readFileSync(resolve(root, "src/corpus.ts"), "utf8");
    const runtimeSource = readFileSync(resolve(root, "src/runtime.ts"), "utf8");
    expect(corpusSource).not.toMatch(/registry/);
    expect(runtimeSource).not.toMatch(/registry/);
    expect(readFileSync(resolve(root, "src/index.ts"), "utf8")).toContain('export * from "./registry.ts"');
  });
});
