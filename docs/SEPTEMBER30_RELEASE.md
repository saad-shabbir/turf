# ClassStreak movement refresh — release status

September 30, 2026. App source implemented. Hosted database update is pending because the desktop browser bridge repeatedly timed out, including after the user reopened the chat. No production database changes have been claimed or performed.

## Ready locally

- Cream/charcoal redesign, exercise artwork, five tabs, weekly calendar and one-hour reminders.
- Missed-departure recovery, active-visit preservation on re-registration, and guarded server support.
- Real-account launch with isolated sample studio profiles/feed, adjustable translucent stickers, illustrated history.
- Exact activity goals 0–7. Server migration 015 is required for goals above four.
- Typecheck, ESLint and configuration checks pass. Database/domain tests, separate native-adapter tests, and actual-component browser interaction checks pass; details are in the associated validation documents.
- Interactive actual-component preview: `http://127.0.0.1:4176/review.html?page=home-empty`. No real camera, location, notifications or account writes run in that gallery.

## Hosted step

Use the existing **turf** project `qrehonivhqcgfrjcpzqk`.

1. Run `supabase/audit-departure-recovery.sql` and review the existing 012 baseline, 0–4 goal check and absence of this update.
2. Run `supabase/departure-live-studio-release.sql` once. The transaction applies 013–015, preserves the previous ingest function as a revoked rollback copy and aborts on an unexpected baseline. Do not replay old migrations or reset the database.
3. Rerun the audit. Confirm recovery guard and live studio endpoint, goal range 0–7, anonymous access false, authenticated access true, and existing account/data counts preserved (allowing normal app activity).

The local release-review page includes copy buttons for these exact scripts. A rollback script is provided for review if needed; it never deletes stored workouts and retains valid goals above four.

## iPhone acceptance after deployment

Install the new IPA over the existing app using the same SideStore signing account. Do not delete the existing app or reset its storage. Test:

- Fresh launch opens real progress; example people appear only when the sample sections are opened.
- Set a recurring time and a one-day Boxing override; reopen the app and confirm both survive.
- Check local notification permission and a test reminder. Actual lock-screen delivery is not established by browser tests.
- At a saved gym, verify arrival and timer. Stop before leaving once; on another visit leave by car and confirm a single saved session with a sensible end time. Recovered departures are labeled estimated.
- Pinch/drag the sticker and use size/backdrop controls; save the image and inspect its exported bounds.

Physical iPhone/SideStore, outdoor departure, wheel feel, and native photo export are **NOT TESTED** in this release session. Force-quit/background execution and poor location fixes can still prevent exact historical reconstruction.
