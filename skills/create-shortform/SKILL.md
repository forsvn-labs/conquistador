---
name: create-shortform
description: "Research, brief, and script production-ready short-form video. Use for TikTok, Instagram Reels, YouTube Shorts, founder demos, UGC-style concepts, hooks, storyboards, recuts, production specifications, or planning how future watch and qualified-response data will be judged."
metadata:
  version: 2.1.0

---

# Create a short-form video package

Build a production-ready short-form argument, not a generic script pasted into every vertical feed.

## Establish evidence and hypothesis

Define audience, costly moment, one communication job, product mechanism, proof, desired action, and
the behavior the video should test.

When current platform or trend evidence matters and access is available, inspect a dated sample large enough to distinguish a
pattern from an anecdote. Separate:

- durable attention/story mechanics;
- current platform formats and eligibility rules;
- ephemeral audio, edit, or trend signals;
- owned performance evidence.

Do not claim a trend from memory, manufacture VoC, or treat another account's benchmark as the user's
baseline. Use a supplied content-research catalog when one exists; otherwise flag the gap. The skill
must still produce a bounded package from operator-supplied evidence without a sibling skill.

## Script and storyboard the hero

Choose an opening that names a relevant task or decision and makes a promise the asset can fulfill.
Specify its visible action, speech or text as needed, and set timing through a comprehension check.
The [hook agent](agents/hook-agent.md) maps the promise to supporting evidence. Every following beat
must explain the task, demonstrate the action, state a needed condition or deliver the promised answer.

Provide timed voice/dialogue, on-screen copy, visual action, audio intent, captions, CTA, and the
source product/brand evidence. Use real UI or label representative material. Never invent product
behavior, users, metrics, or screen states.

For truthful UGC, identify the real consenting actor and disclose sponsorship, employment, gifted
access, or scripting where applicable. Do not present a scripted scene, paid actor, or representative
experience as an unsolicited customer testimonial.

## Create true platform recuts

Adapt the edit, hook, pacing, title/caption, payoff timing, and safe zones for each selected platform.
A crop or renamed export is not a recut. Verify current platform specifications before production.

Specify capture, aspect ratio, resolution, typography, audio, privacy/redaction, source files, and
fallback when rendering or product capture is unavailable.

Every motion package includes a still or poster frame and reduced-motion fallback that preserves the
claim, proof, captions, and action without depending on sound or animation.

## Produce the export bundle

After the brief passes, assemble a tool-agnostic export bundle only to the depth supported by the
available capture, brand inputs, and tools: manifest, per-shot prompts or shot requirements,
recommended production lane, and assembly/grade/subtitle notes. Missing brand files, project storage,
capture, or render engines constrain production verification but do not block a truthful brief.
Recommend a lane; the operator picks the engine. Do not invoke render APIs or publish.

## Plan evaluation and handoff

Define evaluation for one platform/version at a time using the source hypothesis. Pre-register the
sample/window, hook hold, retention/completion, qualified response, baseline comparability, and
confounders. Do not let future views override a failed business or audience signal.

Pre-register keep/drop/change, one next hypothesis, and what the next brief should do differently.
Actual post-launch interpretation belongs to `evaluate-shortform`; planned signals are not results.

## Deliver

Return the evidence boundary, audience/hypothesis, hero script, storyboard, platform recuts,
production package, measurement plan, and external-action boundary. Posting and paid amplification
remain human-owned.

Before delivery, load the recovered method instead of paraphrasing it. Brief and produce stay
separate phases.

**Brief / composition**

- [format](agents/format-agent.md), [voc-extraction](agents/voc-extraction-agent.md),
  [production-mode](agents/production-mode-agent.md);
- [hook](agents/hook-agent.md), [storyboard](agents/storyboard-agent.md),
  [audio](agents/audio-agent.md), [copy-pack](agents/copy-pack-agent.md),
  [platform-tailor](agents/platform-tailor-agent.md);
- [critic](agents/critic-agent.md);
- [shortform-brief-method](references/shortform-brief-method.md),
  [storyboard-grammar](references/storyboard-grammar.md),
  [caption-cta-rules](references/caption-cta-rules.md),
  [production-modes](references/production-modes.md),
  [hook-archetypes](references/hook-archetypes.md),
  [anti-patterns](references/anti-patterns.md),
  plus the matching platform pack by exact file from
  [platform intelligence](references/platform-intelligence/CONTRACT.md):
  [facebook](references/platform-intelligence/facebook.md),
  [founder-demo](references/platform-intelligence/founder-demo.md),
  [linkedin](references/platform-intelligence/linkedin.md),
  [linkedin-launch](references/platform-intelligence/linkedin-launch.md),
  [motion-background](references/platform-intelligence/motion-background.md),
  [newsletter](references/platform-intelligence/newsletter.md),
  [producthunt](references/platform-intelligence/producthunt.md),
  [reddit](references/platform-intelligence/reddit.md),
  [reels](references/platform-intelligence/reels.md),
  [shorts](references/platform-intelligence/shorts.md),
  [showhn](references/platform-intelligence/showhn.md),
  [tiktok](references/platform-intelligence/tiktok.md),
  [ugc](references/platform-intelligence/ugc.md),
  [x](references/platform-intelligence/x.md),
  [x-launch](references/platform-intelligence/x-launch.md),
  [youtube](references/platform-intelligence/youtube.md).

**Produce / export**

- [prompt-author](agents/prompt-author-agent.md),
  [produce-critic](agents/produce-critic-agent.md);
- [video-brief-schema](references/video-brief-schema.md),
  [production-lanes](references/production-lanes.md),
  [production-pattern](references/production-pattern.md),
  [produce-quality-gate](references/produce-quality-gate.md),
  [produce-anti-patterns](references/produce-anti-patterns.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
No canonical brand file, research artifact, project store, renderer, or sibling skill is required.
