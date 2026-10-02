# The no-argument menu

Read this when the user types `/conquistador` with no argument. They ask "what should I do next?"
Answer from the project state, not with a static list. Never run a command from the menu. The
user picks one.

## 1. Read the state

Run `conquistador signals --json` once (`npx @forsvn/conquistador signals --json` when
`conquistador` is not on PATH). If it fails, show the grouped list in step 3 and stop.

If `context.growth` is `null`, the project has no growth context. Lead with
`/conquistador init` and one line on why: "Record your product, goals, and channels once, so
every command starts from them." Then show the grouped list. Do not start `init` yourself.

## 2. Pick two or three commands

Otherwise lead with the two or three commands that have the highest value now. Give each one
the exact text to type and one reason taken from the signals. Reason over the signals; there is
no score to obey.

| Signal | Lead with |
|---|---|
| `launch.hint` is `unreleased` | `launch`: changes wait in the CHANGELOG "Unreleased" section. |
| `launch.hint` is `recent-release` | `social` or `lifecycle`: version `launch.latest.version` shipped `launch.latest.daysAgo` days ago. |
| `git.changedMarketingFiles` is not empty | `check <those files>`, then `critique <the main file>`. Name the files. |
| A changed file is a landing or pricing page | `convert <that page>`. |
| `stack` has analytics, and `executor.status` is not `running` | `connect`: read real numbers before you plan. Relay `executor.advice`. |
| `executor.integrations` is more than 0 | `diagnose` or `measure`: real data is connected. |
| `stack.analytics` and `stack.productAnalytics` are both empty, and `hasCode` is true | `measure`: no analytics found, so set up what to track. |
| `stack.email` is not empty | `lifecycle`: an email tool is installed. |
| `stack.payments` is not empty and `surfaces.pricing.count` is 0 | `pricing`: you take payments but have no pricing page. |
| `platform.found` has `ios` or `android` | `appstore`, or `trailer` when `surfaces.appStore.count` is more than 0. |
| `surfaces.blog.count` is more than 0 | `content` or `seo`: a blog exists. |
| `platform.found` has `web` and `surfaces.blog.count` is 0 | `seo` or `ideas`. |
| `context.growth.open` is more than 0 | `init`: GROWTH.md has open facts to close. |
| `hasCode` is false and no surfaces exist | `position`, then `plan`. |

Prefer a signal about current work (a launch, changed files) over a general one. Use the facts
in `GROWTH.md` to choose between equal picks: the goal and the channels that worked.

Format:

```text
Next for <product name from PRODUCT.md, or the folder name>:

1. /conquistador launch: CHANGELOG has unreleased changes for 1.3.0.
2. /conquistador check app/pricing/page.tsx: you changed the pricing page.
3. /conquistador connect: PostHog is installed, but Executor is not running.

Or pick any command:
```

## 3. Show the grouped list

Show the list after the picks. Keep one line per group.

| Group | Commands |
|---|---|
| Strategy | `position`, `brand`, `pricing`, `channels`, `budget`, `funnel`, `diagnose`, `prioritize`, `shape`, `decide` |
| Plan | `plan`, `gtm`, `campaign`, `launch`, `event`, `experiment` |
| Create | `copy`, `social`, `outreach`, `article`, `video`, `ads`, `creative`, `ideas`, `landing`, `vietnamese` |
| Run | `lifecycle`, `referral`, `outbound`, `press`, `content`, `series`, `paid`, `expand`, `interactive` |
| Grow | `seo`, `convert`, `answers`, `pseo`, `appstore`, `trailer` |
| Review | `check`, `audit`, `critique`, `factcheck`, `qa`, `review` |
| Learn | `measure`, `results`, `watch`, `report` |
| Product | `spec`, `flow`, `ui`, `architect`, `build`, `docs` |
| Setup | `init`, `connect`, `doctor`, `pin`, `unpin`, `feedback` |

End with one line: "Type `/conquistador <command>`, or describe the task in your own words."
