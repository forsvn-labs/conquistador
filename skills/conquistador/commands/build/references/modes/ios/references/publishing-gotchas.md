# Distribution failure patterns

Treat messages from Xcode Organizer, Transporter, and App Store Connect as primary evidence. Error
codes, states, metadata fields, and UI paths are volatile; verify their current meaning with official
Apple documentation before prescribing a consequential fix.

- **Wrong artifact identity:** local archive, uploaded build, and selected store build differ. Record
  bundle identifier, version, build, signing team, and archive checksum or Organizer identity.
- **Capability drift:** entitlements, identifiers, provisioning, privacy manifests, or usage
  descriptions disagree. Fix source and regenerate; do not patch an opaque binary.
- **Platform mismatch:** the target supports a device family that lacks required tested behavior or
  screenshots. Verify the real target settings and current store requirements.
- **Metadata drift:** field limits, categories, privacy/export answers, review access, or release mode
  were copied from stale guidance. Use the live form and current official docs.
- **Processing uncertainty:** upload started but the processed build or review state is not confirmed.
  Read App Store Connect state; never claim success from an upload command alone.
- **In-flight state conflict:** another build or review blocks the requested action. Preserve the
  existing state and ask for authority before cancelling, expiring, replacing, or releasing anything.
- **Credential exposure:** secrets, demo credentials, or tester data entered files or logs. Stop,
  contain exposure through the operator's credential process, and do not echo values.

When the environment lacks Xcode, signing, device, or account access, report those cells as untested
and give the exact next verification step. Do not invent a cloud-pipeline workaround.
