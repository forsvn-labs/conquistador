/**
 * Render the offline, single-file judging page. Draft Markdown is rendered here, in Node, with every
 * character escaped first, so the page carries no third-party code and no raw draft HTML.
 */

export type PagePair = {
  pairId: string;
  practice: string;
  brief: string;
  a: string;
  b: string;
  armA: string;
  armB: string;
  assignmentDigest: string;
};

export type PageSession = {
  sessionId: string;
  reviewer: string;
  reviewerRevision: string;
  pairs: PagePair[];
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function inline(raw: string): string {
  const codes: string[] = [];
  let text = escapeHtml(raw).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => `<span class="link">[image: ${alt || "no description"}]</span>`)
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, label: string, url: string) => `<span class="link" title="${url}">${label}</span>`)
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a?: string, b?: string) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>");
  return text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)]!);
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/;

/** A small, escape-first Markdown renderer for headings, paragraphs, lists, quotes, tables, and code. */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index]!;
    if (!line.trim()) { index += 1; continue; }
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const body: string[] = [];
      for (index += 1; index < lines.length && !lines[index]!.trim().startsWith(fence[1]!); index += 1) body.push(lines[index]!);
      index += 1;
      html.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(6, heading[1]!.length + 2);
      html.push(`<h${level}>${inline(heading[2]!.replace(/\s+#+\s*$/, ""))}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html.push("<hr>"); index += 1; continue; }
    if (isTableRow(line) && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1]!)) {
      const head = tableCells(line);
      const rows: string[][] = [];
      for (index += 2; index < lines.length && isTableRow(lines[index]!); index += 1) rows.push(tableCells(lines[index]!));
      html.push(`<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      for (; index < lines.length && /^\s*>/.test(lines[index]!); index += 1) quoted.push(lines[index]!.replace(/^\s*>\s?/, ""));
      html.push(`<blockquote>${renderMarkdown(quoted.join("\n"))}</blockquote>`);
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = /\d/.test(item[1]!);
      const items: string[] = [];
      for (; index < lines.length; index += 1) {
        const next = LIST_ITEM.exec(lines[index]!);
        if (next) items.push(next[2]!);
        else if (lines[index]!.trim() && /^\s{2,}/.test(lines[index]!) && items.length) items[items.length - 1] += `\n${lines[index]!.trim()}`;
        else break;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.map((entry) => `<li>${entry.split("\n").map(inline).join("<br>")}</li>`).join("")}</${tag}>`);
      continue;
    }
    const paragraph: string[] = [];
    for (; index < lines.length; index += 1) {
      const next = lines[index]!;
      if (!next.trim() || /^(#{1,6})\s/.test(next) || /^\s{0,3}(`{3,}|~{3,})/.test(next) || /^\s*>/.test(next) || LIST_ITEM.test(next)) break;
      paragraph.push(next.trim());
    }
    html.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
  }
  return html.join("\n");
}

const STYLE = `
:root{color-scheme:light;--bg:#f6f5f2;--card:#fff;--ink:#1c1c1e;--muted:#5f5f66;--line:#dedcd6;--focus:#2f5bd3;--chosen:#1c1c1e}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);display:flex;flex-direction:column}
header{display:flex;gap:16px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--line);background:var(--card)}
header h1{font-size:15px;margin:0;font-weight:600}
#progress{font-variant-numeric:tabular-nums;color:var(--muted);font-size:14px}
.bar{flex:0 0 160px;height:6px;border-radius:3px;background:var(--line);overflow:hidden}.bar span{display:block;height:100%;background:var(--ink);width:0}
#save-state{margin-left:auto;font-size:13px;color:var(--muted)}#save-state[data-state=error]{color:#b42318;font-weight:600}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 12px}
button:focus-visible,input:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
main{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px;padding:12px 20px}
.brief{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 16px;max-height:28vh;overflow:auto;flex:none}
.brief summary{cursor:pointer;font-weight:600}.brief .doc{font-size:15px}
.drafts{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
article{background:var(--card);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;min-height:0}
article h2{margin:0;padding:10px 18px;font-size:15px;border-bottom:1px solid var(--line)}
article .doc{overflow:auto;padding:4px 22px 18px;max-width:72ch}
.doc h3,.doc h4,.doc h5,.doc h6{margin:1.1em 0 .4em;line-height:1.3}.doc h3{font-size:19px}.doc h4{font-size:17px}.doc h5,.doc h6{font-size:15px}
.doc table{border-collapse:collapse;font-size:14px;margin:.6em 0}.doc th,.doc td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
.doc pre{background:#f1f0ec;padding:10px;border-radius:6px;overflow:auto;font-size:13px}.doc code{font-size:.92em}
.doc blockquote{margin:.6em 0;padding-left:12px;border-left:3px solid var(--line);color:var(--muted)}.link{text-decoration:underline dotted}
footer{display:flex;gap:10px;align-items:center;padding:12px 20px;border-top:1px solid var(--line);background:var(--card);flex-wrap:wrap}
.choice{min-width:150px;padding:10px 16px;font-weight:600}.choice kbd,.hint kbd{font:12px ui-monospace,monospace;border:1px solid var(--line);border-radius:4px;padding:0 5px;margin-left:6px;color:var(--muted)}
.choice[aria-pressed=true]{background:var(--chosen);color:#fff;border-color:var(--chosen)}.choice[aria-pressed=true] kbd{color:#ddd;border-color:#555}
#reason{flex:1;min-width:220px;font:inherit;padding:9px 12px;border:1px solid var(--line);border-radius:8px}
.hint{font-size:13px;color:var(--muted);width:100%}
#done{background:#eef6ee;border:1px solid #b9d8b9;border-radius:10px;padding:10px 16px}
@media (max-width:900px){.drafts{grid-template-columns:1fr}article .doc{max-height:none}}
`;

const CLIENT = String.raw`
(function () {
  var data = JSON.parse(document.getElementById("session-data").textContent);
  var storageKey = "blind-judging:" + data.sessionId;
  var served = location.protocol === "http:" || location.protocol === "https:";
  var byId = {}; data.pairs.forEach(function (p) { byId[p.pairId] = p; });
  var verdicts = {};
  var current = 0;
  var $ = function (id) { return document.getElementById(id); };
  var labels = { A: "A is better", B: "B is better", tie: "Tie", "reject-both": "Both rejected" };

  function belongs(v) {
    var p = v && byId[v.blindPairId];
    return Boolean(p && v.artifactDigests && v.artifactDigests[0] === p.armA && v.artifactDigests[1] === p.armB && v.assignmentDigest === p.assignmentDigest);
  }
  function merge(list) {
    (Array.isArray(list) ? list : []).forEach(function (v) {
      if (!belongs(v)) return;
      var old = verdicts[v.blindPairId];
      if (!old || String(v.recordedAt) > String(old.recordedAt)) verdicts[v.blindPairId] = v;
    });
  }
  function all() { return data.pairs.map(function (p) { return verdicts[p.pairId]; }).filter(Boolean); }
  function writeLocal() { try { localStorage.setItem(storageKey, JSON.stringify(all())); } catch (e) { setState("error", "This browser blocked local storage. Use Export after each pair."); } }
  function readLocal() { try { merge(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch (e) { /* Ignore unreadable local copies. */ } }
  function setState(state, text) { var el = $("save-state"); el.setAttribute("data-state", state); el.textContent = text; }
  function put(v) {
    return fetch("api/verdicts", { method: "PUT", headers: { "content-type": "application/json", "x-blind-judging-session": data.sessionId }, body: JSON.stringify(v) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); });
  }
  function firstOpen(from) {
    for (var i = 0; i < data.pairs.length; i += 1) { var k = (from + i) % data.pairs.length; if (!verdicts[data.pairs[k].pairId]) return k; }
    return -1;
  }

  function show(index) {
    current = Math.max(0, Math.min(data.pairs.length - 1, index));
    var p = data.pairs[current];
    var main = $("pair");
    main.setAttribute("data-pair-id", p.pairId);
    $("brief-title").textContent = "Brief · " + p.practice;
    $("brief").innerHTML = p.brief;
    $("draft-a").innerHTML = p.a;
    $("draft-b").innerHTML = p.b;
    $("draft-a").scrollTop = 0; $("draft-b").scrollTop = 0;
    var v = verdicts[p.pairId];
    $("reason").value = v && v.rationale !== "No reason given." ? v.rationale : "";
    ["A", "tie", "B"].forEach(function (choice) { $("choose-" + choice).setAttribute("aria-pressed", String(Boolean(v && v.verdict === choice))); });
    progress();
  }
  function progress() {
    var judged = all().length, total = data.pairs.length;
    $("progress").textContent = "Pair " + (current + 1) + " of " + total + " · " + judged + " judged";
    $("bar").style.width = (100 * judged / total) + "%";
    $("done").hidden = judged !== total;
  }

  function record(choice) {
    var p = data.pairs[current];
    var reason = $("reason").value.replace(/\s+/g, " ").trim().slice(0, 300);
    var v = {
      schemaVersion: "conquistador.human-verdict/v1",
      id: p.pairId + "/verdict",
      blindPairId: p.pairId,
      reviewer: data.reviewer,
      reviewerRevision: data.reviewerRevision,
      artifactDigests: [p.armA, p.armB],
      verdict: choice,
      rationale: reason || "No reason given.",
      recordedAt: new Date().toISOString(),
      assignmentDigest: p.assignmentDigest
    };
    verdicts[p.pairId] = v;
    setState("saving", "Saving…");
    writeLocal();
    var judgedIndex = current;
    var after = function () {
      var next = firstOpen(judgedIndex + 1);
      if (current === judgedIndex) { if (next >= 0) show(next); else show(judgedIndex); }
    };
    if (!served) {
      setState("saved", "Saved in this browser · " + labels[choice] + ". Use Export to save a file.");
      after();
      return;
    }
    put(v).then(function () {
      setState("saved", "Saved to the verdict file · " + labels[choice]);
      after();
    }, function (error) {
      setState("error", "Not saved to the file: " + error.message + ". Kept in this browser; choose again to retry.");
      show(judgedIndex);
    });
  }

  function exportFile() {
    var blob = new Blob([JSON.stringify(all(), null, 2) + "\n"], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "verdicts-" + data.sessionId + ".json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  $("choose-A").onclick = function () { record("A"); };
  $("choose-B").onclick = function () { record("B"); };
  $("choose-tie").onclick = function () { record("tie"); };
  $("prev").onclick = function () { show(current - 1); };
  $("next").onclick = function () { show(current + 1); };
  $("export").onclick = exportFile;
  $("reason").addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); $("reason").blur(); }
  });
  document.addEventListener("keydown", function (event) {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var key = event.key.toLowerCase();
    if (key === "a") record("A");
    else if (key === "b") record("B");
    else if (key === "t") record("tie");
    else if (key === "r") { event.preventDefault(); $("reason").focus(); }
    else if (event.key === "ArrowLeft") show(current - 1);
    else if (event.key === "ArrowRight") show(current + 1);
    else return;
    event.preventDefault();
  });

  function start() {
    var open = firstOpen(0);
    show(open >= 0 ? open : data.pairs.length - 1);
  }
  readLocal();
  if (!served) {
    setState("saved", "Opened from disk: verdicts are kept in this browser. Use Export to save a file.");
    start();
    return;
  }
  setState("saving", "Loading saved verdicts…");
  fetch("api/verdicts", { headers: { "x-blind-judging-session": data.sessionId } })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (saved) {
      var onServer = {}; (saved || []).forEach(function (v) { onServer[v.blindPairId] = v.recordedAt; });
      merge(saved);
      var pending = all().filter(function (v) { return onServer[v.blindPairId] !== v.recordedAt; });
      writeLocal();
      return Promise.all(pending.map(put)).then(function () {
        setState("saved", all().length ? "Resumed from the verdict file" : "Verdicts save to the verdict file after each choice");
      });
    })
    .catch(function (error) { setState("error", "Cannot reach the verdict file: " + error.message + ". Verdicts are kept in this browser."); })
    .then(start);
})();
`;

export function renderJudgingPage(session: PageSession): string {
  const json = JSON.stringify(session).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16)}`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:">
<meta name="referrer" content="no-referrer">
<title>Blind pairwise judging</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>Blind pairwise judging</h1>
  <div class="bar" aria-hidden="true"><span id="bar"></span></div>
  <span id="progress" aria-live="polite"></span>
  <span id="save-state" data-state="saving" role="status">Loading…</span>
  <button type="button" id="export" title="Download all verdicts as a JSON file">Export</button>
</header>
<main id="pair">
  <section class="brief"><details open><summary id="brief-title">Brief</summary><div class="doc" id="brief"></div></details></section>
  <div class="drafts">
    <article aria-labelledby="label-a"><h2 id="label-a">Draft A</h2><div class="doc" id="draft-a"></div></article>
    <article aria-labelledby="label-b"><h2 id="label-b">Draft B</h2><div class="doc" id="draft-b"></div></article>
  </div>
  <section id="done" hidden><strong>All pairs are judged.</strong> You can still go back and change a choice. When you are finished, close this tab and run the report.</section>
</main>
<footer>
  <button type="button" id="prev" title="Previous pair (←)">←</button>
  <button type="button" class="choice" id="choose-A" aria-pressed="false">A is better<kbd>A</kbd></button>
  <button type="button" class="choice" id="choose-tie" aria-pressed="false">Tie<kbd>T</kbd></button>
  <button type="button" class="choice" id="choose-B" aria-pressed="false">B is better<kbd>B</kbd></button>
  <input id="reason" type="text" maxlength="300" autocomplete="off" placeholder="Optional: one line on why (press R, then Enter)" aria-label="Optional reason">
  <button type="button" id="next" title="Next pair (→)">→</button>
  <div class="hint">Read the brief, then both drafts. Pick the draft you would rather ship. <kbd>A</kbd> <kbd>B</kbd> <kbd>T</kbd> choose and move on · <kbd>R</kbd> write a reason before you choose · <kbd>←</kbd> <kbd>→</kbd> move between pairs.</div>
</footer>
<script type="application/json" id="session-data">${json}</script>
<script>${CLIENT}</script>
</body>
</html>
`;
}
