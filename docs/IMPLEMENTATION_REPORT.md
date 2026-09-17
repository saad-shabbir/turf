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
| Disposable PostgreSQL migrations/RLS/RPC | PASS: seven suites, actual SQL roles and pgcrypto in PGlite |
| Generated iOS configuration | PASS: location-only mode, SQLCipher, no restricted entitlements |
| Native compilation | PASS: Xcode 26.4.1 device Release at commit 9d8e7b8 |
| Final locked native build and artifact inspection | Pending run 35183791189 |
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
pinning npm fixed that. The second compiled successfully but the secret scanner
misidentified a library prefix; its credential-shaped matching is now corrected.

## Toolchain and commands

Node 24.19.0, npm 11.6.1, Expo 57.0.23, RN 0.86.3, React 19.2.3,
Xcode 26.4.1 / iPhoneOS 26.4 SDK, iOS minimum 16.4, CocoaPods 1.17.0.
See TOOLCHAIN.md and committed locks for exact resolutions.

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
