# September 30 UI feedback validation

Implemented:
- Warm cream surfaces with terracotta, rose or sage accents. Home's weekly goal has equipment artwork and per-workout progress.
- A visible starter checklist with saved-place, first real workout and 0/3 accepted real-friend progress. Dismissal is stored per owner in the existing encrypted local key-value store; demo friends and sessions cannot complete it.
- Fictional example posts appear directly below friend activity, each labeled EXAMPLE. Their profile, like and comment actions remain local examples.
- Home and community copy uses workouts instead of movement.
- The Home activity cards pass accepted real-friend IDs to the profile navigation control.

Automated evidence:
- `node --test --test-isolation=none tests/home-setup-local.test.mjs`: 2 passed. Fresh storage reads preserve dismissal; another owner does not inherit it; sample records do not complete real setup.
- TypeScript check and focused ESLint checks passed.
- Local browser: 15 viewport/screen checks, no page errors or horizontal overflow, including 320px Home/onboarding.
- Local browser: 9 feedback interaction checks passed. Covered direct sample feed, checklist persistence across page reload/account changes, rest-day Yes/No/Maybe and reminder save, example comments/likes, accepted-friend profile with mocked nudge response, unavailable friend profile, emulated two-finger sticker enlargement and drag, style switching, and the labeled Live Activity layout preview.
- Local release guide: 7 checks passed, including all 13 screenshot thumbnails, three copy buttons matching the current SQL files, 390/320px layout and preview theme propagation.

Browser artifacts are under `build/gallery/`: `feedback-check.json`, `visual-check.json`, `release-check.json`, and `screenshots/`. `scripts/build-gallery.mjs` renders the actual app components with explicit disposable browser fixtures. Its storage adapter uses browser-local preview keys so reload behavior can be exercised. It does not use real account data or send nudges.

Live Activity preview is an RN illustration of the SwiftUI layout, not evidence that ActivityKit started on a phone. The local browser's touch emulation does not establish physical iPhone gesture feel, background location delivery, native notifications, camera export, SQLCipher or Lock Screen/Dynamic Island behavior. Those remain physical-device acceptance items.

No hosted SQL was executed as part of this visual validation. `scripts/build-release-review.mjs` only reads the current SQL files and builds copy buttons.


## Follow-up: studio, calendar and plan controls

- Local-time greetings cover morning, afternoon, evening and late night; foreground clock refreshes every 30 seconds.
- Calendar day cells shrink from 86 to 65 points while retaining touch targets. The setup checklist is first below it.
- Empty today/future days ask Yes/No before the reminder prompt. Existing saved Maybe choices remain readable as a reminder choice.
- Scheduled workout × opens confirmation, then delete/reschedule. Per-day moves preserve recurring rules and reschedule reminders. Editor defaults to only this day.
- Studio facade uses a terracotta roof, awning and arched stat windows. Six labeled example regulars appear immediately; twelve example posts use portraits, photos and illustrated workout cards. No fictional visits enter real totals.
- The hosted missing-function issue was fixed by applying and verifying 013–016. All 16 checks passed with current record counts preserved; detailed evidence remains in ignored local build artifacts.
- Typecheck, full lint, config and 68 database/domain tests passed. Browser interactions directly verified Yes/No, delete, Undo and reschedule-to-another-day. Phone acceptance is still untested.
