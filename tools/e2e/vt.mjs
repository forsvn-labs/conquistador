// A small terminal screen model for E2E transcripts. It understands what Clack, Ink, and the
// installer write: text, CR/LF, cursor moves, erase, save/restore, the alternate screen, and SGR colors.
// screen.text() is what a person sees; screen.html() renders the same cells with colors.
const PALETTE = ['#1d1f21', '#cc6666', '#b5bd68', '#f0c674', '#81a2be', '#b294bb', '#8abeb7', '#c5c8c6',
  '#666666', '#d54e53', '#b9ca4a', '#e7c547', '#7aa6da', '#c397d8', '#70c0b1', '#eaeaea'];
const blank = () => ({ ch: ' ', style: null });
const xterm = index => {
  if (index < 16) return PALETTE[index];
  if (index >= 232) { const level = 8 + (index - 232) * 10; return `rgb(${level},${level},${level})`; }
  const cube = index - 16, step = value => (value ? 55 + value * 40 : 0);
  return `rgb(${step(Math.floor(cube / 36))},${step(Math.floor(cube / 6) % 6)},${step(cube % 6)})`;
};

export class Screen {
  constructor(columns = 80, rows = 30) {
    this.columns = columns;
    this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array.from({ length: columns }, blank));
    this.history = [];
    this.row = 0;
    this.column = 0;
    this.wrap = false;
    this.style = {};
    this.saved = [0, 0];
    this.pending = '';
    this.normal = null;
  }

  write(chunk) {
    const text = this.pending + chunk;
    this.pending = '';
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (ch === '\x1b') {
        const rest = text.slice(index);
        const csi = /^\x1b\[([?>=]?)([\d;:]*)([ -/]*)([@-~])/.exec(rest);
        const osc = /^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/.exec(rest);
        const short = /^\x1b([78cDEM=>()][0-9A-Za-z]?)/.exec(rest);
        if (csi) { this.csi(csi[1], csi[2], csi[4]); index += csi[0].length - 1; continue; }
        if (osc) { index += osc[0].length - 1; continue; }
        if (short) { this.escape(short[1][0]); index += short[0].length - 1; continue; }
        // An escape split across chunks: keep it for the next write.
        if (rest.length < 32) { this.pending = rest; return; }
        continue;
      }
      if (ch === '\r') { this.column = 0; this.wrap = false; continue; }
      if (ch === '\n') { this.lineFeed(); continue; }
      if (ch === '\b') { this.column = Math.max(0, this.column - 1); this.wrap = false; continue; }
      if (ch === '\t') { this.column = Math.min(this.columns - 1, (Math.floor(this.column / 8) + 1) * 8); continue; }
      if (ch === '\x07' || ch < ' ') continue;
      this.put(ch);
    }
  }

  put(ch) {
    if (this.wrap) { this.column = 0; this.lineFeed(); this.wrap = false; }
    this.grid[this.row][this.column] = { ch, style: Object.keys(this.style).length ? { ...this.style } : null };
    if (this.column === this.columns - 1) this.wrap = true;
    else this.column += 1;
  }

  lineFeed() {
    this.wrap = false;
    if (this.row < this.rows - 1) { this.row += 1; return; }
    this.history.push(this.grid.shift());
    this.grid.push(Array.from({ length: this.columns }, blank));
  }

  escape(code) {
    if (code === '7') this.saved = [this.row, this.column];
    else if (code === '8') [this.row, this.column] = this.saved;
    else if (code === 'c') Object.assign(this, new Screen(this.columns, this.rows));
  }

  csi(prefix, params, final) {
    // The alternate screen (1049): full-screen programs draw there; leaving it shows the normal screen again.
    if (prefix === '?' && params.split(';').includes('1049')) {
      if (final === 'h' && !this.normal) {
        this.normal = { grid: this.grid, history: this.history, row: this.row, column: this.column };
        this.grid = Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, blank));
        this.history = [];
        this.row = 0; this.column = 0;
      } else if (final === 'l' && this.normal) {
        ({ grid: this.grid, history: this.history, row: this.row, column: this.column } = this.normal);
        this.normal = null;
      }
      return;
    }
    if (prefix === '?' || prefix === '>' || prefix === '=') return;
    const values = params.split(';').map(item => (item === '' ? null : Number(item.split(':')[0])));
    const n = (fallback = 1) => values[0] ?? fallback;
    const clamp = () => { this.row = Math.max(0, Math.min(this.rows - 1, this.row)); this.column = Math.max(0, Math.min(this.columns - 1, this.column)); };
    this.wrap = false;
    switch (final) {
      case 'A': this.row -= n(); break;
      case 'B': this.row += n(); break;
      case 'C': this.column += n(); break;
      case 'D': this.column -= n(); break;
      case 'E': this.row += n(); this.column = 0; break;
      case 'F': this.row -= n(); this.column = 0; break;
      case 'G': this.column = n() - 1; break;
      case 'H': case 'f': this.row = (values[0] ?? 1) - 1; this.column = (values[1] ?? 1) - 1; break;
      case 'J': this.eraseDisplay(n(0)); break;
      case 'K': this.eraseLine(n(0)); break;
      case 'S': for (let i = 0; i < n(); i += 1) { this.grid.shift(); this.grid.push(Array.from({ length: this.columns }, blank)); } break;
      case 'T': for (let i = 0; i < n(); i += 1) { this.grid.pop(); this.grid.unshift(Array.from({ length: this.columns }, blank)); } break;
      case 'm': this.sgr(values); break;
      default: break;
    }
    clamp();
  }

  eraseLine(mode) {
    const line = this.grid[this.row];
    const [from, to] = mode === 1 ? [0, this.column + 1] : mode === 2 ? [0, this.columns] : [this.column, this.columns];
    for (let index = from; index < to; index += 1) line[index] = blank();
  }

  eraseDisplay(mode) {
    if (mode === 2 || mode === 3) { this.grid = Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, blank)); return; }
    this.eraseLine(mode);
    const rows = mode === 1 ? [0, this.row] : [this.row + 1, this.rows];
    for (let index = rows[0]; index < rows[1]; index += 1) this.grid[index] = Array.from({ length: this.columns }, blank);
  }

  sgr(values) {
    const list = values.length ? values.map(value => value ?? 0) : [0];
    for (let index = 0; index < list.length; index += 1) {
      const code = list[index];
      if (code === 0) this.style = {};
      else if (code === 1) this.style.bold = true;
      else if (code === 2) this.style.dim = true;
      else if (code === 3) this.style.italic = true;
      else if (code === 4) this.style.underline = true;
      else if (code === 7) this.style.inverse = true;
      else if (code === 9) this.style.strike = true;
      else if (code === 22) { delete this.style.bold; delete this.style.dim; }
      else if (code === 23) delete this.style.italic;
      else if (code === 24) delete this.style.underline;
      else if (code === 27) delete this.style.inverse;
      else if (code === 29) delete this.style.strike;
      else if (code >= 30 && code <= 37) this.style.fg = PALETTE[code - 30];
      else if (code >= 90 && code <= 97) this.style.fg = PALETTE[code - 82];
      else if (code >= 40 && code <= 47) this.style.bg = PALETTE[code - 40];
      else if (code >= 100 && code <= 107) this.style.bg = PALETTE[code - 92];
      else if (code === 39) delete this.style.fg;
      else if (code === 49) delete this.style.bg;
      else if (code === 38 || code === 48) {
        const key = code === 38 ? 'fg' : 'bg';
        if (list[index + 1] === 5) { this.style[key] = xterm(list[index + 2]); index += 2; }
        else if (list[index + 1] === 2) { this.style[key] = `rgb(${list[index + 2]},${list[index + 3]},${list[index + 4]})`; index += 4; }
      }
    }
  }

  lines({ history = false } = {}) {
    const rows = history ? [...this.history, ...this.grid] : this.grid;
    const text = rows.map(row => row.map(cell => cell.ch).join('').replace(/\s+$/, ''));
    while (text.length && !text.at(-1)) text.pop();
    return text;
  }

  text(options) { return `${this.lines(options).join('\n')}\n`; }

  // True when any cell carries a color or text style.
  styled() { return [...this.history, ...this.grid].some(row => row.some(cell => cell.style)); }

  html({ title = '', history = false } = {}) {
    const rows = history ? [...this.history, ...this.grid] : this.grid;
    const used = this.lines({ history }).length;
    const escape = text => text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
    const css = style => {
      if (!style) return '';
      let fg = style.fg, bg = style.bg;
      if (style.inverse) [fg, bg] = [bg ?? '#1d1f21', fg ?? '#c5c8c6'];
      return [fg && `color:${fg}`, bg && `background:${bg}`, style.bold && 'font-weight:700', style.dim && 'opacity:.6',
        style.italic && 'font-style:italic', style.underline && 'text-decoration:underline', style.strike && 'text-decoration:line-through'].filter(Boolean).join(';');
    };
    const body = rows.slice(0, Math.max(used, 1)).map(row => {
      let html = '', run = '', current = '';
      for (const cell of row) {
        const next = css(cell.style);
        if (next !== current) { html += current ? `<span style="${current}">${escape(run)}</span>` : escape(run); run = ''; current = next; }
        run += cell.ch;
      }
      html += current ? `<span style="${current}">${escape(run)}</span>` : escape(run);
      return html.replace(/\s+$/, '');
    }).join('\n');
    return `<figure class="term" style="width:${this.columns}ch"><figcaption>${escape(title)}</figcaption><pre>${body}</pre></figure>`;
  }
}

export const HTML_HEAD = `<!doctype html><meta charset="utf-8"><title>Conquistador onboarding v2 screens</title>
<style>body{background:#111;color:#c5c8c6;font:14px/1.35 ui-monospace,Menlo,monospace;padding:24px;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
.term{margin:0;background:#1d1f21;border-radius:8px;padding:12px 14px;box-shadow:0 2px 12px #0008}
.term figcaption{color:#8a8f98;font-size:12px;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px}
.term pre{margin:0;font:inherit;white-space:pre}</style>`;
