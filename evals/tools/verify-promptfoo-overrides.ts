#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  resolveContainedPackage,
  runCredentialFreeNode,
} from "../src/promptfoo-compatibility.ts";
import {
  type PromptfooIntegrityBinding,
  verifyPromptfooInstallation,
} from "../src/promptfoo-integrity.ts";
import { PROMPTFOO_VERSION } from "../src/promptfoo-version.ts";
import { invariant } from "../src/validate.ts";

const installationRoot = resolve(import.meta.dirname, "../promptfoo-isolated");
const nodeModulesRoot = resolve(installationRoot, "node_modules");
const integrity = JSON.parse(
  readFileSync(resolve(installationRoot, "integrity-v1.json"), "utf8"),
) as PromptfooIntegrityBinding;

// No installed package is resolved or imported before this complete-tree check.
const runtime = verifyPromptfooInstallation({
  promptfooBinary: resolve(nodeModulesRoot, ".bin/promptfoo"),
  expected: integrity,
});

const requireFromInstall = createRequire(resolve(installationRoot, "package.json"));
const promptfoo = resolveContainedPackage({
  resolvedEntrypoint: runtime.entrypoint,
  nodeModulesRoot,
  expectedName: "promptfoo",
});
const ftp = resolveContainedPackage({
  resolvedEntrypoint: requireFromInstall.resolve("basic-ftp"),
  nodeModulesRoot,
  expectedName: "basic-ftp",
});
const sharp = resolveContainedPackage({
  resolvedEntrypoint: requireFromInstall.resolve("sharp"),
  nodeModulesRoot,
  expectedName: "sharp",
});

invariant(ftp.version === "6.2.3", "basic-ftp is not 6.2.3");
invariant(sharp.version === "0.35.5", "sharp is not 0.35.5");
invariant(promptfoo.version === PROMPTFOO_VERSION, `Promptfoo package is not ${PROMPTFOO_VERSION}`);

const stateDirectory = mkdtempSync(resolve(tmpdir(), "conquistador-promptfoo-compatibility-"));
try {
  mkdirSync(resolve(stateDirectory, "promptfoo-state"), { recursive: true, mode: 0o700 });
  const compatibility = runCredentialFreeNode({
    script: resolve(import.meta.dirname, "promptfoo-override-compatibility-child.mjs"),
    args: [JSON.stringify({
      ftpEntrypoint: ftp.entrypoint,
      sharpEntrypoint: sharp.entrypoint,
    })],
    stateDirectory,
  });
  invariant(
    compatibility.status === 0,
    `credential-free compatibility child failed: ${compatibility.stderr.trim() || compatibility.error?.message || "unknown error"}`,
  );

  const version = runCredentialFreeNode({
    script: promptfoo.entrypoint,
    args: ["--version"],
    stateDirectory,
    workingDirectory: installationRoot,
  });
  invariant(version.status === 0, "credential-free Promptfoo version command failed");
  invariant(
    `${version.stdout}${version.stderr}`.match(/\b\d+\.\d+\.\d+\b/)?.[0] === PROMPTFOO_VERSION,
    `Promptfoo version command did not report ${PROMPTFOO_VERSION}`,
  );
  const help = runCredentialFreeNode({
    script: promptfoo.entrypoint,
    args: ["eval", "--help"],
    stateDirectory,
    workingDirectory: installationRoot,
  });
  invariant(help.status === 0 && help.stdout.includes("--config"), "credential-free Promptfoo eval help failed");
} finally {
  rmSync(stateDirectory, { recursive: true, force: true });
}

process.stdout.write(
  `[promptfoo-overrides] PASS authenticated ${runtime.identity.installedDependencyTreeDigest}; promptfoo ${PROMPTFOO_VERSION}; basic-ftp 6.2.3; sharp 0.35.5; credential-free child checks passed\n`,
);
