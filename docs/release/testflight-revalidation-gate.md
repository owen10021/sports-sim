# TestFlight / App Store revalidation gate

Package A is proven on Node and under Hermes, and exports for iOS from Windows. It is **not** App Store ready until the steps below are re-verified at release time. Platform requirements change, so nothing here is assumed current.

Delivery path: EAS cloud build and submission (no local Mac build).

## Gate checklist (re-run before every TestFlight upload)

1. `npm ci && npm run ci` passes on a clean checkout (typecheck, tests, golden check, `expo export --platform ios`).
2. Golden fingerprint and event-chain head on a physical iPhone (Diagnostics screen) match `GOLDEN_EXPECTED`.
3. Re-check against current Apple documentation: minimum Xcode/iOS SDK for submission, privacy manifest and required-reason API declarations (expo-sqlite, expo-crypto), App Privacy answers, export-compliance (encryption) declaration, and App Store Connect metadata.
4. Confirm the Expo SDK in use is supported by EAS Build and the current TestFlight toolchain.
5. Run an EAS build for the `preview`/`production` profile and install via TestFlight on a real device.
6. On-device checks: background/resume, force-quit and relaunch, and save-fault recovery all behave as in the Package A acceptance contract.
7. Record build IDs, versions and dates in `evidence/` before promoting a build.

Any failed or unverifiable item blocks submission.
