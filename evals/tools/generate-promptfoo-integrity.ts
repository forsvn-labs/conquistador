#!/usr/bin/env node
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { digestBytes } from "../src/digest.ts";
import {
  digestFileTree,
  digestInstalledDependencyTree,
  type PromptfooIntegrityBinding,
  validatePromptfooLock,
  verifyPromptfooInstallation,
} from "../src/promptfoo-integrity.ts";
import { PROMPTFOO_VERSION } from "../src/promptfoo-version.ts";
import { invariant } from "../src/validate.ts";

const ENTRYPOINT = "dist/src/entrypoint.js";

function fail(message: string): never {
  throw new Error(`[promptfoo-integrity] ${message}`);
}

function render(value: PromptfooIntegrityBinding): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function collect(installationRoot: string): PromptfooIntegrityBinding {
  const packageManifestBytes = readFileSync(resolve(installationRoot, "package.json"));
  const packageLockBytes = readFileSync(resolve(installationRoot, "package-lock.json"));
  validatePromptfooLock(packageManifestBytes, packageLockBytes);
  const packageRoot = resolve(installationRoot, "node_modules/promptfoo");
  const installedManifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
  invariant(installedManifest.name === "promptfoo" && installedManifest.version === PROMPTFOO_VERSION, "installed Promptfoo package identity differs");
  const declaredEntrypoint = typeof installedManifest.bin === "string"
    ? installedManifest.bin
    : installedManifest.bin?.promptfoo;
  invariant(declaredEntrypoint === ENTRYPOINT, `Promptfoo ${PROMPTFOO_VERSION} entrypoint differs from the approved path`);
  return {
    schemaVersion: "conquistador.promptfoo-installation-integrity/v1",
    promptfooVersion: PROMPTFOO_VERSION,
    packageManifestDigest: digestBytes(packageManifestBytes),
    packageLockDigest: digestBytes(packageLockBytes),
    entrypointPath: ENTRYPOINT,
    entrypointDigest: digestBytes(readFileSync(resolve(packageRoot, ENTRYPOINT))),
    packageTreeDigest: digestFileTree(packageRoot),
    installedDependencyTreeDigest: digestInstalledDependencyTree(resolve(installationRoot, "node_modules")),
  };
}

const mode = process.argv[2];
if ((mode !== "--write" && mode !== "--verify") || process.argv.length !== 3) {
  fail("choose exactly --write or --verify");
}
const installationRoot = resolve(import.meta.dirname, "../promptfoo-isolated");
const integrityPath = resolve(installationRoot, "integrity-v1.json");
const binding = collect(installationRoot);
verifyPromptfooInstallation({
  promptfooBinary: resolve(installationRoot, "node_modules/.bin/promptfoo"),
  expected: binding,
});
const expected = render(binding);
if (mode === "--write") {
  const temporary = `${integrityPath}.tmp-${process.pid}`;
  writeFileSync(temporary, expected, { flag: "wx", mode: 0o644 });
  renameSync(temporary, integrityPath);
} else if (readFileSync(integrityPath, "utf8") !== expected) {
  fail("integrity-v1.json differs from the exact frozen installation");
}
process.stdout.write(
  `[promptfoo-integrity] PASS ${mode.slice(2)} ${binding.installedDependencyTreeDigest}\n`,
);
