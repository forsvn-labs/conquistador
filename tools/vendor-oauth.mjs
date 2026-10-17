// Copy the exact upstream distribution; never patch the vendored provider.
import { copyFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const folder = dirname(require.resolve('@cloudflare/workers-oauth-provider'));
const metadata = JSON.parse(readFileSync(join(folder, '../package.json'), 'utf8'));
if (metadata.version !== '1.2.3') throw Error('Review the OAuth provider upgrade before vendoring another version.');
copyFileSync(join(folder, 'oauth-provider.js'), new URL('./vendor/oauth-provider.mjs', import.meta.url));
copyFileSync(join(folder, '../LICENSE.txt'), new URL('./vendor/OAUTH-PROVIDER-LICENSE', import.meta.url));
