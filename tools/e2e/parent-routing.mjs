// Exercise the complete catalog through a staged skill and real local MCP stdio.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, packBrief } from '../brief.mjs';
import { loadRoutingContract } from '../routing-contract.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/parent-routing'));
const work = realpathSync(mkdtempSync(join(tmpdir(), 'cq-parent-routing-')));
const target = join(work, 'skill');
const contract = loadRoutingContract(root);
const prefixes = ['conquistador ', '/conquistador ', 'Use Conquistador ', '$conquistador:conquistador '];
const cases = [...Object.keys(contract.methods), ...contract.plays.map(p => p.name)].flatMap(name => prefixes.map(prefix => ({ task: prefix + name, expected: name })));
for (const task of ['Conquistador', 'Conquistador hooks off', 'Conquistador update', 'Conquistador status', 'Conquistador remove', 'Conquistador unpin docs', 'Conquistador unknown-operation']) cases.push({ task, expected: 'parent' });
cases.push({ task: 'the company documents on the brain is not good, please improve it using \nConquistador', expected: 'docs' });
const check = (item, pack) => {
  assert.equal(pack.structured.action, 'brief', item.task);
  if (item.expected === 'parent') assert.equal(pack.structured.reason, 'parent-selection-required', item.task);
  else assert.ok(pack.structured.command === item.expected || pack.structured.play === item.expected, item.task);
  const size = Buffer.byteLength(JSON.stringify({content:[{type:'text',text:pack.text}],structuredContent:pack.structured}));
  assert.ok(size <= pack.structured.budgetBytes, item.task);
  return size;
};
try {
  execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', 'conquistador', target], { stdio: 'pipe' });
  assert.match(readFileSync(join(target, 'SKILL.md'), 'utf8'), /Plain "Conquistador"/);
  const installed = cases.map(item => ({...item, bytes: check(item, packBrief(createBrief(item.task, { root: target, playbooks: [], persistCache: false })))}));
  const requests = [{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'parent-routing-e2e',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'}, ...cases.map((item,i)=>({jsonrpc:'2.0',id:i+2,method:'tools/call',params:{name:'conquistador_brief',arguments:{task:item.task}}}))];
  const run = spawnSync(process.execPath, [join(root, 'mcp/server.mjs')], { cwd: work, env: { PATH: process.env.PATH, CONQUISTADOR_HOME: work, CONQUISTADOR_PLAYBOOKS: join(work,'playbooks'), CONQUISTADOR_CACHE: join(work,'cache') }, input:requests.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:60000,maxBuffer:16000000 });
  assert.equal(run.status,0,run.stderr);
  const responses=run.stdout.trim().split('\n').map(x=>JSON.parse(x));
  const mcp=cases.map((item,i)=>{const result=responses.find(r=>r.id===i+2)?.result;assert.ok(result&&!result.isError,item.task);return {...item,bytes:check(item,{text:result.content[0].text,structured:result.structuredContent})};});
  mkdirSync(out,{recursive:true});writeFileSync(join(out,'report.json'),JSON.stringify({schema:'conquistador.parent-routing-e2e/v1',passed:true,commands:Object.keys(contract.methods).length,workflows:contract.plays.length,prefixes,installed,mcp,limits:'Local staged skill and stdio only. No model behavior, external actions, or hosted deployment verified.'},null,2)+'\n');
  console.log(`Passed ${installed.length} installed and ${mcp.length} MCP cases. Report: ${join(out,'report.json')}`);
}finally{rmSync(work,{recursive:true,force:true});}
