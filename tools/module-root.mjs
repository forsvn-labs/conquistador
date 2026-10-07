import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package root for a module in tools/. A Cloudflare Worker leaves import.meta.url unset in
// unbundled modules and serves the uploaded files under /bundle.
export const packageRootOf = url => (url ? resolve(dirname(fileURLToPath(url)), '..') : '/bundle');
