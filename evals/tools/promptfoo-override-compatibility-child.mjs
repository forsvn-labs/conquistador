import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function invariant(condition, message) {
  if (!condition) throw new Error(`[promptfoo-overrides-child] ${message}`);
}

const expectedEnvironmentKeys = [
  "FORCE_COLOR",
  "HOME",
  "PROMPTFOO_CONFIG_DIR",
  "PROMPTFOO_DISABLE_TELEMETRY",
  "PROMPTFOO_DISABLE_UPDATE",
  "TEMP",
  "TMP",
  "TMPDIR",
  "__CF_USER_TEXT_ENCODING",
];
invariant(
  JSON.stringify(Object.keys(process.env).sort()) === JSON.stringify(expectedEnvironmentKeys),
  "environment is not the strict positive allowlist",
);

const payload = JSON.parse(process.argv[2] ?? "null");
invariant(payload && typeof payload === "object", "compatibility payload is required");
const requireFromChild = createRequire(import.meta.url);

const AdmZip = requireFromChild(payload.admZipEntrypoint);
const archive = new AdmZip();
archive.addFile("compatibility.txt", Buffer.from("conquistador\n"));
const reopened = new AdmZip(archive.toBuffer());
invariant(
  reopened.readAsText("compatibility.txt") === "conquistador\n",
  "adm-zip failed the ZIP round trip",
);

const extraction = mkdtempSync(join(tmpdir(), "conquistador-zip-regression-"));
try {
  const target = join(extraction, "target");
  const outside = join(extraction, "outside");
  mkdirSync(target); mkdirSync(outside);
  writeFileSync(join(outside, "protected.txt"), "original");
  symlinkSync(outside, join(target, "link"));
  const malicious = new AdmZip();
  malicious.addFile("link/protected.txt", Buffer.from("overwrite"));
  let rejected = false;
  try { malicious.extractAllTo(target, true); } catch { rejected = true; }
  invariant(rejected && readFileSync(join(outside, "protected.txt"), "utf8") === "original", "ZIP extraction followed a destination symlink");
} finally { rmSync(extraction, { recursive: true, force: true }); }

const sharp = requireFromChild(payload.sharpEntrypoint);
const image = sharp(Buffer.from([255, 0, 0]), {
  raw: { width: 1, height: 1, channels: 3 },
});
const png = await image.png().toBuffer();
const metadata = await sharp(png).metadata();
invariant(metadata.format === "png" && metadata.width === 1 && metadata.height === 1, "sharp image round trip failed");

const onnx = requireFromChild(payload.onnxEntrypoint);
invariant(typeof onnx.InferenceSession?.create === "function", "onnxruntime-node native module failed to load");
const transformers = await import(pathToFileURL(payload.transformersEntrypoint).href);
invariant(typeof transformers.pipeline === "function", "Transformers failed to import");

process.stdout.write("compatibility imports passed\n");
