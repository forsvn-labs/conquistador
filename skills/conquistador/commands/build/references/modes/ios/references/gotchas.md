> **Tooling note.** The historical `ios-cli` opaque binary is **not shipped** with this skill. Do not require Vibecode, Chorus, or `./ios-cli`. Use host Xcode, `xcodebuild`, Simulator, Devices and Simulators, and App Store Connect / Transporter / approved source-inspectable tooling per [COMMAND.md](../../ios.md). Capability, gotcha, publishing, and screenshot guidance below remains useful; command examples that once called `./ios-cli` are reframed to host tools.

# Common Gotchas

## Build Issues

### `type X does not conform to protocol 'ObservableObject'` at compile time

**Cause:** Xcode 26's strict `MemberImportVisibility` requires `import Combine` in any file that declares `class X: ObservableObject` or uses `@Published`. Importing SwiftUI is NOT sufficient — `ObservableObject`, `@Published`, and `ObservableObjectPublisher` live in Combine.

**Fix:** Add `import Combine` at the top of every file that declares an `ObservableObject` conformance or uses `@Published`. Example:

```swift
import Foundation
import Combine          // ← required, even if this file also imports SwiftUI

final class MyViewModel: ObservableObject {
    @Published var value: String = ""
}
```

When writing any new class that conforms to `ObservableObject`, always include `import Combine`.

### Build can't find a scheme

**Cause:** The `.xcodeproj` doesn't have shared schemes.

**Fix:** Ensure the project has at least one shared scheme under `xcshareddata/xcschemes/`, or pass `-scheme <Name>` explicitly to `xcodebuild`.

## Signing Issues

### "You already have a current iOS Development certificate"

**Cause:** Apple limits the number of active development certificates. Creating another `IOS_DEVELOPMENT` cert fails with a conflict when one already exists.

**Fix:** Reuse the existing development certificate / managed signing in Xcode, or revoke an unused cert at
[https://developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
before creating a new one. Prefer Xcode automatic signing when the operator approves it.

### "This certificate can only be revoked by Apple Developer Program Support"

**Cause:** Some certificates are locked by Apple and can't be revoked via the API.

**Fix:** Try an alternate certificate type or Xcode-managed signing. If all fail, revoke or request support at
[https://developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates).

### "No registered iOS devices were found in App Store Connect"

**Cause:** No devices are registered with the Apple Developer account. Ad-hoc provisioning profiles require at least one device.

**Fix:** Register the tester UDID in the Apple Developer portal (Certificates, Identifiers & Profiles → Devices)
or via Xcode → Window → Devices and Simulators. Re-export/re-sign after the device appears on the portal so the
provisioning profile includes the new UDID.

### "App Store Connect request failed (401): NOT_AUTHORIZED"

**Cause:** Invalid API key credentials.

Common mistakes:

- **Wrong keyID** — the `.p8` filename is `AuthKey_{keyID}.p8`, use the ID from the filename
- **Wrong issuerID** — find it at App Store Connect > Users and Access > Integrations > Keys
- **Expired or revoked key** — check at App Store Connect

## OTA Install Issues

### "Unable to install" on iPhone

**Causes:**

1. Device UDID not in provisioning profile — register the device and re-sign
2. Bundle ID mismatch between app and profile
3. iOS version too old for the app's minimum deployment target

### Install button does nothing

**Cause:** OTA install requires HTTPS. The `itms-services://` protocol only works with HTTPS manifest URLs.

**Fix:** Serve the manifest and IPA over HTTPS, or install via Xcode / Apple Configurator / TestFlight instead of a custom OTA page. Historical cloud OTA hosts from the excluded `ios-cli` path are not used.

## Local / CI pipeline issues

### Build job stuck or never starts

**Cause:** No available macOS runner, Xcode version mismatch, or the CI queue is backed up.

**Fix:** Confirm the host has Xcode + the required SDK, re-run `xcodebuild` locally to isolate project errors, then retry CI.