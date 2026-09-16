#!/usr/bin/env node
import { readFileSync, writeFileSync, realpathSync, openSync, closeSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBbHost } from './bb.mjs';
import { runSpecialistTeam } from './orchestrate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [planPath, projectId, environmentId, outputPath, ...extra] = process.argv.slice(2);
if (!planPath || !projectId || !environmentId || !outputPath || extra.length) {
  throw new Error('Usage: node hosts/coding-agent/team.mjs PLAN PROJECT_ID ENVIRONMENT_ID NEW_OUTPUT_FILE');
}
// Execution reports and context belong to the operator, outside the product package.
const target = resolve(outputPath);
const outputParent = realpathSync(resolve(target, '..'));
const delta = relative(realpathSync(root), outputParent);
if (!delta || (delta !== '..' && !delta.startsWith('../') && !isAbsolute(delta))) throw new Error('Keep team evidence outside the product package.');
// Reserve the destination before any billable host work. Never replace an existing report.
const output = openSync(target, 'wx', 0o600);
const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
try {
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const host = createBbHost({ projectId, environmentId, onChild: event => process.stderr.write(`${JSON.stringify(event)}\n`) });
  const result = await runSpecialistTeam({ plan, root, host, signal: controller.signal,
    onEvent: event => process.stderr.write(`${JSON.stringify(event)}\n`) });
  if (result.receiptMarkdown) process.stderr.write(`${result.receiptMarkdown}\n`);
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ status: result.status, mode: result.mode, independentReview: result.independentReview, receipt: result.receipt ?? null }) + '\n');
} catch (error) {
  writeFileSync(output, JSON.stringify({ status: 'failed', reason: 'Team execution failed. Reconcile the recorded children before retrying.', trace: error.teamTrace ?? [] }, null, 2) + '\n');
  process.stderr.write('Team execution failed. Inspect the private result and reconcile owned children before retrying.\n');
  process.exitCode = 1;
} finally { closeSync(output); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
