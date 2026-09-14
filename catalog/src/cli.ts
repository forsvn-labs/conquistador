#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AdapterManifest, Catalog, ExtensionManifest, ProviderOnboardingRecord, Receipt } from "./contracts.ts";
import { validateProviderOnboardingRecord } from "./onboarding.ts";
import { verifyReceipt } from "./receipt.ts";
import { validateAdapterManifest, validateCatalog, validateExtensionManifest, invariant } from "./validate.ts";

export type CliCommand =
  | { area: "catalog"; action: "check" | "lint"; file: string }
  | { area: "adapter"; action: "check" | "lint" | "test" | "verify"; file: string; catalog: string }
  | { area: "extension"; action: "check"; file: string; catalog: string }
  | { area: "onboarding"; action: "check"; file: string; catalog: string }
  | { area: "receipt"; action: "check" | "verify"; file: string };

function option(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  invariant(index >= 0 && Boolean(argv[index + 1]) && !argv[index + 1].startsWith("--"), `${name} is required`);
  return argv[index + 1];
}

export function parseCli(argv: string[]): CliCommand {
  const [area, action] = argv;
  invariant(![area, action].includes("run"), "generic run commands are forbidden");
  invariant(["catalog", "adapter", "extension", "onboarding", "receipt"].includes(area), "CLI area must be catalog, adapter, extension, onboarding, or receipt");
  const allowed = {
    catalog: ["check", "lint"],
    adapter: ["check", "lint", "test", "verify"],
    extension: ["check"],
    onboarding: ["check"],
    receipt: ["check", "verify"],
  } as const;
  invariant((allowed[area as keyof typeof allowed] as readonly string[]).includes(action), `unsupported ${area} command`);
  invariant(!argv.some((value) => ["--url", "--method", "--command", "--shell", "--mcp", "--execute"].includes(value)), "raw execution flags are forbidden");
  const file = option(argv, "--file");
  const knownFlags = area === "adapter" || area === "extension" || area === "onboarding" ? ["--file", "--catalog"] : ["--file"];
  for (let index = 2; index < argv.length; index += 2) {
    invariant(knownFlags.includes(argv[index]), `unknown CLI flag: ${argv[index]}`);
    invariant(Boolean(argv[index + 1]), `${argv[index]} is missing a value`);
  }
  if (area === "adapter" || area === "extension" || area === "onboarding") {
    return {
      area,
      action: action as "check",
      file,
      catalog: option(argv, "--catalog"),
    };
  }
  return { area, action, file } as CliCommand;
}

function json<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

export function runCli(command: CliCommand): string {
  if (command.area === "catalog") {
    const catalog = json<Catalog>(command.file);
    validateCatalog(catalog);
    return `catalog ${command.action}: ${catalog.operations.length} operations valid; support remains operation-level`;
  }
  if (command.area === "adapter") {
    validateAdapterManifest(json<AdapterManifest>(command.file), json<Catalog>(command.catalog));
    return `adapter ${command.action}: manifest conforms; no operation executed`;
  }
  if (command.area === "extension") {
    const manifest = json<ExtensionManifest>(command.file);
    validateExtensionManifest(manifest, json<Catalog>(command.catalog));
    return `extension check: ${manifest.kind} manifest conforms; no extension activated or operation executed`;
  }
  if (command.area === "onboarding") {
    const record = json<ProviderOnboardingRecord>(command.file);
    validateProviderOnboardingRecord(record, json<Catalog>(command.catalog));
    return `onboarding check: ${record.operation.provider} ${record.operation.operationId} is ${record.maturity}; no connection resolved or operation executed`;
  }
  verifyReceipt(json<Receipt>(command.file));
  return `receipt ${command.action}: digest and redaction contract valid`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(`${runCli(parseCli(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
