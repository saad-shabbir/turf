# Turf M1 setup

The original specification files are preserved. This file describes the implemented source.

## Windows checks

Install Node 24.19.0 with npm 11.6.1. From the repository root:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run test:db
npm run check:config
npm run db:types
```

The database tests use a fresh in-memory PGlite PostgreSQL database with real SQL roles,
RLS and pgcrypto. They do not connect to or reset your hosted project. The Auth schema
is a test fixture; GoTrue/PostgREST integration still requires local Supabase or the
real project. With Docker and the Supabase CLI installed, use `supabase start` and
`supabase test db` for the additional pgTAP grant tests. Do not run reset on production.

Native-adapter unit tests mock native SQLite/Keychain. They test queue and lifecycle
code but do not prove SQLCipher ciphertext or iOS storage behavior.

## Supabase Free

1. Create one Free project manually. Do not activate billing or paid add-ons.
2. Disable public sign-up. Create and confirm the two email/password users in Auth.
3. Apply migrations in order: `202609160001_schema.sql`, `202609160002_rpc.sql`,
   `202609160003_ingest.sql`. Review them before applying. Do not paste an admin key
   into app configuration or build variables.
4. Edit the two placeholder UUIDs in `supabase/bootstrap.sql`, then run it as the
   administrator. Do not commit the personalized file. Profiles can be renamed in-app.
5. Keep the Data API exposed schemas at `public, graphql_public`; never expose `private`.
6. Create `.env.local` from `.env.example`, supplying only the HTTPS project URL and
   `sb_publishable_...` key. These are public client configuration, not authorization.
7. In GitHub repository Settings → Secrets and variables → Actions → Variables,
   set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Removing an allowlist entry blocks app access. App-data deletion removes settings
and profile rows and ends the pair; it does not silently recreate them on login.
Re-enrollment requires deliberately restoring that user's profile/settings as admin.
To delete an Auth account, delete its app data first, then delete the Auth user in the
dashboard. This does not claim deletion from provider backups.

## Build and installation

Before running the Mac workflow, check GitHub's included allowance and disable paid
overages. Use only the standard `macos-26` runner. No Apple credentials enter Actions.

Run **Build unsigned iOS IPA** manually. Leave `configured_backend=true` for the full
app. Use false only for a shell smoke test; without variables it displays a real
“Backend not configured” state. Artifact retention is one day.

The first native dependency resolution was captured from run 35183366492 and
committed to `native-locks/Podfile.lock`. Builds now explicitly use CocoaPods 1.17.0
and enforce `pod install --deployment`. The fallback for a deliberately removed
lock prints it between `TURF_POD_LOCK_BEGIN` / `TURF_POD_LOCK_END`; review and commit
any future regenerated lock before claiming repeatability.

Download and keep `Turf-unsigned.ipa` and its checksum. Follow the original
`BUILD_AND_SIDELOAD.md` for official SideStore/iloader/LocalDevVPN steps. Each person
uses their own Apple Account and signs the same unsigned IPA separately.

## First real-iPhone test

1. Install through SideStore, then turn off Windows/Metro and launch Turf.
2. Sign in, create/join the invite on the two accounts, and verify active pairing.
3. Save a private place from a current fix or corrected coordinates. Check accuracy.
4. Grant foreground then background permission, explicitly consent, and start capture.
5. Begin outside, lock the screen, enter, wait, then leave. Open My diagnostics.
6. Confirm real ENTER/EXIT, separate observation/receipt times and an honest visit.
7. Repeat with a delivered callback while offline; reconnect, sync, then retry sync.
   Verify one logical event/visit, not an extra copy.
8. Pause while offline, cross the boundary, and verify no new local observations.
9. Repeat the full worksheet in `FIELD_TEST_CHECKLIST.md` for both participants,
   including update and SideStore renewal. No field result is implied by unit tests.

## Implementation decisions and limitations

- Exactly 24 random invite bits encoded as six hex characters; five attempts per
  fixed 15-minute window. Failures return stable codes so the counter persists.
- SQL uses a global advisory transaction lock for this two-user application. This
  serializes mutations, session closures and replay rather than scaling to many users.
- Session-to-place snapshots live in the unexposed schema. References must match.
- First callback per region per JS runtime is conservative initial-state evidence.
  A new runtime can therefore make a real arrival uncertain. No automatic duration
  is invented to hide that limitation.
- Storage opens each transactional SQLCipher connection with the device key before
  `BEGIN IMMEDIATE`. It fails closed if SQLCipher is unavailable or the key is wrong.
- Permission loss or lost native registration pauses capture. Resume is explicit
  and online. An offline phone learns of server-side unpairing/replacement later.
- Sync sends one batch of at most 25 events and 25 closures per opportunity. Each
  network request has a five-second timeout; token refresh may add a separate request.
- Rejected observations stay visible locally until retention expiry. Last upload is
  server acknowledgment time. No heartbeat or always-running timer is installed.
- Retention is opportunistic on foreground activity and ingestion. Deadline deletion is not
  guaranteed without a separately configured administrator maintenance job.
- No M2–later screens, tables, scoring, commitments, notifications or inference exist.
