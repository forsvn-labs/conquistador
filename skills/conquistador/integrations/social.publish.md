# social.publish

Publish, schedule, or delete a social post or reply.

This is a publish. Show the account, the exact text, the media, and the time. Get the user's
explicit approval for each post. Prefer a draft or a scheduled post the user can still cancel.
Run `conquistador check` on the text before you ask.

## Find the tool

Search phrases: `create social post`, `schedule post`, `publish tweet`.

## Providers

| Provider | Search for | Needs |
| --- | --- | --- |
| Buffer | `updates create` (queue or draft) | Profile IDs, text, optional media |
| X | `tweets create` | Text; media IDs from upload |
| LinkedIn | `posts create` | Author URN, commentary, visibility |
| Typefully, Hypefury | `drafts create` | Text; schedule |
| Instagram, Facebook | `media create`, then `media publish` | Business account ID, media URL |
