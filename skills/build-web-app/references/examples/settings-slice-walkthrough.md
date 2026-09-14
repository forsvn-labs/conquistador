---
title: Worked Example — Authenticated Settings Slice
lifecycle: canonical
status: stable
produced_by: build-web-app
load_class: EXAMPLE
---

# Worked example: authenticated settings slice

**This example is fictional.** The repository, stack, commands, and results are invented to show the
artifact shape of a completed slice. It is not evidence about any real project and does not count as
an execution of the skill.

## Invocation

> "In our Next.js app, let users change their display name and email notification preferences from a
> /settings page. It should work on mobile and be accessible."

## Inspection record

- Stack: Next.js 14 App Router, TypeScript, Drizzle ORM + Postgres, Tailwind, Vitest + Testing
  Library, Playwright; auth via existing session cookie middleware.
- Dirty state: one modified file `app/layout.tsx` (unrelated, belongs to another lane — untouched).
- Existing patterns: server actions for mutations, `zod` schemas shared client/server.
- No settings table exists. Migration required → slice classified **R2** (stateful), bordering R3;
  kept R2 because no PII beyond display name and email flags, both user-owned.

## Intent validation

- Flow: authenticated user opens `/settings`, edits display name, toggles two notification flags,
  saves, sees confirmation.
- States: loading (skeleton), unauthenticated (redirect to login), validation error (inline),
  save error (retry banner), success (toast).
- Trust boundary: mutation via one server action; input re-validated with the shared zod schema
  server-side regardless of client checks.
- Acceptance criteria: changes persist across sessions; empty name rejected with message; toggles
  reflect stored state after reload; keyboard-only path works.
- Non-goals: password change, email address verification flow, other users' data.

## Implementation

- Slice ID `settings-profile-basics`:
  - migration `0007_user_settings.sql` (additive; down provided);
  - `db/schema.ts` — `user_settings` table;
  - `app/settings/page.tsx` (server component loads state);
  - `app/settings/settings-form.tsx` (client form using shared schema);
  - `app/actions/update-settings.ts` (server action: session check → zod parse → update).
- Shared service extraction: none — single caller, deferred per method.

## Test contract execution

| Check | Command | Result |
|---|---|---|
| types | `npm run typecheck` | pass |
| lint | `npm run lint` | pass |
| unit (schema) | `npm test -- settings-schema` | pass (6 tests) |
| integration (action) | `npm run test:integration -- settings-action` | pass (4 tests incl. unauthorized case) |
| browser smoke | `npm run test:e2e -- settings.spec.ts` | **untested cell** — Playwright browsers not installed in this environment |
| migration down | scratch DB up/down/up | pass |

Environment: macOS 15, Node 22.x, Postgres 16 via scratch container.

## Deliverable

Implemented `settings-profile-basics`; changed files listed by slice; five of six contract checks
green; browser smoke is an explicit untested cell with blocker "Playwright browsers not installed"
and command for the human to run (`npx playwright install && npm run test:e2e -- settings.spec.ts`).

Rollout: additive migration, no data backfill needed, rollback = migration down + revert commit.
Risks: toast component assumes existing design system (verified against current tokens); email
preference currently has no consumer — flagged as intentional non-goal follow-up.

Human next steps: run the e2e cell, review migration naming convention, decide whether to deploy.
Nothing was deployed and no production claim was made.
