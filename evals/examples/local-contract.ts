/** Synthetic local SDK example. No provider, release authority, or human verdict. */
import { readFileSync } from 'node:fs';
import { selectExactCandidate } from '../src/build-selector.ts';
import { validateCandidateBuild, validateEvalCase, validateProviderCell } from '../src/validate.ts';

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const build = fixture('example-candidate');
const exampleCase = fixture('example-case');
const provider = fixture('example-provider');
validateCandidateBuild(build);
validateEvalCase(exampleCase);
validateProviderCell(provider);
const selection = selectExactCandidate(build, exampleCase, provider);
console.log(JSON.stringify({
  proofClass: 'synthetic-local-contract-example', executionAuthorized: false,
  liveExecutions: 0, humanVerdicts: 0, selection,
}, null, 2));
