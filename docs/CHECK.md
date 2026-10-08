# conquistador check

The rule catalog moved to the docs site: <https://conquistador.forsvn.com/docs/check>.
Its source is in this repository at [`docs-site/check.mdx`](../docs-site/check.mdx). It lists every
rule with its severity, channels, fix, and source, and explains channels, file formats, waivers,
and the edit hook.

Without network access, list every rule from the CLI:

```bash
conquistador check --rules          # every rule with its severity and name
conquistador check --rules --json   # also the message, fix, and channels
conquistador check --help
```

To add a rule, follow "Add a rule" in `docs-site/check.mdx`.
