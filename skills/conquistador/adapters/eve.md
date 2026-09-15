# Eve adapter

Use this behavior when Conquistador is installed as an Eve agent (`agent/skills/`, Eve `load_skill`).

- Treat Eve as the host. It owns the model, sandbox, memory, channels, and connections.
- Load canonical skill trees from `agent/skills/<name>/`. Do not invent a sibling that is not on disk.
- Keep send, publish, spend, credentials, and external writes behind a human. If Eve has no approval
  tool for that action, leave a ready draft and stop.
- Do not enable Eve tools, hooks, MCP, channels, or schedules from this portable plugin. Those are
  not in the zero-runtime payload.
- Do not treat this adapter as the coding-agent plugin, official xAI Grok Bot, Grok CLI, the
  single-agent package, or the advisor/worker squad.

The Eve candidate package (instructions and mount recipe) lives in `hosts/eve/` of the product
repository. It is not part of this MIT plugin tree. Public Eve listing is unavailable.
