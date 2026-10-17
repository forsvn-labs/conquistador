# Conquistador CLI

This package is the short command name for `@forsvn/conquistador`. It delegates to that exact
version. It has no install scripts and keeps the playbooks in the main package.

```sh
npx conquistador@latest skills
npx conquistador@latest install
npx conquistador@latest mcp
npx conquistador@latest plugins
```

For app imports, install `@forsvn/conquistador` as a production dependency. See
[installation](https://conquistador.app/install).

Maintainers: publish the main package first, then this package at the same version. Update both
the version and exact dependency together. The initial short-name publication and npm trusted
publisher setup require release approval. This source file does not establish registry availability.
