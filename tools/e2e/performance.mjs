// Deterministic app workloads; no model, provider, home discovery, or persistent cache.
// Compare --reference report.json to reject a faster run that changes any tool output.
// Timings are evidence for this machine/toolchain, not a portable latency assertion.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Readable, Writable } from 'node:stream';

const args = process.argv.slice(2);

const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

const root = resolve(option('--source-root', fileURLToPath(new URL('../../', import.meta.url))));

const { createConquistador } = await import(pathToFileURL(join(root, 'api/index.mjs')));

const { runSkillsMcp } = await import(pathToFileURL(join(root, 'tools/skills-mcp.mjs')));

const cases = [
  { id: 'outreach-full', tool: 'conquistador_brief', args: { task: 'Write the first cold email to RevOps leads at B2B SaaS companies.', context: 'Product: Ledgerline compares revenue records. Proof: none. Voice: plain.' } },
  { id: 'outreach-compact', tool: 'conquistador_brief', args: { task: 'Write the first cold email to RevOps leads at B2B SaaS companies.', size: 'compact' } },
  { id: 'launch-play', tool: 'conquistador_brief', args: { task: 'Plan a Product Hunt launch with social posts and measurement.' } },
  { id: 'search-outreach', tool: 'conquistador_search', args: { query: 'revenue outreach cold email' } },
  { id: 'search-vietnamese', tool: 'conquistador_search', args: { query: 'Viết nội dung tiếng Việt cho chiến dịch marketing' } },
  { id: 'signed-check', tool: 'conquistador_check', args: { text: 'Unlock seamless growth. Acme improved revenue by 40%, guaranteed.', channel: 'linkedin', context: 'Product: Ledgerline compares revenue records. Proof: none.' } },
];

const cq = createConquistador({ receiptKey: 'performance-fixture-key' });

const digest = value => createHash('sha256').update(value).digest('hex');

function call(item) {
  const start = performance.now();
  const result = cq.callTool(item.tool, item.args);
  const ms = performance.now() - start;
  assert.ok(!result.isError, item.id);
  const encoded = JSON.stringify(result);

  return { ms, sha256: digest(encoded), bytes: Buffer.byteLength(encoded) };
}

if (args.includes('--child')) {
  const item = cases.find(item => item.id === option('--child'));
  assert.ok(item, 'Unknown workload.');
  console.log(JSON.stringify(call(item)));
} else {
  const samples = Number(option('--samples', '60'));
  const coldSamples = Number(option('--cold-samples', '3'));
  const framingSamples = Number(option('--framing-samples', '7'));
  assert.ok(Number.isInteger(samples) && samples >= 5 && samples <= 1000);
  assert.ok(Number.isInteger(coldSamples) && coldSamples >= 1 && coldSamples <= 10);
  assert.ok(Number.isInteger(framingSamples) && framingSamples >= 5 && framingSamples <= 100);
  const quantile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];

  const summarize = values => {
    const meanMs = values.reduce((total, value) => total + value, 0) / values.length;
    const varianceMs2 = values.reduce((total, value) => total + (value - meanMs) ** 2, 0) / Math.max(1, values.length - 1);

    return { medianMs: quantile(values, 0.5), p95Ms: quantile(values, 0.95), meanMs, varianceMs2, stddevMs: Math.sqrt(varianceMs2), minMs: Math.min(...values), maxMs: Math.max(...values), samples: values.length, rawMs: values };
  };

  const referencePath = option('--reference');
  const reference = referencePath ? JSON.parse(readFileSync(resolve(referencePath), 'utf8')) : null;
  const measurements = [];

  for (const item of args.includes('--framing-only') ? [] : cases) {
    const cold = [], startup = [];
    const expected = call(item);

    for (let i = 0; i < coldSamples; i++) {
      const start = performance.now();
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--source-root', root, '--child', item.id], { cwd: root, encoding: 'utf8', timeout: 30_000 });
      startup.push(performance.now() - start);
      assert.equal(child.status, 0, child.stderr);
      const result = JSON.parse(child.stdout);
      assert.equal(result.sha256, expected.sha256, `${item.id}: cold output drift`);
      cold.push(result.ms);
    }

    const warm = [];

    for (let i = 0; i < samples; i++) {
      const result = call(item);
      assert.equal(result.sha256, expected.sha256, `${item.id}: warm output drift`);
      warm.push(result.ms);
    }

    if (reference) assert.equal(expected.sha256, reference.measurements.find(row => row.id === item.id)?.sha256, `${item.id}: output differs from reference`);
    const row = { id: item.id, tool: item.tool, sha256: expected.sha256, bytes: expected.bytes, cold: summarize(cold), process: summarize(startup), warm: summarize(warm) };
    measurements.push(row);
    console.log(`${item.id}: cold ${row.cold.medianMs.toFixed(2)} ms; warm ${row.warm.medianMs.toFixed(2)} ms; p95 ${row.warm.p95Ms.toFixed(2)} ms`);
  }

  const framing = [];

  for (const size of args.includes('--api-only') ? [] : [1024, 16_384, 64_000]) {
    for (const fragment of [1, 64]) {
      const id = `stdio-${size}-by-${fragment}`;
      const bytes = Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { padding: 'x'.repeat(size) } })}\n`);
      const timings = [];
      let sha256;

      for (let i = 0; i < framingSamples; i++) {
        const input = Readable.from((function* () {
          for (let offset = 0; offset < bytes.length; offset += fragment) yield bytes.subarray(offset, offset + fragment);
        })());

        const output = [];
        const start = performance.now();
        await runSkillsMcp({ input, output: new Writable({ write(chunk, encoding, done) { output.push(chunk.toString()); done(); } }) });
        timings.push(performance.now() - start);
        const text = output.join('');
        assert.deepEqual(JSON.parse(text), { jsonrpc: '2.0', id: 1, result: {} });
        sha256 = digest(text);
      }

      if (reference?.framing) assert.equal(sha256, reference.framing.find(row => row.id === id)?.sha256, `${id}: framing output drift`);
      const row = { id, requestBytes: bytes.length, fragmentBytes: fragment, sha256, ...summarize(timings) };
      framing.push(row);
      console.log(`${id}: ${row.medianMs.toFixed(2)} ms`);
    }
  }

  const git = (...argv) => {
    const result = spawnSync('git', argv, { cwd: root, encoding: 'utf8' });

    return result.status === 0 ? (result.stdout ?? '').trim() : '';
  };

  const ownsGit = git('rev-parse', '--show-toplevel') === root;
  const report = {
    schema: 'conquistador.e2e.performance/v1', date: new Date().toISOString(),
    source: option('--source-revision', ownsGit ? git('rev-parse', 'HEAD') : null), dirty: ownsGit ? Boolean(git('status', '--porcelain')) : null,
    sourceHashes: Object.fromEntries(['api/index.mjs', 'tools/brief.mjs', 'tools/skills-mcp.mjs', 'tools/search-index.json'].filter(path => existsSync(join(root, path))).map(path => [path, digest(readFileSync(join(root, path)))])),
    harnessSha256: digest(readFileSync(fileURLToPath(import.meta.url))),
    node: process.version, platform: process.platform, arch: process.arch,
    reference: referencePath ? relative(root, resolve(referencePath)) : null,
    limits: 'Fixed app workloads on this machine. No network, model, send, publication, or production writes. Compare repeated runs on the same idle machine.',
    measurements, framing,
  };

  const out = resolve(option('--out', 'dist/e2e/performance/report.json'));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${out}`);
}
