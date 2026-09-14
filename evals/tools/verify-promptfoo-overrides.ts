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
const onnx = resolveContainedPackage({
  resolvedEntrypoint: requireFromInstall.resolve("onnxruntime-node"),
  nodeModulesRoot,
  expectedName: "onnxruntime-node",
});
const transformers = resolveContainedPackage({
  resolvedEntrypoint: requireFromInstall.resolve("@huggingface/transformers"),
  nodeModulesRoot,
  expectedName: "@huggingface/transformers",
});
const promptfoo = resolveContainedPackage({
  resolvedEntrypoint: runtime.entrypoint,
  nodeModulesRoot,
  expectedName: "promptfoo",
});
const requireFromOnnx = createRequire(onnx.packageJson);
const requireFromTransformers = createRequire(transformers.packageJson);
const admZip = resolveContainedPackage({
  resolvedEntrypoint: requireFromOnnx.resolve("adm-zip"),
  nodeModulesRoot,
  expectedName: "adm-zip",
});
const sharp = resolveContainedPackage({
  resolvedEntrypoint: requireFromTransformers.resolve("sharp"),
  nodeModulesRoot,
  expectedName: "sharp",
});

invariant(admZip.version === "0.6.1", "onnxruntime-node does not resolve adm-zip 0.6.1");
invariant(sharp.version === "0.35.4", "Transformers does not resolve sharp 0.35.4");
invariant(promptfoo.version === PROMPTFOO_VERSION, `Promptfoo package is not ${PROMPTFOO_VERSION}`);

const stateDirectory = mkdtempSync(resolve(tmpdir(), "conquistador-promptfoo-compatibility-"));
try {
  mkdirSync(resolve(stateDirectory, "promptfoo-state"), { recursive: true, mode: 0o700 });
  const compatibility = runCredentialFreeNode({
    script: resolve(import.meta.dirname, "promptfoo-override-compatibility-child.mjs"),
    args: [JSON.stringify({
      admZipEntrypoint: admZip.entrypoint,
      onnxEntrypoint: onnx.entrypoint,
      sharpEntrypoint: sharp.entrypoint,
      transformersEntrypoint: transformers.entrypoint,
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
} finally {
  rmSync(stateDirectory, { recursive: true, force: true });
}

process.stdout.write(
  `[promptfoo-overrides] PASS authenticated ${runtime.identity.installedDependencyTreeDigest}; promptfoo ${PROMPTFOO_VERSION}; adm-zip 0.6.1; sharp 0.35.4; credential-free child checks passed\n`,
);
