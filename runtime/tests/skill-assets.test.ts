import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSkillAssets, skillMethodContext } from "../src/skill-assets.ts";

describe("installed method identity", () => {
  it("changes when a nested method changes, bounds context, and rejects symlinks", () => {
    const root = mkdtempSync(resolve(tmpdir(), "skill-assets-review-"));
    try {
      mkdirSync(resolve(root, "demo"));
      writeFileSync(resolve(root, "demo/SKILL.md"), "# Demo\n[method](method.md)\n");
      writeFileSync(resolve(root, "demo/method.md"), "original method");
      const original = loadSkillAssets("demo", root);
      expect(skillMethodContext(original)).toContain("original method");
      writeFileSync(resolve(root, "demo/method.md"), "changed method ".repeat(100));
      const changed = loadSkillAssets("demo", root);
      expect(changed.digest).not.toBe(original.digest);
      expect(Buffer.byteLength(skillMethodContext(changed, 200))).toBeLessThanOrEqual(200);
      expect(() => skillMethodContext(changed, 1)).toThrow(/budget/);
      symlinkSync("SKILL.md", resolve(root, "demo/symlink.md"));
      expect(() => loadSkillAssets("demo", root)).toThrow(/symlink/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
