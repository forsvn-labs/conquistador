# Optimize search and answer visibility

Do the search, AI-answer, or app-store work the user asked for in your own judgment from the user's
facts. Load no other file for it. Then run only the facts check: remove claims the facts do not
support, keep fair inferences, and add nothing (no hedges, no source text, no disclaimers). Return
only what the user asked for.

## Platform facts (checked Oct 2026; confirm in the current specs before use)

- **AI crawlers (robots.txt user agents):** OpenAI `GPTBot` (training), `OAI-SearchBot` (ChatGPT
  search), and `ChatGPT-User` (fetches a user asks for); Anthropic `ClaudeBot` (training),
  `Claude-SearchBot` (search), and `Claude-User` (fetches a user asks for); `PerplexityBot` and
  `Perplexity-User`; `Google-Extended` (Gemini training and grounding only; `Googlebot` still
  indexes for Search and AI Overviews); `Applebot-Extended` (Apple training only); `CCBot` (Common
  Crawl). Each name is a separate control. A directive is a policy, not proof that a page is
  excluded or cited.
- **Search snippets:** Google shows about 50–60 characters of a title and about 150–160 characters
  of a meta description. The cut is by pixel width and varies.
- **Rich results:** Google retired HowTo rich results in 2023 and FAQ rich results on 7 May 2026.
  FAQPage and HowTo remain valid schema.org types, but neither earns a Google search feature.
- **Disavow:** Google advises it only for many spammy or artificial links that caused, or are likely to
  cause, a manual action. A third-party "toxic" score is not a reason.
- **Apple App Store:** app name 30 characters, subtitle 30, keyword field 100 (comma-separated;
  non-Latin scripts can reach Apple's byte limit first, so confirm the count in App Store Connect),
  promotional text 170 (not indexed).
- **Google Play:** title 30 characters, short description 80, full description 4,000. Play has no
  keyword field; it indexes the description text.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
