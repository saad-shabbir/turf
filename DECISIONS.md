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

- Contacts are matched with a server-held HMAC key; the app never receives hashes. Ten-digit contact numbers use the US +1 prefix for this US test group; other numbers need a country code. Numbers are self-entered, not verified, and a match only offers a request requiring acceptance.
- An invite code is prior consent for an initial friendship. After an unfriend, reusing an old code creates a pending request so it cannot undo revocation.
- Realtime publishes only each account's revision number. Screens reload the sanitized friend view; shared feed and inbox data are excluded from the offline snapshot cache.
- Exact-time callbacks remain private. The friend feed exposes only today/yesterday/day buckets; local simulations require opt-in and remain labeled.
