import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { checkPracticeRegistry, discoverMethodFiles, type PracticeRegistry } from "../src/practices";
import { root } from "./helpers";

const repo = resolve(root, "..");
const registry = (): PracticeRegistry => JSON.parse(readFileSync(join(root, "practices.json"), "utf8")) as PracticeRegistry;
const schema = JSON.parse(readFileSync(join(root, "schemas", "practices.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

describe("practice registry", () => {
  it("matches its schema", () => {
    const ok = validate(registry());
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it("covers every command, play, channel, format, and specialist exactly once, with no missing member", () => {
    expect(checkPracticeRegistry(registry(), repo)).toEqual([]);
  });

  it("discovers the method files from the skill tree, not from the registry", () => {
    const found = discoverMethodFiles(repo);
    const commands = readdirSync(join(repo, "skills/conquistador/commands")).filter((name) => statSync(join(repo, "skills/conquistador/commands", name)).isDirectory());
    expect(found.filter((entry) => entry.startsWith("commands/"))).toHaveLength(commands.length);
    expect(found).toContain("plays/outbound");
    expect(found).toContain("channels/x");
    expect(found).toContain("formats/ugc");
    expect(found).toContain("specialists/ads-agent");
    expect(found).toContain("specialists/roster");
  });

  it("fails when a method file exists that no practice covers", () => {
    const changed = registry();
    const outbound = changed.practices.find((entry) => entry.id === "outbound")!;
    outbound.members = outbound.members.filter((member) => member !== "commands/outreach");
    expect(checkPracticeRegistry(changed, repo)).toEqual([expect.stringMatching(/commands\/outreach.*no practice/)]);
  });

  it("fails when a member or exclusion names a file that does not exist", () => {
    const changed = registry();
    changed.practices[0]!.members.push("commands/does-not-exist");
    changed.nonMethods.push({ member: "specialists/gone", reason: "Test." });
    const problems = checkPracticeRegistry(changed, repo);
    expect(problems).toContainEqual(expect.stringMatching(/commands\/does-not-exist.*does not exist/));
    expect(problems).toContainEqual(expect.stringMatching(/specialists\/gone.*does not exist/));
  });

  it("fails when a member belongs to two practices, or is both a member and an exclusion", () => {
    const changed = registry();
    changed.practices[1]!.members.push(changed.practices[0]!.members[0]!);
    changed.nonMethods.push({ member: changed.practices[2]!.members[0]!, reason: "Test." });
    const problems = checkPracticeRegistry(changed, repo);
    expect(problems).toContainEqual(expect.stringMatching(/more than one practice/));
    expect(problems).toContainEqual(expect.stringMatching(/both a member and excluded/));
  });

  it("fails on a duplicate practice id", () => {
    const changed = registry();
    changed.practices.push({ ...changed.practices[0]!, members: [] });
    expect(checkPracticeRegistry(changed, repo)).toContainEqual(expect.stringMatching(/duplicate practice/));
  });

  it("rejects an unknown status, an unknown judge, a bad date or commit, and extra fields", () => {
    const base = registry();
    const variants: Array<(value: PracticeRegistry) => void> = [
      (value) => { (value.practices[0] as { status: string }).status = "shipped"; },
      (value) => { (value.practices[0] as { judge: string }).judge = "model"; },
      (value) => { (value.practices[0] as { judge: string }).judge = "pending-calibration"; },
      (value) => { value.practices[0]!.date = "27/10/2026"; },
      (value) => { value.practices[0]!.commit = "not-a-sha"; },
      (value) => { (value.practices[0] as Record<string, unknown>).verdicts = ["private"]; },
    ];
    for (const change of variants) {
      const copy = structuredClone(base);
      change(copy);
      expect(validate(copy)).toBe(false);
    }
  });

  it("records the owner's results of 27 October 2026", () => {
    const byId = new Map(registry().practices.map((entry) => [entry.id, entry]));
    expect(byId.get("outbound")).toMatchObject({ status: "passed", pr: 98 });
    expect(byId.get("copy")).toMatchObject({ status: "pass-through", pr: 99 });
    expect(byId.get("social")).toMatchObject({ status: "passed", pr: 103, commit: "84ef79f", date: "2026-10-27" });
    expect(byId.get("ads")).toMatchObject({ status: "pass-through", pr: 104, commit: "bed6730", date: "2026-10-27" });
    for (const id of ["pricing", "experiment", "channels"]) expect(byId.get(id)).toMatchObject({ status: "failed", commit: "f449281", date: "2026-10-27" });
    const recorded = new Set(["outbound", "copy", "social", "ads", "pricing", "experiment", "channels"]);
    for (const entry of registry().practices.filter((item) => !recorded.has(item.id))) expect(entry.status).toBe("untested");
  });

  it("has the owner judge every practice, because model judges failed calibration", () => {
    for (const entry of registry().practices) expect(entry.judge).toBe("human");
    expect(schema.properties.practices.items.properties.judge.enum).toEqual(["human"]);
  });

  it("keeps the newsletter channel with outbound, landing with copy, and the video channels with video", () => {
    const owner = new Map(registry().practices.flatMap((entry) => entry.members.map((member) => [member, entry.id] as const)));
    expect(owner.get("channels/email-newsletter")).toBe("outbound");
    expect(owner.get("plays/landing")).toBe("copy");
    expect(owner.get("channels/tiktok")).toBe("video");
    expect(owner.get("channels/youtube")).toBe("video");
  });

  it("is public data only: no paths outside the skill tree and no Drive or private markers", () => {
    const text = readFileSync(join(root, "practices.json"), "utf8");
    expect(text).not.toMatch(/drive\.google|docs\.google|\/Users\/|verification\/|REVIEW\.md/i);
    expect(existsSync(join(repo, "skills/conquistador"))).toBe(true);
  });
});
