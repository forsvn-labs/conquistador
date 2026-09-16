# Product roadmap

## Before private-alpha distribution

1. Complete FOR-247 and FOR-248 live acceptance on the exact reviewed operator build. Observe fresh
   host invocation, at least two visible specialist children, integration, initial exact-digest
   review, one targeted correction when requested, and one exact-digest re-review. Inspect the final
   receipt and cleanup. Two interrupted attempts remain partial evidence; tests do not close them.
2. Observe project activation in a host adapter that actually calls the request admission API.
   Check unrelated coding requests, manual/off settings, removal, and same-context fallback. Setup
   prepares files but does not register routing. Record host version, model, exact build and outcome.
3. Obtain the private-alpha distribution decision and authorized source reference. Check the exact
   ZIP, npm tarball, checksums and assembly record before any channel creation or distribution.
   Product version remains 0.1.0; do not infer a new version or tag. Keep the repository private and
   npm publication disabled. Historical dogfood tags and release facts stay unchanged.

Use the [private-alpha checklist](docs/PRIVATE-ALPHA.md). Installed file completeness, model output,
provider observations, human acceptance and release authority are separate evidence classes.

## Follow-up acceptance

- Verify Executor setup and task resumption with a separately authorized account operation. Observe
  permissions, cancellation and recovery. Discovery or login alone does not prove an operation.
- Check exact update identity across source copies, npm cache changes, Node changes, and host
  caches. Copies without Git still lack source commit provenance.
- Exercise optional previews, Claude hooks, and domain restrictions in the consuming host. Compact
  copies rely on host access enforcement. Native hook delivery remains unverified.
- Exercise an explicitly requested Eve job with a named owner, selected model and budget, approval,
  cancellation and saved-state recovery. Keep optional dependency pins until upgrades are reviewed.

The optional runtime has four declared playbooks. Additional model, vision, campaign-data and
catalog routes need their own authorized checks. Automatic learning promotion remains disabled;
a separate persistence-consent API and cross-run retrieval are future work.

Public distribution, registry publication, marketplace listings, visibility changes, and landing
work require a later explicit decision. Local tests and package assembly grant no such authority.
