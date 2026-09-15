import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadCorpusDescriptor, loadRuntimeCorpus } from "../src/corpus.ts";

const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(resolve(tmpdir(), "conquistador-corpus-"));
  temporary.push(root);
  mkdirSync(resolve(root, "conquistador/standards"), { recursive: true });
  mkdirSync(resolve(root, "conquistador/workflows"), { recursive: true });
  mkdirSync(resolve(root, "write-copy"));
  mkdirSync(resolve(root, "map-user-flow"));
  writeFileSync(resolve(root, "conquistador/SKILL.md"), [
    "launch or grow this",
    "create or improve marketing work",
    "learn from these results",
  ].join("\n"));
  writeFileSync(resolve(root, "conquistador/capabilities.md"), "Campaign and copy capability map\n");
  writeFileSync(resolve(root, "conquistador/standards/quality.md"), "Quality foundation v1\n");
  writeFileSync(resolve(root, "conquistador/standards/safety.md"), "Safety foundation\n");
  writeFileSync(resolve(root, "conquistador/standards/context.md"), "Context foundation\n");
  writeFileSync(resolve(root, "conquistador/workflows/landing-page-messaging.md"), "Landing page copy workflow\n");
  writeFileSync(resolve(root, "conquistador/workflows/specify-product-experience.md"), "Map the product flow into a UI specification.\n");
  writeFileSync(resolve(root, "write-copy/SKILL.md"), "---\nname: write-copy\ndescription: Write landing pages and finished copy.\n---\n");
  writeFileSync(resolve(root, "map-user-flow/SKILL.md"), "---\nname: map-user-flow\ndescription: Map screens, user flow, onboarding journey, and recovery states.\n---\n");
  return root;
}

describe("frozen authored corpus", () => {
  it("binds nested authored resources into the digest and selects only relevant files", () => {
    const root = fixture();
    const before = loadCorpusDescriptor(root);
    writeFileSync(resolve(root, "conquistador/standards/quality.md"), "Quality foundation v2\n");
    const after = loadCorpusDescriptor(root);
    expect(after.digest).not.toBe(before.digest);
    const selection = loadRuntimeCorpus(root).resolve("Improve our landing page copy");
    expect(selection.job).toBe("create-or-improve");
    expect(selection.fileIds).toContain("write-copy/SKILL.md");
    expect(selection.fileIds).toContain("conquistador/workflows/landing-page-messaging.md");
    expect(selection.fileIds).not.toContain("conquistador/workflows/unrelated.md");
    expect(selection.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const engineering = loadRuntimeCorpus(root).resolve("Map the onboarding user flow");
    expect(engineering.job).toBe("create-or-improve");
    expect(engineering.fileIds.filter((fileId) => fileId.endsWith("/SKILL.md"))).toEqual(["conquistador/SKILL.md", "map-user-flow/SKILL.md"]);
    expect(engineering.fileIds).toContain("map-user-flow/SKILL.md");
    expect(engineering.fileIds).not.toContain("conquistador/workflows/specify-product-experience.md");
  });
});


describe("bounded progressive method context", () => {
  it("limits transitive reference fanout without silently claiming omitted files", () => {
    const root = fixture();
    const links: string[] = [];
    for (let index = 0; index < 50; index += 1) {
      links.push(`[reference ${index}](reference-${index}.md)`);
      writeFileSync(resolve(root, `write-copy/reference-${index}.md`), "method detail ".repeat(2000));
    }
    writeFileSync(resolve(root, "write-copy/SKILL.md"), `Write copy.\n${links.join("\n")}`);
    const selected = loadRuntimeCorpus(root).resolve("write copy");
    expect(Buffer.byteLength(selected.systemInstructions)).toBeLessThan(82_000);
    expect(selected.fileIds).toContain("write-copy/SKILL.md");
    expect(selected.omittedFileIds.length).toBeGreaterThan(0);
    expect(selected.systemInstructions).toContain("do not claim to have read omitted references");
  });
});


describe("parent outcome reachability", () => {
  const skillsRoot = resolve(import.meta.dirname, "../../skills");
  const corpus = loadRuntimeCorpus(skillsRoot);
  const outcomes = corpus.descriptor.skillIds.filter((id) => id !== "conquistador");

  it("routes all 38 installed outcomes through the parent without sibling fanout", () => {
    expect(outcomes).toHaveLength(38);
    const capabilities = readFileSync(resolve(skillsRoot, "conquistador/capabilities.md"), "utf8");
    for (const id of outcomes) {
      expect(capabilities, id).toContain(`\`${id}\``);
      const selection = corpus.resolve(`/conquistador ${id}`);
      expect(selection.fileIds.filter((file) => file.endsWith("/SKILL.md")), id)
        .toEqual(["conquistador/SKILL.md", `${id}/SKILL.md`].sort());
      expect(selection.fileIds.length, id).toBeLessThanOrEqual(24);
      expect(Buffer.byteLength(selection.systemInstructions), id).toBeLessThan(82_000);
      expect(selection.fileIds.some((file) => file.startsWith("conquistador/workflows/")), id).toBe(false);
    }
  });

  it.each([
    ["Map the onboarding user flow", "map-user-flow"],
    ["Specify the product UI", "brief-product-ui"],
    ["Architect the software system", "architect-software-system"],
    ["Build an iOS app", "build-ios-app"],
    ["Build a web app for growth analytics", "build-web-app"],
    ["Write the technical documentation", "write-technical-docs"],
  ])("selects only the requested engineering outcome: %s", (prompt, id) => {
    const selection = corpus.resolve(prompt);
    expect(selection.job).toBe("create-or-improve");
    expect(selection.fileIds.filter((file) => file.endsWith("/SKILL.md")))
      .toEqual(["conquistador/SKILL.md", `${id}/SKILL.md`].sort());
  });

  it.each([
    "Write launch copy for a web app",
    "Audit marketing for this software system",
    "Create a product UI announcement",
    "Write launch copy for our tool that helps teams build a web app",
    "Audit our campaign headline: Build an iOS app",
    "Do not build a web app; write marketing copy",
  ])("does not infer engineering work from a marketing mention: %s", (prompt) => {
    const selection = corpus.resolve(prompt);
    for (const id of ["map-user-flow", "brief-product-ui", "architect-software-system", "build-ios-app", "build-web-app", "write-technical-docs"]) {
      expect(selection.fileIds).not.toContain(`${id}/SKILL.md`);
    }
    expect(selection.fileIds).not.toContain("conquistador/workflows/specify-product-experience.md");
  });

  it("keeps missing engineering skills unavailable without substituting marketing work", () => {
    const root = fixture();
    const selection = loadRuntimeCorpus(root).resolve("Build a web app");
    expect(selection.fileIds.filter((file) => file.endsWith("/SKILL.md")))
      .toEqual(["conquistador/SKILL.md"]);
    expect(selection.systemInstructions).not.toContain('<conquistador-context id="build-web-app/SKILL.md">');
  });
});
