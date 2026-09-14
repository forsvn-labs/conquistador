#!/usr/bin/env node
import { readFileSync } from "node:fs"; import { resolve } from "node:path";
import { adversarialSelfTest, buildInventory, verifyInventory } from "../src/inventory-preflight.ts";
const root=resolve(import.meta.dirname,"../..");
try { const record=JSON.parse(readFileSync(resolve(root,"evals/benchmarks/inventory-preflight-v1.json"),"utf8")); const result:any=verifyInventory(record,root); const expected=buildInventory(root); if(JSON.stringify(record)!==JSON.stringify(expected)) throw new Error("schema/source/evidence digest drift"); if(process.argv.includes("--self-test"))result.selfTest=adversarialSelfTest(root); console.log(JSON.stringify(result,null,2)); } catch(error){ console.error(`[inventory-preflight] FAIL: ${error instanceof Error?error.message:String(error)}`); process.exit(1); }
