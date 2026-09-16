import { describe, expect, it } from "vitest";

import { cliHelp, parseCli, PUBLIC_COMMANDS } from "../src/cli.ts";

describe("stable Conquistador CLI", () => {
  it("exposes only the ratified operator commands and defaults to chat", () => {
    expect(PUBLIC_COMMANDS).toEqual([
      "init",
      "chat",
      "mcp",
      "serve",
      "doctor",
      "run",
      "resume",
      "judgment",
      "status",
      "route",
      "eval",
      "backup",
      "restore",
      "migrate",
      "data",
      "version",
    ]);
    expect(parseCli([])).toEqual({ command: "chat" });
    expect(parseCli(["backup", "verify", "--file", "backup.tar"])).toEqual({
      command: "backup",
      action: "verify",
      file: "backup.tar",
    });
    expect(parseCli(["migrate", "--check"])).toEqual({
      command: "migrate",
      mode: "check",
    });
    expect(
      parseCli([
        "data",
        "erase",
        "--scope",
        "session:abc",
        "--confirm",
        "session:abc",
        "--recoverability",
        "backup",
      ]),
    ).toMatchObject({
      command: "data",
      action: "erase",
      scope: "session:abc",
      recoverability: "backup",
    });
    expect(
      parseCli([
        "run",
        "--playbook",
        "content-intelligence-loop",
        "--input",
        "input.json",
      ]),
    ).toEqual({
      command: "run",
      playbook: "content-intelligence-loop",
      input: "input.json",
    });
    expect(parseCli(["resume", "--run-id", "run-1"])).toEqual({
      command: "resume",
      runId: "run-1",
    });
    expect(() =>
      parseCli(["resume", "--run-id", "run-1", "--review", "accept"])
    )
      .toThrow(/unknown argument: --review/);
    expect(parseCli(["status", "--run-id", "run-1", "--runs-dir", "runs"]))
      .toEqual({
        command: "status",
        runId: "run-1",
        runsDir: "runs",
      });
    expect(parseCli(["route", "--intent", "write copy"])).toEqual({
      command: "route",
      intent: "write copy",
    });
  });

  it.each([
    "workflow",
    "skill",
    "agent",
    "registry",
    "preview",
    "publish",
    "send",
    "spend",
    "deploy",
    "tool",
  ])(
    "rejects forbidden public command %s",
    (command) =>
      expect(() => parseCli([command])).toThrow(/unsupported command/),
  );

  it("keeps raw upstream identity and internal control surfaces out of help", () => {
    expect(cliHelp()).not.toMatch(
      /eve|workflow|skill picker|specialist|registry|raw tool/i,
    );
    expect(cliHelp()).toContain("conquistador serve");
    expect(cliHelp()).toContain("conquistador run");
    expect(cliHelp()).toContain("conquistador install");
    expect(cliHelp()).toContain("conquistador operator --help");
    expect(cliHelp()).not.toContain("--review");
    expect(cliHelp()).toContain("--judgment-response");
    expect(cliHelp()).toContain("judgment export");
    expect(cliHelp()).toContain("one final review");
  });

  it("rejects stray positional arguments and duplicate flags", () => {
    for (
      const argv of [
        ["init", "unexpected"],
        ["chat", "unexpected"],
        ["restore", "backup.tar", "--file", "backup.tar"],
        ["serve", "--config", "one.yaml", "--config", "two.yaml"],
      ]
    ) expect(() => parseCli(argv)).toThrow();
  });
});
