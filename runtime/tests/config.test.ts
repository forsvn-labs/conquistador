import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseConfigYaml, validateConfig } from "../src/config.ts";

const root = resolve(import.meta.dirname, "..");

describe("versioned Conquistador config", () => {
  it("parses the shipped local profile and inherits optional model roles", () => {
    const config = parseConfigYaml(readFileSync(resolve(root, "config/conquistador.config.example.yaml"), "utf8"));
    expect(() => validateConfig(config)).not.toThrow();
    expect(config).toMatchObject({
      schemaVersion: "conquistador.config/v1",
      server: { profile: "local", bind: "127.0.0.1", auth: { mode: "local" } },
      memory: { mode: "review-promoted" },
    });
    expect(config.models.fast).toEqual(config.models.primary);
    expect(config.models.judge).toEqual(config.models.primary);
  });

  it("rejects docker sandbox, schedule engines, and unattended mutation keys", () => {
    const source = readFileSync(resolve(root, "config/conquistador.config.example.yaml"), "utf8");
    expect(() =>
      parseConfigYaml(source.replace('mode: "disabled"', 'mode: "docker"')),
    ).toThrow(/docker is unimplemented/);
    expect(() => parseConfigYaml(`${source}\nschedule:\n  cron: "0 * * * *"\n`)).toThrow(
      /undeclared/,
    );
    expect(() => parseConfigYaml(`${source}\nunattended:\n  mutation: true\n`)).toThrow(
      /undeclared/,
    );
  });

  it("rejects public bind without explicit auth, public URL, origins, and proxy policy", () => {
    const config = parseConfigYaml(readFileSync(resolve(root, "config/conquistador.config.example.yaml"), "utf8"));
    config.server.profile = "single-node";
    config.server.bind = "0.0.0.0";
    expect(() => validateConfig(config)).toThrow(/non-loopback/);
  });

  it("rejects literal secrets, unknown fields, upstream config identity, and unsupported providers", () => {
    const config = parseConfigYaml(readFileSync(resolve(root, "config/conquistador.config.example.yaml"), "utf8"));
    const secretLiteral = ["s", "k-not-allowed-in-config"].join("");
    const primary = config.models.primary as unknown as Record<string, unknown>;
    primary.apiKey = secretLiteral;
    expect(() => validateConfig(config)).toThrow(/undeclared|secret/i);
    delete primary.apiKey;
    primary.provider = "unverified-provider";
    expect(() => validateConfig(config)).toThrow(/provider/);
    primary.provider = "openai";
    const rootRecord = config as unknown as Record<string, unknown>;
    rootRecord.eve = { world: "default" };
    expect(() => validateConfig(config)).toThrow(/undeclared|upstream/i);
  });

  it.each(["latest", "default", "auto"])("rejects non-exact model alias %s", (model) => {
    const source = readFileSync(resolve(root, "config/conquistador.config.example.yaml"), "utf8");
    expect(() => parseConfigYaml(source.replace('model: "gpt-example"', `model: "${model}"`))).toThrow(/exact/);
  });

  it("publishes a JSON Schema rooted at the v1 config", () => {
    const schema = JSON.parse(readFileSync(resolve(root, "schemas/config.schema.json"), "utf8"));
    expect(schema.$id).toContain("conquistador.config-1.0.0");
    expect(schema.properties.schemaVersion.const).toBe("conquistador.config/v1");
    expect(schema.properties.sandbox.properties.mode).toEqual({ const: "disabled" });
    expect(schema.additionalProperties).toBe(false);
  });
});
