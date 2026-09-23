# Arrival workout validation

- Typecheck, lint and native configuration checks passed.
- All 24 ClassStreak database/domain tests passed, including custom selection, restart, short stopped sessions, stale controls, capture-token isolation and replay.
- Focused local encrypted-store harness passed: offline control ordering, one arrival notification, initial-presence suppression, Stop and subsequent EXIT without duplicates.
- Real React Native components visually checked at 390px in browser; Barre selection updated the active label, and Stop transitioned to the empty state. Native restart confirmation and notification tapping require physical iPhone testing.
- Migration 011 deployed alone inside a transaction after checking its absence. Existing Auth identities preserved.
- Release reuses the unchanged native iPhone payload. The IPA includes the prior storage recovery fix.

## Physical acceptance
1. Enable Always location and notifications, start monitoring outside a saved place, then enter it.
2. Tap arrival notification, select an existing or custom activity; confirm timer survives backgrounding.
3. Restart and confirm the timer starts at zero.
4. Stop before leaving, then leave; confirm only one session with the selected label and stopped duration.
5. Repeat offline and reconnect; confirm one synced session.

No physical arrival timing or device installation is claimed by these automated checks.
