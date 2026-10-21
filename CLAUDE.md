# ClassStreak: notes for Claude Code

ClassStreak is an iPhone fitness app that checks people in automatically at the studios and gyms they save. It also has a friend league and a feed. It is built with Expo SDK 57, React Native, TypeScript and expo-router. "Turf" is the app's old name, so the repo, the Expo slug, the URL scheme and the bundle ID still say turf.

Before changing app behavior, read AGENTS.md, DECISIONS.md and docs/CLASSSTREAK_RUNBOOK.md. On releases and setup, this file is the current one. Older notes in the docs and BUILD_STATUS.md about SideStore, unsigned IPAs, disabled sign-up or "no paid Apple account" are history.

## Where things are
- `app/`: expo-router screens (`_layout.tsx`, `index.tsx`, `account.tsx`)
- `src/`: app code. `classstreak/` holds the screens and features, `db/` the encrypted SQLite store, `domain/` the business rules, `location/` visit detection, `sync/` Supabase sync, `auth/` sign-in
- `modules/classstreak-health/`: local native module that reads workouts from Apple Health
- `plugins/with-classstreak-privacy.cjs`: config plugin that sets the Health purpose strings
- `supabase/`: migrations, Edge Functions (`seed_demo`, `rollup`, `delete_account`) and maintenance SQL
- `tests/`: Node tests. `scripts/`: config checks and build helpers. `docs/`: runbook, decisions and validation notes

## Identifiers (never change these)
- Bundle ID `com.turf.privatealpha`, widget `com.turf.privatealpha.widgets`, app group `group.com.turf.privatealpha`
- URL scheme `turf`; the auth redirect is `turf://account`
- Expo project `@saadpm1/turf` (project ID `75c75ece-53c4-4a69-8989-43513fe97cae`)
- Apple Team ID `YBRL6P4725`; App Store Connect app `6822943355`

## Supabase
- ClassStreak uses the Supabase project "turf" (ref `qrehonivhqcgfrjcpzqk`). Never touch Saad's other project, "forgood".
- Cloud sessions have `SUPABASE_ACCESS_TOKEN` (a scoped personal access token) and `EXPO_TOKEN` in the environment. Never print them, write them into files or commit them.
- Keep row-level security on every table. Never reset the hosted database and never replay old migrations: the first three Turf migrations (`202609160001` to `202609160003`) are historical. Inspect the hosted schema before applying anything, apply new migrations in order inside a transaction, and keep a recovery path.
- Leave the nine public Turf tables and the `forgood_docs` table alone. ClassStreak's data lives in the private `classstreak` schema plus its RPCs, views and private photo storage.
- Auth: sign-ups are on, "Confirm email" is off (Supabase's built-in email only sends to team members, 2 emails an hour), and `turf://account` is an allowed redirect. Ask Saad before changing any Auth setting.
- Never put a service-role or secret key in the app or in an `EXPO_PUBLIC_` value.

## App config values
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_GOOGLE_PLACES_KEY` and `EXPO_PUBLIC_ENABLE_DIAGNOSTICS` live in the EAS "production" environment (`npx eas-cli@latest env:list --environment production`), never in git. A local `.env` is ignored by git.

## Checks before shipping
1. `npm ci`
2. `npm run typecheck`, `npm run lint`, `npm test` and `npm run check:config`
3. `npx expo-doctor`
4. `npx expo config --type introspect --json`, then confirm the Info.plist purpose strings are there, including `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`. Apple rejected build 7 because one was missing.

## Shipping a fix
- A JavaScript-only change (screens, text, logic, styling, JavaScript-only packages) ships without a new build:
  `npx eas-cli@latest update --channel production --environment production --message "<what changed>"`
  Testers get it after they close and reopen the app.
- A change to native code, a native library, a permission, app.config.ts, a config plugin or the icon needs a new build. Each build uses one of Saad's 15 free Expo iOS builds a month, so never start one without asking him.
- Batch native changes. Saad doesn't want builds spent one change at a time: collect everything that needs a build (native code or libraries, permissions, entitlements, app.config.ts, config plugins, `modules/`, widgets, the icon) and ship it together in one build, sending everything else as over-the-air updates meanwhile. Before any build, run a preflight: all checks above, every privacy-sensitive API that the app's native libraries reference has its purpose string (scan the native code in `node_modules` and `modules/`; Apple rejected ClassStreak build 7 and ForGood build 1 for missing ones), and entitlements match the App ID capabilities and provisioning profiles on Expo. A build Apple rejects still counts toward the 15, which ClassStreak shares with ForGood. Builds run from his laptop, because the App Store Connect API key file is in `C:\Users\saad-\.private\` (the submit profile in eas.json points there). Commit and push before any build, and build only from a clean tree (`git status` shows nothing). The runtime version is a fingerprint of the files on disk, so uncommitted edits give a build that no commit can publish updates to. Build 8 (runtime `4f58a86f…`) is like this.
- Before `eas update`, run `npx eas-cli@latest fingerprint:compare --build-id <build id>` from the checkout you will publish from, and publish only if it matches. `eas.json`, `.gitignore`, config plugins and native module files are part of the fingerprint.

## TestFlight
Builds go through EAS Build and EAS Submit to TestFlight. The internal group "Team (Expo)" gets builds without review. The external group "Friends" joins through a public link once Beta App Review approves a build. TestFlight builds expire after 90 days. Keep the public TestFlight link out of this repo, because the repo is public.

## Git
`main` is the working branch. Make changes on a branch, open a pull request into `main`, and merge it once the checks pass.
