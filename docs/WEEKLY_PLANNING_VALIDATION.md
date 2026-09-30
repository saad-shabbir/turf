# Weekly planning and local reminders

Implemented in the September 30 visual refresh:

- A Monday–Sunday Home calendar shows planned days and logged days, with previous/next week and Today controls.
- An empty Today asks “Is today a rest day?” with Yes, No and Maybe. Yes confirms a rest day; No or Maybe offer a reminder through the existing planner. The choice is editable, saved per owner/date, and cleared when a workout is planned. A logged or planned workout takes priority over this prompt.
- Each usual activity keeps a recurring weekday slot. A day can be changed to another activity (including custom climbing or boxing), a specific time, and an optional weights focus without altering later weeks.
- The edit sheet explicitly distinguishes “Only this day” and “Every Wednesday” (or the selected weekday). A skipped recurring occurrence can be restored with Undo.
- Onboarding and Usual days retain morning, midday, and evening, add night, and offer a scrollable hour/minute/AM–PM picker. Night is represented as an exact 21:00 local time without changing server enums.
- Exact times and exceptions are owner-keyed in the existing encrypted local key/value store. App restart preserves them; sign-out/data deletion purges them with the existing local-data flow. These preferences are currently device-local and do not sync across phones.
- Each reminder is scheduled one hour before its occurrence in the profile time zone. General periods use 09:00, 13:00, and 18:00 workout times. Global usual-day preferences and per-workout switches are respected. Real logged sessions suppress the corresponding reminder; demo sessions do not.
- Date arithmetic is calendar-based across DST. A nonexistent spring-forward wall time is skipped instead of silently shifting to an unexpected time. Occurrences are populated up to 28 days out whenever the app refreshes or plans change, capped at the next 48 regular reminders to leave room for arrival/session alerts.
- Notification schedules are reconciled against the OS; edited/deleted times cancel previous identifiers. Logout invalidates queued scheduling and clears in-flight work after it settles. Stale account snapshots cannot schedule for the next account.

Automated evidence:

- `node --test --test-isolation=none tests/classstreak-planning.test.mjs`: 15 passing tests covering month/year boundaries, one-off versus recurring edits, skip/restore, rest-day choices and day rollover, activity replacement, time zones, DST, midnight reminders, preferences, completed-workout cancellation, native schedule reconciliation and recovery.
- `node --test --test-isolation=none tests/planning-local.test.mjs`: 4 passing native-adapter tests covering encrypted-store API persistence, owner isolation/purge, permission denial, logout during an in-flight schedule, account switch, unreadable-storage recovery, and genuine-progress totals in saved-workout notifications. The test adapter uses plaintext SQLite and does not prove SQLCipher/Keychain behavior on an iPhone.
- `tests/classstreak-live-projection.test.mjs` and `tests/classstreak-sticker-layout.test.mjs`: 9 additional pure tests verify legacy samples cannot hide real visits or inflate owner milestones, and sticker movement/scaling stays inside the photo under resize and malformed measurements.
- Existing reminder tests pass. TypeScript and scoped ESLint pass.

Physical iPhone wheel-picker feel, notification delivery and lock-screen timing: **NOT TESTED**. Local notifications remain subject to iPhone notification permissions and Focus settings. No remote push or new native dependency was added.
