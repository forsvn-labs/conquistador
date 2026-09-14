# Apple platform authority map

Checked 2026-08-11. These are living primary sources; recheck the relevant page at execution time and
record the access date when a platform, privacy, capability, signing, or distribution claim affects the
result.

- [Xcode documentation](https://developer.apple.com/documentation/xcode) — project, build, test, and
  distribution entry point.
- [Human Interface Guidelines for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)
  and [accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
  — native interaction and inclusive design authority.
- [XCTest](https://developer.apple.com/documentation/xctest) — UI and performance testing authority;
  confirm current testing-framework guidance for the project.
- [Supported iOS capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-ios/)
  — membership and provisioning availability.
- [Privacy manifests and required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
  — app and third-party SDK declaration requirements.
- [Beta and release distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
  and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — TestFlight,
  submission, metadata, review, and policy boundaries.
- [App icon configuration](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
  — current Xcode asset/icon workflow.

Do not infer that a capability is available to an account, that signing is configured, or that a build
meets review requirements. Verify the actual membership, target, entitlements, archive, metadata, and
App Store Connect state with the operator before any protected action.
