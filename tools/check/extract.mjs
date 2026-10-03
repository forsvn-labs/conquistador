// Turn Markdown, MDX, HTML, and plain text into one document shape that rules read.
// Every text line keeps the line number of its source so findings point at the file.
// No dependencies: the front matter reader handles the flat YAML that copy files use.

export const scannableExtensions = ['.md', '.mdx', '.markdown', '.html', '.htm', '.txt'];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•' };

export const decodeEntities = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
  if (name[0] !== '#') return entities[name.toLowerCase()] ?? match;
  const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));

  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
});

function scalar(value) {
  const text = value.trim();

  if (/^".*"$/.test(text)) return text.slice(1, -1).replace(/\\"/g, '"');

  if (/^'.*'$/.test(text)) return text.slice(1, -1).replace(/''/g, "'");

  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';

  return text.replace(/\s+#.*$/, '');
}

function inlineList(value) {
  return value.trim().slice(1, -1).split(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/).map(scalar).filter(item => item !== '');
}

// Read `key: value`, `key: [a, b]`, block lists, and `|` or `>` blocks. Nested maps are skipped.
export function parseFrontMatter(lines) {
  if (lines[0]?.trim() !== '---') return { data: {}, at: {}, end: 0 };
  const close = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));

  if (close < 0) return { data: {}, at: {}, end: 0 };
  const data = {};
  const at = {};
  let key = null;
  let block = null;

  for (const [index, line] of lines.slice(1, close).entries()) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);

    if (block !== null && (/^\s+\S/.test(line) || line.trim() === '')) {
      data[key] = data[key] ? `${data[key]}${block === '|' ? '\n' : ' '}${line.trim()}` : line.trim();
    } else if (item && key) {
      data[key] = Array.isArray(data[key]) ? [...data[key], scalar(item[1])] : [scalar(item[1])];
      block = null;
    } else if (pair) {
      key = pair[1].toLowerCase().replace(/-/g, '_');
      at[key] = index + 2;
      block = /^[|>][+-]?$/.test(pair[2].trim()) ? pair[2].trim()[0] : null;
      data[key] = block !== null || pair[2].trim() === '' ? '' : pair[2].trim().startsWith('[') ? inlineList(pair[2]) : scalar(pair[2]);
    } else {
      block = null;
    }
  }

  return { data, at, end: close + 1 };
}

const markdownLink = /!?\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+["'][^)]*["'])?\s*\)/g;

const autoLink = /<((?:https?:\/\/|mailto:)[^>\s]+)>/g;

// Strip inline Markdown and keep link targets beside the text.
function markdownLine(raw) {
  const links = [];

  let text = raw.replace(markdownLink, (match, label, href) => {
    if (!match.startsWith('!')) links.push({ href, text: label.replace(/[*_`]/g, '').trim() });

    return match.startsWith('!') ? '' : label;
  }).replace(autoLink, (match, href) => {
    links.push({ href, text: href });

    return href;
  });

  for (const [match, href] of text.matchAll(/(?<![("<])\bhttps?:\/\/[^\s)\]>"']+/g)) if (!links.some(link => link.href === match)) links.push({ href, text: match });
  text = text.replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|\W)[*_](?=\S)([^*_]+?)[*_](?=\W|$)/g, '$1$2');

  return { text: decodeEntities(text).replace(/[ \t]+/g, ' ').trim(), links };
}

function markdownDocument(source) {
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  const { data, at, end } = parseFrontMatter(raw);
  const lines = [];
  const body = [];
  let fence = null;
  let comment = false;
  let jsx = false;

  for (const [index, line] of raw.entries()) {
    if (index < end) continue;
    const trimmed = line.trim();
    const marker = /^(```+|~~~+)/.exec(trimmed);

    if (fence) { if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null; continue; }

    if (marker) { fence = marker[1]; continue; }

    // MDX imports and exports are code, not copy.
    if (jsx || /^(import|export)\s/.test(trimmed)) { jsx = !/[;}]\s*$|from\s+["'][^"']+["'];?$/.test(trimmed) && /[{(]\s*$/.test(trimmed); continue; }

    let visible = line;

    if (comment) {
      const close = visible.indexOf('-->');

      if (close < 0) continue;
      visible = ' '.repeat(close + 3) + visible.slice(close + 3);
      comment = false;
    }

    visible = visible.replace(/<!--[\s\S]*?-->/g, '');
    const open = visible.indexOf('<!--');

    if (open >= 0) { visible = visible.slice(0, open); comment = true; }

    body.push({ n: index + 1, raw: visible });

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(visible) || /^\s*\|?\s*:?-{3,}/.test(visible)) continue;
    const { text, links } = markdownLine(visible.replace(/\|/g, ' '));

    if (text) lines.push({ n: index + 1, text, links, heading: /^\s{0,3}#{1,6}\s/.test(visible) });
  }

  return { kind: 'markdown', data, fieldLines: at, lines, body };
}

const blockTags = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'button', 'caption', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'section', 'summary', 'table', 'td', 'th', 'tr', 'ul']);

const hiddenTags = ['script', 'style', 'noscript', 'template', 'svg', 'head'];

const attribute = (tag, name) => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);

  return match ? decodeEntities(match[1] ?? match[2] ?? match[3]) : null;
};

// Keep newlines when removing hidden regions so later line numbers stay true.
const blankOut = text => text.replace(/[^\n]/g, '');

function htmlDocument(source) {
  const html = source.replace(/\r\n?/g, '\n');
  const data = {};
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);

  if (title) data.title = decodeEntities(title[1].replace(/\s+/g, ' ').trim());

  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = (attribute(tag, 'name') ?? attribute(tag, 'property') ?? '').toLowerCase();
    const content = attribute(tag, 'content');

    if (content === null) continue;

    if (name === 'description') data.description = content.trim();

    if (['og:title', 'og:description', 'subject', 'channel'].includes(name)) data[name.replace(':', '_')] = content.trim();
  }

  data.html_lang = attribute(/<html\b[^>]*>/i.exec(html)?.[0] ?? '', 'lang');
  let visible = html.replace(/<!--[\s\S]*?-->/g, blankOut).replace(/<!doctype[^>]*>/gi, blankOut);

  for (const tag of hiddenTags) visible = visible.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), blankOut);
  const lines = [];
  let line = 1;
  let current = null;
  let anchor = null;
  let preheader = null;

  const flush = () => {
    if (current && current.text.replace(/\s+/g, ' ').trim()) lines.push({ ...current, text: current.text.replace(/\s+/g, ' ').trim() });
    current = null;
  };

  for (const [token] of visible.matchAll(/<[^>]*>|[^<]+/g)) {
    if (token.startsWith('<')) {
      const tag = /^<\/?\s*([a-z0-9-]+)/i.exec(token)?.[1]?.toLowerCase() ?? '';
      const closing = token.startsWith('</');

      if (tag === 'a' && !closing) anchor = { href: attribute(token, 'href') ?? '', text: '', tag: 'a' };

      if (tag === 'button' && !closing) anchor = { href: '', text: '', tag: 'button' };

      if (tag === 'input' && /type\s*=\s*["']?(submit|button)/i.test(token)) (current ??= { n: line, text: '', links: [] }).links.push({ href: '', text: attribute(token, 'value') ?? '', tag: 'button' });

      if ((tag === 'a' || tag === 'button') && closing && anchor) {
        (current ??= { n: line, text: '', links: [] }).links.push({ ...anchor, text: anchor.text.replace(/\s+/g, ' ').trim() });
        anchor = null;
      }

      if (!closing && preheader === null && /\b(class|id)\s*=\s*["'][^"']*(preheader|preview)/i.test(token)) preheader = '';

      if (blockTags.has(tag) && !(tag === 'button' && !closing)) flush();
    } else {
      const text = decodeEntities(token);

      if (text.trim()) {
        current ??= { n: line + (token.match(/^\s*/)[0].match(/\n/g)?.length ?? 0), text: '', links: [] };
        current.text += text;

        if (anchor) anchor.text += text;

        if (preheader === '') preheader = text.replace(/\s+/g, ' ').trim();
      } else if (current) {
        current.text += ' ';
      }
    }

    line += token.match(/\n/g)?.length ?? 0;
  }

  flush();

  if (preheader) data.preheader = preheader;

  return { kind: 'html', data, lines, body: html.split('\n').map((raw, index) => ({ n: index + 1, raw })) };
}

function textDocument(source) {
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  const lines = [];

  for (const [index, line] of raw.entries()) {
    const links = [...line.matchAll(/\bhttps?:\/\/[^\s)\]>"']+/g)].map(([href]) => ({ href, text: href }));

    if (line.trim()) lines.push({ n: index + 1, text: line.trim(), links });
  }

  return { kind: 'text', data: {}, lines, body: raw.map((text, index) => ({ n: index + 1, raw: text })) };
}

// Pull `Subject:`, `Preheader:`, and similar label lines out of the body when front matter lacks them.
const labelFields = { subject: 'subject', 'subject line': 'subject', preheader: 'preheader', 'preview text': 'preheader', preview: 'preheader', 'meta title': 'meta_title', 'seo title': 'meta_title', 'title tag': 'meta_title', 'meta description': 'meta_description' };

function labels(document) {
  for (const line of document.lines.slice(0, 40)) {
    const match = /^([A-Za-z ]{4,16}?)\s*:\s*(.+)$/.exec(line.text);
    const field = match ? labelFields[match[1].trim().toLowerCase()] : null;

    if (field && document.data[field] === undefined) { document.data[field] = match[2].trim(); document.fieldLines[field] = line.n; }
  }
}

// Copy fields (subject, title, headlines) are text too: phrase rules read them as lines.
const copyFields = ['subject', 'preheader', 'preview_text', 'title', 'meta_title', 'seo_title', 'description', 'meta_description', 'og_title', 'og_description', 'headline', 'headlines', 'descriptions', 'primary_text', 'cta'];

function fieldText(document) {
  const extra = copyFields.flatMap(name => [document.data[name]].flat()
    .filter(value => value !== undefined && value !== '' && value !== true && value !== false)
    .map(value => ({ n: document.fieldLines[name] ?? 1, text: String(value), links: [], field: name })));

  document.lines = [...extra, ...document.lines].sort((left, right) => left.n - right.n);
}

export function extractDocument(source, extension) {
  const ext = extension.toLowerCase();
  const document = ['.html', '.htm'].includes(ext) ? htmlDocument(source) : ['.md', '.mdx', '.markdown'].includes(ext) ? markdownDocument(source) : textDocument(source);

  document.source = source;
  document.fieldLines ??= {};
  fieldText(document);
  labels(document);

  return document;
}
