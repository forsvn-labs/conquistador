#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { selectExactCandidate, type ExactSelection } from "./build-selector.ts";
import { preparePromptfooExecution } from "./live-manifest.ts";
import { executePromptfoo, preflightPromptfooExecution } from "./live-runner.ts";
import { PROMPTFOO_VERSION } from "./promptfoo-version.ts";
import { invariant, validateProviderCell } from "./validate.ts";

export { PROMPTFOO_VERSION } from "./promptfoo-version.ts";

export type PromptfooPlan = {
  promptfooVersion: typeof PROMPTFOO_VERSION;
  selection: ExactSelection;
  command: ["promptfoo", "eval", "--config", "promptfooconfig.yaml", "--no-cache", "--no-share"];
  executionAuthorized: false;
};

function parseJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

export function createPromptfooPlan(build: unknown, evalCase: unknown, provider: unknown): PromptfooPlan {
  validateProviderCell(provider);
  invariant(provider.adapter.name === "promptfoo", "Promptfoo plan requires the pinned promptfoo adapter");
  invariant(provider.adapter.version === PROMPTFOO_VERSION, `Promptfoo adapter must be exactly ${PROMPTFOO_VERSION}`);
  return {
    promptfooVersion: PROMPTFOO_VERSION,
    selection: selectExactCandidate(build, evalCase, provider),
    command: ["promptfoo", "eval", "--config", "promptfooconfig.yaml", "--no-cache", "--no-share"],
    executionAuthorized: false,
  };
}

export function rejectTestOnlyCliArguments(arguments_: string[]): void {
  invariant(
    !arguments_.some((argument_) =>
      argument_.startsWith("--test-only") ||
      argument_ === "--ledger" || argument_.startsWith("--ledger=") ||
      argument_ === "--repo-root" || argument_.startsWith("--repo-root=")
    ),
    "test-only injection and candidate-authority overrides are unavailable from the CLI",
  );
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`[eval-lab] ${name} is required`);
  return process.argv[index + 1];
}

function action(): "plan" | "preflight" | "execute" {
  const selected = ["--plan", "--preflight", "--execute"].filter((flag) => process.argv.includes(flag));
  if (selected.length !== 1) throw new Error("[eval-lab] select exactly one of --plan, --preflight, or --execute");
  return selected[0].slice(2) as "plan" | "preflight" | "execute";
}

function liveInput() {
  const evalRoot = resolve(import.meta.dirname, "..");
  const productRoot = resolve(evalRoot, "..");
  const repoRoot = execFileSync("git", ["-C", productRoot, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const executionId = argument("--execution-id");
  const stateDirectory = resolve(productRoot, ".conquistador/eval-runs", executionId);
  const existingManifestPath = resolve(stateDirectory, "manifest.json");
  const preparedAt = existsSync(existingManifestPath)
    ? JSON.parse(readFileSync(existingManifestPath, "utf8")).preparedAt
    : new Date().toISOString();
  return {
    prepared: preparePromptfooExecution({
      executionId,
      preparedAt,
      repoRoot,
      ledgerPath: resolve(productRoot, "release/ledger/v1.json"),
      caseId: argument("--case-id"),
      providerCellPath: argument("--provider"),
      maxCostUsd: Number(argument("--max-cost-usd")),
    }),
    promptfooBinary: argument("--promptfoo-bin"),
    stateDirectory,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    rejectTestOnlyCliArguments(process.argv.slice(2));
    const selectedAction = action();
    if (selectedAction === "plan") {
      const plan = createPromptfooPlan(
        parseJson(argument("--build")),
        parseJson(argument("--case")),
        parseJson(argument("--provider")),
      );
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      const input = liveInput();
      if (selectedAction === "preflight") {
        const result = preflightPromptfooExecution(input);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (!result.ready) process.exitCode = 2;
      } else {
        process.stdout.write(`${JSON.stringify(executePromptfoo(input), null, 2)}\n`);
      }
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
