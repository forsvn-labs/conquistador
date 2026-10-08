// Bundle the terminal UI libraries into ../vendor, so installs need no npm dependencies.
//   clack.mjs  line prompts for `conquistador setup` (Clack)
//   ink.mjs    the full-screen installer (Ink and React)
// NOTICE.txt collects the license of every package that ends up in a bundle.
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vendor = resolve(here, '../vendor');
// CommonJS packages (React) call require(); give the ESM bundle a real one.
const banner = { js: "import { createRequire as __cqRequire } from 'node:module'; const require = __cqRequire(import.meta.url);" };
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true, legalComments: 'none', metafile: true, logLevel: 'warning' };

const results = [
  await build({ ...common, entryPoints: [join(here, 'entry.mjs')], outfile: join(vendor, 'clack.mjs') }),
  await build({ ...common, entryPoints: [join(here, 'ink-entry.mjs')], outfile: join(vendor, 'ink.mjs'), banner,
    alias: { 'react-devtools-core': join(here, 'devtools-stub.mjs') }, define: { 'process.env.NODE_ENV': '"production"' } }),
];

// The package folder that owns each bundled file, then its name and license text.
const packages = new Map();
for (const { metafile } of results) {
  for (const input of Object.keys(metafile.inputs)) {
    const path = resolve(here, input);
    const match = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)/.exec(path);
    if (!match || packages.has(match[1])) continue;
    const manifest = JSON.parse(readFileSync(join(match[1], 'package.json'), 'utf8'));
    const file = ['LICENSE', 'LICENSE.md', 'license', 'license.md', 'LICENSE.txt'].map(name => join(match[1], name)).find(existsSync);
    packages.set(match[1], { name: manifest.name, version: manifest.version, license: manifest.license, text: file ? readFileSync(file, 'utf8').trim() : `License: ${manifest.license}` });
  }
}
const list = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(vendor, 'NOTICE.txt'), `${list.map(item => `${item.name}@${item.version} (${item.license})\n\n${item.text}\n`).join('\n\n')}`);
console.log(`Bundled ${list.length} packages into ${relative(process.cwd(), vendor)}: ${list.map(item => item.name).join(', ')}`);
