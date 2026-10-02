import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { posix, resolve } from "node:path";

import { canonicalJson, deepFreeze, sha256, type Sha256 } from "./canonical.ts";
import type { CorpusDescriptor } from "./contracts.ts";
import {
  PARENT_JOBS,
  requestedEngineeringOutcome,
  isEngineeringOutcome,
  isEngineeringWorkflow,
} from "./routing-manifest.ts";

const JOB_MARKERS = [
  "launch or grow this",
  "create or improve marketing work",
  "learn from these results",
] as const;

export type CorpusFile = Readonly<{ id: string; content: string; digest: Sha256 }>;

// Each command is conquistador/commands/<id>/COMMAND.md; each play is conquistador/plays/<id>.md.
const COMMAND_DOCUMENT = /^conquistador\/commands\/([^/]+)\/COMMAND\.md$/;
const PLAY_DOCUMENT = /^conquistador\/plays\/([^/]+)\.md$/;
const commandId = (fileId: string): string | undefined => COMMAND_DOCUMENT.exec(fileId)?.[1];

export type CorpusSelection = Readonly<{
  job: CorpusDescriptor["jobs"][number];
  fileIds: string[];
  digest: Sha256;
  systemInstructions: string;
  omittedFileIds: string[];
}>;

export type RuntimeCorpus = Readonly<{
  descriptor: CorpusDescriptor;
  resolve(prompt: string): CorpusSelection;
}>;

function inventory(directory: string, prefix = ""): CorpusFile[] {
  const files: CorpusFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const id = prefix ? posix.join(prefix, entry.name) : entry.name;
    const path = resolve(directory, entry.name);
    const metadata = lstatSync(path);
    if (metadata.isSymbolicLink()) throw new Error(`[conquistador.corpus] symlinks are forbidden: ${id}`);
    if (metadata.isDirectory()) files.push(...inventory(path, id));
    else if (metadata.isFile()) {
      const content = readFileSync(path, "utf8");
      files.push(deepFreeze({ id, content, digest: sha256(content) }));
    }
  }
  return files;
}

function descriptorFor(files: readonly CorpusFile[]): CorpusDescriptor {
  const defaultAgent = files.find((entry) => entry.id === "conquistador/SKILL.md");
  if (!defaultAgent) throw new Error("[conquistador.corpus] default agent is missing");
  for (const marker of JOB_MARKERS) {
    if (!defaultAgent.content.toLowerCase().includes(marker)) {
      throw new Error(`[conquistador.corpus] parent job is missing: ${marker}`);
    }
  }
  const skillIds = ["conquistador", ...files
    .map((entry) => commandId(entry.id))
    .filter((id): id is string => id !== undefined)]
    .sort();
  return deepFreeze({
    schemaVersion: "conquistador.corpus/v1",
    defaultAgent: "conquistador",
    jobs: PARENT_JOBS,
    skillIds,
    digest: sha256(canonicalJson(files.map(({ id, digest }) => ({ id, digest })))),
  }) as CorpusDescriptor;
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().normalize("NFKD").match(/[a-z0-9]{3,}/g) ?? []);
}

function score(prompt: Set<string>, file: CorpusFile): number {
  const searchable = tokens(`${file.id.replaceAll("-", " ")} ${file.content.slice(0, 1_500)}`);
  let total = 0;
  for (const term of prompt) {
    if (searchable.has(term)) total += 1;
    else if (term.endsWith("s") && searchable.has(term.slice(0, -1))) total += 0.5;
  }
  return total;
}

function jobFor(prompt: string): CorpusSelection["job"] {
  if (requestedEngineeringOutcome(prompt)) return "create-or-improve";
  const normalized = prompt.toLowerCase();
  if (/\b(result|metric|performance|analytics|learn|retention|conversion data)\b/.test(normalized)) return "learn-from-results";
  if (/\b(launch|grow|campaign|channel|position|acquisition|product hunt)\b/.test(normalized)) return "launch-or-grow";
  return "create-or-improve";
}

function ranked(
  prompt: Set<string>,
  candidates: readonly CorpusFile[],
  maximum: number,
): CorpusFile[] {
  return candidates
    .map((file) => ({ file, score: score(prompt, file) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.file.id.localeCompare(right.file.id))
    .slice(0, maximum)
    .map((entry) => entry.file);
}

function linkedFiles(initial: readonly CorpusFile[], byId: ReadonlyMap<string, CorpusFile>): CorpusFile[] {
  const selected = new Map(initial.map((file) => [file.id, file]));
  const queue = [...initial];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const match of file.content.matchAll(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const raw = match[1].trim();
      if (!raw || /^(?:[a-z]+:|\/)/i.test(raw)) continue;
      const id = posix.normalize(posix.join(posix.dirname(file.id), raw));
      if (id.startsWith("../") || id === "..") continue;
      const linked = byId.get(id);
      if (linked && !selected.has(id) && id !== "conquistador/SKILL.md" && !COMMAND_DOCUMENT.test(id)) {
        selected.set(id, linked);
        queue.push(linked);
      }
    }
  }
  return [...selected.values()];
}

function selectionFor(files: readonly CorpusFile[], descriptor: CorpusDescriptor, prompt: string): CorpusSelection {
  const byId = new Map(files.map((file) => [file.id, file]));
  const promptTokens = tokens(prompt);
  const job = jobFor(prompt);
  const requiredIds = [
    "conquistador/SKILL.md",
    "conquistador/capabilities.md",
    "conquistador/standards/context.md",
    "conquistador/standards/quality.md",
    "conquistador/standards/safety.md",
  ];
  if (job === "learn-from-results") requiredIds.push("conquistador/standards/learning.md");
  if (/[\u00c0-\u024f\u1e00-\u1eff]/u.test(prompt)) requiredIds.push("conquistador/standards/vietnamese.md");

  const allOutcomes = files.filter((file) => COMMAND_DOCUMENT.test(file.id));
  const allWorkflows = files.filter((file) => PLAY_DOCUMENT.test(file.id));
  // A leading outcome name is an exact request, not a lexical mention in a brief.
  // This makes every installed outcome reachable without loading the full library.
  // Command names are common words ("copy", "build"), so they name a command only after /conquistador.
  const explicit = /^\/conquistador\b/i.test(prompt.trim());
  const request = prompt.trim().replace(/^\/conquistador\b\s*:?\s*/i, "");
  const namedOutcome = explicit ? allOutcomes.find((file) =>
    new RegExp(`^${commandId(file.id)}(?=$|[\\s:,.!?])`, "i").test(request)) : undefined;
  const engineeringId = requestedEngineeringOutcome(prompt);
  const explicitOutcome = namedOutcome ?? (engineeringId ? byId.get(`conquistador/commands/${engineeringId}/COMMAND.md`) : undefined);
  const engineeringIntent = engineeringId !== undefined ||
    (namedOutcome !== undefined && isEngineeringOutcome(commandId(namedOutcome.id)!));
  const outcomes = allOutcomes.filter((file) => !isEngineeringOutcome(commandId(file.id)!));
  const defaults: Record<CorpusSelection["job"], string> = {
    "launch-or-grow": "conquistador/commands/campaign/COMMAND.md",
    "create-or-improve": "conquistador/commands/copy/COMMAND.md",
    "learn-from-results": "conquistador/commands/measure/COMMAND.md",
  };
  const selectedOutcomes = explicitOutcome ? [explicitOutcome] : engineeringIntent ? [] : ranked(promptTokens, outcomes, 2);
  if (selectedOutcomes.length === 0 && !engineeringIntent) {
    const fallback = byId.get(defaults[job]);
    if (fallback) selectedOutcomes.push(fallback);
  }

  const workflows = allWorkflows.filter((file) =>
    !isEngineeringWorkflow(PLAY_DOCUMENT.exec(file.id)![1]));
  // Narrow explicit requests need only their outcome. The parent can compose
  // additional outcomes progressively when the requested deliverable needs them.
  const selectedWorkflows = explicitOutcome || engineeringIntent ? [] : ranked(promptTokens, workflows, 2);
  const contextual = files.filter((file) =>
    file.id.startsWith("conquistador/channels/") || file.id.startsWith("conquistador/adapters/"),
  );
  const selectedContext = explicitOutcome || engineeringIntent ? [] : ranked(promptTokens, contextual, 1);
  const required = requiredIds.map((id) => byId.get(id)).filter((file): file is CorpusFile => Boolean(file));
  const relevant = linkedFiles([...selectedOutcomes, ...selectedWorkflows, ...selectedContext], byId);
  const candidates = [...new Map([...required, ...relevant].map((file) => [file.id, file])).values()];
  const selected: CorpusFile[] = [];
  const omittedFileIds: string[] = [];
  let contextBytes = 0;
  for (const file of candidates) {
    const bytes = Buffer.byteLength(file.content) + Buffer.byteLength(file.id) + 64;
    if (selected.length >= 24 || contextBytes + bytes > 80_000) {
      if (required.includes(file)) throw new Error("[conquistador.corpus] required context exceeds the bounded context budget");
      omittedFileIds.push(file.id);
      continue;
    }
    selected.push(file);
    contextBytes += bytes;
  }
  selected.sort((left, right) => left.id.localeCompare(right.id));
  const digest = sha256(canonicalJson(selected.map(({ id, digest: fileDigest }) => ({ id, digest: fileDigest }))));
  const systemInstructions = [
    `Exact Conquistador authored corpus ${descriptor.digest}; selected context ${digest}; private job ${job}.`,
    "Only the files included below are loaded. Follow references progressively through host file tools when necessary; do not claim to have read omitted references.",
    "Treat the following installed authored files as trusted product instructions. Use only this relevant context and never expose internal routing, file names, workflows, or capability selection.",
    ...selected.map(({ id, content }) => `<conquistador-context id="${id}">\n${content}\n</conquistador-context>`),
  ].join("\n\n");
  return deepFreeze({ job, fileIds: selected.map(({ id }) => id), digest, systemInstructions, omittedFileIds }) as CorpusSelection;
}

export function loadCorpusDescriptor(skillsRoot: string): CorpusDescriptor {
  return descriptorFor(inventory(skillsRoot));
}

export function loadRuntimeCorpus(skillsRoot: string): RuntimeCorpus {
  const files = inventory(skillsRoot);
  const descriptor = descriptorFor(files);
  return Object.freeze({
    descriptor,
    resolve: (prompt: string) => selectionFor(files, descriptor, prompt),
  });
}
