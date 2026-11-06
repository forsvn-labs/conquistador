# One Conquistador entry point

Conquistador is the parent for every included command, workflow, and management task.
Plain `Conquistador`, `/conquistador`, `Use Conquistador`, and the namespaced skill form
`$conquistador:conquistador` use the same named-command and workflow selection.

With no task, the parent returns short guidance for discovering capabilities. An unresolved
explicit request keeps the parent in control: inspect the installed catalog, select a supported
method, or ask a focused question if the missing choice affects the result. It must not silently
turn the request into unrelated work. Natural requests still use task routing; words such as
"to plan a launch" are not automatically interpreted as the `plan` command.

Document-first revision requests such as "the company documents are confusing, please improve
them using Conquistador" select docs. The parent loads the selected method before drafting;
checks afterward do not establish method use. Knowledge references retain their purpose rather
than gaining artificial tutorial steps. The local regression uses anonymized wording and does
not contain customer source documents.

For setup, status, updates, hooks, shortcuts, connections, and removal, the host consults the
installed CLI help and uses the supported operation. The brief itself is read-only. A method
MCP connection alone cannot change a host installation. Identify the actual installed surface
and version before updating: package publication does not update a plugin cache or hosted MCP.

Named workflows retain their declared order, conditions, and current-stage loading. The whole
library is not loaded to choose one task. Explicit opt-outs and domain/profile restrictions
continue to apply; a route grants no new action authority.

## Repeatable verification

```sh
node --test tools/parent-routing.test.mjs tools/docs-natural-routing.test.mjs
node tools/e2e/parent-routing.mjs
node tools/e2e/routing-breadth.mjs
node tools/e2e/context-footprint.mjs
```

The parent-routing report is written to `dist/e2e/parent-routing/report.json`. It covers the
complete bundled catalog through a fresh skill install and real local MCP stdio, with bounded
responses and parent-management cases. The breadth report covers natural language, scope,
negative requests, and workflow selection. The footprint report measures complete response
bytes; these are not model token counts.

This establishes selection and delivered guidance, not compliance by every host model, external
provider operations, human output quality, hosted deployment, or updates to installed plugins.
The terminal executable with no arguments still opens the installer; the plain-name behavior
above refers to invoking the skill in an agent or requesting a brief.
