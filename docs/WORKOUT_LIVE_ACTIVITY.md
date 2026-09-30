# Workout Live Activity — implementation and validation

The iPhone presentation uses the existing Expo Widgets native integration. It shows the active workout name, elapsed time from the stored arrival (or Restart), and the owner’s real weekly goal progress. No raw location, place name, friend identity, auth token, or profile ID enters the native display payload. It has a Lock Screen presentation and Dynamic Island layouts on supported devices. Tapping it opens the in-app active workout, where the user can change the workout type, restart, or stop.

## Foreground start requirement

A geofence arrival in the background does **not** automatically create a Live Activity. It records `pending`; the existing arrival notification can bring the user into ClassStreak. Opening the app creates the activity using the original saved arrival time, so the elapsed timer does not start over. Once created, updates can be sent while the app is executing in the background. OS background execution and delivery remain best effort.

An in-progress native timer is a system presentation, not a new GPS source. Departure detection remains the existing geofence/backup-fix path. An iPhone without a Dynamic Island can use the Lock Screen presentation where Live Activities are supported and enabled.

## Lifecycle and privacy

- SELECT changes the workout label; RESTART changes its time anchor; STOP, departure, pause, and logout end the presentation.
- One serialized reconciliation path reuses the saved native instance ID and skips unchanged payloads.
- When an already-bound native instance disappears, the service treats it as dismissed and does not recreate it for that visit. A new arrival can start a new card.
- A clear request invalidates older queued/in-flight reconciliations, suspends later background callbacks, ends native instances, and clears binding/status. Only an explicit authenticated app refresh with a matching cache owner and unblocked auth can resume it. Native cleanup still executes when encrypted storage cannot be opened.
- Auth epoch, auth-blocked state, tracking owner, snapshot owner, current visit and paused state are checked around native work. A changed account or visit cannot keep an old update alive.
- Weekly totals use only the profile owner’s real sessions. Seed and simulated sessions are excluded; old sample-owned counted flags do not hide real progress.
- Simulated, invalid, future, and more-than-four-hour-old arrivals do not create a card. The native presentation also becomes stale at four hours.

## Automated evidence

Run separately because the native test harness has process-global adapters:

```text
node --test --test-isolation=none tests/workout-live-activity-local.test.mjs
```

Nine tests pass: background pending/foreground deduplication, preserved arrival, type selection and Restart, stop/pause/auth/cache cleanup, owner-only real weekly counts, account-switch and queued-clear races, explicit authenticated resume, manual dismissal, cleanup with unreadable storage, and invalid/expired/simulated suppression. The tests use the real local store/service with a mutable native driver stub. They establish service behavior, **not** ActivityKit rendering or real iPhone delivery.

`npm run typecheck` and scoped ESLint also validate the TypeScript/SwiftUI adapter source. Physical-phone acceptance is **NOT TESTED**. Remaining phone checks: open arrival notification, view both supported Lock Screen/Island layouts, select another workout, Restart, Stop, depart by car, pause tracking, and sign out; verify no old card remains and a background-only arrival waits for the app to open.
