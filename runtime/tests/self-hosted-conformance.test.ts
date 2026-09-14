import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  SELF_HOSTED_PATHS,
  fileSystemResolver,
  normalizedReporterDigest,
  validateDeclaration,
  validateRecord,
} from "../src/self-hosted-conformance.ts";
import { canonicalJson, sha256 } from "../src/canonical.ts";
import { semanticReporterDigest, semanticReporterProjection } from "../../tools/release/self-hosted/capture.ts";

const root = resolve(import.meta.dirname, "../..");
const readJson = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), "utf8"));

describe("self-hosted conformance authority", () => {
  test("accepts exactly the hand-authored closed declaration", () => {
    const declaration = validateDeclaration(readJson(SELF_HOSTED_PATHS.declaration), fileSystemResolver(root));
    expect(declaration.cells).toHaveLength(18);
    expect(declaration.authority).toEqual({
      releaseState: "NO-GO",
      candidateStatus: "UNBOUND",
      selectedCandidate: null,
      g3Status: "INCOMPLETE",
      landing: "disabled",
      exts161Packet: null,
    });
    expect(declaration.cells.filter((cell) => cell.proofClass === "local-runtime")).toHaveLength(6);
    expect(declaration.cells.filter((cell) => cell.expectedStatus === "missing")).toHaveLength(12);
  });

  test("executes every advertised adversarial label with its intended error code", () => {
    const execution = spawnSync("bun", ["-e", "import { runSelfHostedSelfTest } from './tools/release/self-hosted/selftest.ts'; console.log(JSON.stringify(runSelfHostedSelfTest(process.cwd())))"], { cwd: root, encoding: "utf8" });
    expect(execution.status, execution.stderr).toBe(0);
    const result = JSON.parse(execution.stdout) as { rejections: number; positives: number; labels: string[] };
    const corpus = readJson(SELF_HOSTED_PATHS.corpus) as { cases: unknown[] };
    expect(result.rejections).toBe(corpus.cases.length);
    expect(result.rejections).toBeGreaterThanOrEqual(49);
    expect(result.positives).toBe(4);
    expect(result.labels).toHaveLength(result.rejections);
  });

  test("validates the canonical machine record with checked-in Ajv 2020 and runtime", () => {
    const schema = readJson(SELF_HOSTED_PATHS.schema);
    const record = readJson(SELF_HOSTED_PATHS.record);
    const Ajv = Ajv2020 as unknown as new (options: { allErrors: boolean; strict: boolean }) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors: unknown } };
    const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
    expect(validate(record), JSON.stringify(validate.errors)).toBe(true);
    expect(() => validateRecord(record, fileSystemResolver(root))).not.toThrow();
  });

  test("keeps every nonlocal and support proof class missing", () => {
    const record = readJson(SELF_HOSTED_PATHS.record) as { rows: Array<{ proofClass: string; result: { status: string } }>; aggregate: { supported: number } };
    expect(record.rows.filter((row) => row.proofClass !== "local-runtime").every((row) => row.result.status === "missing")).toBe(true);
    expect(record.aggregate.supported).toBe(0);
  });

  test("normalizes only reporter timing while retaining substantive values", () => {
    const first = { startTime: 1, duration: 2, numPassedTests: 7, nested: { endTime: 3, version: "4.1.10", cost: 0.25 } };
    const timingOnly = { startTime: 9, duration: 8, numPassedTests: 7, nested: { endTime: 7, version: "4.1.10", cost: 0.25 } };
    const substantive = { ...timingOnly, numPassedTests: 8 };
    expect(normalizedReporterDigest(first)).toBe(normalizedReporterDigest(timingOnly));
    expect(normalizedReporterDigest(substantive)).not.toBe(normalizedReporterDigest(first));
    expect(normalizedReporterDigest([timingOnly, { startTime: 0 }])).toBe(normalizedReporterDigest([{ startTime: 5, duration: 6, numPassedTests: 7, nested: { endTime: 9, version: "4.1.10", cost: 0.25 } }, { startTime: 1 }]));
    expect(normalizedReporterDigest(null)).not.toBe(normalizedReporterDigest("scalar"));
  });

  test("keeps reporter evidence stable across relocated roots and runtime noise", () => {
    const makeReporter = (
      runtimeRoot: string,
      testStatus = "passed",
      assertionTitle = "emits",
      passedTests = 2,
      noise: Record<string, unknown> = {},
    ) => ({
      numTotalTestSuites: 1,
      numPassedTestSuites: 1,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: passedTests,
      numFailedTests: 2 - passedTests,
      startTime: 1,
      endTime: 2,
      success: true,
      version: "vitest-runtime",
      ...noise,
      testResults: [{
        name: `${runtimeRoot}/tests/example.test.ts`,
        status: testStatus,
        assertionResults: [{
          ancestorTitles: ["/suite"],
          fullName: `/suite ${assertionTitle}`,
          status: testStatus,
          title: assertionTitle,
          duration: 3,
          failureMessages: [],
          meta: { workerId: "runtime-dependent" },
        }],
      }],
    });

    const first = makeReporter("/workspace/runtime", "passed", "emits", 2, { workerId: "one", startTime: 10 });
    const relocated = makeReporter("/private/tmp/product/runtime", "passed", "emits", 2, { workerId: "two", endTime: 20, success: false });
    expect(semanticReporterDigest(first, "/workspace/runtime", "fixture")).toBe(semanticReporterDigest(relocated, "/private/tmp/product/runtime", "fixture"));
    expect(semanticReporterProjection(relocated, "/private/tmp/product/runtime", "fixture").testResults[0]?.name).toBe("tests/example.test.ts");

    expect(semanticReporterDigest(makeReporter("/workspace/runtime", "failed"), "/workspace/runtime", "fixture")).not.toBe(semanticReporterDigest(first, "/workspace/runtime", "fixture"));
    expect(semanticReporterDigest(makeReporter("/workspace/runtime", "passed", "changed"), "/workspace/runtime", "fixture")).not.toBe(semanticReporterDigest(first, "/workspace/runtime", "fixture"));
    expect(semanticReporterDigest(makeReporter("/workspace/runtime", "passed", "emits", 1), "/workspace/runtime", "fixture")).not.toBe(semanticReporterDigest(first, "/workspace/runtime", "fixture"));
  });

  test("rejects reporter test paths outside the declared runtime root", () => {
    for (const testFile of ["/workspace/other/tests/example.test.ts", "../outside.test.ts"]) {
      const outside = {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        testResults: [{
          name: testFile,
          status: "passed",
          assertionResults: [{ ancestorTitles: [], fullName: "emits", status: "passed", title: "emits" }],
        }],
      };
      expect(() => semanticReporterProjection(outside, "/workspace/runtime", "fixture")).toThrow("[E_COMMAND_OUTPUT]");
    }
  });

  test("rebinds declaration bytes and reconstructs local observation digests", () => {
    const resolver = fileSystemResolver(root);
    const record = readJson(SELF_HOSTED_PATHS.record) as Record<string, any>;
    const staleDeclaration = JSON.parse(JSON.stringify(record)) as Record<string, any>;
    staleDeclaration.declarationRawDigest = `sha256:${"0".repeat(64)}`;
    const { digest: _staleDigest, ...staleBody } = staleDeclaration;
    staleDeclaration.digest = sha256(staleBody);
    expect(() => validateRecord(staleDeclaration, resolver)).toThrow("[E_DIGEST_STALE]");

    const staleObservation = JSON.parse(JSON.stringify(record)) as Record<string, any>;
    staleObservation.rows.find((row: Record<string, any>) => row.result.status === "passed").result.reportDigest = `sha256:${"0".repeat(64)}`;
    const { digest: _observationDigest, ...observationBody } = staleObservation;
    staleObservation.digest = sha256(observationBody);
    expect(() => validateRecord(staleObservation, resolver)).toThrow("[E_OBSERVATION_DIGEST]");
    expect(canonicalJson(record)).not.toBe(canonicalJson(staleObservation));
  });

  test("public verifier rejects mutation flags without changing protected bytes", () => {
    const paths = [SELF_HOSTED_PATHS.record, SELF_HOSTED_PATHS.report, SELF_HOSTED_PATHS.externalPacket];
    const digest = (path: string): string => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
    const before = paths.map(digest);
    const result = spawnSync("bun", ["tools/release/verify-self-hosted.ts", "--generate"], { cwd: root, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("unknown argument");
    expect(paths.map(digest)).toEqual(before);
  });
});
