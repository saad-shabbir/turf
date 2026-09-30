# ClassStreak workout refresh — release status

September 30, 2026. The app revisions are implemented and tested locally. The browser connection recovered, and the guarded hosted update 013–016 was applied and verified directly in Supabase. All 16 release checks passed; the fresh before/after record counts match.

## Included

- Compact calendar above the dismissible “Off to a great start” checklist and weekly progress. Local-time greetings include “Hello, night owl” and refresh while foregrounded. Planned workouts have confirmed per-day delete/reschedule controls.
- A roof-and-awning studio facade, inline labeled example regulars, and twelve varied example posts. Missing-board/network errors stay inline without a raw global SQL banner.
- Warm cream, terracotta, rose and sage styling, illustrated weekly progress and workout history, and the existing five tabs.
- Home calendar and recurring exact times, editable day-specific workout/focus, and reminders one hour before. Empty Today asks Yes/No for a rest day; No leads to “Set a reminder so you don’t forget to go.”
- Dismissible, owner-persisted setup checklist with real friend progress toward three. Labeled example feed appears directly; real accounts still launch without demo session totals.
- Draggable, pinch-resizable translucent photo stickers; no visible size/backdrop controls. Small weekly goal text reads “2/3 goal this week.”
- Accepted-friend profiles with real weekly progress and a recipient-local-day workout status. Nudges are actual inbox writes with friendship, preference, completed-workout and daily duplicate checks. Failed sends never claim success.
- Workout Live Activity layout for Lock Screen and Dynamic Island: elapsed timer, chosen workout and current completed weekly goal progress. It updates after workout selection/restart and ends after stop, departure, pause or logout. The active workout is not counted before it finishes.
- Missed-departure recovery using confirmed outside fixes, preserving active visits during re-registration; exact weekly goals 0–7.

## Validation

- TypeScript, ESLint and configuration checks pass.
- Database/domain suite: **68 passed**. The final profile/inbox/deployment regressions passed again after the last server edits. Native adapter suites: **21 passed** (6 departure, 4 planning, 2 checklist, 9 Live Activity), each run in its own process because the harness installs shared global mocks.
- Browser checks exercise real app components with isolated fixtures. Phone camera, OS notifications, ActivityKit and GPS are not exercised by the browser.
- Live Activity lifecycle tests and current screenshot/interaction evidence are documented in `docs/WORKOUT_LIVE_ACTIVITY.md` and ignored `build/gallery/` reports.
- Release JavaScript compiled successfully. IPA packaging verified the matching Hermes bundle, all 165 unchanged native archive entries, assets and ZIP integrity. No new native dependencies were required.

## Packaged build

`ClassStreak-studio-refresh.ipa` is **23,418,707 bytes**. The existing private Drive download is updated in place. Hermes, ZIP integrity, bundled assets and all 165 unchanged native entries passed packaging verification.

- Native commit: `324020299bdd8f779ea5a3420667ae56820bca13`.
- JavaScript commit: `cdcec107bf1c39bc440cc858ef585069fe1eaf97`.
- JavaScript SHA-256: `81f2b7d8c2b65cefff8d4f9ec0ada6d34daec9c99c3588c6c9df36d50b020aee`.
- IPA SHA-256: `f70e948ba613fdc3c552b8ae0ec289c6da56b18fb57d17f94d105efeb4b4d8d5`.

Local provenance is saved in ignored `build/ClassStreak-studio-refresh.provenance.json`. Package, keys and private download link stay out of public source. Physical iPhone acceptance is NOT TESTED.

## Hosted deployment verified

The signed-in SQL editor was used to run a fresh read-only audit, the guarded 013–016 transaction, and the read-only verification. The editor reported success; all **16 verification checks passed**. Current account, place and session counts were preserved. Detailed hosted evidence is stored only in ignored local build artifacts.

The missing `public.cs_studio_live(uuid)` function is now present and callable only by authenticated users. Friend-profile/inbox-nudge and tracking-recovery functions are installed. No database reset, old-migration replay or deletion was performed. Physical phone acceptance remains pending. No remote push service is configured.

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
