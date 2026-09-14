import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { invariant } from "./validate.ts";

export const COMPATIBILITY_ENVIRONMENT_KEYS = [
  "FORCE_COLOR",
  "HOME",
  "PROMPTFOO_CONFIG_DIR",
  "PROMPTFOO_DISABLE_TELEMETRY",
  "PROMPTFOO_DISABLE_UPDATE",
  "TEMP",
  "TMP",
  "TMPDIR",
  "__CF_USER_TEXT_ENCODING",
] as const;

function contained(root: string, path: string): boolean {
  return path.startsWith(`${root}${sep}`);
}

export function strictCompatibilityEnvironment(stateDirectory: string): NodeJS.ProcessEnv {
  const root = resolve(stateDirectory);
  return {
    __CF_USER_TEXT_ENCODING: "0x0:0:0",
    FORCE_COLOR: "0",
    HOME: root,
    PROMPTFOO_CONFIG_DIR: resolve(root, "promptfoo-state"),
    PROMPTFOO_DISABLE_TELEMETRY: "true",
    PROMPTFOO_DISABLE_UPDATE: "true",
    TEMP: root,
    TMP: root,
    TMPDIR: root,
  };
}

export function resolveContainedPackage(input: {
  resolvedEntrypoint: string;
  nodeModulesRoot: string;
  expectedName: string;
}): { entrypoint: string; root: string; packageJson: string; version: string } {
  const requestedNodeModules = resolve(input.nodeModulesRoot);
  invariant(lstatSync(requestedNodeModules).isDirectory(), "package containment root must be a real directory");
  const nodeModulesRoot = realpathSync(requestedNodeModules);
  const entrypoint = realpathSync(resolve(input.resolvedEntrypoint));
  invariant(contained(nodeModulesRoot, entrypoint), `${input.expectedName} entrypoint resolves outside the authenticated node_modules tree`);
  let directory = dirname(entrypoint);
  for (;;) {
    invariant(contained(nodeModulesRoot, directory), `${input.expectedName} package root resolves outside the authenticated node_modules tree`);
    const packageJson = resolve(directory, "package.json");
    if (existsSync(packageJson)) {
      const realPackageJson = realpathSync(packageJson);
      invariant(contained(nodeModulesRoot, realPackageJson), `${input.expectedName} package manifest resolves outside the authenticated node_modules tree`);
      const manifest = JSON.parse(readFileSync(realPackageJson, "utf8"));
      if (manifest.name === input.expectedName) {
        invariant(typeof manifest.version === "string" && manifest.version.length > 0, `${input.expectedName} package version is missing`);
        return { entrypoint, root: directory, packageJson: realPackageJson, version: manifest.version };
      }
    }
    const parent = dirname(directory);
    invariant(parent !== directory && directory !== nodeModulesRoot, `cannot locate authenticated ${input.expectedName} package root`);
    directory = parent;
  }
}

export function runCredentialFreeNode(input: {
  script: string;
  args?: string[];
  stateDirectory: string;
  workingDirectory?: string;
}): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const result = spawnSync(process.execPath, [resolve(input.script), ...(input.args ?? [])], {
    cwd: resolve(input.workingDirectory ?? input.stateDirectory),
    encoding: "utf8",
    env: strictCompatibilityEnvironment(input.stateDirectory),
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error } : {}),
  };
}
