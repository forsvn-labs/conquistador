# Registry fixtures

These records are contract fixtures for Skill Registry, Playbook Registry, routing, and verified operations.

They are not a customer-managed catalog. They are not loaded by the Portable Plugin. The playbook record is executable through the local runner. The rest of the fixtures are contracts, not live providers.

`playbooks/content-intelligence-loop.json` is the first compounding-loop playbook record. It is executable (`executionStatus: executable`). Skill steps run only through the durable judgment seam: the runner seals and persists a judgment request, then pauses at `awaiting-judgment` until a validated response arrives from an embedded provider or a CLI-imported file. No provider is installed by default, and stubbed completion is not a valid outcome. Unverified or unsupported tool operations emit a human action manifest instead of executing. There are no live credentials on this ticket.

`operations/v1.json` is the verified-operation catalog used by that playbook.

`inputs/content-intelligence-loop.json` is the fixture input for CLI and runner traces.

`router/capability-routes.json` is the versioned capability-router contract. Ambiguous or unmatched intent abstains. The Portable Plugin does not load it.
