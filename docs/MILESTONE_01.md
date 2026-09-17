# Milestone 1 — Standalone install, pairing, and real private geofence observations

**Do only this milestone.** The full PRD describes the eventual game; it is not permission to implement later stages.

## Objective

A standalone Turf app can be installed on both iPhones through SideStore. Each user signs into an allowlisted Supabase account, pairs with the other, adds a named place, enables background monitoring, and sees their own real raw ENTER/EXIT events and derived visits in a debug screen. Offline callbacks persist and synchronize later without duplication.

No points or financial outcomes exist yet. The purpose is to prove the technical foundation on the actual phones.

## Build sequence inside this milestone

### M1.A — Prove the build route early

Create the Expo/TypeScript shell and native build scripts/workflow. Generate a physical-device Release IPA. A shell may show “Backend not configured” during the earliest smoke test; it must not simulate a connection. A configured full M1 build must use validated public project settings.

Record resolved toolchain compatibility and real artifact inspection. A missing Mac in the Codex environment is expected: the GitHub workflow compiles. A workflow definition is not a successful cloud build. If authenticated GitHub access is unavailable, leave runnable scripts and exact manual steps, and mark compilation NOT RUN.

### M1.B — Private backend and two users

Implement the M1 schema, grants, policies, SQL RPCs and security tests. Supply a reviewed admin-only bootstrap procedure for two existing confirmed Auth IDs; never hardcode Saad's or the friend's real credentials. Disable public sign-up in the setup guide and enforce the two-user allowlist regardless of dashboard configuration.

Implement email/password sign-in, recoverable persisted session, sign-out, invite create/join/expiry/rate limits, and a pending-pair screen. Include owner-controlled data/privacy settings. Two screens displaying the same placeholder names do not demonstrate pairing.

### M1.C — One named place and native capture

Implement current-location or explicit-coordinate place input with categories gym/work/mosque/home/custom, default radius 150m, validated bounds, and ownership. Supporting at least one enabled place per user is the field-test goal; registry logic must support the specified cap without duplicate registration.

Implement staged permissions and actual status display. Define/import the native task before router boot. Bind callbacks to the active device, capture session and immutable place revision. Persist a real callback locally before trying network delivery.

Implement pause/resume, permission-revocation recovery, local encrypted storage, background-capable session loading, bounded sync, idempotent ingestion, and deterministic incomplete/closed visit derivation. No continuous GPS polling, fake background timer, paid lookup, or notification SDK.

### M1.D — Diagnostics and evidence

Debug screen: permission states, registered task/regions, current session/device, last callback, last successful upload, queue count/age, safe errors, raw received ENTER/EXIT events, and derived own visits with incomplete/review flags. Show observed and received times separately. It must never display the friend's raw coordinates/places/visits.

A debug simulator is optional for automated/local testing. If added, keep synthetic events in a separate test-only store/path, clearly labeled, never counted as native evidence. The production geofence ingestion API must not expose an obvious “award fake visit” UI or imply cryptographic anti-cheating.

## Required deliverables

An actual runnable source project, lockfiles and TypeScript configuration; M1 migration files and RPCs; generated typed DB bindings; local database/session/outbox implementation; M1 screens and native config; unit/database tests; manual iOS workflow and packaging/verification scripts; updated setup/install documentation; and an honest test report.

Do not create dummy later-stage screens, fake score data, cloud resources you cannot access, a secret-containing seed, an empty IPA, or a simulator artifact labeled as an iPhone build.

## Automated acceptance tests

- Dependency install, strict typecheck and lint succeed.
- Unit tests cover duplicate ENTER, orphan EXIT, initial inside, valid sequence, interrupted session, reverse time, late upload, queue retry and expired session behavior.
- Auth/session storage tests cover persistence, locked-compatible key access contract, storage failure, logout purge and no cross-user queue leakage. Test an encrypted database is not readable without its key.
- Database migration applies to a fresh disposable instance. RLS tests execute as real app roles, not as admin. All `docs/DATABASE_AND_RLS.md` security cases are covered.
- Ingestion of the same event twice creates one event and one logical derivation. Foreign owner/place/session/device references are rejected.
- A callback is queued before network; a failed request is not marked uploaded; a resumed batch retains stable event IDs.
- Pause is effective before network completion. A delayed callback cannot write under an ended local generation.
- IPA build/inspection proves a device Release with embedded runtime and no forbidden signing dependencies, when CI access is available.

## Human acceptance tests

Use `FIELD_TEST_CHECKLIST.md` on both phones. Required observations include standalone startup with Windows/Metro off; login/pairing; real locked-screen outside→inside→outside; server persistence; an offline period followed by one-time sync; pause; and a normal app update/SideStore refresh. Read state without claiming guaranteed OS execution.

Record app/OS/SideStore versions and approximate test times. Do not paste precise location logs or passwords into public issue trackers. Force-quit/reboot results are informative limitations, not proof of always-on behavior.

## Stop rule

Stop after M1 code and its available tests. Do not start gym scoring, the shared feed, mosque commitment results, streaks, recaps, notifications, unknown-place inference, or payments. Report the smallest remaining human test or actual blocker.

## Completion report template

```text
Implemented:
Changed files:
Toolchain versions:
Commands executed:
Automated tests: PASS / FAIL / NOT RUN (each with evidence)
Database setup: APPLIED / NOT APPLIED (which project/environment, no secrets)
Cloud iOS compile: PASS / FAIL / NOT RUN
IPA inspection: PASS / FAIL / NOT RUN
Actual artifact path/link, only if produced:
SideStore installation: PASS / FAIL / NOT TESTED
Locked-screen geofencing: PASS / FAIL / NOT TESTED
Two-phone test: PASS / FAIL / NOT TESTED
Known limitations/blockers:
Exact next action for Saad:
```

A successful code review does not mark the hardware tests passed. No later milestone is authorized by this report.
