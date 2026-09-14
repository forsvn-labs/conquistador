# Local state and recovery

The runtime stores instance identity, sessions, artifacts, review state, receipts, and
approved memory under `data.dir` in `conquistador.config.yaml`. Run lifecycle commands
with that configuration selected through `CONQUISTADOR_CONFIG`. Paths below are
relative to the data root. Stop the service before backup, restore, or erase.

```sh
node runtime/bin/conquistador.js backup create --file backups/before-change.json
node runtime/bin/conquistador.js backup verify --file backups/before-change.json
node runtime/bin/conquistador.js migrate --check
node runtime/bin/conquistador.js data export --scope all --file backups/export.json
```

Backup containers include a closed inventory, stored content digests, and a manifest
digest. Secret-shaped content is redacted. Keep separate copies of credentials in your
secret store. A backup is not a credential backup or proof that every sensitive value
was detected. Exports contain portable artifacts, approved memory, redacted receipts,
and provenance in plain JSON.

To restore a verified backup to the same instance:

```sh
node runtime/bin/conquistador.js restore --file backups/before-change.json
```

Restore rejects unsupported schemas, unsafe paths, changed content, cross-instance
ambiguity, and state collisions. It does not merge unrelated sessions. Interrupted
restore work is journaled and resumed by the next restore or migration apply.
`migrate --apply` refuses unknown schemas; it does not invent a conversion.

Erase requires an exact scope and an explicit recoverability choice. Replace
`SESSION_ID` with the specific session you intend to remove:

```sh
node runtime/bin/conquistador.js data erase --scope session:SESSION_ID \
  --confirm session:SESSION_ID --recoverability backup
```

The `backup` choice requires a prior successful backup receipt. Verify and copy the
backup before erasing. `--recoverability decline` explicitly gives up that requirement.
Use `all` only when you intend to erase all supported state in this data root.
Lifecycle receipts remain an audit trail; backups are separately owned containers.

Session persistence supports restart recovery, but an in-memory message queue is not
durable. After cancellation, shutdown, or an ambiguous network failure, inspect the
session and its action status before retrying. Review and action secrets belong to
the operator. Restoring an artifact sidecar alone does not restore approval authority.
