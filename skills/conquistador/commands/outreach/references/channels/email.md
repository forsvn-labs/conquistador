# Email

Write cold email as plain text from one person: no images, no HTML layout, no attachments, and no
tracking pixel. Craft rules are in [the craft reference](../frameworks/cold-email-frameworks.md).

## Subject, preview, and footer

- In plain text the inbox preview is the first body line. Make that line carry the fact; a greeting
  alone wastes it.
- Keep the subject true to the body. Never type "Re:" or "Fwd:" on a new message.
- Sign with a first name. Under it put the company, a postal address, and a plain opt-out line,
  such as: Reply "unsubscribe" and I won't email you again.

## Inbox and list basics

Copy cannot fix a bad list or a burned domain. Check these before the first send.

- Send cold email from a secondary domain or subdomain that clearly belongs to the brand, not the
  main company domain. Authenticate every sending domain with SPF, DKIM, and DMARC.
- Warm new inboxes before campaign volume, and spread volume across inboxes instead of raising one.
- Verify every address and remove duplicates and role addresses such as info@ before upload.
- Suppress unsubscribes, bounces, and complaints across every inbox and channel.
- Prefer a segment large enough to test on. A very small niche supports one careful send, not
  repeated tests.

### Starting points (Oct 2026)

Verify current provider rules before use, and replace these with the sender's own data.

| Item | Starting point |
|---|---|
| Warm-up for a new inbox | 2–4 weeks before campaign volume |
| New contacts per inbox per day | 20–30 |
| Bounce rate | Under 2%; pause the inbox above it |
| Spam complaint rate | Under 0.1%; the largest mailbox providers treat 0.3% as a hard limit |
| Unsubscribe | Honor at once; bulk senders also need one-click unsubscribe headers |

## Operator checks before any send

The operator verifies sender identity, address source, regional rules, suppression, unsubscribe
handling, domain setup, and the approved batch and cadence. A draft cannot verify deliverability,
and drafting changes no domain, inbox, list, or sending tool.
