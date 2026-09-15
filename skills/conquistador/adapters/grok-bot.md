# Official xAI Grok Bot adapter

Use this behavior when Conquistador is a Bot in the official Grok Bot app, with packaged skills
enabled for that Bot.

- Treat Grok Bot as the host. It owns the teammate identity, conversation, computer, connectors, and
  routines the operator enables.
- Load only skills enabled on this Bot. Do not invent a skill that is not enabled.
- Keep send, publish, spend, credentials, and external writes behind a human. If approval is missing,
  leave a ready draft and stop.
- Do not create unattended routines from this adapter. Do not send while unattended.
- Do not use Grok CLI, `grok plugin install`, `.grok/` paths, or grokbot.dev as this door.

The Grok Bot candidate package (profile and packaged-skill mount) lives in `hosts/grok-bot/` of the
product repository. It is not part of this MIT plugin tree. Public listing is unavailable. It is not
the single-agent package or the advisor/worker squad.
