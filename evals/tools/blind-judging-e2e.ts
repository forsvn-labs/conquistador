// E2E: a real browser judges the synthetic sample pack through the judging page.
//   J1-J2  the page shows the brief and two drafts with no arm identity, and keyboard choices save.
//   J3-J5  a reload and a closed browser resume from the saved verdict file; a change replaces a verdict.
//   J6     every saved verdict is bound to the pair that was on screen when it was chosen.
//   J7     the report command accepts the finished session.
//   J8-J9  opened from disk, the page keeps verdicts in the browser and exports a valid verdict file.
//   node --experimental-strip-types tools/blind-judging-e2e.ts [OUT_DIR]
// Uses the Playwright package and Chromium installed at the repository root. Writes OUT_DIR/report.json
// and screenshots. Exit 1 when a check fails.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Page } from "playwright";

import { buildJudgingReport, formatJudgingReport, loadJudgingSession, parsePassRule, prepareJudgingSession, readVerdictsFile, upsertVerdict } from "../src/blind-judging.ts";
import { startJudgingServer } from "../src/blind-judging-server.ts";
import type { HumanVerdict } from "../src/contracts.ts";

const evals = resolve(import.meta.dirname, "..");
const out = resolve(process.argv[2] ?? join(evals, "..", "dist", "e2e", "blind-judging"));
const packDir = join(evals, "fixtures", "blind-judging", "sample-pack");
const work = mkdtempSync(join(tmpdir(), "blind-judging-e2e-"));
const sessionDir = join(work, "session");
const verdictsPath = join(work, "private", "verdicts.json");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const checks: Array<{ id: string; name: string; ok: boolean; detail: string }> = [];
function check(id: string, name: string, ok: unknown, detail: unknown = "") {
  checks.push({ id, name, ok: Boolean(ok), detail: String(detail).slice(0, 600) });
  console.log(`${ok ? "✓" : "✗"} ${id} ${name}${ok ? "" : `  ${String(detail).slice(0, 300)}`}`);
}

prepareJudgingSession({ packDir, outDir: sessionDir, reviewer: "e2e-judge", nonce: "e2e-".repeat(12) });
const session = loadJudgingSession(sessionDir);
const server = await startJudgingServer({ sessionDir, verdictsPath, port: 0 });
const browser = await chromium.launch();
const shownPairs: Record<string, string> = {};

async function onScreen(page: Page) {
  return page.locator("main").getAttribute("data-pair-id");
}
async function choose(page: Page, key: string) {
  const pairId = await onScreen(page);
  await page.keyboard.press(key);
  await page.locator("#save-state[data-state='saved']").waitFor();
  shownPairs[pairId!] = key;
}

try {
  let context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await context.newPage();
  await page.goto(server.url);
  await page.locator("main[data-pair-id]").waitFor();
  const visible = await page.locator("body").innerText();
  check("J1", "page shows the brief, draft A, draft B, and progress without arm names",
    visible.includes("Brief") && visible.includes("Draft A") && visible.includes("Draft B") && visible.includes("Pair 1 of 3") && !/\b(bare|method)\b/i.test(visible), visible.slice(0, 300));
  await page.screenshot({ path: join(out, "01-first-pair.png"), fullPage: false });

  await choose(page, "a");
  await page.keyboard.press("r");
  await page.keyboard.type("Clearer offer and real proof.");
  await page.keyboard.press("Enter");
  await choose(page, "b");
  const saved = readVerdictsFile(verdictsPath);
  check("J2", "keyboard choices save to the verdict file with the optional reason",
    saved.length === 2 && saved[0]!.verdict === "A" && saved[1]!.verdict === "B" && saved[1]!.rationale === "Clearer offer and real proof.", JSON.stringify(saved));

  await page.reload();
  await page.locator("main[data-pair-id]").waitFor();
  const afterReload = await page.locator("#progress").innerText();
  check("J3", "a reload resumes at the first unjudged pair", afterReload.includes("Pair 3 of 3") && afterReload.includes("2 judged"), afterReload);

  await context.close();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.goto(server.url);
  await page.locator("main[data-pair-id]").waitFor();
  const afterClose = await page.locator("#progress").innerText();
  check("J4", "a closed browser with no local storage resumes from the server file", afterClose.includes("2 judged"), afterClose);

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await choose(page, "t");
  const changed = readVerdictsFile(verdictsPath);
  check("J5", "changing a verdict replaces it instead of judging the pair twice",
    changed.length === 2 && changed.find((entry) => entry.blindPairId === session.pairs[0]!.pair.id)?.verdict === "tie", JSON.stringify(changed.map((entry) => entry.verdict)));

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await choose(page, "a");
  await page.locator("#done").waitFor();
  await page.screenshot({ path: join(out, "02-session-complete.png"), fullPage: false });
  const final = readVerdictsFile(verdictsPath);
  const keyToVerdict: Record<string, HumanVerdict["verdict"]> = { a: "A", b: "B", t: "tie" };
  const bound = final.every((verdict) => {
    const entry = session.pairs.find((item) => item.pair.id === verdict.blindPairId);
    return entry && keyToVerdict[shownPairs[verdict.blindPairId]!] === verdict.verdict
      && verdict.artifactDigests[0] === entry.pair.armA.artifactDigest && verdict.artifactDigests[1] === entry.pair.armB.artifactDigest
      && verdict.assignmentDigest === entry.pair.assignmentDigest;
  });
  check("J6", "every verdict is bound to the pair on screen, in A/B order", final.length === 3 && bound, JSON.stringify(shownPairs));

  const report = buildJudgingReport({ packDir, sessionDir, verdicts: final, rule: parsePassRule({}) });
  const text = formatJudgingReport(report);
  writeFileSync(join(out, "judging-report.txt"), text);
  check("J7", "the report accepts the finished session", report.practices.every((entry) => entry.judged === entry.pairs), text);
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page = await context.newPage();
  await page.goto(pathToFileURL(join(sessionDir, "judge.html")).href);
  await page.locator("main[data-pair-id]").waitFor();
  await choose(page, "b");
  await page.reload();
  await page.locator("main[data-pair-id]").waitFor();
  const fileMode = await page.locator("#progress").innerText();
  const saveText = await page.locator("#save-state").innerText();
  check("J8", "opened from disk, verdicts survive a reload in the browser and the page says so",
    fileMode.includes("1 judged") && /browser/i.test(saveText), `${fileMode} | ${saveText}`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").click()]);
  const exportedPath = join(work, "exported.json");
  await download.saveAs(exportedPath);
  const exported = JSON.parse(readFileSync(exportedPath, "utf8")) as HumanVerdict[];
  let valid = true;
  try { upsertVerdict(session, [], exported[0]!); } catch { valid = false; }
  check("J9", "the exported file is a valid HumanVerdict array for this session", exported.length === 1 && valid, JSON.stringify(exported));
  await context.close();
} catch (error) {
  check("J0", "the browser run completed", false, error instanceof Error ? error.stack : error);
} finally {
  await browser.close();
  await server.close();
  rmSync(work, { recursive: true, force: true });
}

writeFileSync(join(out, "report.json"), `${JSON.stringify({ suite: "blind-judging-e2e", pack: "fixtures/blind-judging/sample-pack", checks }, null, 2)}\n`);
console.log(`\n${checks.filter((entry) => entry.ok).length}/${checks.length} checks passed · ${join(out, "report.json")}`);
if (checks.some((entry) => !entry.ok)) process.exit(1);
