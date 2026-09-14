import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("licensed clean-room runtime boundary", () => {
  it("ships MIT source and machine-readable provenance for rebuilt concepts", () => {
    expect(readFileSync(resolve(root, "LICENSE"), "utf8")).toContain("MIT License");
    const provenance = JSON.parse(readFileSync(resolve(root, "PROVENANCE.json"), "utf8")) as {
      schemaVersion: string;
      concepts: Array<{ id: string; copiedCode: boolean; sourceLicense: string }>;
    };
    expect(provenance.schemaVersion).toBe("conquistador.provenance/v1");
    expect(provenance.concepts.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "conquistador-runtime-contract",
      "provider-wire-contracts",
      "replaceable-harness-boundary",
      "jose-oidc-verification",
      "ajv-schema-validation-tests",
    ]));
    for (const dependency of ["jose-oidc-verification", "ajv-schema-validation-tests"]) {
      expect(provenance.concepts.find((entry) => entry.id === dependency)).toMatchObject({
        copiedCode: false,
        sourceLicense: "MIT",
      });
    }
  });

  it("never imports the UNLICENSED product tree or adds a control-plane/license gate", () => {
    const source = readdirSync(resolve(root, "src"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => readFileSync(resolve(root, "src", entry.name), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/(?:\.\.\/)+product\/|forsvn\/product|licenseKey|licenseGate|controlPlane|telemetryEndpoint/);
    expect(source).not.toMatch(/\.eve(?:\/|\b)|\/eve\/|workflow-world|from ["'][^"']*(?:^|\/)eve(?:\/|$)[^"']*["']/i);
  });

  it("keeps runtime files outside Portable Plugin activation", () => {
    const pluginRoot = existsSync(resolve(root, "../skills/plugin.json")) ? resolve(root, "../skills") : resolve(root, "..");
    for (const manifest of ["plugin.json", ".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
      const text = readFileSync(resolve(pluginRoot, manifest), "utf8");
      expect(text).not.toMatch(/runtime|conquistador\.config|\/api\/v1/);
    }
  });
});
