#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a new iOS SwiftUI project from the template.
#
# Usage:
#   bash bootstrap.sh [flags] <app-name> <bundle-id> <output-dir>
#
# Flags:
#   --dry-run          Print the plan without creating, modifying, or initializing anything.
#   --git-consent yes|no
#                      Explicit consent to run `git init`, `git add`, and an initial commit inside
#                      the NEW project directory. Default: no — no git commands are ever run.
#                      Equivalent env: CONQUISTADOR_BOOTSTRAP_GIT_CONSENT=yes
#                      (YES is also accepted; the value is case-folded.)
#
# Gates:
#   - Path gate: <output-dir> must be an absolute path whose parent exists, and must not sit inside
#     an existing git work tree (nested repositories are never created).
#   - Consent gate: git initialization/staging/commit requires explicit consent above.
#   - Idempotency gate: re-running against an already-bootstrapped matching output directory is a
#     no-op success; a mismatched or foreign existing directory is refused.

DRY_RUN=0
GIT_CONSENT="${CONQUISTADOR_BOOTSTRAP_GIT_CONSENT:-}"
POSITIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --git-consent)
      [ $# -ge 2 ] || { echo "Error: --git-consent requires a value (yes|no)" >&2; exit 1; }
      GIT_CONSENT="$2"
      shift 2
      ;;
    --git-consent=*)
      GIT_CONSENT="${1#--git-consent=}"
      shift
      ;;
    -*)
      echo "Error: unknown flag $1" >&2
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

[ ${#POSITIONAL[@]} -eq 3 ] || {
  echo "Usage: $0 [--dry-run] [--git-consent yes|no] <app-name> <bundle-id> <output-dir>" >&2
  exit 1
}

APP_NAME="${POSITIONAL[0]}"
BUNDLE_ID="${POSITIONAL[1]}"
OUTPUT_DIR="${POSITIONAL[2]}"

# Consent is fail-closed: only yes/YES grants git. Unknown values are rejected.
# The manifest records the normalized decision (yes|no), never the raw token.
CONSENT_RAW="${GIT_CONSENT:-no}"
CONSENT_LC="$(printf '%s' "$CONSENT_RAW" | tr '[:upper:]' '[:lower:]')"
case "$CONSENT_LC" in
  yes) GIT_CONSENT="yes" ;;
  no|"") GIT_CONSENT="no" ;;
  *)
    echo "Error: git consent must be yes or no, got: $CONSENT_RAW" >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../template"

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "Error: Template not found at $TEMPLATE_DIR" >&2
  exit 1
fi

# --- Path gate ---------------------------------------------------------------

case "$OUTPUT_DIR" in
  /*) ;; # absolute, fine
  *)
    echo "Error: Output directory must be an absolute path, got: $OUTPUT_DIR" >&2
    exit 1
    ;;
esac

PARENT_DIR="$(dirname "$OUTPUT_DIR")"
if [ ! -d "$PARENT_DIR" ]; then
  echo "Error: Parent directory does not exist: $PARENT_DIR" >&2
  exit 1
fi

# Refuse to create a project nested inside an existing git work tree.
INSIDE_GIT_ROOT="$(cd "$PARENT_DIR" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$INSIDE_GIT_ROOT" ]; then
  echo "Error: Output path is inside an existing git repository ($INSIDE_GIT_ROOT)." >&2
  echo "       Creating a nested repository there is not supported by this script." >&2
  exit 1
fi

# Derive identifiers from app name
SWIFT_NAME=$(echo "$APP_NAME" | sed 's/[^a-zA-Z0-9]/_/g')
if [[ "$SWIFT_NAME" =~ ^[0-9] ]]; then
  SWIFT_NAME="_${SWIFT_NAME}"
fi
if [ -z "$SWIFT_NAME" ]; then
  echo "Error: App name '$APP_NAME' does not produce a valid Swift identifier" >&2
  exit 1
fi

TEMPLATE_NAME="App Name"
TEMPLATE_SWIFT="App_Name"
TEMPLATE_BUNDLE_ID="com.example.App-Name"
MANIFEST="$OUTPUT_DIR/.conquistador-bootstrap.json"

# --- Idempotency gate ---------------------------------------------------------

PLAN_ACTIONS=(
  "copy template -> $OUTPUT_DIR"
  "rename dirs: $TEMPLATE_NAME{,Tests,UITests}.xcodeproj -> $APP_NAME..."
  "rename Swift files: ${TEMPLATE_SWIFT}* -> ${SWIFT_NAME}*"
  "substitute bundle id '$BUNDLE_ID', swift id '$SWIFT_NAME', name '$APP_NAME' in text files"
)
GIT_PLAN="none"
if [ "$GIT_CONSENT" = "yes" ]; then
  GIT_PLAN="git init + add + initial commit inside $OUTPUT_DIR"
fi

if [ -d "$OUTPUT_DIR" ]; then
  if [ -f "$MANIFEST" ] \
    && grep -q "\"app_name\"[[:space:]]*:[[:space:]]*\"$APP_NAME\"" "$MANIFEST" \
    && grep -q "\"bundle_id\"[[:space:]]*:[[:space:]]*\"$BUNDLE_ID\"" "$MANIFEST"; then
    echo "Already bootstrapped at $OUTPUT_DIR with the same app name and bundle ID."
    echo "No action taken (idempotent success)."
    exit 0
  fi
  echo "Error: Output directory already exists and was not created by this script with the same identity: $OUTPUT_DIR" >&2
  exit 1
fi

# --- Dry-run gate --------------------------------------------------------------

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY RUN — no changes will be made."
  echo "  app name:        $APP_NAME"
  echo "  bundle id:       $BUNDLE_ID"
  echo "  swift ident:     $SWIFT_NAME"
  echo "  output dir:      $OUTPUT_DIR"
  for action in "${PLAN_ACTIONS[@]}"; do
    echo "  plan: $action"
  done
  echo "  git actions:     $GIT_PLAN"
  exit 0
fi

# --- Execute -------------------------------------------------------------------

echo "Creating project '$APP_NAME' at $OUTPUT_DIR..."
echo "  Bundle ID: $BUNDLE_ID"
echo "  Swift identifier: $SWIFT_NAME"

cp -R "$TEMPLATE_DIR" "$OUTPUT_DIR"

# Rename directories (order matters — deepest first)
if [ -d "$OUTPUT_DIR/$TEMPLATE_NAME" ]; then
  mv "$OUTPUT_DIR/$TEMPLATE_NAME" "$OUTPUT_DIR/$APP_NAME"
fi
if [ -d "$OUTPUT_DIR/${TEMPLATE_NAME}Tests" ]; then
  mv "$OUTPUT_DIR/${TEMPLATE_NAME}Tests" "$OUTPUT_DIR/${APP_NAME}Tests"
fi
if [ -d "$OUTPUT_DIR/${TEMPLATE_NAME}UITests" ]; then
  mv "$OUTPUT_DIR/${TEMPLATE_NAME}UITests" "$OUTPUT_DIR/${APP_NAME}UITests"
fi
if [ -d "$OUTPUT_DIR/${TEMPLATE_NAME}.xcodeproj" ]; then
  mv "$OUTPUT_DIR/${TEMPLATE_NAME}.xcodeproj" "$OUTPUT_DIR/${APP_NAME}.xcodeproj"
fi

# Rename Swift files
if [ -f "$OUTPUT_DIR/$APP_NAME/${TEMPLATE_SWIFT}App.swift" ]; then
  mv "$OUTPUT_DIR/$APP_NAME/${TEMPLATE_SWIFT}App.swift" "$OUTPUT_DIR/$APP_NAME/${SWIFT_NAME}App.swift"
fi
if [ -f "$OUTPUT_DIR/${APP_NAME}Tests/${TEMPLATE_SWIFT}Tests.swift" ]; then
  mv "$OUTPUT_DIR/${APP_NAME}Tests/${TEMPLATE_SWIFT}Tests.swift" "$OUTPUT_DIR/${APP_NAME}Tests/${SWIFT_NAME}Tests.swift"
fi
if [ -f "$OUTPUT_DIR/${APP_NAME}UITests/${TEMPLATE_SWIFT}UITests.swift" ]; then
  mv "$OUTPUT_DIR/${APP_NAME}UITests/${TEMPLATE_SWIFT}UITests.swift" "$OUTPUT_DIR/${APP_NAME}UITests/${SWIFT_NAME}UITests.swift"
fi
if [ -f "$OUTPUT_DIR/${APP_NAME}UITests/${TEMPLATE_SWIFT}UITestsLaunchTests.swift" ]; then
  mv "$OUTPUT_DIR/${APP_NAME}UITests/${TEMPLATE_SWIFT}UITestsLaunchTests.swift" "$OUTPUT_DIR/${APP_NAME}UITests/${SWIFT_NAME}UITestsLaunchTests.swift"
fi

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

SAFE_BUNDLE_ID=$(escape_sed_replacement "$BUNDLE_ID")
SAFE_SWIFT_NAME=$(escape_sed_replacement "$SWIFT_NAME")
SAFE_APP_NAME=$(escape_sed_replacement "$APP_NAME")

sedi() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

find "$OUTPUT_DIR" -type f \( -name "*.swift" -o -name "*.pbxproj" -o -name "*.plist" -o -name "*.xcworkspacedata" \) | while read -r file; do
  sedi "s|$TEMPLATE_BUNDLE_ID|$SAFE_BUNDLE_ID|g" "$file"
  sedi "s|$TEMPLATE_SWIFT|$SAFE_SWIFT_NAME|g" "$file"
  sedi "s|$TEMPLATE_NAME|$SAFE_APP_NAME|g" "$file"
done

cat > "$MANIFEST" <<EOF
{
  "app_name": "$APP_NAME",
  "bundle_id": "$BUNDLE_ID",
  "swift_identifier": "$SWIFT_NAME",
  "bootstrapped_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_consent": "${GIT_CONSENT:-no}"
}
EOF

# --- Consent gate: no git commands run without explicit consent -----------------

if [ "$GIT_CONSENT" = "yes" ]; then
  cd "$OUTPUT_DIR"
  git init -q
  git add -A
  git commit -q -m "Initial project: $APP_NAME" 2>/dev/null \
    || echo "  Note: git commit skipped (no git user.name/user.email configured)"
else
  echo "  Git: skipped (no explicit consent). Re-run with --git-consent yes to initialize a repository."
fi

echo ""
echo "Project created at: $OUTPUT_DIR"
echo "  xcodeproj: $OUTPUT_DIR/$APP_NAME.xcodeproj"
echo "  scheme: $APP_NAME"
echo "  bundle ID: $BUNDLE_ID"
