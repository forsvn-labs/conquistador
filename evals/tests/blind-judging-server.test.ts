import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadJudgingSession, prepareJudgingSession, readVerdictsFile } from "../src/blind-judging";
import { startJudgingServer } from "../src/blind-judging-server";
import type { HumanVerdict } from "../src/contracts";
import { root } from "./helpers";

const samplePack = resolve(root, "fixtures/blind-judging/sample-pack");
const temps: string[] = [];
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function session() {
  const dir = mkdtempSync(join(tmpdir(), "blind-judging-server-"));
  temps.push(dir);
  const sessionDir = join(dir, "session");
  prepareJudgingSession({ packDir: samplePack, outDir: sessionDir, reviewer: "hung", nonce: "s".repeat(48) });
  return { sessionDir, verdictsPath: join(dir, "private-verdicts", "verdicts.json") };
}

async function serve(sessionDir: string, verdictsPath: string) {
  const server = await startJudgingServer({ sessionDir, verdictsPath, port: 0 });
  closers.push(server.close);
  return server;
}

function verdictFor(sessionDir: string, index: number, verdict: HumanVerdict["verdict"]): HumanVerdict {
  const { pair } = loadJudgingSession(sessionDir).pairs[index]!;
  return {
    schemaVersion: "conquistador.human-verdict/v1",
    id: `${pair.id}/verdict`,
    blindPairId: pair.id,
    reviewer: "hung",
    reviewerRevision: loadJudgingSession(sessionDir).reviewerRevision,
    artifactDigests: [pair.armA.artifactDigest, pair.armB.artifactDigest],
    verdict,
    rationale: "Clearer proof.",
    recordedAt: new Date().toISOString(),
    assignmentDigest: pair.assignmentDigest,
  };
}

const put = (url: string, sessionId: string, body: unknown) =>
  fetch(`${url}api/verdicts`, { method: "PUT", headers: { "content-type": "application/json", "x-blind-judging-session": sessionId }, body: JSON.stringify(body) });

describe("loopback judging server", () => {
  it("serves the page on loopback only and saves each verdict to the chosen file", async () => {
    const { sessionDir, verdictsPath } = session();
    const server = await serve(sessionDir, verdictsPath);
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    const page = await fetch(server.url);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("Blind pairwise judging");

    const { sessionId } = loadJudgingSession(sessionDir);
    const response = await put(server.url, sessionId, verdictFor(sessionDir, 0, "A"));
    expect(response.status).toBe(200);
    expect(readVerdictsFile(verdictsPath)).toHaveLength(1);
  });

  it("keeps verdicts across a server restart, which is what a reload or closed browser relies on", async () => {
    const { sessionDir, verdictsPath } = session();
    const { sessionId } = loadJudgingSession(sessionDir);
    const first = await serve(sessionDir, verdictsPath);
    await put(first.url, sessionId, verdictFor(sessionDir, 0, "B"));
    await put(first.url, sessionId, verdictFor(sessionDir, 1, "tie"));
    await first.close();
    const second = await serve(sessionDir, verdictsPath);
    const saved = (await (await fetch(`${second.url}api/verdicts`)).json()) as HumanVerdict[];
    expect(saved.map((entry) => entry.verdict)).toEqual(["B", "tie"]);
  });

  it("replaces a changed verdict instead of storing the pair twice", async () => {
    const { sessionDir, verdictsPath } = session();
    const { sessionId } = loadJudgingSession(sessionDir);
    const server = await serve(sessionDir, verdictsPath);
    await put(server.url, sessionId, verdictFor(sessionDir, 0, "A"));
    await put(server.url, sessionId, verdictFor(sessionDir, 0, "tie"));
    expect(readVerdictsFile(verdictsPath).map((entry) => entry.verdict)).toEqual(["tie"]);
  });

  it("rejects invalid verdicts and cross-site writes without touching the file", async () => {
    const { sessionDir, verdictsPath } = session();
    const { sessionId } = loadJudgingSession(sessionDir);
    const server = await serve(sessionDir, verdictsPath);
    await put(server.url, sessionId, verdictFor(sessionDir, 0, "A"));
    const before = readFileSync(verdictsPath, "utf8");
    const wrongOrder = verdictFor(sessionDir, 1, "A");
    wrongOrder.artifactDigests.reverse();
    expect((await put(server.url, sessionId, wrongOrder)).status).toBe(400);
    expect((await put(server.url, "another-session", verdictFor(sessionDir, 1, "A"))).status).toBe(403);
    const plainForm = await fetch(`${server.url}api/verdicts`, { method: "PUT", body: JSON.stringify(verdictFor(sessionDir, 1, "A")) });
    expect(plainForm.status).toBe(403);
    expect(readFileSync(verdictsPath, "utf8")).toBe(before);
  });
});
