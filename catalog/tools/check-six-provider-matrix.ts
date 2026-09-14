import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSixProviderMatrix } from "../src/six-provider-matrix.ts";
import { validateCatalog } from "../src/validate.ts";

const root = resolve(import.meta.dirname, "..");

const catalogPath = resolve(root, "operations/v1.json");

const matrixPath = resolve(root, "fixtures/v1/six-provider-matrix-v1.json");

const catalog: unknown = JSON.parse(readFileSync(catalogPath, "utf8"));

validateCatalog(catalog);

const rendered = `${JSON.stringify(buildSixProviderMatrix(catalog), null, 2)}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(matrixPath, rendered);
  process.stdout.write(`six-provider matrix wrote ${matrixPath}\n`);
} else if (rendered !== readFileSync(matrixPath, "utf8")) {
  throw new Error("six-provider matrix is stale; run npm run matrix:write");
} else {
  const matrix = buildSixProviderMatrix(catalog);

  process.stdout.write(
    `six-provider matrix check: ${matrix.operations.length} operations; live=${matrix.liveProofStatus}; support=${matrix.supportClaimStatus}\n`,
  );
}
