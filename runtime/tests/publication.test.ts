import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("published self-hosted foundation", () => {
  it("publishes closed protocol and provider matrix schemas", () => {
    const protocol = JSON.parse(readFileSync(resolve(root, "schemas/protocol.schema.json"), "utf8"));
    const providerMatrix = JSON.parse(readFileSync(resolve(root, "schemas/provider-matrix.schema.json"), "utf8"));
    expect(protocol.$id).toBe("https://forsvn.com/schemas/conquistador/protocol-v1.json");
    expect(protocol.oneOf).toHaveLength(6);
    expect(protocol.$defs.Event.oneOf).toHaveLength(9);
    expect(protocol.$defs.ReviewPacket).toBeUndefined();
    expect(protocol.$defs.TerminalResult).toBeUndefined();
    expect(protocol.$defs.ReviewVerdictRequest.required).toEqual([
      "outcome",
      "packetDigest",
    ]);
    expect(JSON.stringify(protocol)).toContain(
      "review-contract-v1.json#/$defs/packet",
    );
    expect(JSON.stringify(protocol)).toContain(
      "review-contract-v1.json#/$defs/verdict",
    );
    expect(providerMatrix.$id).toBe("https://forsvn.com/schemas/conquistador/provider-matrix-v1.json");
    expect(providerMatrix.additionalProperties).toBe(false);
  });

  it("ships an executable owned entry point and honest operator documentation", () => {
    expect(existsSync(resolve(root, "bin/conquistador.js"))).toBe(true);
    expect(readFileSync(resolve(root, "bin/conquistador.js"), "utf8")).toContain('../lib/main.js');
    expect(existsSync(resolve(root, "lib/main.js"))).toBe(true);
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    expect(readme).toContain("Node.js 24");
    expect(readme).toContain("fixture-verified");
    expect(readme).toContain("No live provider support claim");
    expect(readme).toContain("Portable Plugin");
    expect(readme).not.toMatch(/production.ready|live.verified/i);
  });
});
