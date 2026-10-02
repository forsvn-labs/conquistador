# Conquistador artifact kit

HTML templates for visual review in [Lavish](https://github.com/kunchenguid/lavish-axi). Each
template is one plain HTML file with inline CSS. There is no build step. Mermaid in
`funnel.html` loads from a CDN.

| Template | Use it for |
|---|---|
| `ad-set.html` | Paid social ad variants in feed, story, and landscape frames |
| `social-posts.html` | X, LinkedIn, and Instagram post frames |
| `email.html` | An email in an inbox row and an opened message |
| `landing-section.html` | A landing page section at desktop and mobile widths |
| `funnel.html` | A funnel as a Mermaid diagram, with stage definitions |
| `calendar.html` | A campaign calendar by week and channel |

## Use a template

1. Copy it next to the deliverable: `conquistador review kit <template> <destination.html>`.
2. Set the brand variables in the `:root` block from the customer's design system, `PRODUCT.md`,
   or `GROWTH.md`.
3. Replace each `[bracketed placeholder]` with the deliverable's text. Do not invent metrics,
   quotes, logos, or results. Leave a placeholder when the fact is not on hand.
4. Open it: `conquistador review <destination.html>`.

Put local images beside the HTML file and use relative paths. Lavish does not resolve
root paths such as `/logo.png`.

## Brand variables

| Variable | Meaning |
|---|---|
| `--brand-primary` | Main brand color, for buttons and accents |
| `--brand-on-primary` | Text color on the main brand color |
| `--brand-ink` | Body text color |
| `--brand-muted` | Secondary text color |
| `--brand-canvas` | Page background |
| `--brand-surface` | Card background |
| `--brand-line` | Borders |
| `--brand-font` | Body font stack |
| `--brand-heading-font` | Heading font stack |
| `--brand-radius` | Corner radius |
