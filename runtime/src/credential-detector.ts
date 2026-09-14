import credentialDetectorSchema from "../schemas/credential-detector.schema.json" with {
  type: "json",
};

export const CREDENTIAL_DETECTOR_SCHEMA_ID = credentialDetectorSchema.$id;
export const CREDENTIAL_PATTERN_SOURCE = credentialDetectorSchema.pattern;

const CREDENTIAL_PATTERN = new RegExp(CREDENTIAL_PATTERN_SOURCE);

export function containsCredential(value: unknown): boolean {
  return CREDENTIAL_PATTERN.test(JSON.stringify(value));
}

export function assertNoCredential(value: unknown, label: string): void {
  if (containsCredential(value)) {
    throw new Error(`[review-contract] ${label} contains secret material`);
  }
}
