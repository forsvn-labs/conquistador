# TestFlight handoff

Use only for an explicit TestFlight preparation or distribution request. Do not assume a private
pipeline, vendor CLI, stored attempt, tester list, or App Store Connect authority.

## Choose the real scope

- **Internal testing:** team members with suitable App Store Connect access.
- **External testing:** people outside the team; current beta-review and test-information requirements
  must be verified with official Apple sources.

The operator must identify the account/team, app, exact processed build, group, audience, tester or
public-link policy, feedback route, and “What to Test” notes. Treat tester emails, demo credentials,
and public links as sensitive external state.

## Preparation

1. Verify the build from App Store Connect, not from a local archive name. Record version, build,
   processing state, signing evidence, export compliance, and expiry.
2. Verify current internal or external prerequisites against the authority map and live App Store
   Connect UI.
3. Prepare group intent, audience, tester handling, beta description, feedback email, review contact,
   demo-access plan when applicable, and build-specific test notes.
4. Present the exact mutation packet: build, groups, invite/public-link changes, notes, and whether an
   external beta-review submission is included.
5. After explicit approval, make only those changes with Apple-supported or source-inspectable tools.
   Read back group membership, build attachment, review state, and link status.

## Stops

- No compatible build or App Store Connect access: bounded handoff only.
- No explicit approval: do not upload, attach, invite, enable a link, submit, expire, or remove.
- Missing current Apple verification: label the dependent requirement unknown.
- Never place demo credentials, API keys, or tester lists in committed files or chat output.
