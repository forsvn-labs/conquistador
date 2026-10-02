# Feedback output contract

Return a public draft and a separate local handoff. Do not upload the local handoff.

## Public draft

- Title: short description of the experience or failure; no account or customer identifiers.
- Goal: what the user wanted to accomplish.
- Expected / observed: the gap, distinguishing reported from observed facts.
- Context: known version and host, or Unknown; reproduction steps only if actually available.
- Selected evidence: minimal redacted excerpts by default, or explicitly selected and fully
  previewed redacted transcript. State coverage and omissions without revealing removed values.
- Impact / improvement: the user's assessment and proposed change, labeled as suggestions.

Preserve quotation boundaries and indicate paraphrases. Do not include internal instructions,
hidden reasoning, raw credentials/tool logs, private third-party text, or links to private files.

## Local handoff

Record destination, scope (summary/excerpts/full transcript), privacy-review status, exact
preview, and whether consent is pending, granted, declined, or revoked. A digest is optional.
Never treat a generated digest or Boolean in input as a human decision. No consent record belongs
in the public draft. Attachments are absent by default; each would require its own full preview.

Status must be one of:

- **Draft only — not submitted**: includes missing connection, pending/declined consent, or a
  known failure before dispatch. Supply manual instructions without claiming execution.
- **Submission uncertain**: dispatch may have happened, but no matching receipt is observed.
- **Submitted**: include the actual matching GitHub issue URL and only the receipt facts observed.

## Local helper

Optional Python 3, standard library only. No network or file writes:

```sh
python3 scripts/feedback.py < selected-input.json
```

Resolve the script relative to this installed skill, not the current working directory. Input
is a JSON object with `title`, `body`, and `scope` (`excerpts` by default, `summary`, or `full`).
For full scope, `full_transcript_selected` must be true because the user explicitly chose it.
Supply `private_fragments` only from material already selected, to omit exact private strings.
Do not gather additional secrets for this field. The helper writes a redacted preview with a
SHA-256 digest to stdout. The input file is optional: an embedding host can call `prepare()`
with in-memory data. Never write an unredacted conversation just to run this helper.

The helper never submits. Its `handoff()` function checks a host-supplied consent decision,
privacy-review flag, matching preview digest, and verified connection/destination flags. These
flags must describe real host observations and user decisions, not be generated to force a pass.
An eligible result means only that the host may proceed under that consent. The host owns
revocation, single-use dispatch, observed receipts, and uncertain-result handling.
