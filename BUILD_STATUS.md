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

## Deploy 2026-10-29: plan fallback (approved by Saad on 2026-10-28)
- Commit `33d7dcd1e1cdc73f548b88ce1611ff3660d8f848` (main, PR #7). `npm ci` passed. Under Node 24.22.2, typecheck, lint, `npm test` (26/26), `test:db` (105/105) and `check:config` all passed.
- Migration `202610290019_classstreak_plan_fallback.sql` was applied to turf (`qrehonivhqcgfrjcpzqk`) in one transaction through the Management API at 2026-10-29T06:26:58Z. Before applying, the hosted schema showed 0018 present (the `classstreak.messages` table, the `classstreak-social` cron, and `plan_days`/`cs_messages` bodies byte-identical to 202610280018) and 0019 absent. Until now, this file had no record of individual migrations by name.
- After applying, `classstreak.plan_days` and `public.cs_messages` match the 0019 bodies, with grants unchanged (`plan_days` owner-only; `cs_messages` for authenticated and service_role). `plan_days` returned 7 days without error for a synced real user and an unsynced one. The `classstreak-push` (every minute) and `classstreak-social` (every 5 minutes) cron jobs are active. To roll back, re-create both functions from 202610280018.
- `fingerprint:compare` against build 9 (`074a1683-f983-4782-967e-7ec0e609cbab`): `7a5bdc82abc50e41ab72d3eb819bf4f042c65633` matches.
- EAS Update on channel production: update group `e3c2085e-059e-48e4-8b5a-50686ddc8a44`, iOS update `01a18659-3b53-73c6-acec-fd5c9cd12ba8`, runtime `7a5bdc82abc50e41ab72d3eb819bf4f042c65633`.
- No EAS build was started. No Auth settings were changed.
