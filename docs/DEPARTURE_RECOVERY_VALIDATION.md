# Missed departure recovery — September 30, 2026

## Observed report and confirmed code gaps

Ifti received an arrival notification at a climbing gym; the departure did not produce a session. His exact debug events and OS state are not available, so the specific device cause is not established.

The previous implementation depended on the iOS region EXIT callback to finish the visit. Its backup GPS callback retained in-place observations but never examined outside observations; foreground reconciliation only applied the existing four-hour estimated limit. GPS updates could also automatically pause. Re-registering geofences explicitly stopped capture, clearing the in-progress candidate and rotating its token.

## Implemented

- While a real visit is active, balanced-accuracy location updates use a 25-meter movement interval and do not automatically pause. They end at native departure, recovered departure, explicit Stop, or tracking pause. This trades some active-workout battery use for departure reliability; it does not start continuous updates for the entire day.
- Two usable outside fixes confirm a missed departure. They must be at least 30 seconds apart, each be no older than two minutes when processed, have accuracy 0–100 meters, and place the phone beyond the saved radius plus accuracy uncertainty plus a 75-meter buffer. Confirmation cannot bridge a gap over five minutes. An inside/boundary reading breaks the confirmation. Duplicate, future, invalid and stale fixes do not qualify.
- Only the outside observation timestamps are retained. Outside coordinates and routes are not saved. The first confirmed outside observation supplies the estimated end, not the time the app was opened and not an invented boundary-crossing time.
- An offline recovered EXIT is persisted in the existing encrypted outbox under its original owner and capture token. It is arrival- and timer-start-bound, so a concurrent Stop, Restart, new visit or account/capture change cannot complete the wrong workout. SQL migration `202609300013_classstreak_departure_recovery.sql` marks it estimated and ignores stale recovered events without re-arming the venue.
- Foreground reconciliation restores missing native registration and backup updates, then checks a recent cached fix and a fresh reading. Current-position lookup is bounded to eight seconds. The existing four-hour safety estimate remains only after attempting recovery; it is not presented as an exact departure.
- Re-registering an already active capture preserves its candidate, epoch, token and queued evidence, even while offline. A paused/new capture retains the existing ownership/epoch safeguards. The UI must call `startTracking()` directly after saving venue edits instead of first calling `stopTracking()`.
- Edits to the active place's coordinates/radius take effect after the current workout ends. The original candidate geometry and selected workout remain stable during that visit. Pending place configuration is stored locally, so this transition also works offline. Disabling the active place must be blocked in the UI until the workout is stopped; otherwise the existing server correctly rejects events for a disabled place.
- Background task failures and failures starting backup updates leave a diagnostic message instead of disappearing silently.

## Automated evidence

`node --test --test-isolation=none tests/departure-recovery-local.test.mjs` — 6 passed: location noise/freshness/confirmation, offline outbox and privacy, Stop/Restart/capture races, foreground repair, re-registration preservation, and deferred place geometry edits. These use native adapters; they do not prove iOS execution or encrypted storage behavior.

`node --test --test-isolation=none tests/classstreak-departure-recovery.test.mjs` — 2 passed in disposable PostgreSQL: estimated arrival-bound closure/idempotency/ownership, legacy events and short-visit rejection.

Existing `active-workout-local.test.mjs` — 1 passed; `sync-recovery-local.test.mjs` — 2 passed. Focused ESLint passed.

`classstreak-live-studio.test.mjs` — 1 passed: new authenticated `cs_studio_live` excludes legacy demo fixtures/count flags, preserves real board/privacy/opt-out behavior, and is unavailable anonymously. Migration 014 adds this read-only wrapper without changing the old RPC or deleting seeded records.

`classstreak-recovery-deployment.test.mjs` — 1 passed: incremental release retains the actual prior ingest implementation with all client execution revoked; rollback restores its exact definition hash and preserves Auth row count in the disposable fixture.

`classstreak-exact-goals.test.mjs` — 1 passed: migration 015 broadens only the `user_activities` goal constraint from 0–4 to 0–7. Onboarding accepts five/seven including custom climbing; editing to seven remains deferred until next week; eight is rejected atomically in setup/settings. Deployment and rollback retain existing/historical goals, including valid seven-day goals saved after release. Rollback deliberately keeps the broader constraint instead of clamping user preferences.

## Hosted deployment preparation

No Supabase management connector or configured CLI was available to this subtask. Previous releases used the signed-in dashboard SQL editor. A browser inventory attempt timed out, so hosted state is **not audited by this subtask**.

1. Confirm the dashboard project is `qrehonivhqcgfrjcpzqk` (turf). Run `supabase/audit-departure-recovery.sql`. It returns counts and function/security metadata only; no credentials, email addresses or location data.
2. If migration 012 and the old arrival-bound ingest/0–4 goal constraint are present and 013–015 are absent, run **only** `supabase/departure-live-studio-release.sql`. This transaction backs up the deployed ingest to a revoked `cs_ingest_before_departure_recovery`, applies 013–015, and checks grants and the new 0–7 constraint. It deliberately aborts on an unexpected baseline or preexisting release/backup. It does not replay earlier migrations or modify stored rows.
3. Rerun the read-only audit; confirm recovery guard, live RPC, authenticated-only access and preserved data. Record actual hosted evidence in the parent release notes. Account/session counts may also legitimately change from normal app usage.
4. Emergency rollback, if needed: reviewed `supabase/rollback-departure-live-studio.sql` restores the original saved ingest definition. The harmless read-only live studio RPC remains available. No records or columns are dropped.

## Pending validation and limits

- Hosted migration deployment: parent task must record separately. No hosted changes were made by this implementation subtask.
- iPhone/SideStore IPA delivery and physical climbing-gym test: NOT TESTED by this subtask. Test enter → wait at least the activity minimum → drive/walk away without opening the app; then foreground the app if the system callback was missed. Verify only one session, estimated label for GPS recovery, sensible duration, and no stuck timer.
- If iOS delivers neither a region callback nor enough usable GPS fixes, software cannot reconstruct an exact historical departure. Force quitting, disabled/insufficient location permission, OS suspension and poor indoor GPS remain real limitations. The existing estimated cap and manual duration correction remain available.
- This change does not replay held events under a different setup or invent Ifti's missing session. Any historical recovery requires his actual saved evidence, or his own correction.
