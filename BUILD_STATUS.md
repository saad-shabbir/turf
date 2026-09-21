# ClassStreak build evidence

- All nine v4 milestones are committed in order on classstreak-v4. Final screen and reminder fixes pass local checks.
- TypeScript and ESLint pass. All 19 ClassStreak domain/database tests pass; four synthetic IPA validator tests pass.
- The iOS Hermes production bundle compiled locally. Native compilation passed in GitHub Actions run 35570176395 (commit 3240202), using Xcode 26.4.1, CocoaPods 1.17.0, Node 24.19.0 and npm 11.6.1. The app and WidgetKit extension target iPhoneOS 16.4+, and the Health module is linked. Physical iPhone acceptance is NOT TESTED.
- Hosted deployment on 2026-09-21 UTC: eight additive ClassStreak migrations succeeded, all 27 ClassStreak tables have RLS, and the photo bucket is private. Both existing Auth users and all nine public Turf tables remain intact.
- Hosted seed_demo, rollup and delete_account functions are deployed. Each rejects missing and invalid user tokens with HTTP 401. No real account was deleted during testing.
- ClassStreak maintenance is active every 15 minutes. New email signup is still disabled pending authorization; existing users can sign in.
- Visual review uses the real screen components with disposable fixtures, separately from native acceptance. Welcome, onboarding goals, Home, Profile, Friends, session sheet, Post and Plus were inspected at a phone viewport; narrow-screen checks are recorded separately below.
- Invitation HTML is on classstreak-pages. GitHub Pages activation is pending separate public-hosting approval. No custom domain is claimed.
- SideStore installation, real geofences, background recovery, camera/export, Health access and widget behavior remain NOT TESTED on a physical iPhone.

- The successful native Podfile.lock is saved and committed for future deterministic resolution. No native inputs changed after the successful native build. The latest JavaScript/assets are embedded locally with the matching Hermes format so the Places key does not leave the local build workflow.
