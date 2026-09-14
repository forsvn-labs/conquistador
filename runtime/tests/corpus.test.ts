import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    expect(engineering.fileIds.filter((fileId) => fileId.endsWith("/SKILL.md"))).toEqual(["conquistador/SKILL.md"]);
    expect(engineering.fileIds).not.toContain("map-user-flow/SKILL.md");
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
