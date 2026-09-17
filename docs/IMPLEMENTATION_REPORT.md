# Milestone 1 implementation report

Scope: M1 only. Original specifications were read and preserved; roadmap sections
were not treated as authorization. No scores, shared visit feed, financial rules,
notifications, unknown-place inference or later-stage tables were created.

## Implemented

- Expo Router native app: sign-in, pairing, tracking, places, owner diagnostics,
  privacy/settings. No backend configuration produces an explicit error state.
- Supabase allowlist, RLS, owner-only raw data, six-character invites, persisted
  rate limits, immutable place revisions, one capture device and session binding.
- Module-scope geofence task before router boot, encrypted SQLite outbox,
  Keychain key, generation-aware pause, bounded retries, auth persistence and purge.
- Transactional idempotent ingestion, deterministic replay, uncertainty for initial
  state, incomplete visits, clock review, overlapping regions and session interruption.
- App-data deletion, admin-assisted Auth deletion instructions, opportunistic retention.
- Manual standard-Mac workflow, device Release packaging and artifact inspection,
  exact JavaScript lock and an observed native Podfile.lock.

## Changed files

New source is under `app/`, `src/auth/`, `src/db/`, `src/domain/`, `src/location/`,
`src/sync/`, `src/components/`, plus `index.ts` and `app.config.ts`.
Schema/RPCs and bootstrap: `supabase/migrations/`, `supabase/bootstrap.sql`.
Checks: `tests/`, `supabase/tests/`, `scripts/check-*.mjs`.
Build: `.github/workflows/`, `scripts/build-ios-unsigned.sh`,
`scripts/verify-ipa.sh`, `native-locks/Podfile.lock`.
Setup: `docs/SETUP_M1.md`, `docs/TOOLCHAIN.md`, package/TypeScript/lint files.
The supplied README/PRD/technical documents remain original specifications;
use SETUP_M1.md for current implementation setup.

## Verification

| Check | Result / evidence |
|---|---|
| Clean normal dependency installation | PASS on macos-26, run 35183366492 |
| TypeScript strict check | PASS locally and on Mac |
| ESLint | PASS locally and on Mac |
| Native-adapter unit tests | PASS: four tests including queue retry, auth generation and pause race |
| Disposable PostgreSQL migrations/RLS/RPC | PASS: ten suites, actual SQL roles and pgcrypto in PGlite |
| Generated iOS configuration | PASS: location-only mode, SQLCipher, no restricted entitlements |
| Native compilation | PASS: Xcode 26.4.1 device Release at commit 9d8e7b8 |
| Packaging validator fixtures | PASS: four Python tests, plus reproduced Hermes string-boundary false positive |
| Final locked native build and artifact inspection | PASS: [run 35184213560](https://github.com/saad-shabbir/turf/actions/runs/35184213560), commit 0725676 |
| Download integrity and device platform | PASS: matching SHA-256 and independent Mach-O iOS platform inspection |
| Hosted Supabase migration/bootstrap | NOT APPLIED: no project configuration supplied |
| Full Supabase/GoTrue/PostgREST and pgTAP | NOT RUN: no Docker/Supabase local stack |
| Concurrent independent DB connections | NOT RUN: PGlite tests serialize SQL; lock/index behavior is exercised sequentially |
| Native SQLCipher absent/wrong-key runtime test | NOT RUN: on-device diagnostic implemented |
| SideStore installation | NOT TESTED |
| Locked-screen/background capture | NOT TESTED |
| Two-phone acceptance | NOT TESTED |

PGlite Auth identities are disposable fixtures. Native unit tests substitute adapters,
so they do not establish encryption, OS execution, or real location delivery.
The first Mac run failed lock validation; clean cross-platform lock generation and
pinning npm fixed that. The next two compiled successfully but the secret scanner
misidentified a library prefix and then adjacent Hermes strings. This was reproduced
with a harmless compiled fixture. Inspection now decodes the Hermes string table
before matching credential-shaped values and retains admin-JWT rejection.

The final native app source is the same as commit 05ab059. Later commits add
artifact checks, SQL clock-edge hardening, tests and documentation; no later
milestone or changed native app behavior is included.

## Toolchain and commands

Node 24.19.0, npm 11.6.1, Expo 57.0.23, RN 0.86.3, React 19.2.3,
Xcode 26.4.1 / iPhoneOS 26.4 SDK, iOS minimum 16.4, CocoaPods 1.17.0.
Ruby 3.4.10 (arm64-darwin25) on the successful runner.
See TOOLCHAIN.md and committed locks for exact resolutions.

## Actual artifact

`outputs/ios/Turf-unsigned.ipa` in the Codex task workspace: 12,035,971 bytes.
SHA-256: `3632d63e33c3b20afaa9b06903a0270b83288808aab19dae51f8e6950ed1f53c`.
The checksum and actual toolchain summary are saved beside the IPA.
The private GitHub run also holds the artifact for one day.

This is a real unsigned physical-device standalone Release, built without backend
variables. It is a shell smoke-test artifact, not a configured two-user deployment.
Signing/installation and actual background operation remain unverified.

Commands executed include `expo install`, clean `npm install --package-lock-only`,
local `tsc --noEmit`, `eslint .`, `node --test --test-isolation=none` for local and DB
suites, `expo config --type introspect`, native config validation and type generation.
Mac ran normal `npm ci`, all JS/DB checks, `expo prebuild --platform ios --clean
--no-install`, CocoaPods, and signing-disabled `xcodebuild` for `iphoneos` Release.

## Setup and next human test

Apply migrations 001 → 002 → 003 to the chosen Supabase Free project, disable
public sign-up and run the admin bootstrap for two confirmed Auth UUIDs. Supply only
the URL and publishable key in GitHub variables, then build with backend validation.
No admin key or Apple credential belongs in the app or build.

For the shell smoke test, sign/install the unsigned IPA with your own SideStore
account and open Turf with Windows/Metro off. The unconfigured shell must clearly
say that its backend is not configured; it cannot log in or collect visits yet.

For full field acceptance, follow SETUP_M1.md's nine steps and the original
FIELD_TEST_CHECKLIST.md on both iPhones. Start outside a saved boundary, lock the
screen, enter and exit twice; verify owner-only server persistence, offline retry
without duplicates, and Pause both online and offline. Record update/renewal and
force-quit/reboot behavior separately. No device result is inferred from this report.
