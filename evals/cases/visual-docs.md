# Visual documentation acceptance tasks

Run these with the installed docs skill in the host being evaluated. Give the host access only
to the stated product and evidence. Save the prompt, exact skill/model version, final rendered
guide, original captures, annotation sources, capture manifest, and observed checks. Do not load
this evaluation into ordinary documentation tasks. Automated loading checks are not quality scores.

| Case | Request | Evidence to inspect |
| --- | --- | --- |
| First use | Explain how a new marketing teammate selects agents and completes Conquistador setup. | Current installer screens; fixture accounts explicitly labeled. |
| Recovery | Explain how to fix a failed contact import in the supplied test app. | Real error and corrected states; exact recovery sequence; no invented app. |
| Interaction | Explain a drag-and-drop interaction in a supplied UI. | Short recording, useful poster frame, equivalent text steps, keyboard alternative if supported. |
| Concept | Explain how approved content moves between the supplied systems. | Pele diagram grounded in actual handoffs, ownership and failure paths; text alternative. |
| Missing access | Write a UI guide with no running app or supplied captures. | Honest draft with a specific capture list; no fabricated screenshots or ready-to-publish claim. |
| Reference | Correct one API parameter description. | Focused correction; no forced screenshots, recording, or full-document rewrite. |

Ask an intended reader to perform each accessible task using only the guide. Record where they
hesitate, ask for help, choose the wrong control, or cannot recognize success. Have them explain
the conceptual flow in their own words. Record observations rather than invented success scores.

Accept a guide when the reader completes its task, every relevant visual matches the current
product, annotations and labels are readable at normal and narrow widths, media works in the
destination, text alternatives suffice without playback, and evidence gaps are explicit. Fail
on invented states, exposed private data, broken required media, or inability to identify the
next action or success. Revise from observed failure, then repeat that task with a fresh reader.

Local illustration: run `node tools/e2e/installer.mjs --only happy --out dist/e2e/visual-docs/installer`
and render its gallery with `tools/e2e/screenshots.mjs`. This exercises the real terminal UI with
fake account tools. It does not certify a live account installation or human comprehension.
