# Hacker News

Use for Show HN posts, the maker's first comment, and replies.

## Decisions

- Show HN is for something people can try now. If it needs a sign-up or a waitlist, say so, or wait.
- The title states what it is and does, in plain terms. No adjectives, no claims of "best" or "first".
- The first comment, from the maker, says why you built it, how it works at the level a skeptical
  engineer wants, what it does not do yet, and where to try it. Mention price and licence plainly.
- Readers will test your claims. State a number only if they can reproduce it, and say on what.
- Answer every technical question directly, including the critical ones. Do not argue about tone.

## Platform facts (checked Oct 2026; confirm in the guidelines)

- A title holds 80 characters and starts "Show HN:" for a Show HN.
- The guidelines forbid asking for upvotes or comments, and posting from several accounts.
- Text with a link: the URL goes in the link field, and the explanation goes in the first comment.

## Annotated pairs

The people and products are synthetic. Nothing here was posted.

Show HN title and the maker's first comment for a command-line tool.

```strong
Show HN: Tallow – diff two CSV files by key column instead of by line

Line diffs fall apart on CSVs. Sort the file differently or add a column, and every line shows as changed. Tallow matches rows by a key column you name and reports added rows, removed rows, and changed cells.

It streams, so files larger than memory are fine. On my laptop (M2, 16 GB) it compares two 2 GB exports in about 40 seconds. It's a single Go binary, MIT licensed, no telemetry.

It does not handle composite keys or typos in key values yet. Tell me which you would need first.

Code and install steps: https://tallow.example
```

```weak
Show HN: Tallow – The Revolutionary AI-Powered Data Comparison Platform for Modern Teams

We're excited to share Tallow! 🚀 Tallow uses cutting-edge technology to transform how teams work with data. Join the waitlist today and please upvote if you like it!
```

**Why:** The strong post names the exact problem engineers have hit, gives a number they can check,
and says what is missing. The weak one cannot be tried, makes claims nobody can test, and asks for
upvotes.
