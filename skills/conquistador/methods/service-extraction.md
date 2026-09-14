# Service extraction method

Use privately only when an accepted product or marketing experience genuinely needs a durable service
or integration boundary.

- Define the user-visible responsibility and why host-native or in-process behavior is insufficient.
- Specify callers, data ownership, trust boundaries, API/events, idempotency, deadlines, retries,
  observability, backup/recovery, migration, deletion scope, and failure behavior.
- Keep provider-specific code behind a narrow adapter and preserve a local or manual fallback when the
  external dependency is unavailable.
- Resolve licensing, privacy, credentials, and operational ownership before implementation.
- Reject extraction that adds a background service, database, queue, or network dependency without a
  proven product need.

Return the bounded service contract, alternatives rejected, operational owner, acceptance evidence,
and explicit authorization still needed. This method never starts or deploys a service on its own.
