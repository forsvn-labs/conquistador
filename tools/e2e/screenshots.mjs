// Turn a screens gallery (screens.html from tools/e2e/onboarding-v2.mjs) into one PNG per screen.
//   node tools/e2e/screenshots.mjs GALLERY.html OUT_DIR [--only TEXT[,TEXT]] [--browser PATH]
// Needs a Chromium-family browser with --headless. CONQUISTADOR_E2E_BROWSER or --browser picks it;
// otherwise the Playwright headless shell or Google Chrome is used when present.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { HTML_HEAD } from './vt.mjs';

const [gallery, outDir] = process.argv.slice(2);
const option = name => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
if (!gallery || !outDir) { console.error('Usage: node tools/e2e/screenshots.mjs GALLERY.html OUT_DIR [--only TEXT[,TEXT]] [--browser PATH]'); process.exit(2); }

function browser() {
  const named = option('--browser') ?? process.env.CONQUISTADOR_E2E_BROWSER;
  if (named) return named;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const shells = existsSync(cache) ? readdirSync(cache).filter(name => name.startsWith('chromium_headless_shell-')).sort().reverse() : [];
  for (const folder of shells) {
    for (const build of readdirSync(join(cache, folder))) {
      const path = join(cache, folder, build, 'chrome-headless-shell');
      if (existsSync(path)) return path;
    }
  }
  return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync) ?? null;
}

const chrome = browser();
if (!chrome) { console.error('No Chromium-family browser found. Pass --browser PATH.'); process.exit(1); }
const only = option('--only')?.split(',') ?? null;
const figures = [...readFileSync(gallery, 'utf8').matchAll(/<figure class="term" style="width:(\d+)ch"><figcaption>([^<]*)<\/figcaption><pre>([\s\S]*?)<\/pre><\/figure>/g)];
mkdirSync(outDir, { recursive: true });
const work = resolve(outDir, 'pages');
mkdirSync(work, { recursive: true });
let written = 0;
for (const [figure, columns, caption, body] of figures) {
  if (only && !only.some(text => caption.includes(text))) continue;
  const name = caption.replace(/&amp;/g, '&').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const page = join(work, `${name}.html`);
  writeFileSync(page, `${HTML_HEAD}<style>body{padding:16px;display:block}</style>\n${figure}\n`);
  // Menlo at 14px is about 8.43px per column and 18.9px per line, plus padding and the caption.
  const width = Math.ceil(Number(columns) * 8.43) + 64;
  const height = body.split('\n').length * 19 + 110;
  const png = resolve(outDir, `${name}.png`);
  const result = spawnSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--virtual-time-budget=2000', `--window-size=${width},${height}`, `--screenshot=${png}`, `file://${page}`], { encoding: 'utf8', timeout: 60_000 });
  if (result.status !== 0 || !existsSync(png)) console.error(`Could not render ${caption}: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
  else written += 1;
}
rmSync(work, { recursive: true, force: true });
console.log(`${written} screenshots in ${resolve(outDir)}`);
