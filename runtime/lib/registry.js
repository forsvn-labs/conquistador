const SKILL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PLAYBOOK_ID = SKILL_ID;
const PLAYBOOK_CANONICAL = /^playbook:[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const FIELD_TYPES = new Set(["string", "number", "boolean", "string[]", "artifact"]);
const ROUTING_KEYS = new Set(["routingIndex", "promptSignals", "noneOf", "hooks", "skill-registry", "capability-index"]);
const FORBIDDEN_CATALOG_KEYS = new Set(["leaves", "customerCatalog", "customerManagedCatalogEntries"]);
function invariant(condition, prefix, message) {
    if (!condition)
        throw new Error(`[${prefix}] ${message}`);
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, allowed, prefix, label) {
    const keys = Object.keys(value);
    const routing = keys.filter((key) => ROUTING_KEYS.has(key));
    invariant(routing.length === 0, prefix, `${label} must not carry routing-registry fields (${routing.join(", ")})`);
    const catalog = keys.filter((key) => FORBIDDEN_CATALOG_KEYS.has(key));
    invariant(catalog.length === 0, prefix, `${label} must not carry a customer-managed catalog (${catalog.join(", ")})`);
    invariant(keys.every((key) => allowed.includes(key)), prefix, `${label} contains an undeclared field`);
}
function nonEmpty(value, prefix, label) {
    invariant(typeof value === "string" && value.trim().length > 0, prefix, `${label} is required`);
}
function exactUtc(value, prefix, label) {
    invariant(typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value, prefix, `${label} must be an exact UTC ISO timestamp`);
}
function unique(values, prefix, label) {
    invariant(new Set(values).size === values.length, prefix, `${label} must be unique`);
}
function semver(value, prefix, label) {
    invariant(typeof value === "string" && SEMVER.test(value), prefix, `${label} must be exact semver`);
}
function skillId(value, prefix, label) {
    invariant(typeof value === "string" && SKILL_ID.test(value), prefix, `${label} must be a kebab-case skill id`);
}
function playbookId(value, prefix, label) {
    invariant(typeof value === "string" && PLAYBOOK_ID.test(value), prefix, `${label} must be a kebab-case playbook id`);
}
function positiveInteger(value, prefix, label) {
    invariant(Number.isInteger(value) && Number(value) > 0, prefix, `${label} must be a positive integer`);
}
function nonNegativeNumber(value, prefix, label) {
    invariant(typeof value === "number" && Number.isFinite(value) && value >= 0, prefix, `${label} must be a finite non-negative number`);
}
function stringArray(value, prefix, label) {
    invariant(Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0), prefix, `${label} must be a non-empty-string array`);
}
function validateFields(value, prefix, label) {
    invariant(Array.isArray(value) && value.length > 0, prefix, `${label} needs at least one field`);
    const names = [];
    for (const [index, entry] of value.entries()) {
        invariant(isObject(entry), prefix, `${label}[${index}] must be an object`);
        exactKeys(entry, ["name", "type", "required", "description"], prefix, `${label}[${index}]`);
        nonEmpty(entry.name, prefix, `${label}[${index}].name`);
        invariant(typeof entry.type === "string" && FIELD_TYPES.has(entry.type), prefix, `${label}[${index}].type is invalid`);
        invariant(typeof entry.required === "boolean", prefix, `${label}[${index}].required must be boolean`);
        nonEmpty(entry.description, prefix, `${label}[${index}].description`);
        names.push(entry.name);
    }
    unique(names, prefix, `${label} names`);
}
function validateVersionedFields(value, prefix, label, extra = []) {
    invariant(isObject(value), prefix, `${label} is required`);
    exactKeys(value, ["version", "fields", ...extra], prefix, label);
    semver(value.version, prefix, `${label}.version`);
    validateFields(value.fields, prefix, `${label}.fields`);
}
const INSTALL_ELIGIBILITY_KEYS = [
    "independentlyInstallable",
    "requiresSiblingSkill",
    "requiresPlaybookRunner",
    "requiresRegistryActivation",
    "requiresGeneratedCatalog",
];
function validateInstallEligibility(value, prefix) {
    invariant(isObject(value), prefix, "installEligibility is required");
    exactKeys(value, INSTALL_ELIGIBILITY_KEYS, prefix, "installEligibility");
    invariant(value.independentlyInstallable === true, prefix, "a skill must remain independently installable");
    invariant(value.requiresSiblingSkill === false, prefix, "a skill cannot require a sibling skill to install");
    invariant(value.requiresPlaybookRunner === false, prefix, "a skill cannot require the playbook runner to install");
    invariant(value.requiresRegistryActivation === false, prefix, "a skill cannot require registry activation to install");
    invariant(value.requiresGeneratedCatalog === false, prefix, "a skill cannot require a generated catalog to install");
}
export function validateSkillRecord(value) {
    const prefix = "conquistador.skill-registry";
    invariant(isObject(value), prefix, "skill record must be an object");
    exactKeys(value, [
        "schemaVersion",
        "id",
        "version",
        "kind",
        "trigger",
        "inputs",
        "outputs",
        "compatiblePlaybooks",
        "toolRequirements",
        "qualityCriteria",
        "failureBehavior",
        "provenance",
        "installEligibility",
    ], prefix, "skill record");
    invariant(value.schemaVersion === "conquistador.skill-record/v1", prefix, "schemaVersion must be conquistador.skill-record/v1");
    skillId(value.id, prefix, "id");
    semver(value.version, prefix, "version");
    invariant(value.kind === "outcome-skill", prefix, "kind must be outcome-skill");
    invariant(isObject(value.trigger), prefix, "trigger is required");
    exactKeys(value.trigger, ["description", "examples"], prefix, "trigger");
    nonEmpty(value.trigger.description, prefix, "trigger.description");
    stringArray(value.trigger.examples, prefix, "trigger.examples");
    invariant(value.trigger.examples.length > 0, prefix, "trigger.examples needs at least one example");
    validateVersionedFields(value.inputs, prefix, "inputs");
    validateVersionedFields(value.outputs, prefix, "outputs", ["deliverable"]);
    nonEmpty(value.outputs.deliverable, prefix, "outputs.deliverable");
    stringArray(value.compatiblePlaybooks, prefix, "compatiblePlaybooks");
    unique(value.compatiblePlaybooks, prefix, "compatiblePlaybooks");
    for (const id of value.compatiblePlaybooks)
        playbookId(id, prefix, "compatiblePlaybooks[]");
    invariant(isObject(value.toolRequirements), prefix, "toolRequirements is required");
    exactKeys(value.toolRequirements, ["capabilityIds", "requiredForStandalone"], prefix, "toolRequirements");
    stringArray(value.toolRequirements.capabilityIds, prefix, "toolRequirements.capabilityIds");
    unique(value.toolRequirements.capabilityIds, prefix, "toolRequirements.capabilityIds");
    invariant(value.toolRequirements.requiredForStandalone === false, prefix, "standalone install cannot require tools");
    invariant(Array.isArray(value.qualityCriteria) && value.qualityCriteria.length > 0, prefix, "qualityCriteria are required");
    const qualityIds = [];
    for (const [index, criterion] of value.qualityCriteria.entries()) {
        invariant(isObject(criterion), prefix, `qualityCriteria[${index}] must be an object`);
        exactKeys(criterion, ["id", "description"], prefix, `qualityCriteria[${index}]`);
        nonEmpty(criterion.id, prefix, `qualityCriteria[${index}].id`);
        nonEmpty(criterion.description, prefix, `qualityCriteria[${index}].description`);
        qualityIds.push(criterion.id);
    }
    unique(qualityIds, prefix, "qualityCriteria ids");
    invariant(isObject(value.failureBehavior), prefix, "failureBehavior is required");
    exactKeys(value.failureBehavior, ["onInvalidInput", "onMissingTools", "onQualityFail"], prefix, "failureBehavior");
    invariant(["reject", "ask-once"].includes(value.failureBehavior.onInvalidInput), prefix, "failureBehavior.onInvalidInput is invalid");
    invariant(["degrade-to-local", "stop"].includes(value.failureBehavior.onMissingTools), prefix, "failureBehavior.onMissingTools is invalid");
    invariant(["revise-once", "stop"].includes(value.failureBehavior.onQualityFail), prefix, "failureBehavior.onQualityFail is invalid");
    invariant(isObject(value.provenance), prefix, "provenance is required");
    exactKeys(value.provenance, ["sourcePath", "independentlyVersioned", "recordedAt"], prefix, "provenance");
    nonEmpty(value.provenance.sourcePath, prefix, "provenance.sourcePath");
    invariant(value.provenance.independentlyVersioned === true, prefix, "a skill must remain independently versioned");
    exactUtc(value.provenance.recordedAt, prefix, "provenance.recordedAt");
    validateInstallEligibility(value.installEligibility, prefix);
}
export function validateSkillRegistry(value) {
    const prefix = "conquistador.skill-registry";
    invariant(isObject(value), prefix, "skill registry must be an object");
    exactKeys(value, ["schemaVersion", "productVersion", "activationRequiredByPortablePlugin", "loadsAtPluginRuntime", "records"], prefix, "skill registry");
    invariant(value.schemaVersion === "conquistador.skill-registry/v1", prefix, "schemaVersion must be conquistador.skill-registry/v1");
    invariant(value.productVersion === "1.0.0", prefix, "productVersion must be 1.0.0");
    invariant(value.activationRequiredByPortablePlugin === false, prefix, "registry activation is not required by the Portable Plugin");
    invariant(value.loadsAtPluginRuntime === false, prefix, "the Portable Plugin must not load the skill registry at runtime");
    invariant(Array.isArray(value.records), prefix, "records must be an array");
    const ids = [];
    for (const record of value.records) {
        validateSkillRecord(record);
        ids.push(record.id);
    }
    unique(ids, prefix, "skill ids");
}
function validateStepUses(value, prefix, label, kind) {
    invariant(isObject(value), prefix, `${label}.uses is required`);
    exactKeys(value, ["skillId", "scriptId", "toolOperationId", "branch", "maturity", "fallback"], prefix, `${label}.uses`);
    const selectors = ["skillId", "scriptId", "toolOperationId", "branch"].filter((key) => value[key] !== undefined);
    invariant(selectors.length === 1, prefix, `${label} must declare exactly one of skill, script, tool operation, or branch`);
    if (value.skillId !== undefined) {
        invariant(kind === "skill", prefix, `${label} skill uses require kind skill`);
        skillId(value.skillId, prefix, `${label}.uses.skillId`);
    }
    if (value.scriptId !== undefined) {
        invariant(kind === "script", prefix, `${label} script uses require kind script`);
        skillId(value.scriptId, prefix, `${label}.uses.scriptId`);
    }
    if (value.toolOperationId !== undefined) {
        invariant(kind === "tool-operation", prefix, `${label} tool uses require kind tool-operation`);
        invariant(typeof value.toolOperationId === "string" && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value.toolOperationId), prefix, `${label}.uses.toolOperationId is invalid`);
        invariant(value.maturity === "unverified", prefix, `${label} cannot claim a supported tool operation`);
        invariant(value.fallback === "human-action-manifest", prefix, `${label} unverified tools must fall back to a human action manifest`);
    }
    else {
        invariant(value.maturity === undefined && value.fallback === undefined, prefix, `${label} maturity and fallback apply only to tool operations`);
    }
    if (value.branch !== undefined) {
        invariant(kind === "skill", prefix, `${label} branch requires kind skill`);
        invariant(isObject(value.branch), prefix, `${label}.uses.branch must be an object`);
        exactKeys(value.branch, ["on", "cases"], prefix, `${label}.uses.branch`);
        nonEmpty(value.branch.on, prefix, `${label}.uses.branch.on`);
        invariant(Array.isArray(value.branch.cases) && value.branch.cases.length >= 2, prefix, `${label}.uses.branch needs two or more cases`);
        const whens = [];
        for (const [index, entry] of value.branch.cases.entries()) {
            invariant(isObject(entry), prefix, `${label}.uses.branch.cases[${index}] must be an object`);
            exactKeys(entry, ["when", "skillId"], prefix, `${label}.uses.branch.cases[${index}]`);
            nonEmpty(entry.when, prefix, `${label}.uses.branch.cases[${index}].when`);
            skillId(entry.skillId, prefix, `${label}.uses.branch.cases[${index}].skillId`);
            whens.push(entry.when);
        }
        unique(whens, prefix, `${label} branch cases`);
    }
}
function assertAcyclic(nodes, prefix) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const visiting = new Set();
    const visited = new Set();
    const visit = (id) => {
        if (visited.has(id))
            return;
        invariant(!visiting.has(id), prefix, `step graph contains a cycle at ${id}`);
        visiting.add(id);
        for (const dep of byId.get(id).dependsOn)
            visit(dep);
        visiting.delete(id);
        visited.add(id);
    };
    for (const node of nodes)
        visit(node.id);
}
function validateStep(value, prefix, index, artifactIds) {
    const label = `stepGraph.nodes[${index}]`;
    invariant(isObject(value), prefix, `${label} must be an object`);
    exactKeys(value, ["id", "kind", "uses", "dependsOn", "inputArtifacts", "outputArtifacts", "completion", "timeoutSeconds", "idempotency", "retry", "failureBehavior", "budget"], prefix, label);
    skillId(value.id, prefix, `${label}.id`);
    invariant(["skill", "script", "tool-operation"].includes(value.kind), prefix, `${label}.kind is invalid`);
    validateStepUses(value.uses, prefix, label, value.kind);
    stringArray(value.dependsOn, prefix, `${label}.dependsOn`);
    unique(value.dependsOn, prefix, `${label}.dependsOn`);
    stringArray(value.inputArtifacts, prefix, `${label}.inputArtifacts`);
    stringArray(value.outputArtifacts, prefix, `${label}.outputArtifacts`);
    unique(value.inputArtifacts, prefix, `${label}.inputArtifacts`);
    unique(value.outputArtifacts, prefix, `${label}.outputArtifacts`);
    invariant(value.outputArtifacts.length > 0, prefix, `${label} must produce at least one typed artifact`);
    for (const artifactId of [...value.inputArtifacts, ...value.outputArtifacts]) {
        invariant(artifactIds.has(artifactId), prefix, `${label} references unknown artifact ${artifactId}`);
    }
    nonEmpty(value.completion, prefix, `${label}.completion`);
    positiveInteger(value.timeoutSeconds, prefix, `${label}.timeoutSeconds`);
    invariant(["none", "required"].includes(value.idempotency), prefix, `${label}.idempotency is invalid`);
    invariant(["stop", "degrade"].includes(value.failureBehavior), prefix, `${label}.failureBehavior is invalid`);
    if (value.retry !== undefined) {
        invariant(isObject(value.retry), prefix, `${label}.retry must be an object`);
        exactKeys(value.retry, ["maxAttempts"], prefix, `${label}.retry`);
        positiveInteger(value.retry.maxAttempts, prefix, `${label}.retry.maxAttempts`);
    }
    if (value.budget !== undefined) {
        invariant(isObject(value.budget), prefix, `${label}.budget must be an object`);
        exactKeys(value.budget, ["maxTokens"], prefix, `${label}.budget`);
        positiveInteger(value.budget.maxTokens, prefix, `${label}.budget.maxTokens`);
    }
}
export function validatePlaybookRecord(value) {
    const prefix = "conquistador.playbook-registry";
    invariant(isObject(value), prefix, "playbook record must be an object");
    invariant(!Array.isArray(value.steps), prefix, "a prose sequence is not a playbook");
    exactKeys(value, [
        "schemaVersion",
        "id",
        "canonicalId",
        "version",
        "kind",
        "executionStatus",
        "notExecutableReason",
        "proseSource",
        "inputs",
        "completionCriteria",
        "stepGraph",
        "artifacts",
        "budgets",
        "retry",
        "resume",
        "timeout",
        "idempotency",
        "gates",
        "provenance",
        "receipts",
        "evalSignals",
        "finalDeliverable",
        "nextDecision",
        "activation",
    ], prefix, "playbook record");
    invariant(value.schemaVersion === "conquistador.playbook-record/v1", prefix, "schemaVersion must be conquistador.playbook-record/v1");
    playbookId(value.id, prefix, "id");
    invariant(typeof value.canonicalId === "string" && PLAYBOOK_CANONICAL.test(value.canonicalId), prefix, "canonicalId must be playbook:<id>");
    invariant(value.canonicalId === `playbook:${value.id}`, prefix, "canonicalId must match id");
    semver(value.version, prefix, "version");
    invariant(value.kind === "executable-playbook", prefix, "kind must be executable-playbook");
    invariant(value.executionStatus === "fixture-not-executable" ||
        value.executionStatus === "unimplemented" ||
        value.executionStatus === "executable", prefix, "playbook execution is not admitted without a runner trace");
    if (value.executionStatus === "executable") {
        invariant(value.notExecutableReason === undefined, prefix, "an executable playbook cannot declare a notExecutableReason");
    }
    else {
        nonEmpty(value.notExecutableReason, prefix, "notExecutableReason");
    }
    if (value.proseSource !== undefined) {
        nonEmpty(value.proseSource, prefix, "proseSource");
        invariant(typeof value.proseSource === "string" && value.proseSource.endsWith(".md"), prefix, "proseSource is a compatibility map to Markdown, not a registry entry");
    }
    validateVersionedFields(value.inputs, prefix, "inputs");
    stringArray(value.completionCriteria, prefix, "completionCriteria");
    invariant(value.completionCriteria.length > 0, prefix, "completionCriteria are required");
    invariant(Array.isArray(value.artifacts) && value.artifacts.length > 0, prefix, "a playbook without artifacts fails closed");
    const artifactIds = [];
    for (const [index, artifact] of value.artifacts.entries()) {
        invariant(isObject(artifact), prefix, `artifacts[${index}] must be an object`);
        exactKeys(artifact, ["id", "name", "format", "schema", "provenanceRequired"], prefix, `artifacts[${index}]`);
        skillId(artifact.id, prefix, `artifacts[${index}].id`);
        nonEmpty(artifact.name, prefix, `artifacts[${index}].name`);
        invariant(["markdown", "json"].includes(artifact.format), prefix, `artifacts[${index}].format is invalid`);
        nonEmpty(artifact.schema, prefix, `artifacts[${index}].schema`);
        invariant(artifact.provenanceRequired === true, prefix, `artifacts[${index}] must require provenance`);
        artifactIds.push(artifact.id);
    }
    unique(artifactIds, prefix, "artifact ids");
    const artifactIdSet = new Set(artifactIds);
    invariant(isObject(value.stepGraph), prefix, "a playbook without a step graph fails closed");
    exactKeys(value.stepGraph, ["nodes"], prefix, "stepGraph");
    invariant(Array.isArray(value.stepGraph.nodes) && value.stepGraph.nodes.length >= 2, prefix, "a playbook must compose two or more steps");
    const stepIds = [];
    for (const [index, node] of value.stepGraph.nodes.entries()) {
        validateStep(node, prefix, index, artifactIdSet);
        stepIds.push(node.id);
    }
    unique(stepIds, prefix, "step ids");
    const stepIdSet = new Set(stepIds);
    const nodes = value.stepGraph.nodes;
    for (const node of nodes) {
        for (const dep of node.dependsOn) {
            invariant(stepIdSet.has(dep), prefix, `step ${node.id} depends on unknown step ${dep}`);
            invariant(dep !== node.id, prefix, `step ${node.id} cannot depend on itself`);
        }
    }
    assertAcyclic(nodes, prefix);
    invariant(isObject(value.budgets), prefix, "budgets are required");
    exactKeys(value.budgets, ["tokensPerRun", "judgmentNodesMaxTokens", "maximumCostPerRun"], prefix, "budgets");
    positiveInteger(value.budgets.tokensPerRun, prefix, "budgets.tokensPerRun");
    positiveInteger(value.budgets.judgmentNodesMaxTokens, prefix, "budgets.judgmentNodesMaxTokens");
    nonNegativeNumber(value.budgets.maximumCostPerRun, prefix, "budgets.maximumCostPerRun");
    invariant(isObject(value.retry), prefix, "retry is required");
    exactKeys(value.retry, ["maxAttempts", "preserveCompletedSteps"], prefix, "retry");
    positiveInteger(value.retry.maxAttempts, prefix, "retry.maxAttempts");
    invariant(value.retry.preserveCompletedSteps === true, prefix, "retry must preserve completed steps");
    invariant(isObject(value.resume), prefix, "resume is required");
    exactKeys(value.resume, ["enabled", "preserveCompletedWork"], prefix, "resume");
    invariant(value.resume.enabled === true, prefix, "resume must be enabled");
    invariant(value.resume.preserveCompletedWork === true, prefix, "resume must preserve completed work");
    invariant(isObject(value.timeout), prefix, "timeout is required");
    exactKeys(value.timeout, ["seconds"], prefix, "timeout");
    positiveInteger(value.timeout.seconds, prefix, "timeout.seconds");
    invariant(isObject(value.idempotency), prefix, "idempotency is required");
    exactKeys(value.idempotency, ["required", "keyFrom"], prefix, "idempotency");
    invariant(value.idempotency.required === true, prefix, "idempotency is required");
    stringArray(value.idempotency.keyFrom, prefix, "idempotency.keyFrom");
    invariant(isObject(value.gates), prefix, "a playbook without gates fails closed");
    exactKeys(value.gates, ["review", "action"], prefix, "gates");
    invariant(Array.isArray(value.gates.review) && value.gates.review.length > 0, prefix, "a playbook without a review gate fails closed");
    invariant(Array.isArray(value.gates.action), prefix, "gates.action must be an array");
    const reviewIds = [];
    for (const [index, gate] of value.gates.review.entries()) {
        invariant(isObject(gate), prefix, `gates.review[${index}] must be an object`);
        exactKeys(gate, ["id", "kind", "afterStep", "humanRequired", "modelCannotSatisfy", "outcomes", "artifactIds", "stopOnReject"], prefix, `gates.review[${index}]`);
        skillId(gate.id, prefix, `gates.review[${index}].id`);
        invariant(gate.kind === "review", prefix, `gates.review[${index}].kind must be review`);
        invariant(typeof gate.afterStep === "string" && stepIdSet.has(gate.afterStep), prefix, `gates.review[${index}] must follow a declared step`);
        invariant(gate.humanRequired === true, prefix, "review gates require a human");
        invariant(gate.modelCannotSatisfy === true, prefix, "model output cannot satisfy a review gate");
        invariant(Array.isArray(gate.outcomes) &&
            gate.outcomes.length === 3 &&
            gate.outcomes[0] === "accept" &&
            gate.outcomes[1] === "revise" &&
            gate.outcomes[2] === "reject", prefix, `gates.review[${index}].outcomes must be accept, revise, reject`);
        stringArray(gate.artifactIds, prefix, `gates.review[${index}].artifactIds`);
        invariant(gate.artifactIds.every((id) => artifactIdSet.has(id)), prefix, `gates.review[${index}] references an unknown artifact`);
        invariant(gate.stopOnReject === true, prefix, "review rejection must stop the run");
        reviewIds.push(gate.id);
    }
    unique(reviewIds, prefix, "review gate ids");
    const actionIds = [];
    for (const [index, gate] of value.gates.action.entries()) {
        invariant(isObject(gate), prefix, `gates.action[${index}] must be an object`);
        exactKeys(gate, ["id", "kind", "afterStep", "afterGate", "requiresReviewOutcome", "humanRequired", "modelCannotSatisfy", "mutationClass", "fallback"], prefix, `gates.action[${index}]`);
        skillId(gate.id, prefix, `gates.action[${index}].id`);
        invariant(gate.kind === "action", prefix, `gates.action[${index}].kind must be action`);
        invariant(typeof gate.afterStep === "string" && stepIdSet.has(gate.afterStep), prefix, `gates.action[${index}] must follow a declared step`);
        invariant(typeof gate.afterGate === "string" && reviewIds.includes(gate.afterGate), prefix, "an action gate must follow a review gate");
        invariant(gate.requiresReviewOutcome === "accept", prefix, "an action gate requires an accepted review");
        invariant(gate.humanRequired === true, prefix, "action gates require a human");
        invariant(gate.modelCannotSatisfy === true, prefix, "model output cannot satisfy an action gate");
        invariant(["draft", "publish", "spend", "account-change"].includes(gate.mutationClass), prefix, `gates.action[${index}].mutationClass is invalid`);
        invariant(gate.fallback === "human-action-manifest", prefix, "unverified actions must fall back to a human action manifest");
        invariant(gate.id !== gate.afterGate, prefix, "review and action gates must remain separate");
        actionIds.push(gate.id);
    }
    unique([...reviewIds, ...actionIds], prefix, "gate ids");
    const toolSteps = nodes.filter((node) => node.kind === "tool-operation" && node.failureBehavior !== "degrade");
    if (toolSteps.length > 0) {
        invariant(value.gates.action.length > 0, prefix, "a consequential tool step requires an action gate");
    }
    invariant(isObject(value.provenance), prefix, "provenance is required");
    exactKeys(value.provenance, ["sourcePath", "recordedAt", "proseCompositionKind"], prefix, "provenance");
    nonEmpty(value.provenance.sourcePath, prefix, "provenance.sourcePath");
    exactUtc(value.provenance.recordedAt, prefix, "provenance.recordedAt");
    invariant(value.provenance.proseCompositionKind === "compatibility-map-only", prefix, "prose composition is a compatibility map, not a registry entry");
    invariant(isObject(value.receipts), prefix, "receipts are required");
    exactKeys(value.receipts, ["required", "redaction", "includeToolOperations"], prefix, "receipts");
    invariant(value.receipts.required === true, prefix, "receipts are required");
    invariant(value.receipts.redaction === "required", prefix, "receipts must be redacted");
    invariant(value.receipts.includeToolOperations === true, prefix, "receipts must include tool operations");
    invariant(isObject(value.evalSignals), prefix, "evalSignals are required");
    exactKeys(value.evalSignals, ["criteria"], prefix, "evalSignals");
    invariant(Array.isArray(value.evalSignals.criteria) && value.evalSignals.criteria.length > 0, prefix, "evalSignals.criteria are required");
    const evalIds = [];
    for (const [index, criterion] of value.evalSignals.criteria.entries()) {
        invariant(isObject(criterion), prefix, `evalSignals.criteria[${index}] must be an object`);
        exactKeys(criterion, ["id", "description", "source"], prefix, `evalSignals.criteria[${index}]`);
        nonEmpty(criterion.id, prefix, `evalSignals.criteria[${index}].id`);
        nonEmpty(criterion.description, prefix, `evalSignals.criteria[${index}].description`);
        invariant(["artifact", "trace", "human-verdict", "observed-result"].includes(criterion.source), prefix, `evalSignals.criteria[${index}].source is invalid`);
        evalIds.push(criterion.id);
    }
    unique(evalIds, prefix, "evalSignals.criteria ids");
    invariant(isObject(value.finalDeliverable), prefix, "finalDeliverable is required");
    exactKeys(value.finalDeliverable, ["artifactId", "description", "accompanyingArtifactIds"], prefix, "finalDeliverable");
    invariant(typeof value.finalDeliverable.artifactId === "string" && artifactIdSet.has(value.finalDeliverable.artifactId), prefix, "finalDeliverable.artifactId must be a declared artifact");
    nonEmpty(value.finalDeliverable.description, prefix, "finalDeliverable.description");
    stringArray(value.finalDeliverable.accompanyingArtifactIds, prefix, "finalDeliverable.accompanyingArtifactIds");
    invariant(value.finalDeliverable.accompanyingArtifactIds.every((id) => artifactIdSet.has(id)), prefix, "finalDeliverable references an unknown artifact");
    invariant(isObject(value.nextDecision), prefix, "exactly one next decision is required");
    exactKeys(value.nextDecision, ["id", "description"], prefix, "nextDecision");
    skillId(value.nextDecision.id, prefix, "nextDecision.id");
    nonEmpty(value.nextDecision.description, prefix, "nextDecision.description");
    invariant(isObject(value.activation), prefix, "activation is required");
    exactKeys(value.activation, ["requiredByPortablePlugin", "loadsAtPluginRuntime", "customerManagedCatalog"], prefix, "activation");
    invariant(value.activation.requiredByPortablePlugin === false, prefix, "registry activation is not required by the Portable Plugin");
    invariant(value.activation.loadsAtPluginRuntime === false, prefix, "the Portable Plugin must not load the playbook registry at runtime");
    invariant(value.activation.customerManagedCatalog === false, prefix, "a customer-managed catalog is forbidden");
}
export function validatePlaybookRegistry(value) {
    const prefix = "conquistador.playbook-registry";
    invariant(isObject(value), prefix, "playbook registry must be an object");
    exactKeys(value, ["schemaVersion", "productVersion", "activationRequiredByPortablePlugin", "loadsAtPluginRuntime", "records"], prefix, "playbook registry");
    invariant(value.schemaVersion === "conquistador.playbook-registry/v1", prefix, "schemaVersion must be conquistador.playbook-registry/v1");
    invariant(value.productVersion === "1.0.0", prefix, "productVersion must be 1.0.0");
    invariant(value.activationRequiredByPortablePlugin === false, prefix, "registry activation is not required by the Portable Plugin");
    invariant(value.loadsAtPluginRuntime === false, prefix, "the Portable Plugin must not load the playbook registry at runtime");
    invariant(Array.isArray(value.records), prefix, "records must be an array");
    const ids = [];
    for (const record of value.records) {
        validatePlaybookRecord(record);
        ids.push(record.id);
    }
    unique(ids, prefix, "playbook ids");
}
