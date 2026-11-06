# Visual walkthrough template

Use for a product guide or tutorial. Adapt to the reader's task; omit irrelevant sections.
API references may need request/response examples instead of UI captures. Keep small edits small.

```markdown
# [Do one useful thing]

[What you will achieve, in one sentence.]

[Verified image of the outcome, with alt text and a caption.]

## Before you start

[Only accounts, permissions, inputs, and setup needed for this task.]

## 1. [Take the first action]

[One short instruction with exact UI labels or a selectable command.]

[Actual screenshot with numbered callouts, next to the corresponding instructions.]

**You should see:** [Observable result.]

## 2. [Take the next action]

[Repeat at meaningful state changes. Use a short recording plus a still/text alternative
when the interaction cannot be explained clearly by one screenshot.]

## Check the result

[How you know the task is complete, with a real success-state image where useful.]

## If [specific problem occurs]

[Visible symptom → recovery action → expected result. Include an annotated error state
when it helps the reader recognize the problem.]

## How it works

[Only if needed: a focused Pele diagram and a short explanation of the flow or handoff.]
```

Keep capture provenance and reproduction notes in source comments or an asset manifest, not
in every paragraph. Keep original captures and editable annotation layers. Include alt text,
useful captions, and selectable text instructions. Label fixtures and mark missing visuals as
draft gaps. Do not publish placeholders as a finished guide.

Inspect the rendered result at normal and narrow widths. Follow the guide without source code
or extra explanation. Report actual checks and leave human usability acceptance pending until
an intended reader can complete the task.
