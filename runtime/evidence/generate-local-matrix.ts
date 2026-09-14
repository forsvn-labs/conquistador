#!/usr/bin/env bun

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";

import { canonicalJson, sha256 } from "../src/canonical.ts";
import { buildRuntimeLocalMatrix } from "../src/local-matrix.ts";

const productRoot = resolve(import.meta.dirname, "..", "..");
const matrixPath = resolve(
  productRoot,
  "release/evidence/runtime-local/matrix-v1.json",
);

const workRoot = mkdtempSync(resolve(tmpdir(), "conquistador-local-matrix-"));
try {
  const record = await buildRuntimeLocalMatrix({
    workRoot,
    productRoot,
  });
  const bytes = `${canonicalJson(record)}\n`;
  if (process.argv.includes("--stdout")) {
    process.stdout.write(bytes);
  } else {
    mkdirSync(dirname(matrixPath), { recursive: true });
    writeFileSync(matrixPath, bytes);
    console.log(
      `[generate-local-matrix] PASS — ${relative(productRoot, matrixPath)} ${
        sha256(bytes)
      }`,
    );
    console.log(
      `[generate-local-matrix] cells=${record.cells.length} adversarial=${record.adversarial.rejected}/${record.adversarial.cases}`,
    );
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}
