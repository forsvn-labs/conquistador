/** Focused import guards. Private fingerprints are supplied by the operator and never stored here. */
export function checkPackageBoundary(files, privateFingerprints = []) {
  for (const fingerprint of privateFingerprints) {
    if (typeof fingerprint !== 'string' || fingerprint.length < 32) throw new Error('Use a private fingerprint of at least 32 characters.');
  }
  for (const [path, file] of Object.entries(files)) {
    if (/\.(?:epub|mobi|azw3?|vtt|srt)$/i.test(path) ||
        /(?:^|\/)(?:raw-urls\.md|theses\.md|knowledge-roots\.json)$/.test(path) ||
        /^(?:company|wiki|knowledge|private-provenance)\//.test(path)) {
      throw new Error(`Source import is outside the product boundary: ${path}`);
    }
    const text = Buffer.from(file.bytes).toString('utf8');
    if (/CloudStorage\/GoogleDrive-[^/\n]+\/My Drive\//.test(text) || privateFingerprints.some(value => text.includes(value))) {
      // Report only the product file, never the private matching text.
      throw new Error(`Private source match in product file: ${path}`);
    }
  }
  return { filesChecked: Object.keys(files).length, privateFingerprintsChecked: privateFingerprints.length, semanticReviewRequired: true };
}
