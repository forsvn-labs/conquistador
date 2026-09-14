"""Optional local draft aid. MIT. No network, persistence, or submission capability."""
import hashlib
import json
import re
import sys

DESTINATION = "https://github.com/forsvn-labs/conquistador/issues"
LIMIT = 120_000


def redact(text, private_fragments=()):
    # Pattern screening is intentionally incomplete; semantic privacy review is mandatory.
    for fragment in sorted(private_fragments, key=len, reverse=True):
        if fragment:
            text = text.replace(fragment, "[private material omitted]")
    patterns = [
        r'(?i)"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)"\s*:\s*"(?:\\.|[^"\\])*"',
        r"-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----",
        r"(?i)\b(?:authorization|cookie|set-cookie)\s*:[^\n]+",
        r"(?i)\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[=:]\s*[^\s,;]+",
        r"\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+)\b",
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        r"https?://[^\s<>]+",
        r"(?:/Users/|/home/|[A-Za-z]:\\Users\\)[^\n]+",
    ]
    for pattern in patterns:
        text = re.sub(pattern, "[redacted]", text)
    return text


def digest(preview):
    return hashlib.sha256(json.dumps(preview, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def prepare(data):
    if not isinstance(data, dict):
        raise ValueError("Expected selected input object")
    scope = data.get("scope", "excerpts")
    if scope not in ("summary", "excerpts", "full"):
        raise ValueError("Unknown scope")
    if scope == "full" and data.get("full_transcript_selected") is not True:
        raise ValueError("Full transcript needs explicit user scope selection")
    fragments = data.get("private_fragments", [])
    if not isinstance(fragments, list) or any(not isinstance(x, str) for x in fragments):
        raise ValueError("Private fragments must be selected strings")
    for key in ("title", "body"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError("Title and body are required")
    if len(data["title"]) > 256 or len(data["body"]) > LIMIT:
        raise ValueError("Reduce selected material to a reviewable preview")
    preview = {"destination": DESTINATION, "title": redact(data["title"], fragments),
               "body": redact(data["body"], fragments), "scope": scope, "attachments": []}
    return {"status": "Draft only — not submitted", "preview": preview,
            "preview_digest": digest(preview), "privacy_review_required": True}


def handoff(preview, consent, *, privacy_reviewed=False, connection=False, destination_verified=False):
    # Caller owns authentic user consent and single-use dispatch. This function never sends.
    if not isinstance(consent, dict) or consent.get("decision") != "approved":
        return "Draft only — not submitted"
    if consent.get("preview_digest") != digest(preview):
        raise ValueError("Preview changed; obtain consent to the new exact payload")
    if preview.get("destination") != DESTINATION or preview.get("attachments") != []:
        raise ValueError("Unsupported destination or attachment; use full manual preview")
    if not (privacy_reviewed is True and connection is True and destination_verified is True):
        return "Draft only — not submitted"
    return "Eligible for host submission — not submitted"


if __name__ == "__main__":
    try:
        raw = sys.stdin.read(LIMIT + 4097)
        if len(raw) > LIMIT + 4096:
            raise ValueError("Input exceeds local draft limit")
        print(json.dumps(prepare(json.loads(raw)), ensure_ascii=False, indent=2))
    except (ValueError, TypeError):
        print("Invalid selected input; no draft emitted", file=sys.stderr)
        sys.exit(2)
