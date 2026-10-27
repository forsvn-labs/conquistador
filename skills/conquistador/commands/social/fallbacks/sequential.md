# Sequential fallback

Use when one agent runs the whole method in one context. The method does not change.

1. Make the decisions in [the entry](../ENTRY.md) and read the channel file for the platform.
2. Draft the post. Compare it with the channel file's annotated pairs and cut.
3. Run [the check](../references/method.md) on the finished draft.
4. For a launch package, an optional review against [anti-patterns](../references/anti-patterns.md)
   may follow. It must not add words, disclaimers, or source lines to the post.

This is one context, not independent review. Nothing is posted, voted on, or replied to as the
account until the user approves the exact text and the action. Polish (`editorial-polish` or
`vietnamese`) comes last, after the check. Polish can change the text, so run the check again on
the polished text (facts, consent, and limits) before delivery or approval.
