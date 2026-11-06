#!/usr/bin/env node
// Local file helper. Importing this module starts no process and writes no files.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { render } from 'pele';

export function renderDiagram(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Diagram source is empty.');
  return render(source, { links: false, images: false, limit: 50000, outputLimit: 4000000 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2) throw new Error('Usage: node tools/render-diagram.mjs input.mmd output.svg');
    const [input, output] = args.map(value => resolve(value));
    if (input === output) throw new Error('Input and output must be different files.');
    const source = readFileSync(input, 'utf8');
    const { svg, type, width, height } = renderDiagram(source);
    writeFileSync(output, svg, { flag: 'wx' });
    console.log(JSON.stringify({ output, source: input, type, width, height }));
  } catch (error) {
    console.error(`Diagram not written: ${error.message}`);
    process.exitCode = 1;
  }
}
