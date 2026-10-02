> **Tooling note.** The historical `ios-cli` opaque binary is **not shipped** with this skill. Do not require Vibecode, Chorus, or `./ios-cli`. Use host Xcode, `xcodebuild`, Simulator, Devices and Simulators, and App Store Connect / Transporter / approved source-inspectable tooling per [COMMAND.md](../../ios.md). Capability, gotcha, publishing, and screenshot guidance below remains useful; command examples that once called `./ios-cli` are reframed to host tools.

# iOS App Store Publishing

Publish an archived iOS app (`.xcarchive`) to App Store Connect — production review or TestFlight. Use host Xcode Organizer, Transporter, or `xcodebuild -exportArchive` with explicit human approval for credentials, uploads, and submission.

## CRITICAL RULES

1. **Do not call excluded opaque signing services or raw HTTP APIs.** Use host Xcode / App Store Connect tooling with explicit approval for credentials and uploads.
2. **App Store Connect API key auth is required for automated ASC calls.** Password / GSA auth is rejected for many publishing APIs. The API key needs Admin or App Manager role. Configure it in Xcode, Transporter, or `xcrun notarytool`/`altool` as applicable (see [First-Time Setup](#first-time-setup)).
3. **For App Store screenshots, see [screenshots.md](screenshots.md).** It has everything needed to produce App-Store-ready PNGs.
4. **Production needs full metadata.** Description, keywords, privacy/support URLs, primary category, copyright, review contact, and screenshots are required by App Store Connect's readiness gate. See [publishing-production.md](publishing-production.md) for the schema.
5. **Sign and upload with the same Apple team / API-key owner** that owns the app record. A mismatched team forces a rebuild or upload rejection.

## Environment

Host publishing uses Xcode Organizer, Transporter, or `xcodebuild -exportArchive` plus App Store Connect. Optional local config may include team/bundle identifiers — never commit `.p8` keys or passwords to the repo.

## Flow at a glance

1. **Auth** — configure App Store Connect API key auth in Xcode or Transporter (see [First-Time Setup](#first-time-setup)). One-time per API key.
2. **Build** — `xcodebuild` (or Xcode) archive for the target scheme/destination. Confirm team, bundle id, and signing match the ASC app record.
3. **Screenshots** (production only) — generate via [screenshots.md](screenshots.md), upload in App Store Connect, collect URLs into the metadata `screenshots` array when automating.
4. **Preflight** — run a publishing readiness checklist against metadata + archive before upload. See [publishing-readiness.md](publishing-readiness.md).
5. **Publish** — upload via Xcode Organizer / Transporter and submit for review (production) or distribute via TestFlight — both human-approved. See [publishing-production.md](publishing-production.md) or [publishing-testflight.md](publishing-testflight.md).

## Writing release notes (`whatsNew`)

For a new version of an existing app, `whatsNew` is required by App Store Connect's readiness gate (≤4000 chars). To author it: read the git log between the last shipped tag and HEAD, summarize user-visible changes (bullet points, present tense, no internal-tool names like "fix(auth)"). Keep it user-focused — what changed for the user, not what changed in the code. For first releases, `whatsNew` can be empty.

## Targets

- **`production`** — App Store submission. Goes through full metadata, screenshots, and readiness gate.
- **`testflight`** — internal or external beta. See [publishing-testflight.md](publishing-testflight.md).

## Tooling surface

Prefer Xcode Organizer, Transporter, and `xcodebuild -exportArchive` for the publishing surface. Do not require the excluded historical `ios-cli` binary.

## First-Time Setup

App Store Connect API key auth is the preferred path for automated publishing. The operator generates the key once at appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API. You'll need:

- **Issuer ID** (UUID at the top of the page)
- **Key ID** (per-key UUID after generation)
- **Private key file** (`.p8`, downloaded once at generation)
- **Team ID** (Apple Developer team)

Persist credentials in the host keychain / Xcode / Transporter — never in git. Re-configure only when the key rotates.

## Routing

- **Production submission** — see [publishing-production.md](publishing-production.md). Includes the metadata JSON schema.
- **TestFlight (internal or external)** — see [publishing-testflight.md](publishing-testflight.md).
- **Preflight check names + remediation** — see [publishing-readiness.md](publishing-readiness.md).
- **App Store Connect rules + ITMS errors + manual prerequisites** — see [publishing-gotchas.md](publishing-gotchas.md).
- **App Store screenshots** — see [screenshots.md](screenshots.md).