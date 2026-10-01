# Turf coding-agent instructions

Build **Milestone 1 only**. Read `PRD.md`, `TECH_SPEC.md`, `docs/DATABASE_AND_RLS.md`, `docs/BUILD_AND_SIDELOAD.md`, and `docs/MILESTONE_01.md` before editing. PRD defines behavior; the technical documents define security and execution contracts. Conflicts must be recorded, not silently resolved by weakening privacy.

## Non-negotiable boundaries

- Two allowlisted users, one live pair, own-device consent. No third-party tracking, Find My scraping, PWA, Shortcuts, Android, or public sign-up.
- Expo/React Native/TypeScript, Supabase Free, Windows-local development, hosted macOS compilation, unsigned device IPA for per-person SideStore signing.
- No paid resources, payment activation, Apple credentials in CI, EAS signing, native APNs, Sign in with Apple, or external places API in M1.
- Deliver real persistence and authorization. Never fake a successful login, geofence, upload, IPA build, or physical-device test.
- Server derives the authenticated owner; never trust a submitted `user_id`. Raw places/events/visits stay owner-only. Never put service-role/secret keys into the app, public environment variables, logs, or GitHub build artifacts.
- Tasks must be defined at module scope and imported before router boot. Local durable queue precedes networking. No always-running timer or guaranteed background heartbeat.
- Preserve idempotency, pause/logout stop behavior, session/device binding, duplicate/initial-state handling, and honest incomplete visits.
- Do not ship real coordinates/passwords in test fixtures. Simulation is labeled and excluded from real attendance evidence.
- No scoreboard, point engine, monetary commitment logic, challenges, streaks, inference, or notification SDK in M1.

## Workflow

Use exact dependency resolutions and a committed lockfile. Record toolchain versions. Scaffold without overwriting these specification files. Use official upstream docs for unknown/current APIs. Keep cloud iOS builds manual, on standard runners, with short artifact retention; do not enable paid overages.

Create reviewed migrations and authorization tests. Use a disposable database for reset/test commands, never a populated production project. Do not create remote accounts or publish a repository without authorized credentials/actions. Missing access is a documented manual setup step, not permission to invent it.

Run type checking, lint, unit tests, and database tests when available. Report checks as PASS / FAIL / NOT RUN with reasons. Distinguish code completion, successful cloud compile, signed installation, and observed background behavior. Stop at M1 and leave later milestones untouched.

At handoff supply changed files, commands, migration order, environment setup, test results, artifact path if actually built, current blockers, and the exact next human field test. Never report physical-device acceptance from mocked tests.
