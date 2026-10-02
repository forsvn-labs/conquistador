# One-shot Gemini video recipe

Official documentation checked 2026-09-14. This is a locally syntax-checked recipe, not a live
Gemini execution receipt. The control flow below is original project code; no SDK or third-party
sample is bundled with the skill.

## Prepare the selected file

Use a project-local Python environment with the official `google-genai` SDK. The current
[Interactions guide](https://ai.google.dev/gemini-api/docs/interactions-overview) specifies Python
SDK 2.3.0 or later. Record the installed version and recheck compatibility before execution.
Install dependencies only through the host's approved package manager. Never modify a global Python
installation merely to run this skill.

Inspect only the selected file. This read-only command handles spaces when the path stays quoted:

```sh
ffprobe -v error -show_entries format=duration,size:stream=codec_type,codec_name -of json "/absolute/path/to/video.mp4"
```

Check duration, streams, MIME type, the account's current upload limits and model context limit.
The current [video guide](https://ai.google.dev/gemini-api/docs/video-understanding) and
[Files guide](https://ai.google.dev/gemini-api/docs/files) disagree on some headline size limits.
Do not promise a maximum from this recipe. Verify the chosen account and request; stop on rejection
rather than repeatedly uploading or silently analyzing only part of the file.

The operator must permit the selected upload and any billed analysis. Supply exactly one of
`GEMINI_API_KEY` or `GOOGLE_API_KEY` privately in the process environment. The SDK gives
`GOOGLE_API_KEY` precedence when both exist, so resolve that ambiguity before a call. See the
[API-key guide](https://ai.google.dev/gemini-api/docs/api-key).

## Dispatch once, then clean up

Run this function only after those prerequisites are satisfied. Pass the chosen video-capable model
ID as `model`; do not guess a model name. Configure the host's network-call timeouts and overall
execution budget first. The 60-poll bound below limits processing checks, not the duration of an
individual SDK call. A host kill can prevent `finally` from running; treat cleanup as unconfirmed
in that case. Do not automatically retry a timed-out upload or analysis.

```python
import os
import time
from pathlib import Path
from google import genai


def analyze_once(path, question, model):
    video = Path(path).expanduser().resolve(strict=True)
    if not video.is_file() or video.stat().st_size == 0:
        raise ValueError("Select a nonempty video file")
    keys = [name for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY") if os.getenv(name)]
    if len(keys) != 1:
        raise ValueError("Configure exactly one Gemini API-key environment variable")
    if not question.strip() or not model.strip():
        raise ValueError("Supply a question and a verified model ID")
    outcome = {"text": None, "cleanup": "upload-not-confirmed"}
    uploaded_name = None
    with genai.Client() as client:
        try:
            uploaded = client.files.upload(file=str(video))
            uploaded_name = uploaded.name
            if not uploaded_name:
                raise RuntimeError("Upload returned no file identifier")
            for _ in range(60):
                state = uploaded.state.name if uploaded.state else None
                if state == "ACTIVE":
                    break
                if state == "FAILED":
                    raise RuntimeError("Video processing failed")
                time.sleep(5)
                uploaded = client.files.get(name=uploaded_name)
            else:
                raise TimeoutError("Video processing exceeded the polling budget")
            if not uploaded.uri or not uploaded.mime_type:
                raise RuntimeError("Processed video reference is incomplete")
            response = client.interactions.create(
                model=model,
                store=False,
                input=[
                    {"type": "video", "uri": uploaded.uri,
                     "mime_type": uploaded.mime_type, "processing": "static"},
                    {"type": "text", "text": question},
                ],
            )
            if response.status != "completed" or not response.output_text:
                raise RuntimeError("Analysis did not return completed text")
            outcome["text"] = response.output_text
        finally:
            if uploaded_name:
                try:
                    client.files.delete(name=uploaded_name)
                    outcome["cleanup"] = "file-deleted"
                except Exception:
                    outcome["cleanup"] = "file-deletion-unconfirmed"
                    print("Gemini file cleanup was not confirmed; report this to the operator.")
    return outcome
```

Catch provider exceptions at the host boundary and report the failed phase without raw request,
response, authorization headers, or secret-bearing exception text. If upload fails before returning
its identifier, cleanup cannot be confirmed. Preserve only the exact returned file identifier in a
private recovery note when available; never list or delete unrelated remote files. File deletion
is separate from request retention. This recipe uses `store=False` for a one-shot interaction and
makes no promise beyond the provider's documented retention controls.

Use the actual question plus a requirement for timestamped observations, uncertain speech/text,
and coverage limits. For example, request the moment an error appears and what the UI visibly does
next. Do not prefill a scene or timestamp as an expected answer.

## Review and coverage

Read the [critic](../agents/critic-agent.md) before delivery, in the same context if separate review
is unavailable. Include model ID, SDK version, covered duration or segment ranges, processing mode,
and cleanup outcome in the supporting notes. A completed response is evidence that a call returned,
not proof that every scene or word was inspected correctly.

This recipe uses static processing. For supported agentic models, the video guide documents
`processing="agentic"` and paired `processing_call`/`processing_result` steps. Inspect those records
before claiming agentic coverage. A search pass does not prove that an event never occurs elsewhere.
For segmented input, convert clip-local timestamps to source time with the stored segment start,
retain overlaps for checking, and merge duplicate findings. Verify a selected cut locally.

The exact API fields are documented in the
[Interactions reference](https://ai.google.dev/api/interactions-api). No model analysis, cleanup
receipt, or timestamped answer has been generated by this documentation check.
