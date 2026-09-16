# Private dogfooding

Use one real task to check whether Conquistador helps in your actual host. Keep installation
checks, observed behavior, and your acceptance of the result separate.

## Install and check

1. Follow the [default skill installation](../INSTALL.md#skills-recommended). Use the complete root
   bundle, an account with private repository access, and the project where you intend to work.
2. Check the selected host and scope with `skills list`. Run the
   [installation doctor](../INSTALL.md#read-only-completeness-check) if your distribution includes it.
   Record missing files or stale paths before continuing. Older releases may need a newer complete
   distribution to supply the doctor.
3. Start a fresh host session and select Conquistador. Use a [task example](USAGE.md) with your own
   facts and files. Expect a finished deliverable, evidence gaps, and a next action. For a
   multi-part task, record whether a brief and receipt appeared, and whether child titles used
   public role labels.
4. Review the output yourself, then supply one correction or measured result. Check whether the
   follow-up preserves the facts and fixes the problem. A second unresolved material failure should
   remain a gap, not a hidden retry loop.

The default installer already copies the complete library. A listing or passing doctor does not
prove activation, independent review, useful output, or live account access. Those need their own
observations. Record the exact source commit when available; otherwise keep the supplied build
identity and mark the commit unknown.

## Connect accounts only when needed

Start with supplied context and existing permitted connections. If missing live access blocks the
task, Conquistador should explain Executor, help set it up, guide account sign-in through its UI,
verify the required operation, and resume. You should not need to know Executor beforehand.
Follow [connection guidance](INTEGRATIONS.md); do not paste secrets into chat.

A successful login or MCP discovery is not an account-operation result. Record those separately.
Eve jobs, runtime playbooks, and proactive hooks are optional, explicit exercises. If your task
needs visual feedback, use [Lavish preview](PREVIEW.md) and check that annotations return to the
agent and affect the source.

## Keep a small private record

Save notes in your own private project, outside the installed product:

```text
Build: source commit or supplied package identity; unknown fields marked
Host: name, version, model, installation route and scope
Checks: inventory, doctor, activation, and any account operation observed
Task: requested outcome and relevant source references
Result: what worked or failed, including evidence gaps
Correction: what you asked to change and what happened
Verdict: accepted, needs revision, or blocked, with a reason
Next check: the smallest task that can confirm the fix
```

Keep only what explains the result. Do not collect whole transcripts, customer data, or credentials
by default. An observation applies to that build, host, and task; it is not a general quality claim.

## Memory and feedback

A correction does not become memory automatically. Review the exact entry and destination before
saving it through the [memory workflow](LEARNING.md). Automatic cross-run retrieval and global
learning are absent.

Keep product feedback as a local redacted draft. Agree on a private recipient, destination, and
exact content before disclosure. The `submit-feedback` method's public-destination requirement
must not be bypassed for private dogfood notes. Memory approval is separate from feedback consent.

## Update and retry

Preserve local edits and use the [original installer's update procedure](INSTALL-REFERENCE.md#update-or-remove-an-installation).
Record the new build identity, check completeness, refresh the host, and repeat the smallest task
that exposed the problem. Keep the original observation for comparison. Outputs and runtime state
belong outside the installed copy and have their own retention rules.

The repository and dogfood artifacts remain private. The npm package stays `private: true`.
Local tests, package records, and doctor results do not grant public release or external-action
authority. Publication, visibility changes, and artifact sharing require explicit authorization.
