import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { parseCli, runCli } from "../src/cli.ts";
import { root } from "./helpers.ts";

describe("conformance-only CLI", () => {
  it("checks the catalog without executing an operation", () => {
    const command = parseCli(["catalog", "check", "--file", `${root}/operations/v1.json`]);
    expect(runCli(command)).toContain("17 operations valid");
  });

  it.each(["outcome-skill", "host-tool", "provider-adapter"])(
    "checks the %s extension manifest without activation or execution",
    (kind) => {
      const command = parseCli([
        "extension", "check",
        "--file", `${root}/fixtures/v1/extensions/${kind}.json`,
        "--catalog", `${root}/operations/v1.json`,
      ]);
      expect(runCli(command)).toMatch(/manifest conforms; no extension activated or operation executed/);
    },
  );

  it.each([
    ["run", "operation"],
    ["adapter", "run"],
    ["catalog", "check", "--url", "https://example.com"],
    ["receipt", "verify", "--shell", "echo"],
  ])("rejects generic or raw execution: %s %s", (...argv) => {
    expect(() => parseCli(argv)).toThrow();
  });

  it("checks exactly one onboarding record without execution", () => {
    const command = parseCli([
      "onboarding", "check",
      "--file", `${root}/fixtures/v1/onboarding/search-console.analytics.query.cataloged.json`,
      "--catalog", `${root}/operations/v1.json`,
    ]);
    expect(runCli(command)).toBe("onboarding check: search-console search-console.analytics.query is cataloged; no connection resolved or operation executed");
  });

  it("contains no raw HTTP, MCP, or shell transport implementation", () => {
    const source = readdirSync(resolve(root, "src"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => readFileSync(resolve(root, "src", entry.name), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/from ["']node:child_process["']|\bfetch\s*\(|from ["'](?:axios|undici)["']/);
    expect(source).not.toMatch(/mcpServers|\.callTool\s*\(|\.request\s*\(\s*\{\s*method/);
  });
});
