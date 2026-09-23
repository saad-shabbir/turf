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

## Change request 1 — 2026-09-21

- The latest numbered change request replaces the earlier pasted walkthrough: exact new Welcome wording, revised Sage tokens, Clay default, added How it works page, same fonts and core components.
- Motion reference: [MotiPressable](https://github.com/nandorojo/moti/blob/master/packages/moti/src/interactions/pressable/pressable.tsx). Applied press-in/out state, preserved accessibility props, and short transitions with Reduce Motion. The installed React Native Animated API handles these small effects without a new native dependency.
- Custom activities keep their trimmed name (40 characters maximum) in a `custom:` key. They remain distinct in goals, places, automatic/manual sessions, schedules and shared summaries. Their automatic minimum is 25 minutes, matching Gym; this is a visit threshold, not an exercise classifier.
- Goals continue to apply next Monday. The editor starts with picked activities, including picked-but-deferred zero goals; Add more reveals the standard catalog and Custom. This week's targets remain immutable.
- Each activity has its own days and time. For old clients and the nudge rule, the compatibility day schedule uses the earliest selected time. Local reminders remain one per day, for the earliest activity not yet logged, to stay within the phone's scheduling limit.
- Friend expansion shares only weekday, broad Morning/Midday/Evening and duration; no exact timestamp, raw fix or private place ID. The requested activity-color palette did not exist in §12, so the legend uses existing theme tokens plus activity icons rather than adding colors.
- The custom reaction input uses the system keyboard's emoji key. React Native does not provide a supported cross-platform command to switch a user's keyboard directly to emoji. Compound emoji (skin tones and ZWJ) are supported; the app retains the existing one-reaction-per-person rule.
- Weekly chart bars are intentionally noninteractive, as permitted by the request. Week checks show that week's count and briefly highlight. Milestone cards derive the actual achievement date from owned counted history; sample achievements are labeled. Native confetti first-open state is stored in encrypted local storage.
- This private walkthrough build loads the existing removable demo fixture after first completed setup and leaves the user on Home. Five extra demo regulars are not friends. Demo studio boards show only that account's sample people; the public real-visit board remains unchanged. Demo data can be removed from Account. Remove automatic demo setup before a public production release.
- Location explanation describes saved arrival areas and candidate samples honestly: a radius can include nearby pavement, and a visit is not proof of exercise. No claim of perfect background timing was added.
- The browser gallery now keeps editable sample state for goals, schedules, comments and reactions, and follows onboarding Back changes. It never writes to a real account; camera, photo export, authentication, and haptics require an iPhone.
- Hosted migrations 009 and 010 were applied incrementally in one transaction after checking the baseline (2 Auth users, 0 ClassStreak users, 9 legacy Turf tables). Auth users remained 2; schedules RLS verified enabled. Original migrations were not replayed. Pre-update implementations remain revoked under `*_before_walkthrough`/`*_before_demo_board` names for recovery; no stored personal records were dropped.

- Location sample retention now filters the candidate arrival radius before writing encrypted storage; outside, inaccurate, future-dated and expired observations are discarded. The 2-hour/300-sample bound remains.

## Arrival workout controls (22 September 2026)
- A genuine armed arrival sends a local encouragement notification; tapping opens the existing activity picker plus Custom. Initial presence is still suppressed. Notification permission is required, and iOS delivery timing is not guaranteed.
- Active duration derives from the persisted arrival timestamp. Restart requires confirmation and moves the start to now. Stop saves locally before sync, disarms the region until EXIT, and binds all controls to the original arrival ID.
- Short stopped workouts are saved but existing minimum-duration and daily count rules still govern goal credit. Automatic exit and the existing four-hour cap remain fallback limits.
- Controls use the existing encrypted outbox, capture token, owner isolation and replay protection. No native dependencies, entitlements, identifiers or encryption keys changed.

## Field-test sync and departure recovery (23 September 2026)
- Distance-triggered GPS samples are biased toward movement and cannot veto a visit that meets its activity minimum. Remove the whole-visit speed veto on client and server; keep duration, suppression, deduplication and daily goal rules. This also covers already-queued EXIT payloads from the previous build.
- CAPTURE_EXPIRED has several causes, not just replacement. The owner-scoped diagnostic RPC distinguishes a nonmatching setup and permanently invalid capture times from retryable future-clock/network failures.
- Permanently invalid events stay byte-for-byte in the encrypted outbox, with owner-scoped hold markers. Valid later events can sync. Debug shows pending versus preserved counts and offers history/manual-review navigation. No token is reassigned and no unverified old event becomes an automatic verified session.
- A user's missed workout is not claimed recovered until it appears in their history. Re-registering after upgrading first drains eligible records and preserves expired ones before establishing a new capture.
- Applied only migration 012 after baseline inspection. Rollback: restore close_visit from migration 002; the new read-only status RPC can remain harmlessly available. Never replay the whole migration 002.
