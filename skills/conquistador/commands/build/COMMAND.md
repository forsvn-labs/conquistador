---
name: build
description: "Build and verify a requested web or iOS app outcome."
metadata:
  version: 1.0.0
---

# Build an app outcome

Build only when the user explicitly asks for implementation. Marketing copy, a flow, or a UI brief does
not ask for code.

## Pick the mode

| Mode | Use when | Read |
|---|---|---|
| `web` | The outcome is a web product: pages, client and server state, data, auth. | [modes/web.md](references/modes/web.md) |
| `ios` | The outcome is a native iOS or iPadOS app in Swift or SwiftUI. | [modes/ios.md](references/modes/ios.md) |

Select the mode from the user's words (`/conquistador build ios`) or from the project. Read the
selected mode file in full and follow it. Each mode lists its own playbooks.

Use `flow` and `ui` first when the experience is not specified. Deploy, publish, or submit to a store
only with explicit approval.

