import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  COMPATIBILITY_ENVIRONMENT_KEYS,
  resolveContainedPackage,
  runCredentialFreeNode,
  strictCompatibilityEnvironment,
} from "../src/promptfoo-compatibility.ts";

const temporaryRoots: string[] = [];

function temporaryRoot(label: string): string {
  const root = mkdtempSync(resolve(tmpdir(), label));
  temporaryRoots.push(root);
  return root;
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Promptfoo override verifier isolation", () => {
  it("gives a hostile imported module only the strict positive environment", () => {
    const root = temporaryRoot("conquistador-hostile-module-");
    const hostile = resolve(root, "hostile.mjs");
    const driver = resolve(root, "driver.mjs");
    write(
      hostile,
      "export const observation = { secret: process.env.CONQUISTADOR_PARENT_SECRET ?? null, keys: Object.keys(process.env).sort() };\n",
    );
    write(
      driver,
      "import { observation } from './hostile.mjs'; process.stdout.write(JSON.stringify(observation));\n",
    );
    const previous = process.env.CONQUISTADOR_PARENT_SECRET;
    process.env.CONQUISTADOR_PARENT_SECRET = "must-not-cross-child-boundary";
    try {
      const result = runCredentialFreeNode({ script: driver, stateDirectory: root });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        secret: null,
        keys: [...COMPATIBILITY_ENVIRONMENT_KEYS],
      });
    } finally {
      if (previous === undefined) delete process.env.CONQUISTADOR_PARENT_SECRET;
      else process.env.CONQUISTADOR_PARENT_SECRET = previous;
    }
  });

  it("builds the compatibility environment without inheriting any parent key", () => {
    const root = temporaryRoot("conquistador-compatibility-env-");
    process.env.CONQUISTADOR_PARENT_SECRET = "parent-only";
    try {
      const environment = strictCompatibilityEnvironment(root);
      expect(Object.keys(environment).sort()).toEqual([...COMPATIBILITY_ENVIRONMENT_KEYS]);
      expect(environment).not.toHaveProperty("CONQUISTADOR_PARENT_SECRET");
      expect(environment).not.toHaveProperty("OPENAI_API_KEY");
      expect(environment).not.toHaveProperty("PATH");
      expect(Object.values(environment).every((value) => typeof value === "string")).toBe(true);
    } finally {
      delete process.env.CONQUISTADOR_PARENT_SECRET;
    }
  });

  it("rejects an external package symlink even when its manifest has the expected name", () => {
    const installationRoot = temporaryRoot("conquistador-contained-install-");
    const externalRoot = temporaryRoot("conquistador-external-package-");
    const nodeModulesRoot = resolve(installationRoot, "node_modules");
    mkdirSync(nodeModulesRoot, { recursive: true });
    write(
      resolve(installationRoot, "package.json"),
      `${JSON.stringify({ name: "test-install", private: true })}\n`,
    );
    write(
      resolve(externalRoot, "package.json"),
      `${JSON.stringify({ name: "expected-package", version: "1.0.0", main: "index.js" })}\n`,
    );
    write(resolve(externalRoot, "index.js"), "module.exports = process.env.OPENAI_API_KEY;\n");
    symlinkSync(externalRoot, resolve(nodeModulesRoot, "expected-package"), "dir");
    const requireFromInstall = createRequire(resolve(installationRoot, "package.json"));
    const resolvedEntrypoint = requireFromInstall.resolve("expected-package");
    expect(() => resolveContainedPackage({
      resolvedEntrypoint,
      nodeModulesRoot,
      expectedName: "expected-package",
    })).toThrow(/entrypoint resolves outside the authenticated node_modules tree/);
  });
});
