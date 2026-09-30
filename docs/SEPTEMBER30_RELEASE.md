# ClassStreak workout refresh — release status

September 30, 2026. The app revisions are implemented and tested locally. The hosted database update is pending: the user returned a matching read-only audit, and the combined guarded update is ready. The desktop browser bridge remains unavailable, so no direct hosted deployment is claimed.

## Included

- Warm cream, terracotta, rose and sage styling, illustrated weekly progress and workout history, and the existing five tabs.
- Home calendar and recurring exact times, editable day-specific workout/focus, and reminders one hour before. Empty Today asks Yes/No/Maybe for a rest day; No/Maybe leads to “Set a reminder so you don’t forget to go.”
- Dismissible, owner-persisted setup checklist with real friend progress toward three. Labeled example feed appears directly; real accounts still launch without demo session totals.
- Draggable, pinch-resizable translucent photo stickers; no visible size/backdrop controls. Small weekly goal text reads “2/3 goal this week.”
- Accepted-friend profiles with real weekly progress and a recipient-local-day workout status. Nudges are actual inbox writes with friendship, preference, completed-workout and daily duplicate checks. Failed sends never claim success.
- Workout Live Activity layout for Lock Screen and Dynamic Island: elapsed timer, chosen workout and current completed weekly goal progress. It updates after workout selection/restart and ends after stop, departure, pause or logout. The active workout is not counted before it finishes.
- Missed-departure recovery using confirmed outside fixes, preserving active visits during re-registration; exact weekly goals 0–7.

## Validation

- TypeScript, ESLint and configuration checks pass.
- Database/domain suite: **65 passed**. The final profile/inbox/deployment regressions passed again after the last server edits. Native adapter suites: **21 passed** (6 departure, 4 planning, 2 checklist, 9 Live Activity), each run in its own process because the harness installs shared global mocks.
- Browser checks exercise real app components with isolated fixtures. Phone camera, OS notifications, ActivityKit and GPS are not exercised by the browser.
- Live Activity lifecycle tests and current screenshot/interaction evidence are documented in `docs/WORKOUT_LIVE_ACTIVITY.md` and ignored `build/gallery/` reports.
- Updated IPA packaging evidence will be recorded after final compilation. The older movement-refresh awaiting-server upload predates this revision and should not be used as evidence for the new features.

## Hosted step

Existing project: **turf** / `qrehonivhqcgfrjcpzqk`.

The user-reported pre-release audit has **2 Auth users, 2 real profiles, 9 places and 210 sessions**, migration 012 present, and the expected ingest hash `f9848e5f82a5f0ae851b11b6d9cece7c`. No recovery/live-studio backup had been applied. See `docs/DEPARTURE_RECOVERY_VALIDATION.md`.

1. The audit has been reviewed. Refresh `http://127.0.0.1:4176/release.html` to get the latest combined SQL.
2. Run `supabase/departure-live-studio-release.sql` once. It applies **013–016** transactionally, preserving actual prior function definitions as private rollback copies. It does not reset the database or replay old migrations.
3. Run `supabase/verify-departure-release.sql`. Every `checks` value should be true. Compare the returned counts, allowing normal app activity, and record the user-returned result.

The rollback restores prior ingest/social/friend-list definitions without deleting records or narrowing goals above four. No remote push service is configured.

## iPhone acceptance

Install over the existing app using the same SideStore signing account. Keep the widget extension for the Live Activity; do not delete/reset the installed app or its saved data.

- Fresh launch shows real progress. Example community posts are clearly labeled.
- Choose a rest-day answer, set a recurring time and a one-day override, and reopen to verify persistence.
- Add a mutual friend, open their profile and send a nudge before they work out. Have the recipient open/sync ClassStreak and confirm the inbox message. A second nudge that day must not create another message; a logged workout hides the nudge.
- Verify gym arrival/timer, manual Stop and departure by car. Check exactly one saved session with a sensible duration; recovered departures are estimates.
- Tap the arrival notification to choose the workout and start the Live Activity. Lock the phone, inspect the elapsed timer/workout/weekly goal, reopen to restart or stop, and confirm updates/removal.
- Pinch/drag the sticker, save the photo and inspect bounds and goal text.

Physical iPhone/SideStore, outdoor departure, native photo export and Live Activity rendering are **NOT TESTED** in this release session. Apple requires this local Live Activity to start while the app is foregrounded; a background arrival uses the existing notification, and opening it preserves the original arrival time. The timer then runs natively on the Lock Screen. Instant remote nudge push while the app is closed is not available in this SideStore configuration; friend nudges arrive on app sync.

References: [Apple Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities), [Expo Widgets](https://docs.expo.dev/versions/latest/sdk/widgets/). The installed package versions and native IPA were inspected directly; the IPA already declares Live Activity support and includes its widget extension.
