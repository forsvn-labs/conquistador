// Blind pairwise judging commands. See "Run a blind judging session" in evals/README.md.
//   generate --pack <dir> --commit <sha> [--arms bare,method] [--runner <cmd>] [--cases a,b] [--force] [--trust-runner] [--repo <dir>]
//   prepare --pack <dir> --out <dir> --reviewer <name> [--nonce <secret>] [--allow-residual]
//   serve   --session <dir> [--verdicts <file>] [--port <n>] [--open]
//   report  --pack <dir> --session <dir> [--verdicts <file>] [--min-decided 6] [--min-win-rate 2/3] [--sequential] [--json <file>]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildJudgingReport, formatJudgingReport, parsePassRule, prepareJudgingSession, readVerdictsFile, requirePrivatePath } from "../src/blind-judging.ts";
import { startJudgingServer } from "../src/blind-judging-server.ts";
import { generateDrafts } from "../src/judge-generate.ts";

const FLAGS = new Set(["allow-residual", "open", "sequential", "force", "trust-runner"]);
const [command, ...rest] = process.argv.slice(2);
const options: Record<string, string> = {};
for (let index = 0; index < rest.length; index += 1) {
  const arg = rest[index]!;
  if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
  const name = arg.slice(2);
  if (FLAGS.has(name)) options[name] = "true";
  else if (rest[index + 1] === undefined || rest[index + 1]!.startsWith("--")) fail(`--${name} needs a value`);
  else options[name] = rest[++index]!;
}

function fail(message: string): never {
  console.error(`blind-judging: ${message.replace(/^\[eval-lab\] /, "")}`);
  process.exit(1);
}
function need(name: string): string {
  return options[name] ?? fail(`--${name} is required`);
}

const list = (value: string | undefined) => value?.split(",").map((entry) => entry.trim()).filter(Boolean);

try {
  if (command === "generate") {
    const { written } = await generateDrafts({
      packDir: need("pack"),
      commit: need("commit"),
      arms: list(options.arms),
      cases: list(options.cases),
      runner: options.runner,
      repoDir: options.repo,
      force: options.force === "true",
      trustRunner: options["trust-runner"] === "true",
    });
    console.log(`Generated ${written.length} drafts. Generation records: ${join(resolve(need("pack")), ".generation")}`);
    console.log(`Next: npm run judge:prepare -- --pack "${resolve(need("pack"))}" --out "<private session folder>" --reviewer <name>`);
  } else if (command === "prepare") {
    const { sessionDir, session } = prepareJudgingSession({
      packDir: need("pack"),
      outDir: need("out"),
      reviewer: need("reviewer"),
      nonce: options.nonce,
      allowResidual: options["allow-residual"] === "true",
    });
    console.log(`Prepared session ${session.sessionId} with ${session.pairs.length} pairs.`);
    console.log(`  Judging page:  ${join(sessionDir, "judge.html")}`);
    console.log(`  Sealed key and audit (do not open before judging): ${join(sessionDir, "sealed")}`);
    console.log(`Next: npm run judge:serve -- --session "${sessionDir}" --open`);
  } else if (command === "serve") {
    const server = await startJudgingServer({ sessionDir: need("session"), verdictsPath: options.verdicts, port: options.port ? Number(options.port) : 0 });
    console.log(`Judging page: ${server.url}`);
    console.log(`Verdicts save to: ${server.verdictsPath}`);
    console.log("Each choice is saved at once. Press Ctrl+C when you are finished.");
    if (options.open === "true") {
      const opener = process.platform === "darwin" ? ["open", [server.url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", server.url]] : ["xdg-open", [server.url]];
      spawn(opener[0] as string, opener[1] as string[], { stdio: "ignore", detached: true }).unref();
    }
    const stop = () => { void server.close().then(() => process.exit(0)); };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } else if (command === "report") {
    const sessionDir = need("session");
    const verdictsPath = resolve(options.verdicts ?? join(sessionDir, "verdicts.json"));
    const report = buildJudgingReport({
      packDir: need("pack"),
      sessionDir,
      verdicts: readVerdictsFile(verdictsPath),
      rule: parsePassRule({ minDecided: options["min-decided"], minWinRate: options["min-win-rate"], sequential: options.sequential === "true" }),
    });
    process.stdout.write(formatJudgingReport(report));
    if (options.json) {
      writeFileSync(requirePrivatePath(options.json, "report file"), `${JSON.stringify(report, null, 2)}\n`);
      console.log(`Report JSON: ${resolve(options.json)}`);
    }
  } else {
    fail("use generate, prepare, serve, or report (see evals/README.md)");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
