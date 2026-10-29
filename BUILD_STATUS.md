# ClassStreak build evidence

- All nine v4 milestones are committed in order on classstreak-v4. Final screen and reminder fixes pass local checks.
- TypeScript and ESLint pass. All 19 ClassStreak domain/database tests pass; four synthetic IPA validator tests pass.
- The iOS Hermes production bundle compiled locally. Native compilation passed in GitHub Actions run 35570176395 (commit 3240202), using Xcode 26.4.1, CocoaPods 1.17.0, Node 24.19.0 and npm 11.6.1. The app and WidgetKit extension target iPhoneOS 16.4+, and the Health module is linked. Physical iPhone acceptance is NOT TESTED.
- Hosted deployment on 2026-09-21 UTC: eight additive ClassStreak migrations succeeded, all 27 ClassStreak tables have RLS, and the photo bucket is private. Both existing Auth users and all nine public Turf tables remain intact.
- Hosted seed_demo, rollup and delete_account functions are deployed. Each rejects missing and invalid user tokens with HTTP 401. No real account was deleted during testing.
- ClassStreak maintenance is active every 15 minutes. New email signup is still disabled pending authorization; existing users can sign in.
- Visual review uses the real screen components with disposable fixtures, separately from native acceptance. Welcome, onboarding goals, Home, Profile, Friends, session sheet, Post and Plus were inspected at a phone viewport; the 320-point Profile has no horizontal overflow, and the goal-screen Continue button is fully visible above the bottom edge.
- Invitation HTML is on classstreak-pages. GitHub Pages activation is pending separate public-hosting approval. No custom domain is claimed.
- SideStore installation, real geofences, background recovery, camera/export, Health access and widget behavior remain NOT TESTED on a physical iPhone.

- The successful native Podfile.lock is saved and committed for future deterministic resolution. No native inputs changed after the successful native build. The latest JavaScript/assets are embedded locally with the matching Hermes format so the Places key does not leave the local build workflow.

- Final local `build/ClassStreak.ipa` packaged successfully: Hermes version 98 matches the native runtime, all 165 non-bundle ZIP entries are byte-identical, all 46 bundle/asset entries are present with no additional asset paths, and the bundle decodes without privileged Supabase credentials. The Places key is present only in the local client bundle, as intended.
- Email signup and GitHub Pages activation remain pending user approval. The latter was rejected by automatic approval review as an additional public hosting surface. Existing authenticated users can use ClassStreak meanwhile.

- Auth URL inspection found a localhost default with no mobile redirect allowlist. Adding the exact `turf://account` callback was prepared but rejected by automatic approval review; this setting also awaits explicit authorization. Confirmation/reset email return-to-app is therefore not operational yet. No confirmation/reset emails were sent during this check.

## Social update deploy, 2026-10-29 UTC (stopped before publishing)
- Commit `4c270fa5f399fef84a0aa6487eca24dc3e15f43e` (PR #5). `npm ci`, typecheck, lint and `check:config` pass on Node 22. `npm test` and `npm run test:db` need Node 24's `--test-isolation` flag; under Node 24.22.2 they pass (test:db 98/98).
- The hosted turf database has no `supabase_migrations.schema_migrations` table. Earlier ClassStreak migrations are recorded only here, in DECISIONS.md and in the validation docs, so this entry is the record for 0018. Before applying: 0017's `cs_timed_session` and every function 0018 renames were present, and nothing from 0018 existed.
- Applied `202610280018_classstreak_social.sql` in a single transaction. The 11 new tables (blocks, mutes, push_tokens, push_outbox, push_config, messages, plans, plan_alerts, active_workouts, cheers, workout_photos) have RLS on, as do all 39 ClassStreak tables. The three social photo storage policies are present. `push_config` stays disabled. Auth users (7), ClassStreak users (7), sessions (18) and the 11 public tables are unchanged. Recovery: the replaced functions are kept as `*_before_social`, and the rollback is in the migration header.
- Cron job `classstreak-social` (`*/5 * * * *`, `select classstreak.social_checks()`) is active. `social_checks()` runs without error. Step 2 of the schedule file (push_config and the push sender) was not run.
- Deployed the `send_push` Edge Function with `--no-verify-jwt`. A POST returns HTTP 200 `{"sent":0}`.
- **Stopped at fingerprint.** The latest finished iOS production build is build 9 (`074a1683-f983-4782-967e-7ec0e609cbab`, commit 4cae2ae). Its fingerprint is `7a5bdc82abc50e41ab72d3eb819bf4f042c65633`, and `fingerprint:compare` says it matches this checkout. The deploy brief expected `dafcdc6ea46941e53302dc1848373cec0c0a81b3`, and none of the listed builds has that fingerprint. Following the brief, no update was published. No EAS update IDs.
- No EAS build was started.

## Social update published, 2026-10-29 UTC
- The fingerprint hold above came from a wrong expected value in the deploy brief. `fingerprint:compare` against build 9 is the check that counts, so the update was published.
- Checkout: `main` at `4c270fa5f399fef84a0aa6487eca24dc3e15f43e`, clean tree after `npm ci`. Typecheck, lint and `check:config` pass on Node 22.
- `npx eas-cli@latest fingerprint:compare --build-id 074a1683-f983-4782-967e-7ec0e609cbab`: build 9's fingerprint `7a5bdc82abc50e41ab72d3eb819bf4f042c65633` matches the local directory.
- Published to channel/branch `production`. Update group ID `32dea6aa-0b95-44b7-ba36-e0e70ee1cd82` (iOS update `01a18612-47b9-7af4-bc06-f264879d4941`), runtime version `7a5bdc82abc50e41ab72d3eb819bf4f042c65633`, commit `4c270fa`. Message: "Messages, profile photos, shared plans, photo-verified workouts, live workouts with cheers, friend search and block". Testers get it after closing and reopening the app (twice: once to download, once to run it).

### Push readiness of build 9
- `embedded.mobileprovision` (profile "*[expo] com.turf.privatealpha AppStore", expires 2027-10-14): Entitlements include `aps-environment` = `production`, plus the app group, HealthKit and `beta-reports-active`.
- Signed entitlements in the main `ClassStreak` binary also include `aps-environment` = `production`. The binary contains the expo-notifications push token code (`expo-notifications` 57.0.23).
- Expo credentials (queried through the Expo API, because `eas credentials` has no non-interactive mode): the iOS push key `GQ77PWZVV7` (team YBRL6P4725) is assigned to `com.turf.privatealpha`. The widget bundle `com.turf.privatealpha.widgets` has no push key, which it doesn't need. The same key is also used by ForGood.
- `select count(*) from classstreak.push_tokens` on turf: **0**. No device has registered yet, which is expected because the update that registers tokens has only just been published. `classstreak.push_config.enabled` is still `false`, so no pushes go out until step 2 of the schedule file (push_config and the push sender) is run.
- No EAS build was started, and no Auth settings were changed.

## Push sending turned on, 2026-10-29 UTC
- Before: `pg_net` was not installed, `push_config` was off with no endpoint, and `send_push` was deployed with `verify_jwt=false` (version 1). `dispatch_push()` uses only `push_config.enabled` and `endpoint` and posts with no auth header, so no secret or extra setup is needed.
- Ran step 2 of `supabase/schedule-classstreak-social.sql` through the Management API in one transaction: `create extension if not exists pg_net` (0.20.4), `push_config` set to enabled=true with endpoint `https://qrehonivhqcgfrjcpzqk.supabase.co/functions/v1/send_push`, and cron job `classstreak-push` (jobid 3, `* * * * *`, `select classstreak.dispatch_push()`), which is active.
- Verified: `select classstreak.dispatch_push()` runs without error. `cron.job_run_details` shows `classstreak-push` succeeded, and `net._http_response` shows HTTP 200 `{"sent":0}` from `send_push`.
- At switch-on: `classstreak.push_tokens` 0, push outbox 0 pending / 0 sent / 0 failed. Pushes start once testers reopen the app (with the published update) and allow notifications, which registers their tokens.
- Recovery: `update classstreak.push_config set enabled=false;` (and `select cron.unschedule('classstreak-push');`). No migration was changed, no Auth setting was changed and no EAS build was started.
