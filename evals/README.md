# Conquistador Eval Lab

The optional Eval Lab provides typed evaluation contracts, exact candidate/provider selection,
run aggregation, blind-review and authority checks. Use it locally with the included synthetic
fixtures. A fixture result is not model execution, output quality, or human release acceptance.
The local SDK cannot activate production or grant authority for an external action.

## Public setup

Use Node 24. From this directory:

```sh
npm ci --ignore-scripts
npm test
npm run example:local
```

The default test suite uses included files and local temporary processes. It excludes the private
inventory-preflight, readiness-authority, historical benchmark records, and historical live-runner tests. `test:contracts` remains a smaller focused
selection. Neither command needs a private ledger or a Promptfoo installation.

The local example reads `fixtures/example-candidate.json`, `example-case.json`, and
`example-provider.json`, validates them, and calls `selectExactCandidate`. Its output explicitly
identifies synthetic fixture data, zero live executions, and no execution authorization.
It does not contact a provider, generate work, or create a candidate approval.

## Use the contract SDK

Node 24 can import the TypeScript modules directly:

```ts
import { selectExactCandidate } from './src/build-selector.ts';
import { validateCandidateBuild, validateEvalCase, validateProviderCell } from './src/validate.ts';

// Supply your own explicit objects, or use the synthetic files in fixtures/.
validateCandidateBuild(build);
validateEvalCase(evalCase);
validateProviderCell(providerCell);
const selection = selectExactCandidate(build, evalCase, providerCell);
```

See [the runnable example](examples/local-contract.ts), [schemas](schemas/eval-lab.schema.json),
and tests for complete fields. The SDK validates declared bindings; valid object shapes do not
prove that an external action occurred. Run aggregation, calibration, and review helpers retain
separate evidence and human authority requirements. Never label fixtures as live observations.

## Historical maintainer pipelines

`test:source`, `inventory:*`, and candidate-bound `promptfoo:*` execution/export commands belong
to the historical private evidence workflow. They require that workflow's exact committed
candidate, ledger, integrity records, and human/credential authority. The clean public repository
does not supply those private records or the serialized historical fixture/support-disposition bundle. These commands are not public setup prerequisites and
must fail closed when authority is absent. Do not fabricate a ledger or copy private receipts here.

Promptfoo remains an optional isolated dependency graph under `promptfoo-isolated/`, outside the
default module installation. Its pinned packages and safety verifiers do not authorize execution.
Do not install or run that graph just to use the public SDK. A genuine live host integration must
supply its own scoped Executor connection and explicit authority; local tests never grant either.
