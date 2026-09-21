# ClassStreak development and release

The v4 brief in `CLASSSTREAK_V4.md` governs this app. The screenshot files in `design/` govern its appearance. Historical Turf documents describe the previous product only.

## Run

Use Node 24.19.0 and npm 11.6.1, then `npm ci`. Create ignored `.env` from `.env.example`; fill the existing Supabase URL and public publishable key. The Google Places key belongs only in `.env` as `EXPO_PUBLIC_GOOGLE_PLACES_KEY`. Restrict it in Google Cloud to iOS bundle identifier `com.turf.privatealpha` and the Places API only. Expo public values are included in the installed app, so this is not a server secret. A build made without this key supports MapKit pin selection and a typed studio name.

This is an iPhone app requiring a native development or Release build, not Expo Go. On a Mac, run `npx expo run:ios --device`. For EAS development builds use `eas build --platform ios --profile development` after configuring Apple signing. A paid account is not assumed or purchased. For the current SideStore route, dispatch `.github/workflows/build-ios.yml` on the ClassStreak branch. It builds a standalone unsigned device Release IPA on the standard GitHub macOS runner, validates it, and uploads a short-lived artifact. Install the IPA through SideStore as you did for Turf. Its bundle identifier is unchanged so it replaces the earlier app; the display name is ClassStreak.

GitHub builds use the existing public Supabase repository variables. The Places key is deliberately not copied out of `.env` into repository secrets; CI builds use the map-pin fallback. Native compilation requires stable Xcode >=26.4 and CocoaPods 1.17.0. Commit the newly resolved native lock after a successful initial build; the previous Turf lock is retained only as historical evidence.

## Database

Inspect hosted migrations and schema before applying any SQL. The original three Turf migrations are historical: do not replay them. Apply only the timestamped ClassStreak migrations, in order, in a transaction after inspecting the target. They preserve Auth identities and create a private `classstreak` schema, public authenticated RPCs, sanitized views, revision-only Realtime and private photo storage. `supabase/schedule-classstreak.sql` installs maintenance every 15 minutes. Deploy `seed_demo`, `rollup` and `delete_account` Edge Functions from this repository. `delete_account` uses only the built-in server service key; never place a privileged key in a client environment variable.

Save a schema-only export of the previous schema before retiring it. With no hosted backup available, archive legacy application objects in a private historical schema before dropping them. This gives the existing installation a recovery path without touching Auth users. Record hosted changes and timestamps in `BUILD_STATUS.md`.

## Use and Debug

Onboarding ends in email/password account creation. Existing Auth users can sign in and finish ClassStreak setup. Save a studio pin, grant foreground and Always location access, and start automatic tracking in Account. Initial presence is ignored until the phone first leaves a region. Automatic detection is best effort; drive-bys and short stays do not count. Optional Health matching checks only workout time overlaps and is off by default.

Profile → Account → tap version five times opens Debug. It includes registered places, visit state, recent events, queue count, last sync/fix, simulated ENTER/EXIT/+40 minutes/drive-by, local clock advance, rollup, reminders, onboarding reset, and scoped demo seeding/removal. Simulations are labeled; explicit opt-in is needed to share them with friends, and they never enter venue boards. Seed data contains 22 own sessions and Priya/Jess/Maya as three scoped example friends. Removing demo data leaves real sessions intact.

Personal notifications are scheduled locally; friend requests, reactions, comments and nudges go to the in-app inbox and next-open banner. There is no APNs setup or purchase processing. The Plus button says Coming soon. Story export opens the share sheet and copies the friend link; select Instagram and add its link sticker/audience there. The domain `classstreak.app` is not claimed as deployed: code entry and in-app QR are available independently.

## Verify

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run check:config`, and `python tests/ipa-inspection.test.py`. Database tests use a disposable PGlite database, fake Auth identities and Storage contract tables; they exercise real SQL policies and RPCs without changing hosted data. Native storage tests cannot establish iPhone Keychain/SQLCipher behavior.

For visual review: `node scripts/build-gallery.mjs`, then `node scripts/serve-gallery.mjs`; open localhost:4173 at a phone viewport. It uses real screen components with disposable sample fixtures and explicit adapters for device actions. It is a UI review tool, never evidence of working camera, geofencing, Health, sharing or native widgets. The iOS production bundle is checked separately with `npx expo export --platform ios`.

Physical acceptance still requires SideStore installation, real entry/exit and offline visits, location denial/recovery, camera/export, local notifications, widget refresh and Health permission/overlap checks. Record observations rather than inferring them from compilation.
