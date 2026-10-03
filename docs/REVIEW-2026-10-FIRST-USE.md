# First-use integrity review (unshipped)

This change set starts from `24d9d3713c277a15032b9192aec77a882995e2da` on
`private-alpha`. The published npm release remains 0.2.2. This record describes source changes
and the evidence collected for them; it is not release, deployment, or model-quality approval.

## Fixed and deferred findings

| Finding | Source change | Evidence boundary |
| --- | --- | --- |
| S1: stale private bot files after exclusion | Fresh staged exports, verified ownership inventory, exact upload list/counts, rollback; `--no-private` avoids private indexing | Synthetic playbooks only; old remote uploads are not removed. Legacy local packs require a fresh directory |
| S2: task `--dry-run` ignored | Parse before effects; TTY/non-TTY previews perform no writes, registration/version calls, clipboard writes, or task launches | Real Linux PTY with synthetic host executables; no model calls |
| S3: incomplete payload passes health | Package-authoritative SHA-256 inventory for the plugin subset; validate source, staging, installed methods/resources/hooks/bootstrap and manifest | File integrity, not host activation or answer quality |
| S4: attempted/old reads accepted | Pair current-task calls and successful results; require exact file identity and complete returned text/digests; explicit omitted/unavailable/incomplete states | Synthetic transcript formats; unscoped/rotated/oversized transcripts fail open without claiming reads |
| S6: receipt mistaken for readiness | Recheck selected host registration and local content; show recorded versus observed registration and unverified activation/trust | Stubbed CLI registration checks; real host trust/loading requires separate acceptance |
| S7: broken retry instruction | Failed selected-host installation prints `add AGENT --yes` | Retry executed against synthetic CLI |
| S9: ambiguous arguments | Explicit `task WORD`, strict start/install/removal options, target choice before mutation; reject unsupported brief/bot/playbook flags | Older project/operator routes retained, including standalone `--dry-run` |
| S11: uninstall ownership unclear | Name the selected/all registration scope, preserve playbooks/config/exports, and document separate npm CLI removal | Synthetic lifecycle fixtures |
| Premium first-use/discovery | Three bounded starter tasks and complete synthetic examples with correction checks; public release/source behavior distinguished across docs | Author-written examples, not observed model output or user acceptance |
| Acquisition website | Not changed | Separate landing repository unavailable through connected GitHub access (404); deployed page not verified |
| S5: private search-to-read mismatch | Deferred | No claim that absolute private search results can be read through every MCP route |
| S8: HTTP publication privacy defaults | Deferred | Non-loopback unauthenticated configuration and inherited private roots remain a conditional risk. No live server exposure was observed; hosted publication needs a separate fix/review |
| S10: long-lived private index freshness | Deferred | Added/edited/deleted private files may require restarting the long-lived process |

## Baseline reproduction

- Synthetic private export followed by exclusion retained `99-your-playbooks.md` and incorrectly
  reported private inclusion on the original commit
- Original task `--dry-run --no-open` in a Linux pseudo-terminal wrote `installs.json` and ran
  two Codex registration commands against a synthetic executable
- Removing `skills/write-copy/SKILL.md` or replacing the hook still returned payload-current on
  the original commit
- Original hook logic accepted call arguments without matching successful results and treated
  an earlier brief invocation as coverage

All reproduction writes used disposable homes and harmless fixtures. No customer playbooks,
credentials, account sign-in, publication, or paid model calls were involved.

## Local acceptance ledger

Local Linux x64 / Node 24.19.0 build passed; all **831 tests** passed (307 tooling, 294 runtime,
167 catalog, 63 Eval Lab), plus **117/117** offline routing checks and the 17-operation catalog
validation. Maintained runtime output and diff whitespace checks are clean. Root-config lint
still reports existing debt, with **zero introduced/changed-line diagnostics** across the 21-file
reviewed scope (710 current versus 809 baseline); all five new code/test files lint clean.
Independent read-only review cleared the requested scope. CI results belong to the exact
submitted commit and are reported on the pull request. See [PROGRESS](../PROGRESS.md).
Checks distinguish these layers:

| Layer | Coverage in this change |
| --- | --- |
| Argument errors, dry-run, cancellation | Synthetic regression suite plus real Linux PTY dry-run |
| Selected-host install, host-side removal/repair, update, uninstall | Synthetic executables and isolated homes; preserved unrelated hosts and user artifacts |
| Export replacement and recovery | Private exclusion, removed/empty roots, repeats, foreign/edited/symlink refusal, staging failure and rollback |
| Payload completeness | Missing/tampered methods, resources, hooks, bootstrap and manifest; invalid sources preserve last good copy |
| Knowledge delivery guard | Successful current-task paired results, failed/stale/partial/missing evidence and fail-open cases |
| Starter routing and documentation | Offline routing checks, local links, three synthetic full outputs and revisions |
| Native agent activation and hook trust | Not run locally; CI install checks, if available, are reported separately for their exact commit/platform |
| First useful model output and correction quality | Not run; use the [acceptance checklist](PUBLIC-ALPHA.md) in a real authorized host |
| Live provider/authentication and human verdict | Not run |
| Website and release lifecycle | No website access; no release, merge, or deployment performed |

The maintained native-agent E2E harnesses use explicit all-host or selected-host scope. Their
source updates alone are not execution evidence. Windows interactive start and other CPU
architectures remain unverified unless a recorded run explicitly covers them.
