---
name: results
description: "Evaluate real results from ads, outreach, or short-form video."
metadata:
  version: 1.1.0
---

# Evaluate results

Turn observed results into a bounded keep, revise, pause, or stop decision. Evaluate actual output and
actual numbers only. A plan, estimate, or modeled result is not a result.

## Pick the mode

| Mode | Use when | Read |
|---|---|---|
| `ads` | A paid campaign has delivery or outcome data. | [modes/ads.md](references/modes/ads.md) |
| `outreach` | A cold email, founder, partnership, or DM batch was sent. | [modes/outreach.md](references/modes/outreach.md) |
| `video` | A short-form video was rendered or published. | [modes/video.md](references/modes/video.md) |

Select the mode from the user's words (`/conquistador results ads`) or from the artifact. If the
evidence covers more than one mode, run each mode on its own evidence. Use `measure` for cross-channel
or downstream synthesis.

Read the selected mode file in full and follow it. Each mode lists its own playbooks.

Never invent metrics. Never spend, send, pause, or change a live account without explicit approval.

