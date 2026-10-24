/**
 * Remove identity leaks from a draft before a blind judge sees it. Every removal is reported so a
 * human can audit what the judge did not see. The normalizer never rewrites deliverable prose; it
 * drops whole labels, lines, fences, or sections, and replaces cited file names with a neutral mark.
 */

export type NormalizeRule =
  | "front-matter"
  | "metadata-fence"
  | "wrapper-fence"
  | "arm-label"
  | "metadata-line"
  | "provenance"
  | "method-section"
  | "readiness-label"
  | "length-marker"
  | "file-name";

export type Removal = { rule: NormalizeRule; excerpt: string };

export type NormalizedDraft = {
  text: string;
  removals: Removal[];
  /** Identity words still present after normalization. A non-empty list needs a human decision. */
  residualLeaks: string[];
  words: number;
};

export type NormalizeOptions = {
  /** Arm identities, for example `bare` and `method`. */
  identityTokens: string[];
  /** Extra section headings to strip, matched case-insensitively against the heading start. */
  stripHeadings?: string[];
};

const BUILTIN_LEAK_TOKENS = ["conquistador"];
const ARM_WORDS = "bare|method|baseline|candidate|control|treatment|without[- ]method|with[- ]method";

const METHOD_SECTIONS = [
  /^why (these|this|the|it) (choices?|works?|structure|approach|version|order|wins?)\b/,
  /^(rationale|reasoning|design (notes|rationale|decisions)|decisions log)\b/,
  /^(method|process|approach|operator|reviewer) notes\b/,
  /^notes (for|to) (the )?(reviewer|operator|user|editor)\b/,
  /^self[- ]?(score|scoring|review|assessment|check|critique|evaluation|grade)\b/,
  /^(scorecard|scores?|scoring|rubric)\b/,
  /^(critic|critique)\b/,
  /^(quality|qa|final|pre-?flight) (check|gate|review|pass|checklist)\b/,
  /^review (notes|pass|checklist|summary)\b/,
  /^anti[- ]?patterns?\b/,
  /^(swap|first[- ]screen|so[- ]what|squint|5[- ]second) test\b/,
  /^(claims?|facts?) (to verify|check|audit|ledger|register)\b/,
  /^(verification|fact[- ]check|readiness)\b/,
  /^what i (changed|did|checked)\b/,
  /^(methods?|skills?|playbooks?|sources?|references?) (used|applied|read|loaded|consulted)\b/,
];
const READINESS_WRAPPERS = /^(ready to (use|ship|send|publish|paste)|final (draft|version|output|copy)|deliverable|output)$/;
const METADATA_KEYS = new Set([
  "arm", "variant", "condition", "skill", "method", "playbook", "model", "version", "date", "status", "surface",
  "readiness", "verdict", "score", "self-score", "grade", "confidence", "author", "generated", "generator",
  "run", "practice", "command", "agent", "agents", "references", "sources", "word_count", "words", "length",
]);
const LABEL_KEY = String.raw`^\s*(?:[-*]\s+)?(?:\*\*|__)?\s*`;
const READINESS_LINE = new RegExp(`${LABEL_KEY}(status|readiness|verdict|ready|grade|self[- ]?score|score|confidence|quality (gate|check))\\s*(?:\\*\\*|__)?\\s*[:：]`, "i");
const METADATA_LINE = new RegExp(`${LABEL_KEY}(arm|variant|condition|skill|playbook|model|generated (by|with)|generator|run as|methods? used)\\s*(?:\\*\\*|__)?\\s*[:：]`, "i");
const LENGTH_LINE = new RegExp(`${LABEL_KEY}(word count|character count|char count|length|reading time|words)\\s*(?:\\*\\*|__)?\\s*[:：]`, "i");
const LABEL_WORDS = "PASS|PASSED|FAIL|FAILED|REVISE|READY|SHIP|SHIPPABLE|APPROVED|BLOCKED|DRAFT|NEEDS REVISION";
const READINESS_ONLY = new RegExp(`^\\s*(?:[✅❌⚠️✔️]\\s*)?(?:\\*\\*)?[\\[(]?\\s*(?:${LABEL_WORDS})\\s*[\\])]?(?:\\*\\*)?\\.?\\s*$`);
const READY_BADGE_LINE = /^\s*[✅✔️🟢]\s*(ready|pass|approved)\b.*$/i;
const READINESS_BADGE = new RegExp(`\\s*[\\[(]\\s*(?:${LABEL_WORDS})\\s*[\\])]`, "g");
const LENGTH_UNITS = String.raw`(?:words?|characters?|chars?|tokens?|min(?:ute)?s? read)`;
const LENGTH_INLINE = new RegExp(String.raw`\s*[\[(]\s*~?\s*\d[\d,.]*\s*${LENGTH_UNITS}\s*[\])]`, "gi");
const LENGTH_ONLY = new RegExp(String.raw`^\s*[\[(]?\s*[~≈]?\s*\d[\d,.]*\s*${LENGTH_UNITS}\s*[\])]?\.?\s*$`, "i");
const PROVENANCE = [
  /^(written|drafted|generated|produced|prepared|composed)\s+(after|from|using|with|following|as|via)\b/i,
  /^(run|ran|executed)\s+(as|with|via|using)\b/i,
  /^(single|multi)[- ]context review\b/i,
  /^(this|the) draft (was|is) (written|generated|produced|drafted)\b/i,
  /^(sources?|files?|references?|methods?|skills?|playbooks?) (read|used|loaded|consulted|applied)\b/i,
  /^based on (the )?(method|skill|playbook|references?)\b/i,
];
const FILE_NAME = String.raw`\x60?(?:[\w.-]+\/)*[\w.{},-]*\w\.(?:md|mdx|json|ya?ml|toml|txt|ts|mjs|js|py)\x60?(?![\w/])`;
const FILE_PAREN = new RegExp(String.raw`\s*\([^()\n]*${FILE_NAME}[^()\n]*\)`, "g");
const FILE_INLINE = new RegExp(FILE_NAME, "g");
const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;

type Item = { kind: "line"; text: string; level: number } | { kind: "fence"; info: string; lines: string[] };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function headingText(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/^(\d+[.)]|phase \d+[:.]?|step \d+[:.]?)\s*/i, "")
    .replace(/[:：\s]+$/, "")
    .trim()
    .toLowerCase();
}

function tokenize(lines: string[]): Item[] {
  const items: Item[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const open = FENCE_OPEN.exec(line);
    if (open) {
      const marker = open[1]!;
      const body: string[] = [];
      let closed = false;
      for (index += 1; index < lines.length; index += 1) {
        const candidate = lines[index]!.trim();
        if (candidate.startsWith(marker[0]!.repeat(marker.length)) && /^[`~]+$/.test(candidate)) { closed = true; break; }
        body.push(lines[index]!);
      }
      if (!closed) index = lines.length;
      items.push({ kind: "fence", info: open[2]!.toLowerCase(), lines: body });
      continue;
    }
    const heading = /^(#{1,6})\s+\S/.exec(line);
    items.push({ kind: "line", text: line, level: heading ? heading[1]!.length : 0 });
  }
  return items;
}

function render(items: Item[]): string {
  return items.map((item) => (item.kind === "line" ? item.text : ["```" + item.info, ...item.lines, "```"].join("\n"))).join("\n");
}

function isMetadataFence(item: Extract<Item, { kind: "fence" }>): boolean {
  if (!["", "yaml", "yml", "json", "toml", "text", "txt", "ini"].includes(item.info)) return false;
  const content = item.lines.filter((line) => line.trim());
  if (!content.length) return false;
  const keys = content.map((line) => /^\s*"?([\w -]+?)"?\s*[:=]/.exec(line)?.[1]?.trim().toLowerCase().replace(/ /g, "_"));
  const keyed = keys.filter(Boolean).length;
  return keyed / content.length >= 0.5 && keys.some((key) => Boolean(key) && (METADATA_KEYS.has(key!) || METADATA_KEYS.has(key!.replace(/_/g, "-"))));
}

function cleanPass(source: string, options: NormalizeOptions, removals: Removal[]): string {
  const remove = (rule: NormalizeRule, excerpt: string) => removals.push({ rule, excerpt: excerpt.trim() });
  let lines = source.split("\n");

  if (/^(---|\+\+\+)\s*$/.test(lines[0] ?? "")) {
    const marker = lines[0]!.trim();
    const close = lines.findIndex((line, index) => index > 0 && line.trim() === marker);
    if (close > 0) {
      remove("front-matter", lines.slice(0, close + 1).join("\n"));
      lines = lines.slice(close + 1);
    }
  }

  const arms = [...new Set([...options.identityTokens.map(escapeRegex), ARM_WORDS])].join("|");
  const armLabel = new RegExp(`\\b(${arms})\\b[\\s-]*(draft|arm|version|variant|output|run|condition)\\b|\\b(draft|arm|variant|condition)\\s*[:=]?\\s*(${options.identityTokens.map(escapeRegex).join("|") || "$^"})\\b`, "i");
  const extra = (options.stripHeadings ?? []).map((heading) => heading.trim().toLowerCase()).filter(Boolean);
  const isMethodSection = (text: string) => METHOD_SECTIONS.some((pattern) => pattern.test(text)) || extra.some((heading) => text.startsWith(heading));

  const items = tokenize(lines);
  const kept: Item[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.kind === "fence") {
      if (isMetadataFence(item)) remove("metadata-fence", render([item]));
      else kept.push(item);
      continue;
    }
    if (item.level > 0) {
      const text = headingText(item.text);
      if (armLabel.test(item.text)) { remove("arm-label", item.text); continue; }
      if (isMethodSection(text)) {
        let end = index + 1;
        while (end < items.length) {
          const next = items[end]!;
          if (next.kind === "line" && next.level > 0 && next.level <= item.level) break;
          end += 1;
        }
        remove("method-section", render(items.slice(index, end)));
        index = end - 1;
        continue;
      }
      if (READINESS_WRAPPERS.test(text)) { remove("readiness-label", item.text); continue; }
    } else {
      const trimmed = item.text.trim();
      if (PROVENANCE.some((pattern) => pattern.test(trimmed))) {
        let end = index + 1;
        while (end < items.length) {
          const next = items[end]!;
          if (next.kind !== "line" || !next.text.trim() || next.level > 0) break;
          end += 1;
        }
        remove("provenance", render(items.slice(index, end)));
        index = end - 1;
        continue;
      }
      if (METADATA_LINE.test(trimmed)) { remove("metadata-line", trimmed); continue; }
      if (trimmed && armLabel.test(trimmed)) { remove("arm-label", trimmed); continue; }
      if (READINESS_LINE.test(trimmed) || READINESS_ONLY.test(trimmed) || READY_BADGE_LINE.test(trimmed)) { remove("readiness-label", trimmed); continue; }
      if (LENGTH_LINE.test(trimmed) || (trimmed && LENGTH_ONLY.test(trimmed))) { remove("length-marker", trimmed); continue; }
      let text = item.text;
      text = text.replace(LENGTH_INLINE, (match) => { remove("length-marker", match); return ""; });
      text = text.replace(READINESS_BADGE, (match) => { remove("readiness-label", match); return ""; });
      text = text.replace(FILE_PAREN, (match) => { remove("file-name", match); return ""; });
      text = text.replace(FILE_INLINE, (match) => { remove("file-name", match); return "[file]"; });
      if (text !== item.text) text = text.replace(/(\S) {2,}/g, "$1 ").replace(/ +([.,;:!?])/g, "$1");
      kept.push({ ...item, text });
      continue;
    }
    kept.push(item);
  }
  return tidy(render(kept));
}

function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapperFence(text: string): Extract<Item, { kind: "fence" }> | null {
  const items = tokenize(text.split("\n")).filter((item) => item.kind === "fence" || item.text.trim());
  const only = items.length === 1 ? items[0]! : null;
  return only?.kind === "fence" && ["", "markdown", "md", "text", "txt"].includes(only.info) ? only : null;
}

export function normalizeDraft(source: string, options: NormalizeOptions): NormalizedDraft {
  const removals: Removal[] = [];
  let text = tidy(source.replace(/^﻿/, "").replace(/\r\n?/g, "\n"));
  for (let pass = 0; pass < 4; pass += 1) {
    text = cleanPass(text, options, removals);
    const fence = wrapperFence(text);
    if (!fence) break;
    removals.push({ rule: "wrapper-fence", excerpt: "```" + fence.info });
    text = tidy(fence.lines.join("\n"));
  }
  const residualLeaks = [...new Set([...options.identityTokens, ...BUILTIN_LEAK_TOKENS].map((token) => token.toLowerCase()))]
    .filter((token) => token && new RegExp(`\\b${escapeRegex(token)}\\b`, "i").test(text));
  const words = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return { text, removals, residualLeaks, words };
}
