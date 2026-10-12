# Conquistador docs site

This folder is the Mintlify site for <https://conquistador.app/docs>. `docs.json` is the
config and the navigation. Each `.mdx` file is one page. This folder is not in the npm package.

## Preview and check

Use Node 20.17 or later and Bun. From this folder:

```sh
bun install
bun run dev         # mint dev: preview at http://localhost:3000
bun run validate    # mint validate: strict build check
bun run links       # mint broken-links
```

From the repository root, the E2E test checks the site against the code:

```sh
node tools/e2e/docs-site.mjs                              # offline checks
node tools/e2e/docs-site.mjs --live http://localhost:3000 # also every page in a running preview
```

The report is `dist/e2e/docs-site/report.md`. The test fails when a CLI command, an MCP tool or
field, or a check rule is missing from the site, when a feature newer than npm 0.3.0 is not marked
"from 0.4.0", or when a page uses AI-writing tells.

## Rules for editing

- This site is the source of truth for use, the copy check, deployed agents, troubleshooting,
  and reference. `docs/CHECK.md` only points here. `INSTALL.md` stays the full install reference,
  because it ships in the npm package for offline readers; keep the install pages and INSTALL.md
  in step.
- Mark a feature that is on `main` but not in the current npm release with "from 0.6.0" (the
  next version). Keep the mark after the release: it tells readers of older installs what they lack.
- Write plain, short sentences: one idea per sentence, active voice, no hype.

## Set up hosting (one time, by the owner)

### 1. Create the Mintlify project

1. Sign up at <https://mintlify.com/start> on the free Starter plan.
2. When it asks for a repository, connect GitHub and select `forsvn-labs/conquistador`, branch
   `main`.
3. Install the Mintlify GitHub App. Choose **Only select repositories** and select
   `forsvn-labs/conquistador`.
4. In the dashboard, open **Settings > Git Settings**. Turn on **docs.json is in a subdirectory**
   and enter `/docs-site` (no trailing slash). Save. Mintlify deploys from that folder.
5. Note your Mintlify subdomain. It is the last part of the dashboard URL, for example
   `app.mintlify.com/forsvn/SUBDOMAIN`. The site is then at `https://SUBDOMAIN.mintlify.app`.

### 2. Serve it at `/docs` on the landing site

1. In the dashboard, open **Settings > Custom domain**. Turn on **Host at**, enter
   `conquistador.app`, and enter `docs` as the base path. Click **Add domain**. Do not point
   DNS at Mintlify: the landing Worker on Cloudflare keeps the domain.
2. The landing repository (`conquistador-landing`) already serves the docs: its Worker
   (`worker/index.ts`) proxies `/docs`, `/docs/*`, `/_mintlify/*`, `/mintlify-assets/*` and
   `/api/request` to `https://forsvn.mintlify.site`, and the landing CSP does not apply to those paths
   (Mintlify sends its own). Change the origin there only if the Mintlify subdomain changes.
3. Deploy the landing if you changed it. Open <https://conquistador.app/docs>, check that images, search,
   and the navigation work, and check the browser console for CSP errors.

Source: Mintlify, [Deploy at a subpath with Vercel](https://www.mintlify.com/docs/deploy/vercel)
and [CSP configuration](https://www.mintlify.com/docs/deploy/csp-configuration), checked
2026-10-07.

### 3. What you get on Starter

- `https://conquistador.app/docs/llms.txt` and `/docs/llms-full.txt`, generated.
- A search MCP server for the docs at `https://conquistador.app/docs/mcp`.
- The "Copy page" menu with ChatGPT, Claude, Cursor, VS Code, and MCP options (`contextual` in
  `docs.json`).

Mintlify also serves `/.well-known/mcp` and `/.well-known/llms.txt` discovery files. With the
subpath setup, they are under `/docs/.well-known/...`, not at the domain root. To publish them at
the root, add rewrites for those two paths too. This is optional and not tested.

### 4. Submit the repository to Context7

1. Merge the PR that adds `context7.json` to `main`.
2. Open <https://context7.com/add-library>, select the **GitHub** tab, paste
   `https://github.com/forsvn-labs/conquistador`, and submit.
3. Context7 reads `context7.json` and indexes only `docs-site/`.
4. Optional: to claim the library, add `url` and `public_key` from your Context7 team settings to
   `context7.json`.
