# Integration recipes

Conquistador names capabilities, not providers. Each file here is a recipe for one capability in
[`capabilities.json`](../capabilities.json): the questions it answers, the Executor search
phrases, and hints for common providers. Any provider that Executor can reach works.

## Use a recipe

1. Run `executor tools search "<phrase>"` with a phrase from the recipe.
2. Run `executor tools describe <path>` on the best match and read its input schema.
3. Call the tool with `executor call <path> '<json>'`. Read-class tools run within host policy.
   Write-class tools need the user's explicit approval each time. Show the exact payload first.

## Add a provider

Add one row to the provider table in the matching recipe. Write what to search for and what the
tool needs (an account ID, a property ID, a date format). Do not add code.

## Add a capability

1. Add the capability to `capabilities.json` with `class`, `description`, and `search`.
2. Add it to the `uses` list of each command that can use it.
3. Add `integrations/<capability>.md` from the template below.

```markdown
# <capability>

<One sentence: what this capability reads or changes.>

## Answers

- <A question this capability answers.>

## Find the tool

Search phrases: `<phrase>`, `<phrase>`.

## Providers

| Provider | Search for | Needs |
| --- | --- | --- |
```
