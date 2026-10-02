// Channel detection and channel-specific field readers.
// Order: --channel, then front matter `channel:`, then file and folder names, then the file type.
import { basename, dirname, extname, sep } from 'node:path';

export const channels = {
  x: 'X (Twitter) post or thread',
  linkedin: 'LinkedIn post',
  email: 'Marketing email',
  landing: 'Landing page',
  'google-ads': 'Google responsive search ad',
  'meta-ads': 'Meta (Facebook, Instagram) ad',
  article: 'Blog post or article',
  social: 'Social post, platform not named',
  web: 'Web page',
  general: 'Marketing text, channel not named',
};

const aliases = {
  twitter: 'x', tweet: 'x', tweets: 'x', thread: 'x', 'x-post': 'x', 'x-thread': 'x',
  li: 'linkedin', 'linkedin-post': 'linkedin',
  newsletter: 'email', edm: 'email', nurture: 'email', drip: 'email', mail: 'email', emails: 'email', lifecycle: 'email',
  lp: 'landing', homepage: 'landing', 'landing-page': 'landing', page: 'landing', home: 'landing',
  rsa: 'google-ads', adwords: 'google-ads', 'search-ads': 'google-ads', 'google-ad': 'google-ads', sem: 'google-ads', ppc: 'google-ads', google: 'google-ads',
  facebook: 'meta-ads', fb: 'meta-ads', instagram: 'meta-ads', ig: 'meta-ads', meta: 'meta-ads', 'meta-ad': 'meta-ads', 'facebook-ads': 'meta-ads',
  blog: 'article', longform: 'article', articles: 'article',
};

export function normalizeChannel(value) {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');

  return channels[key] ? key : aliases[key] ?? null;
}

const tokens = name => name.toLowerCase().replace(/\.[^.]+$/, '').split(/[^a-z0-9]+/).filter(Boolean);

// Name tokens that imply a channel. Ad platforms need the word "ad" or "ads" beside the platform.
function channelFromName(name) {
  const words = tokens(name);
  const joined = `-${words.join('-')}-`;
  const ad = words.some(word => ['ad', 'ads', 'advert', 'creative'].includes(word));

  if (/-(rsa|adwords|sem|ppc)-/.test(joined) || (ad && /-(google|search)-/.test(joined))) return 'google-ads';
  if (ad && /-(meta|facebook|fb|instagram|ig)-/.test(joined)) return 'meta-ads';
  if (/-(x|tweet|tweets|twitter|thread)-/.test(joined)) return 'x';
  if (/-linkedin-/.test(joined)) return 'linkedin';
  if (/-(email|emails|newsletter|edm|nurture|drip|lifecycle)-/.test(joined)) return 'email';
  if (/-(landing|lp|homepage)-/.test(joined)) return 'landing';
  if (/-(blog|article|longform)-/.test(joined)) return 'article';
  if (/-(social)-/.test(joined)) return 'social';

  return null;
}

export function detectChannel(file, document, override) {
  const forced = normalizeChannel(override);

  if (forced) return forced;
  const declared = normalizeChannel(document.data.channel);

  if (declared) return declared;
  const path = file.startsWith('http') ? new URL(file).pathname : file;
  const own = channelFromName(basename(path));

  if (own) return own;
  for (const folder of dirname(path).split(/[\\/]/).reverse().slice(0, 3)) {
    const found = channelFromName(folder);

    if (found) return found;
  }
  if (document.kind === 'html' && /<form\b|<button\b|type=["']?submit/i.test(document.source) && /<h1\b/i.test(document.source)) return 'landing';

  return document.kind === 'html' ? 'web' : 'general';
}

// Words in a path that mark a file as marketing work even when no channel is named.
const marketingWords = new Set(['marketing', 'copy', 'campaign', 'campaigns', 'launch', 'launches', 'content', 'social', 'posts', 'ads', 'press', 'outreach', 'announcement', 'announcements', 'growth', 'gtm', 'seo', 'drafts', 'deliverables']);

const skippedFolders = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'vendor', '.next', '.nuxt', '.svelte-kit', 'skills', '.claude', '.codex', '.cursor', '.agents', '.conquistador', '.github']);

const projectFiles = /^(readme|changelog|license|licence|agents|claude|gemini|contributing|install|security|code_of_conduct|skill|command|notice|migration|vision|roadmap|progress|index|versions|todo)(\.[a-z]+)?$/i;

// The hook stays silent unless a file looks like marketing copy. Code, docs, and agent files never qualify.
export function isMarketingFile(file, document) {
  const parts = file.split(/[\\/]/);

  if (parts.slice(0, -1).some(part => skippedFolders.has(part))) return false;
  if (projectFiles.test(basename(file).replace(/\.[^.]+$/, '').replace(/\.[^.]+$/, '')) && !document?.data?.channel) return false;
  if (normalizeChannel(document?.data?.channel)) return true;
  if (['.html', '.htm'].includes(extname(file).toLowerCase())) return true;
  if (channelFromName(basename(file))) return true;

  return parts.slice(-4, -1).some(part => marketingWords.has(part.toLowerCase()) || channelFromName(part));
}

// X weighting from the counting-characters guide: URLs count 23, CJK and emoji count 2.
const lightRanges = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];

const urlPattern = /\bhttps?:\/\/\S+|\b(?:[a-z0-9-]+\.)+(?:com|io|co|ai|org|net|app|dev)(?:\/\S*)?/gi;

export function weightedLength(text) {
  let total = (text.match(urlPattern) ?? []).length * 23;

  for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text.replace(urlPattern, ''))) {
    if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u.test(segment)) { total += 2; continue; }
    for (const character of segment) {
      const code = character.codePointAt(0);

      total += lightRanges.some(([low, high]) => code >= low && code <= high) ? 1 : 2;
    }
  }

  return total;
}

// Google counts each double-width (Chinese, Japanese, Korean) character as 2.
export function adLength(text) {
  let total = 0;

  for (const character of text) total += /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}！-｠]/u.test(character) ? 2 : 1;

  return total;
}

// Ad fields come from front matter lists, `Headline 1: ...` lines, or `## Headlines` sections with list items.
const fieldNames = [
  [/^(headlines?|h\d+)$/, 'headlines'], [/^(descriptions?|d\d+)$/, 'descriptions'], [/^(paths?|display paths?)$/, 'paths'],
  [/^(primary texts?|primary|body text)$/, 'primary'], [/^(long headlines?)$/, 'long'],
];

const fieldFor = label => fieldNames.find(([pattern]) => pattern.test(label.trim().toLowerCase().replace(/\s*\d+$/, '').replace(/\s+/g, ' ')))?.[1] ?? null;

export function adFields(document) {
  const fields = { headlines: [], descriptions: [], paths: [], primary: [] };
  const fromData = (key, values) => { for (const value of [values].flat()) if (value !== undefined && value !== '') fields[key].push({ text: String(value), n: document.fieldLines[key] ?? document.fieldLines[`${key.replace(/s$/, '')}`] ?? 1 }); };

  fromData('headlines', document.data.headlines ?? document.data.headline);
  fromData('descriptions', document.data.descriptions ?? document.data.description_lines);
  fromData('paths', document.data.paths);
  fromData('primary', document.data.primary_text ?? document.data.primary);
  if (document.kind === 'html') return fields;
  let section = null;

  for (const line of document.body) {
    const raw = line.raw.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(raw);
    const labeled = /^(?:[-*]\s*)?(?:\*\*)?([A-Za-z][A-Za-z ]{0,24}?\s*\d*)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+?)\s*$/.exec(raw);
    const listed = /^(?:[-*+]|\d+[.)])\s+(.+)$/.exec(raw);

    if (heading) { section = fieldFor(heading[1].replace(/[*_`]/g, '')); continue; }
    if (labeled && fieldFor(labeled[1])) { fields[fieldFor(labeled[1])].push({ text: labeled[2].replace(/^["“]|["”]$/g, '').replace(/\s*\(\d+\s*(chars?|characters?)\)\s*$/i, ''), n: line.n }); continue; }
    if (section && listed) fields[section].push({ text: listed[1].replace(/[*_`]/g, '').replace(/^["“]|["”]$/g, '').replace(/\s*\(\d+\s*(chars?|characters?)\)\s*$/i, '').trim(), n: line.n });
    else if (section === 'primary' && raw) fields.primary.push({ text: raw, n: line.n });
  }

  return fields;
}

// Split an X file into posts: one per `##` section, or one per `---` block, or the whole body.
export function socialPosts(document) {
  const posts = [];
  let current = null;
  const usesHeadings = document.body.some(line => /^#{1,6}\s/.test(line.raw));
  const usesRules = !usesHeadings && document.body.some(line => /^\s*-{3,}\s*$/.test(line.raw));

  for (const line of document.body) {
    const heading = /^#{1,6}\s/.test(line.raw);
    const rule = /^\s*-{3,}\s*$/.test(line.raw);

    if ((usesHeadings && heading) || (usesRules && rule)) { if (current) posts.push(current); current = null; continue; }
    if (!line.raw.trim() && !current) continue;
    current ??= { n: line.n, lines: [] };
    current.lines.push(line.raw);
  }
  if (current) posts.push(current);

  return posts.map(post => ({ n: post.n, text: post.lines.join('\n').trim() })).filter(post => post.text);
}

export const relativeTo = (root, file) => file.startsWith(root + sep) ? file.slice(root.length + 1) : file;
