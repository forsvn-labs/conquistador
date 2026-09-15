# Eve host options

`host.json`, `instructions.md`, and `capabilities.md` describe the existing portable
instructions-and-skills package. That package stays zero-runtime and does not install
Eve. The optional native app lives separately in [`runtime/`](runtime/README.md).

Keep `/conquistador` in the existing coding agent. Explicitly delegate a durable job
to Eve when the user requests it. A job has one Eve session and one parent. Installing
skills does not create jobs, start services, or grant external action authority.

The dependency-free [`jobs.mjs`](jobs.mjs) exports `prepareJob(options)` and `run(argv)`.
The root CLI can delegate `conquistador jobs` arguments to `run`. The CLI returns an
exit code and prints JSON. `prepareJob` returns its result without printing.

```text
prepare --destination ABS_NEW_DIR --owner ID --model PROVIDER/MODEL [--source ROOT]
submit --app DIR --url ORIGIN --message-file FILE
status --app DIR --url ORIGIN --session ID
resume --app DIR --url ORIGIN --session ID --message-file FILE
```

Prepare copies canonical skills byte-for-byte into a new private directory, records
SHA-256 hashes, and pins the app to one non-secret owner ID and random instance ID.
It rejects an existing destination, skill symlinks, and domain-restricted sources.
Domain restrictions must stay in the existing restricted host; this optional app does
not widen them. It never installs dependencies
or starts a process. `source` defaults to this full checkout. Method changes belong
in `skills/`, never in the Eve template.

Submit, status, and resume load the optional pinned `eve/client` package. They need
an explicitly running app, a host-supplied caller credential, and the trusted launcher's
`CONQUISTADOR_EVE_ORIGIN` binding. The requested URL must match that origin before any
network request. No model or network
call occurs when importing `jobs.mjs`, requesting help, or preparing an app. Commands
do not authorize actions. The separate operator interface is documented below.
