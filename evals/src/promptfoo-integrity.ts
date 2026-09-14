import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

import type { Sha256 } from "./contracts.ts";
import { digestBytes, digestValue } from "./digest.ts";
import { PROMPTFOO_VERSION } from "./promptfoo-version.ts";
import { invariant, requireSha256 } from "./validate.ts";

const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

export type PromptfooIntegrityBinding = {
  schemaVersion: "conquistador.promptfoo-installation-integrity/v1";
  promptfooVersion: typeof PROMPTFOO_VERSION;
  packageManifestDigest: Sha256;
  packageLockDigest: Sha256;
  entrypointPath: string;
  entrypointDigest: Sha256;
  packageTreeDigest: Sha256;
  installedDependencyTreeDigest: Sha256;
};

export type PromptfooRuntimeIdentity = {
  schemaVersion: "conquistador.promptfoo-runtime-identity/v1";
  promptfooVersion: typeof PROMPTFOO_VERSION;
  packageManifestDigest: Sha256;
  packageLockDigest: Sha256;
  entrypointPath: string;
  entrypointDigest: Sha256;
  packageTreeDigest: Sha256;
  installedDependencyTreeDigest: Sha256;
  identityDigest: Sha256;
};

function safeRelativePath(path: string, label: string): string {
  invariant(
    Boolean(path) && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") &&
      path.split("/").every((part) => Boolean(part) && part !== "." && part !== ".."),
    `${label} is unsafe`,
  );
  return path;
}

export function digestFileTree(root: string): Sha256 {
  const absoluteRoot = resolve(root);
  const files: Array<{ path: string; digest: Sha256 }> = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = resolve(directory, entry.name);
      const relativePath = relative(absoluteRoot, path).split(sep).join("/");
      if (entry.isDirectory()) {
        visit(path);
      } else {
        invariant(entry.isFile(), `Promptfoo package tree contains unsupported entry ${relativePath}`);
        files.push({ path: relativePath, digest: digestBytes(readFileSync(path)) });
      }
    }
  };
  visit(absoluteRoot);
  invariant(files.length > 0, "Promptfoo package tree is empty");
  return digestValue(files);
}

type InstalledTreeEntry =
  | { path: string; kind: "directory"; mode: number }
  | { path: string; kind: "file"; mode: number; digest: Sha256 }
  | { path: string; kind: "symlink"; mode: number; target: string };

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateInstalledPath(path: string): string {
  invariant(
    Boolean(path) && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") &&
      path.split("/").every((part) => Boolean(part) && part !== "." && part !== ".."),
    `installed dependency path is unsafe: ${path}`,
  );
  return path;
}

function collisionKey(path: string): string {
  return path.normalize("NFKC").toLowerCase();
}

export function digestInstalledDependencyTree(nodeModulesRoot: string): Sha256 {
  const requestedRoot = resolve(nodeModulesRoot);
  invariant(lstatSync(requestedRoot).isDirectory(), "installed dependency root must be a real directory");
  const absoluteRoot = realpathSync(requestedRoot);
  const entries: InstalledTreeEntry[] = [];
  const collisionPaths = new Map<string, string>();
  const recordPath = (relativePath: string): string => {
    const safePath = validateInstalledPath(relativePath);
    const key = collisionKey(safePath);
    const previous = collisionPaths.get(key);
    invariant(previous === undefined, `installed dependency path collision: ${previous} and ${safePath}`);
    collisionPaths.set(key, safePath);
    return safePath;
  };
  const visit = (directory: string): void => {
    const children = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => lexicalCompare(left.name, right.name));
    for (const child of children) {
      const path = resolve(directory, child.name);
      const relativePath = recordPath(relative(absoluteRoot, path).split(sep).join("/"));
      const stat = lstatSync(path);
      const mode = stat.mode & 0o7777;
      if (stat.isDirectory()) {
        entries.push({ path: relativePath, kind: "directory", mode });
        visit(path);
      } else if (stat.isFile()) {
        entries.push({ path: relativePath, kind: "file", mode, digest: digestBytes(readFileSync(path)) });
      } else if (stat.isSymbolicLink()) {
        invariant(relativePath.split("/").at(-2) === ".bin", `installed dependency symlink is outside an npm .bin directory: ${relativePath}`);
        const target = readlinkSync(path);
        invariant(Boolean(target) && !target.startsWith("/") && !target.includes("\\") && !target.includes("\0"), `installed dependency symlink target is unsafe: ${relativePath}`);
        const resolvedTarget = resolve(dirname(path), target);
        invariant(resolvedTarget.startsWith(`${absoluteRoot}${sep}`), `installed dependency symlink escapes node_modules: ${relativePath}`);
        invariant(lstatSync(resolvedTarget).isFile(), `installed dependency launcher target is not a regular file: ${relativePath}`);
        invariant(realpathSync(resolvedTarget).startsWith(`${absoluteRoot}${sep}`), `installed dependency launcher resolves outside node_modules: ${relativePath}`);
        entries.push({ path: relativePath, kind: "symlink", mode, target });
      } else {
        invariant(false, `installed dependency tree contains a special file: ${relativePath}`);
      }
    }
  };
  visit(absoluteRoot);
  invariant(entries.length > 0, "installed dependency tree is empty");
  return digestValue(entries);
}

export function validatePromptfooIntegrityBinding(value: unknown): asserts value is PromptfooIntegrityBinding {
  invariant(Boolean(value) && typeof value === "object", "Promptfoo integrity binding is required");
  const binding = value as PromptfooIntegrityBinding;
  const expectedKeys = [
    "entrypointDigest",
    "entrypointPath",
    "installedDependencyTreeDigest",
    "packageLockDigest",
    "packageManifestDigest",
    "packageTreeDigest",
    "promptfooVersion",
    "schemaVersion",
  ];
  invariant(
    JSON.stringify(Object.keys(binding).sort()) === JSON.stringify(expectedKeys),
    "Promptfoo integrity binding shape is not closed",
  );
  invariant(binding.schemaVersion === "conquistador.promptfoo-installation-integrity/v1", "Promptfoo integrity schema is not v1");
  invariant(binding.promptfooVersion === PROMPTFOO_VERSION, `Promptfoo integrity must bind ${PROMPTFOO_VERSION}`);
  requireSha256(binding.packageManifestDigest, "Promptfoo package manifest digest");
  requireSha256(binding.packageLockDigest, "Promptfoo package lock digest");
  safeRelativePath(binding.entrypointPath, "Promptfoo entrypoint path");
  requireSha256(binding.entrypointDigest, "Promptfoo entrypoint digest");
  requireSha256(binding.packageTreeDigest, "Promptfoo package tree digest");
  requireSha256(binding.installedDependencyTreeDigest, "Promptfoo installed dependency tree digest");
}

export function expectedPromptfooRuntimeIdentity(binding: PromptfooIntegrityBinding): PromptfooRuntimeIdentity {
  validatePromptfooIntegrityBinding(binding);
  const body = {
    schemaVersion: "conquistador.promptfoo-runtime-identity/v1" as const,
    promptfooVersion: PROMPTFOO_VERSION,
    packageManifestDigest: binding.packageManifestDigest,
    packageLockDigest: binding.packageLockDigest,
    entrypointPath: binding.entrypointPath,
    entrypointDigest: binding.entrypointDigest,
    packageTreeDigest: binding.packageTreeDigest,
    installedDependencyTreeDigest: binding.installedDependencyTreeDigest,
  };
  return { ...body, identityDigest: digestValue(body) };
}

export function validatePromptfooLock(packageManifestBytes: Buffer, packageLockBytes: Buffer): void {
  const packageManifest = JSON.parse(packageManifestBytes.toString("utf8"));
  const packageLock = JSON.parse(packageLockBytes.toString("utf8"));
  invariant(packageManifest.private === true, "isolated Promptfoo package must be private");
  invariant(packageManifest.dependencies?.promptfoo === PROMPTFOO_VERSION, `isolated package must depend on exact Promptfoo ${PROMPTFOO_VERSION}`);
  invariant(
    JSON.stringify(packageManifest.overrides) === JSON.stringify({ "adm-zip": "0.6.1", sharp: "0.35.4" }),
    "isolated package must use only the approved adm-zip and sharp overrides",
  );
  invariant(packageLock.lockfileVersion === 3, "isolated Promptfoo lock must use lockfileVersion 3");
  invariant(packageLock.packages?.[""]?.dependencies?.promptfoo === PROMPTFOO_VERSION, "Promptfoo lock root dependency differs");
  const lockedPromptfoo = packageLock.packages?.["node_modules/promptfoo"];
  invariant(lockedPromptfoo?.version === PROMPTFOO_VERSION, `Promptfoo lock must pin ${PROMPTFOO_VERSION}`);
  invariant(
    lockedPromptfoo.resolved === `https://registry.npmjs.org/promptfoo/-/promptfoo-${PROMPTFOO_VERSION}.tgz`,
    "Promptfoo lock uses an unexpected package source",
  );
  invariant(typeof lockedPromptfoo.integrity === "string" && SHA512.test(lockedPromptfoo.integrity), "Promptfoo lock has no exact registry integrity");
  invariant(packageLock.packages?.["node_modules/adm-zip"]?.version === "0.6.1", "Promptfoo lock must resolve adm-zip 0.6.1");
  const lockedSharp = Object.entries(packageLock.packages as Record<string, any>)
    .filter(([path]) => path === "node_modules/sharp" || path.endsWith("/node_modules/sharp"));
  invariant(lockedSharp.length > 0 && lockedSharp.every(([, entry]) => entry.version === "0.35.4"), "Promptfoo lock must resolve every sharp package to 0.35.4");
  for (const [path, entry] of Object.entries(packageLock.packages as Record<string, any>)) {
    if (!path || entry.link) continue;
    invariant(typeof entry.version === "string" && entry.version.length > 0, `Promptfoo lock entry ${path} has no exact version`);
    if (entry.resolved !== undefined) {
      invariant(
        typeof entry.resolved === "string" && entry.resolved.startsWith("https://registry.npmjs.org/"),
        `Promptfoo lock entry ${path} uses a non-registry source`,
      );
      invariant(typeof entry.integrity === "string" && SHA512.test(entry.integrity), `Promptfoo lock entry ${path} has no exact integrity`);
    }
  }
}

export function verifyPromptfooInstallation(input: {
  promptfooBinary: string;
  expected: PromptfooIntegrityBinding;
}): { identity: PromptfooRuntimeIdentity; entrypoint: string } {
  validatePromptfooIntegrityBinding(input.expected);
  invariant(input.promptfooBinary === resolve(input.promptfooBinary), "Promptfoo binary path must be absolute");
  invariant(basename(input.promptfooBinary) === "promptfoo", "Promptfoo binary must be the exact promptfoo launcher");
  invariant(basename(dirname(input.promptfooBinary)) === ".bin", "Promptfoo binary must come from node_modules/.bin");
  const nodeModulesRoot = dirname(dirname(input.promptfooBinary));
  invariant(basename(nodeModulesRoot) === "node_modules", "Promptfoo binary must come from node_modules/.bin");
  const installationRoot = dirname(nodeModulesRoot);
  const packageRoot = resolve(nodeModulesRoot, "promptfoo");
  const expectedEntrypoint = resolve(packageRoot, safeRelativePath(input.expected.entrypointPath, "Promptfoo entrypoint path"));
  const launcherStat = lstatSync(input.promptfooBinary);
  invariant(launcherStat.isSymbolicLink(), "Promptfoo launcher must be the npm-created symbolic link");
  invariant(realpathSync(input.promptfooBinary) === realpathSync(expectedEntrypoint), "Promptfoo launcher target differs from the pinned package entrypoint");

  const packageManifestBytes = readFileSync(resolve(installationRoot, "package.json"));
  const packageLockBytes = readFileSync(resolve(installationRoot, "package-lock.json"));
  validatePromptfooLock(packageManifestBytes, packageLockBytes);
  invariant(digestBytes(packageManifestBytes) === input.expected.packageManifestDigest, "isolated Promptfoo package manifest differs from candidate bytes");
  invariant(digestBytes(packageLockBytes) === input.expected.packageLockDigest, "isolated Promptfoo package lock differs from candidate bytes");

  const installedManifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
  invariant(installedManifest.name === "promptfoo" && installedManifest.version === PROMPTFOO_VERSION, "installed Promptfoo package identity differs");
  const declaredEntrypoint = typeof installedManifest.bin === "string" ? installedManifest.bin : installedManifest.bin?.promptfoo;
  invariant(declaredEntrypoint === input.expected.entrypointPath, "installed Promptfoo package declares a different entrypoint");
  const entrypointDigest = digestBytes(readFileSync(expectedEntrypoint));
  const packageTreeDigest = digestFileTree(packageRoot);
  const installedDependencyTreeDigest = digestInstalledDependencyTree(nodeModulesRoot);
  invariant(entrypointDigest === input.expected.entrypointDigest, "Promptfoo entrypoint bytes differ from the candidate binding");
  invariant(packageTreeDigest === input.expected.packageTreeDigest, "Promptfoo package bytes differ from the candidate binding");
  invariant(installedDependencyTreeDigest === input.expected.installedDependencyTreeDigest, "Promptfoo installed dependency tree differs from the candidate binding");

  const identity = expectedPromptfooRuntimeIdentity(input.expected);
  invariant(
    identity.entrypointDigest === entrypointDigest &&
      identity.packageTreeDigest === packageTreeDigest &&
      identity.installedDependencyTreeDigest === installedDependencyTreeDigest,
    "Promptfoo runtime identity differs from verified bytes",
  );
  return { identity, entrypoint: expectedEntrypoint };
}
