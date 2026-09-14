import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adversarialSelfTest, buildInventory, verifyInventory } from "../src/inventory-preflight";
import { root } from "./helpers";

describe("closed offline inventory preflight",()=>{
  it("proves exact inventory, coverage, zero execution, and unbound authority",()=>{const result=verifyInventory(buildInventory());expect(result).toMatchObject({status:"inventory-complete-candidate-unbound",definitions:{core:74,deep:52,parentWorkflow:25,parity:40,calibration:60},coverage:{outcomes:37,parents:3,directOnlyEngineeringBoundaries:1,workflows:21},plannedCandidateExecutions:573,candidateExecutions:0,providerModelCellsBound:0,aaExecutions:0,humanVerdicts:0,releaseState:"NO-GO",candidate:"UNBOUND"})});
  it("keeps specify-product-experience as the direct-only workflow boundary",()=>{const specify=buildInventory().cases.find(x=>x.subjectId==="specify-product-experience");expect(specify).toMatchObject({class:"workflow",directOnly:true,assertions:["no-parent-routing","no-usefulness-claim","composition-only","step-graph-not-executed"]})});
  it("keeps the six engineering outcomes as standalone EXTS-156 cells outside parent routing",()=>{
    const inventory=buildInventory();
    const engineering=["architect-software-system","brief-product-ui","build-ios-app","build-web-app","map-user-flow","write-technical-docs"];
    expect(inventory.cases.filter(x=>x.partition==="outcome-core"&&x.class==="normal"&&engineering.includes(x.subjectId)).map(x=>x.subjectId).sort()).toEqual([...engineering].sort());
    expect(inventory.cases.filter(x=>x.class==="parent").some(x=>engineering.includes(x.subjectId))).toBe(false);
  });
  it("executes every named fail-closed mutation for its intended reason",()=>{const result=adversarialSelfTest();expect(result.positive).toBe(1);expect(result.rejected).toBe(53);expect(result.rejected).toBe(result.labels.length)},15000);
  it("keeps the public JSON Schema closed and aligned with the runtime authority",()=>{
    const schema=JSON.parse(readFileSync(resolve(root,"schemas/inventory-preflight-v1.schema.json"),"utf8"));
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.cases.items).toEqual({"$ref":"#/$defs/InventoryCase"});
    expect(schema.$defs.InventoryCase.additionalProperties).toBe(false);
    expect(schema.$defs.InventoryCase.properties.repetitionCount).toEqual({enum:[1,3]});
    expect(schema.$defs.InventoryCase.properties.compositionInputOnly).toEqual({const:true});
    expect(schema.$defs.InventoryCase.properties.executablePlaybook).toEqual({const:false});
    expect(schema.$defs.InventoryCase.properties.claimedExecuted).toEqual({const:false});
    expect(schema.$defs.InventoryCase.properties.directOnly).toEqual({const:true});
    const plan=schema.properties.executionPlan.properties;
    expect(plan.plannedExecutions.items).toEqual({"$ref":"#/$defs/PlannedExecution"});
    expect(schema.$defs.PlannedExecution.additionalProperties).toBe(false);
    expect(schema.$defs.PlannedExecution.properties.status).toEqual({const:"planned-unbound"});
    expect(schema.$defs.PlannedExecution.properties.authority).toEqual({const:"none"});
    expect(schema.$defs.PlannedExecution.properties.candidateBuildId).toEqual({type:"null"});
    expect(schema.$defs.PlannedExecution.properties.providerCellId).toEqual({type:"null"});
    expect(schema.$defs.PlannedExecution.properties.immutableBindings.properties.outputDigest).toEqual({type:"null"});
    expect(schema.$defs.PlannedExecution.properties.immutableBindings.properties.traceDigest).toEqual({type:"null"});
    expect(schema.$defs.PlannedExecution.properties.immutableBindings.properties.reviewPacketDigest).toEqual({type:"null"});
    expect(plan.aaPolicy).toEqual({"$ref":"#/$defs/AaPolicy"});
    expect(plan.bindingBoundary).toEqual({"$ref":"#/$defs/BindingBoundary"});
    expect(schema.$defs.AaPolicy.additionalProperties).toBe(false);
    expect(schema.$defs.AaPolicy.properties.executionsPerBoundProviderModelCell).toEqual({const:12});
    expect(schema.$defs.AaPolicy.properties.executions).toEqual({type:"array",maxItems:0});
    expect(schema.$defs.BindingBoundary.additionalProperties).toBe(false);
    expect(schema.$defs.BindingBoundary.properties.evidenceBeforeBinding).toEqual({const:false});
    expect(schema.$defs.BindingBoundary.properties.floatingIdentitiesDenied).toEqual({const:true});
    expect(schema.$defs.CaseSource.properties.version.pattern).toBe("^\\d+\\.\\d+\\.\\d+$");
  });
});
