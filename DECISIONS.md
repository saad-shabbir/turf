# ClassStreak v4 decisions

1. V4 is the active scope; the earlier Turf preview approval milestone is superseded by the direct instruction to build v4.
2. Preserve com.turf.privatealpha, turf.db, turf.db.key and the geofence task name to support an installed update and retained encrypted account storage.
3. Build on a fresh branch from the latest remote commit; leave the previous checkout and unfinished Turf preview untouched.
4. New data lives in the classstreak schema behind authenticated public RPCs. Preserve old Turf data during transition and provide a separate retirement script.
5. Specific v4 sections override stale milestone wording: inbox instead of pushes, react-native-share, email instead of OAuth, real record totals instead of inconsistent sample numbers.
6. Invoker views cannot directly read owner-only peer tables. Their authenticated functions return sanitized projections, with no raw table grants.
7. Scheduled local notifications cannot fetch live friend data during suspension. Refresh/cancel schedules on foreground and events; omit potentially stale friend claims.
8. Missing EXIT becomes a labeled estimated four-hour closure per v4, never Health verification solely from geofence evidence.
9. Collect the two-hour encrypted GPS buffer only during a saved-place candidate, preserving the promise not to record movements elsewhere.
10. Server rollups use server time. Debug as_of affects only the owner's simulation projection, never other accounts or shared real scores.
11. Venue boards always exclude seed/simulated sessions. Explicit opt-in permits labeled simulated friend-feed entries, resolving section 10's unconditional-exclusion sentence.
12. Existing Auth accounts complete ClassStreak setup after sign-in. Email confirmation is a real pending state; keep drafts until a session exists.
# Friends and contact details

- The studio QR uses an explicit share token pointing to the canonical venue, so it never publishes a private place row or owner ID. The token's public preview contains only the shared studio pin and lets onboarding pre-save it. `classstreak.app` is not claimed as deployed; typed codes and in-app QR work with the current free build.
- Google Places confirmed Club Pilates at 7460 W Lake Mead Blvd E1, Las Vegas, and Core Pilates at 3592 Old Atlanta Rd #101, Suwanee on 2026-09-20. Demo pins use those results and remain editable; no placeholder coordinates are monitored.

- Personal reminder schedules cover the next 28 days and refresh on app activity and synchronized visits, staying below iOS's pending-notification limit. Future scheduled copy uses generic prompts because iOS cannot query live friend counts while a local notification is delivered; today’s reminder may name a friend already known to have attended. Recap details are computed when opened; no stale friend claim is embedded.
- Offline qualified callbacks keep encrypted evidence and show “saved on this phone”; an actual counted-session notification waits for the server decision. In-app friend messages use an inbox, own-account Realtime revisions and a next-open banner, with no APNs entitlement.

- Contacts are matched with a server-held HMAC key; the app never receives hashes. Ten-digit contact numbers use the US +1 prefix for this US test group; other numbers need a country code. Numbers are self-entered, not verified, and a match only offers a request requiring acceptance.
- An invite code is prior consent for an initial friendship. After an unfriend, reusing an old code creates a pending request so it cannot undo revocation.
- Realtime publishes only each account's revision number. Screens reload the sanitized friend view; shared feed and inbox data are excluded from the offline snapshot cache.
- Exact-time callbacks remain private. The friend feed exposes only today/yesterday/day buckets; local simulations require opt-in and remain labeled.

- The user explicitly approved preserving the two Auth users and existing Turf tables during ClassStreak deployment; this supersedes the brief’s request to drop Turf tables.
- Edge Functions forward the user JWT to authenticated PostgREST or verify it with Supabase Auth. Legacy gateway JWT verification is disabled for signing-key compatibility; missing/invalid user credentials still return 401.
- HealthKit and WidgetKit are implemented as native modules/targets, with only aggregate widget values in the app group. Compilation is separate from SideStore entitlement and physical-device acceptance.
- A small-screen Plus headline uses 34 pt to preserve the supplied one-line layout; Dynamic Type may wrap. Post retains the screenshot’s bottom-right sticker-style control and a More styles coming sheet.
- The GitHub-produced native build uses the specified map-pin fallback. The delivered local IPA embeds the final Expo bundle using the ignored .env, so Google Places works without uploading the key to GitHub configuration. Native input equality, matching Hermes format and unchanged native ZIP entries are enforced before repackaging.
