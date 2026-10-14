import { version } from './agents.mjs';

export const APP_GUIDE = [
  'Add the dependency in your app folder:',
  '',
  `npm i @forsvn/conquistador@^${version}`,
  `bun add @forsvn/conquistador@^${version}`,
  '',
  'Use it in your app server:',
  'import { createConquistador }',
  "  from '@forsvn/conquistador';",
  "import { createMcpRequestHandler }",
  "  from '@forsvn/conquistador/mcp';",
  '',
  'Your agent calls the eight marketing tools.',
  'Your app supplies the model and user context.',
  'Mount /mcp beside your app, or run it separately.',
  'Set app access rules and a receipt signing key.',
  'Keep the package in production dependencies.',
  '',
  'Guide and runnable app example:',
  'https://conquistador.app/docs/install/app',
].join('\n');

export function runAppGuide(args) {
  if (args.some(arg => !['--help', '-h'].includes(arg))) {
    console.error('Usage: conquistador app');
    return 2;
  }
  console.log(APP_GUIDE);
  return 0;
}
