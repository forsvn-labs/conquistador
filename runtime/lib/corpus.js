import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { posix, resolve } from "node:path";
import { canonicalJson, deepFreeze, sha256 } from "./canonical.js";
import { PARENT_JOBS, hasDirectOnlyEngineeringIntent, isDirectOnlyEngineeringOutcome, isDirectOnlyEngineeringWorkflow, } from "./routing-manifest.js";
const JOB_MARKERS = [
    "launch or grow this",
    "create or improve marketing work",
    "learn from these results",
];
function inventory(directory, prefix = "") {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
        const id = prefix ? posix.join(prefix, entry.name) : entry.name;
        const path = resolve(directory, entry.name);
        const metadata = lstatSync(path);
        if (metadata.isSymbolicLink())
            throw new Error(`[conquistador.corpus] symlinks are forbidden: ${id}`);
        if (metadata.isDirectory())
            files.push(...inventory(path, id));
        else if (metadata.isFile()) {
            const content = readFileSync(path, "utf8");
            files.push(deepFreeze({ id, content, digest: sha256(content) }));
        }
    }
    return files;
}
function descriptorFor(files) {
    const defaultAgent = files.find((entry) => entry.id === "conquistador/SKILL.md");
    if (!defaultAgent)
        throw new Error("[conquistador.corpus] default agent is missing");
    for (const marker of JOB_MARKERS) {
        if (!defaultAgent.content.toLowerCase().includes(marker)) {
            throw new Error(`[conquistador.corpus] parent job is missing: ${marker}`);
        }
    }
    const skillIds = files
        .filter((entry) => /^[^/]+\/SKILL\.md$/.test(entry.id))
        .map((entry) => entry.id.slice(0, -"/SKILL.md".length))
        .sort();
    return deepFreeze({
        schemaVersion: "conquistador.corpus/v1",
        defaultAgent: "conquistador",
        jobs: PARENT_JOBS,
        skillIds,
        digest: sha256(canonicalJson(files.map(({ id, digest }) => ({ id, digest })))),
    });
}
function tokens(value) {
    return new Set(value.toLowerCase().normalize("NFKD").match(/[a-z0-9]{3,}/g) ?? []);
}
function score(prompt, file) {
    const searchable = tokens(`${file.id.replaceAll("-", " ")} ${file.content.slice(0, 1_500)}`);
    let total = 0;
    for (const term of prompt) {
        if (searchable.has(term))
            total += 1;
        else if (term.endsWith("s") && searchable.has(term.slice(0, -1)))
            total += 0.5;
    }
    return total;
}
function jobFor(prompt) {
    const normalized = prompt.toLowerCase();
    if (/\b(result|metric|performance|analytics|learn|retention|conversion data)\b/.test(normalized))
        return "learn-from-results";
    if (/\b(launch|grow|campaign|channel|position|acquisition|product hunt)\b/.test(normalized))
        return "launch-or-grow";
    return "create-or-improve";
}
function exclusiveDirectOnlyWin(prompt, candidates, isDirectOnly) {
    const scored = candidates
        .map((file) => ({ file, score: score(prompt, file) }))
        .filter((entry) => entry.score > 0);
    if (scored.length === 0)
        return false;
    const best = Math.max(...scored.map((entry) => entry.score));
    return scored.filter((entry) => entry.score === best).every((entry) => isDirectOnly(entry.file));
}
function ranked(prompt, candidates, maximum) {
    return candidates
        .map((file) => ({ file, score: score(prompt, file) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.file.id.localeCompare(right.file.id))
        .slice(0, maximum)
        .map((entry) => entry.file);
}
function linkedFiles(initial, byId) {
    const selected = new Map(initial.map((file) => [file.id, file]));
    const queue = [...initial];
    while (queue.length > 0) {
        const file = queue.shift();
        for (const match of file.content.matchAll(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
            const raw = match[1].trim();
            if (!raw || /^(?:[a-z]+:|\/)/i.test(raw))
                continue;
            const id = posix.normalize(posix.join(posix.dirname(file.id), raw));
            if (id.startsWith("../") || id === "..")
                continue;
            const linked = byId.get(id);
            if (linked && !selected.has(id)) {
                selected.set(id, linked);
                queue.push(linked);
            }
        }
    }
    return [...selected.values()];
}
function selectionFor(files, descriptor, prompt) {
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
    if (job === "learn-from-results")
        requiredIds.push("conquistador/standards/learning.md");
    if (/[\u00c0-\u024f\u1e00-\u1eff]/u.test(prompt))
        requiredIds.push("conquistador/standards/vietnamese.md");
    const allOutcomes = files.filter((file) => /^[^/]+\/SKILL\.md$/.test(file.id) && file.id !== "conquistador/SKILL.md");
    const allWorkflows = files.filter((file) => file.id.startsWith("conquistador/workflows/") && file.id.endsWith(".md"));
    const outcomeIsDirectOnly = (file) => isDirectOnlyEngineeringOutcome(file.id.slice(0, -"/SKILL.md".length));
    const workflowIsDirectOnly = (file) => isDirectOnlyEngineeringWorkflow(file.id.slice("conquistador/workflows/".length, -".md".length));
    const directOnlyIntent = hasDirectOnlyEngineeringIntent(prompt) ||
        exclusiveDirectOnlyWin(promptTokens, allOutcomes, outcomeIsDirectOnly) ||
        exclusiveDirectOnlyWin(promptTokens, allWorkflows, workflowIsDirectOnly);
    const outcomes = allOutcomes.filter((file) => !outcomeIsDirectOnly(file));
    const defaults = {
        "launch-or-grow": "plan-campaign/SKILL.md",
        "create-or-improve": "write-copy/SKILL.md",
        "learn-from-results": "measure-growth/SKILL.md",
    };
    const selectedOutcomes = directOnlyIntent ? [] : ranked(promptTokens, outcomes, 2);
    if (selectedOutcomes.length === 0 && !directOnlyIntent) {
        const fallback = byId.get(defaults[job]);
        if (fallback)
            selectedOutcomes.push(fallback);
    }
    const workflows = allWorkflows.filter((file) => !workflowIsDirectOnly(file));
    const selectedWorkflows = directOnlyIntent ? [] : ranked(promptTokens, workflows, 2);
    const contextual = files.filter((file) => file.id.startsWith("conquistador/channels/") || file.id.startsWith("conquistador/adapters/"));
    const selectedContext = ranked(promptTokens, contextual, 1);
    const required = requiredIds.map((id) => byId.get(id)).filter((file) => Boolean(file));
    const relevant = linkedFiles([...selectedOutcomes, ...selectedWorkflows, ...selectedContext], byId);
    const candidates = [...new Map([...required, ...relevant].map((file) => [file.id, file])).values()];
    const selected = [];
    const omittedFileIds = [];
    let contextBytes = 0;
    for (const file of candidates) {
        const bytes = Buffer.byteLength(file.content) + Buffer.byteLength(file.id) + 64;
        if (selected.length >= 24 || contextBytes + bytes > 80_000) {
            if (required.includes(file))
                throw new Error("[conquistador.corpus] required context exceeds the bounded context budget");
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
    return deepFreeze({ job, fileIds: selected.map(({ id }) => id), digest, systemInstructions, omittedFileIds });
}
export function loadCorpusDescriptor(skillsRoot) {
    return descriptorFor(inventory(skillsRoot));
}
export function loadRuntimeCorpus(skillsRoot) {
    const files = inventory(skillsRoot);
    const descriptor = descriptorFor(files);
    return Object.freeze({
        descriptor,
        resolve: (prompt) => selectionFor(files, descriptor, prompt),
    });
}
