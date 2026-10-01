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

`classstreak-recovery-deployment.test.mjs` — 1 passed: incremental release retains the actual prior ingest/social/friend-list implementations with all client execution revoked; rollback restores their exact definition hashes and preserves Auth row count in the disposable fixture. The new profile endpoint is disabled on rollback so it cannot advertise eligibility that differs from the restored social rule.

`classstreak-exact-goals.test.mjs` — 1 passed: migration 015 broadens only the `user_activities` goal constraint from 0–4 to 0–7. Onboarding accepts five/seven including custom climbing; editing to seven remains deferred until next week; eight is rejected atomically in setup/settings. Deployment and rollback retain existing/historical goals, including valid seven-day goals saved after release. Rollback deliberately keeps the broader constraint instead of clamping user preferences.

`classstreak-friend-profile.test.mjs` — 3 passed: migration 016 exposes only an accepted real friend's safe first name, real weekly count/goal/streak, coarse weekly workout details and nudge status. Pending, removed, nonexistent and anonymous access is denied; precise timestamps, gender, place and coordinates are absent. An actual sender RPC produces one recipient inbox item, verified after changing the authenticated actor. Retrying a successful send does not duplicate the inbox item. Recipient preference, any real completed workout (including a short non-counting workout or one finished after midnight), and the recipient's local date enforce eligibility. Seeds/simulations never suppress a real nudge. Direct private helpers and saved social implementations remain inaccessible.

Nudges lock both user rows in UUID order before checking eligibility, so a concurrent workout completion or notification preference edit that already holds the recipient lock completes before the nudge decision. Accepted friendship is locked separately against revocation. Reciprocal sends use the same user lock order. These lock paths were inspected; true multi-connection concurrency is not reproduced by the disposable PGlite harness. Delivery is the existing real inbox on sync; this does not add closed-app remote push.

`npm run test:db` — 65 passed across the combined database/domain suite. After the final recipient-lock, midnight and wording edits, the five focused profile/inbox/release tests passed again. Typecheck and focused ESLint passed.

## Hosted deployment preparation

No Supabase management connector or configured CLI was available to this subtask. Previous releases used the signed-in dashboard SQL editor. A browser inventory attempt timed out, so hosted state is **not audited by this subtask**.

### User-reported pre-deployment audit — September 30, 2026

The user supplied the read-only audit result for `qrehonivhqcgfrjcpzqk`. This is user-reported hosted evidence, not a query executed by this subtask:

- Auth users: **2**; real ClassStreak profiles: **2**; places: **9**; sessions: **210**.
- Migration 012 capture-status RPC: **present**. Drive-away speed fix: **present**.
- Recovery guard, live-studio RPC and saved rollback function: **all absent**.
- Authenticated ingest execution: **allowed**. Anonymous ingest execution: **not allowed**.
- Ingest definition MD5: **`f9848e5f82a5f0ae851b11b6d9cece7c`**.
- Weekly activity goal constraint: **0–4**.
- Public tables: `cs_revisions`, `devices`, `diagnostic_events`, `geofence_events`, `pairs`, `places`, `profiles`, `tracking_sessions`, `user_settings`, `visits`.

The reported ingest hash exactly matches migration 011 recreated in disposable PostgreSQL; that implementation includes arrival-bound workout controls. The guarded release now checks this exact hash as well as the previously defined structural/grant/goal checks. The reported values meet the known pre-release conditions. The retained original studio helper is also checked transactionally before applying; its presence was not a separate field in the supplied audit. No hosted execution or deployment is claimed from this report.

A safe machine-readable copy is saved at `build/evidence/supabase-pre-revamp-audit.json` (ignored build output). It contains counts/schema metadata only.

1. Confirm the dashboard project is `qrehonivhqcgfrjcpzqk` (turf). Run `supabase/audit-departure-recovery.sql`. It returns counts and function/security metadata only; no credentials, email addresses or location data.
2. If migration 012 and the old arrival-bound ingest/0–4 goal constraint are present and 013–016 are absent, run **only** `supabase/departure-live-studio-release.sql`. This transaction backs up the deployed ingest to a revoked `cs_ingest_before_departure_recovery`, saves the original social/friend-list implementations under revoked backup names, applies 013–016, and checks grants and the new 0–7 constraint. It deliberately aborts on an unexpected baseline or preexisting release/backup. It does not replay earlier migrations or modify stored rows. The expanded audit reports whether the friend profile and friend rollback already exist; they were not fields in the earlier user-supplied audit, so their absence is also checked inside the guarded transaction.
3. Rerun the read-only audit; confirm recovery guard, live RPC, authenticated-only access and preserved data. Record actual hosted evidence in the parent release notes. Account/session counts may also legitimately change from normal app usage.
4. Emergency rollback, if needed: reviewed `supabase/rollback-departure-live-studio.sql` restores the original saved ingest, friend-list and social definitions and disables the new profile RPC. The harmless read-only live studio RPC remains available. No records or columns are dropped; sent nudges and inbox history remain intact.

## Pending validation and limits

- Hosted migration deployment: parent task must record separately. No hosted changes were made by this implementation subtask.
- iPhone/SideStore IPA delivery and physical climbing-gym test: NOT TESTED by this subtask. Test enter → wait at least the activity minimum → drive/walk away without opening the app; then foreground the app if the system callback was missed. Verify only one session, estimated label for GPS recovery, sensible duration, and no stuck timer.
- If iOS delivers neither a region callback nor enough usable GPS fixes, software cannot reconstruct an exact historical departure. Force quitting, disabled/insufficient location permission, OS suspension and poor indoor GPS remain real limitations. The existing estimated cap and manual duration correction remain available.
- This change does not replay held events under a different setup or invent Ifti's missing session. Any historical recovery requires his actual saved evidence, or his own correction.


## Hosted completion — September 30

The browser connection recovered. A new read-only audit matched the expected function hash and migration012 baseline. The 013–016 transaction succeeded in the signed-in SQL editor. All 16 post-release checks were true and current record counts were preserved. Detailed hosted identifiers, query links and counts stay in ignored local build evidence. The API schema reload was requested after creating the missing live-studio function; the final verification remained successful.
