import { createRequire } from "node:module";

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

// Promptfoo 0.124 removed the ONNX/Transformers ZIP extraction graph. Exercise the
// patched dependencies that are still present, without opening network sockets.
const ftp = requireFromChild(payload.ftpEntrypoint);
const client = new ftp.Client(1000);
invariant(typeof client.access === "function", "basic-ftp API failed to load");
client.close();
invariant(client.closed, "basic-ftp client did not close");

const sharp = requireFromChild(payload.sharpEntrypoint);
const image = sharp(Buffer.from([255, 0, 0]), {
  raw: { width: 1, height: 1, channels: 3 },
});
const png = await image.png().toBuffer();
const metadata = await sharp(png).metadata();
invariant(metadata.format === "png" && metadata.width === 1 && metadata.height === 1, "sharp image round trip failed");

process.stdout.write("compatibility imports passed\n");
