#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildInventory, verifyInventory } from "../src/inventory-preflight.ts";
const root=resolve(import.meta.dirname,"../.."); const record=buildInventory(root); verifyInventory(record,root);
writeFileSync(resolve(root,"evals/benchmarks/inventory-preflight-v1.json"),`${JSON.stringify(record,null,2)}\n`);
console.log(JSON.stringify(verifyInventory(record,root),null,2));
