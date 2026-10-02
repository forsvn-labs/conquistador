> **Tooling note.** The historical `ios-cli` opaque binary is **not shipped** with this skill. Do not require Vibecode, Chorus, or `./ios-cli`. Use host Xcode, `xcodebuild`, Simulator, Devices and Simulators, and App Store Connect / Transporter / approved source-inspectable tooling per [COMMAND.md](../../ios.md). Capability, gotcha, publishing, and screenshot guidance below remains useful; command examples that once called `./ios-cli` are reframed to host tools.

# Device Registration

For ad-hoc distribution, each tester's device UDID must be registered with the Apple Developer account before a profile that includes that device can be issued.

## Flow (happy path)

```
1. Connect the device or ask the tester for the UDID.
2. Register the UDID in the Apple Developer portal
   (Certificates, Identifiers & Profiles → Devices) or via
   Xcode → Window → Devices and Simulators.
3. Confirm Developer Mode is enabled on the device (see below).
4. Re-download / regenerate the ad-hoc provisioning profile so it includes the new UDID.
5. Re-sign or re-export the app (rebuild only if entitlements/targets changed).
6. Install via Xcode, Apple Configurator, or an approved distribution path.
```

If a device was added after the last export, the old provisioning profile will not include it — re-sign with a refreshed profile.

## Listing devices on the host

Use Xcode → Window → Devices and Simulators, or:

```bash
xcrun xctrace list devices
# or
xcrun devicectl list devices
```

Portal registration remains the source of truth for ad-hoc profile membership.

## Developer Mode

Devices must have Developer Mode enabled to install ad-hoc signed apps:

1. **Settings > Privacy & Security > Developer Mode**
2. Toggle ON
3. iPhone will prompt to restart — tap Restart
4. After reboot, confirm when prompted

Developer Mode persists across app installs — only needs to be enabled once.

## Important

- Devices must be registered **before** signing/export for ad-hoc. The provisioning profile created at export time includes the registered device UDIDs known to the portal.
- If a new device is added after a build was signed, re-sign/export with a refreshed profile (not necessarily a full rebuild).
- Creating identifiers, registering devices, and using Apple credentials require explicit human approval for the exact account.
