// Test-only npm/Bun boundary. Never contacts a registry or installs a real package.
import { appendFileSync, chmodSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const [name, ...args] = process.argv.slice(2);
if (process.env.FAKE_AGENT_LOG) appendFileSync(process.env.FAKE_AGENT_LOG, `${JSON.stringify({ name, args })}\n`);
const command = process.env.FAKE_CLI_COMMAND;
if (args[0] === 'prefix') { console.log(dirname(dirname(command))); process.exit(0); }
if (args[0] === 'pm') { console.log(dirname(command)); process.exit(0); }
if (args[0] === 'view') { console.log(JSON.stringify(process.env.FAKE_CLI_VERSION)); process.exit(0); }
if (process.env.FAKE_CLI_FAIL) { console.error('EACCES: test installation permission failure'); process.exit(1); }
if (!process.env.FAKE_CLI_NO_COMMAND) {
  writeFileSync(command, `#!${process.execPath}\nconsole.log(${JSON.stringify(process.env.FAKE_CLI_VERSION)});\n`);
  chmodSync(command, 0o755);
}
console.log('Test CLI package installed.');
