# Analyze video

Answer the user's question from the actual video and audio in your own judgment from the user's
facts. Load no other file for it. Then run only the facts check: remove claims the facts do not
support, keep fair inferences, and add nothing (no hedges, no source text, no disclaimers). Return
only what the user asked for.

## Platform facts (checked Oct 2026; confirm in the current specs before use)

- **Seeing the video:** an agent sees a local video through the Gemini API (`google-genai` Python
  SDK). Sending the file is an upload. Read exactly one of `GEMINI_API_KEY` or `GOOGLE_API_KEY` from
  the environment; never ask for a key in chat, print it, or pass it on a command line. Inspect the
  file with `ffprobe` first.
- **Limits and models:** re-check current upload limits and video-capable model names at
  https://ai.google.dev/gemini-api/docs/video-understanding before a call. If the agent cannot read
  files or run code, say so; do not claim to have watched the video.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
