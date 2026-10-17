#!/usr/bin/env node
// Resolve the exact paired package. No shell, command interpolation, or second npx download.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@forsvn/conquistador/package.json'));
await import(pathToFileURL(join(root, 'runtime/bin/conquistador.js')).href);
