#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { exportPublicExecutionEvidence } from "../src/execution-evidence.ts";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`[eval-lab] ${name} is required`);
  return process.argv[index + 1];
}

try {
  const evalRoot = resolve(import.meta.dirname, "..");
  const productRoot = resolve(evalRoot, "..");
  const executionId = argument("--execution-id");
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(executionId)) throw new Error("[eval-lab] execution ID must be lowercase and path-safe");
  const outputPath = resolve(argument("--output"));
  const evidenceRoot = resolve(productRoot, "release/evidence/exts-156");
  const outputRelative = relative(evidenceRoot, outputPath);
  if (!outputRelative || outputRelative.startsWith("..") || outputRelative.startsWith("/")) {
    throw new Error("[eval-lab] public execution evidence must stay under release/evidence/exts-156");
  }
  const evidence = exportPublicExecutionEvidence({
    stateDirectory: resolve(productRoot, ".conquistador/eval-runs", executionId),
    ledgerPath: resolve(productRoot, "release/ledger/v1.json"),
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (existsSync(outputPath)) {
    if (readFileSync(outputPath, "utf8") !== serialized) throw new Error("[eval-lab] existing public evidence differs; refusing overwrite");
  } else {
    writeFileSync(outputPath, serialized, { flag: "wx", mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify({ output: outputPath, evidenceDigest: evidence.evidenceDigest }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
