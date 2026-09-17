# Turf — Technical build specification

**Version:** 1.0 · **Date:** September 16, 2026  
This is an implementation contract, not a claim that the proposed build has run. Implement only the M1 portions now.

## 1. Architecture

```text
Native Turf app on each iPhone
  Expo Router screens + Supabase session
  expo-location -> module-scope expo-task-manager handler
  encrypted SQLite queue -> authenticated Supabase database RPC
                                      |
                            private raw observations
                            derived owner-only visits
                                      |
                     M2: server rules and sanitized feed
                     M3: private commitment evaluator
```

Windows edits/tests JavaScript and TypeScript. A standard GitHub-hosted macOS runner generates and compiles the iOS project. The artifact contains a standalone physical-device Release app; SideStore supplies per-user signing. GitHub does not receive Apple passwords or provisioning profiles. [S03, S09–S11]

No EAS Build, EAS Update, paid hosting, PWA, Shortcuts, push provider, payment provider, Places API, or LLM API is required in M1. The domain is unused.

## 2. Toolchain and package selection

Baseline from the official matrix checked on September 16, 2026: **Expo SDK 57**, compatible **React Native 0.86**, **React 19.2.3**, **Node 22.13.x or newer supported version**, **iOS 16.4+**, **Xcode 26.4+**. These are compatibility lines, not permission to install arbitrary package patches. [S06]

At scaffolding, confirm SDK 57 is a stable published release and choose current compatible patch versions via Expo's installer. If the matrix/package availability differs, document the discrepancy and choose a documented stable compatible baseline; do not silently use a beta, independently upgrade React Native, or force unsupported build flags. Record exact resolutions in `docs/TOOLCHAIN.md` and commit `package-lock.json`.

Use **npm** consistently. Pin the Node major and resolved patch used in CI. Do not rely on floating `latest` in repeatable build scripts after bootstrap. Native iOS generation happens on the macOS runner. Generate into a temporary scaffold first if necessary to avoid overwriting the supplied documents.

| Component | Package/choice | M1 purpose |
|---|---|---|
| Runtime | `expo`, Expo-compatible `react`, `react-native` | Native app |
| Navigation | `expo-router`, template-required dependencies | Sign-in, setup, places, diagnostics |
| Location | `expo-location`, `expo-task-manager` | Native region callbacks |
| Backend | `@supabase/supabase-js` v2 compatible stable patch | Auth + typed database RPC |
| Secure key | `expo-secure-store`, `expo-crypto` | Store small encryption key; random IDs/bytes |
| Local storage | `expo-sqlite` with SQLCipher | Durable encrypted outbox/cache/session storage |
| Validation | `zod` stable patch, or equally strict explicit validators | Validate payloads and configuration |
| Testing | SDK-compatible `jest-expo`, Jest, React Native Testing Library | Reducer, queue, auth/storage, UI tests |
| Database testing | Supabase CLI + pgTAP | Schema and authorization verification |

Use `npx expo install` for Expo/native dependencies. Keep a single app, one native target, no extensions or app groups. Do not add `expo-dev-client`, `expo-notifications`, `expo-apple-authentication`, Google Maps, or new paid-service SDKs in M1. Default placeholder assets are sufficient.

`react-native-maps` with the platform iOS map can be evaluated later; M1's current-location/coordinate place input removes that build dependency.

## 3. Intended source structure

```text
index.ts                         # imports tasks before expo-router/entry
app.config.ts
app/
  _layout.tsx
  sign-in.tsx
  pairing.tsx
  tracking.tsx
  places.tsx
  debug.tsx
  settings.tsx
src/
  auth/                          # client, lifecycle, encrypted session adapter
  db/                            # local SQLite + generated Supabase types
  location/                      # permission adapter, tasks, registry, reconciliation
  sync/                          # durable queue, bounded worker, RPC adapters
  domain/                        # pure validation/state logic, not M2 scoring
  components/
  config/
supabase/
  config.toml
  migrations/                    # M1 schema/RPC/grants only
  tests/                         # pgTAP and fixture setup, never real users
scripts/
  build-ios-unsigned.sh
  verify-ipa.sh
  check-config.mjs
.github/workflows/
  checks.yml                     # low-cost JS/database checks
  build-ios.yml                  # manual native build only
native-locks/                     # reviewed Podfile.lock once first resolved
```

Codex may refine filenames without changing these responsibilities. Preserve the existing root spec files. A documentation package is not already a runnable scaffold.

## 4. Native configuration contract

Use a stable app name `Turf`, scheme `turf`, and an initial bundle identifier such as `com.turf.privatealpha`. Freeze the identifier before the first installed beta. It is not a backend user identity: SideStore may adjust signing identifiers differently for the two Apple Accounts.

Required native configuration:

```ts
// Configuration fragment, not a complete application file.
plugins: [
  'expo-router',
  ['expo-location', {
    locationWhenInUsePermission:
      'Turf uses your location to help you save places you choose.',
    locationAlwaysAndWhenInUsePermission:
      'Turf detects visits to your saved places while your phone is locked. '
      + 'You choose what to share with your one paired friend.',
    isIosBackgroundLocationEnabled: true,
  }],
  'expo-secure-store',
  ['expo-sqlite', { useSQLCipher: true }],
]
```

Verify generated `Info.plist` contains both location usage descriptions and `UIBackgroundModes: [location]`. Do not add `fetch`, `remote-notification`, `aps-environment`, Apple sign-in, associated domains, or app-group entitlements just because an earlier PRD listed them. No background mode is an unlimited execution entitlement. [S07]

Set a deployment target compatible with the chosen SDK and both phones. Do not blindly assert export-compliance flags for an app using encryption; there is no App Store submission in M1.

## 5. Auth, secrets, and account lifecycle

Create two confirmed email/password identities using the Supabase dashboard/admin API. Disable public sign-up. An admin-only two-slot allowlist further blocks an unauthorized third identity even if sign-up configuration changes. Bootstrap profile/settings rows only for those IDs. [S16, S24]

The app receives only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Those are public client configuration, not security boundaries. Authorization comes from the user's session, RPC checks, grants and RLS. Privileged keys and the database password are never bundled or supplied to the iOS build. [S17]

Use an asynchronous Supabase storage adapter backed by encrypted SQLite. Generate one small random 256-bit database key and store it in SecureStore using `AFTER_FIRST_UNLOCK`, with no biometric prompt requirement for background use. Do not store large session JSON directly as an unchecked single Keychain value. SecureStore documents accessibility and large-value limitations; SQLCipher is Expo's supported native encryption option. [S18, S19]

The local database contains auth/cache/outbox data, separated and checked by authenticated user ID. Implement atomic storage writes and serialization/locking for concurrent UI and task runtimes. No module may import UI state to recover its credentials. On each background sync opportunity, load the persisted session and refresh once if necessary; expire to `auth_required`, retain queued data securely, and report the state on the next foreground. Do not depend on an in-memory auto-refresh timer.

After reboot, protected storage may be unavailable until the user unlocks once. Mark that scenario as an execution limitation, not a successful capture. Detect a missing database with a leftover Keychain key after reinstall; clear stale local state and require sign-in rather than restoring another person's session.

Logout: set local paused first, stop monitoring, best-effort close the server session, clear credentials and private caches/queue, and navigate to sign-in even if remote logout fails. Unsent records discarded during explicit logout must not later upload under a different user. Warn in the UI that unsynchronized visits can be lost on logout/uninstall.

M1 includes actual app-data deletion and an honest admin-assisted Auth account deletion path. Do not label a settings reset as account deletion. The later self-service Auth deletion Edge Function must validate the requesting identity and run only server-side.

## 6. Pairing and configuration

Use database RPCs for atomic pair operations. Six-character random code, 24-hour expiry, single-use, only for the other allowlisted user. Store only a digest in a non-exposed schema. Limit attempts per authenticated account (proposed: five per 15 minutes). Failed attempts must persist the limit counter; a raised exception that rolls the counter back is not a working limiter.

A partial unique index permits at most one `pending` or `active` pair. Row locking serializes concurrent create/join attempts. Reject self-pairing and a third participant. Return minimal pairing/profile data without private settings, email, coordinates, or invite hashes.

First registration, adding a place, and resuming a capture session require connectivity in M1 so server identities/revisions are established. Once monitoring is active, capture continues offline and queues locally. Offline Pause works immediately. Do not call this initial setup an ongoing manual check-in requirement.

A place configuration row is immutable except activation/deactivation. An edit creates a new revision under the same logical `place_key`; events refer to that revision. Store only private place coordinates on the server, not a continuous breadcrumb stream. Disabling/deleting a place unregisters its active region and does not fabricate an EXIT.

## 7. Native geofence task and lifecycle

Define one stable task name, e.g. `TURF_GEOFENCE_V1`, at module scope in a file imported by `index.ts` **before** the router entry. The task must initialize storage/config/auth independently of mounted screens. TaskManager supplies a task event ID; retain it for deduplication. [S08]

Registration binds a server-issued capture-session ID, active device ID, and immutable place revision into each region identifier. Maintain a local durable registry mapping identifiers to these values. Register only when paired, consented, not paused, foreground/background permissions are actually granted, and required storage is usable.

On foreground: reload local state, query actual permission/task status, reconcile desired and registered places, and attempt queued sync. Re-register when configuration really changes, not on every render. A stale task flag is not proof of healthy monitoring.

On a native callback:

1. Validate task error/payload, identifiers, active device/session, and durable paused state.
2. Assign one stable event ID. Record task event ID, `ENTER`/`EXIT`, session, place revision, local sequence, and **callback observation time**. Do not collect a new GPS fix just to handle a region event.
3. Persist locally in a transaction **before** networking. Duplicate delivery of the same task ID must not create another local row.
4. Attempt a small authenticated upload batch with a bounded timeout (proposed: 25 records, one attempt, 5 seconds). Commit acknowledgments only for accepted/idempotently recognized records.
5. On timeout/offline/auth failure, leave records queued. Retry when another legitimate runtime opportunity occurs or when the app opens. Do not create a polling timer and claim it runs while suspended.

Callbacks describe a region, not a guaranteed fresh coordinate/accuracy sample. Do not apply the old `accuracy >100m` rule to a nonexistent callback field. For “use current location” setup, show available accuracy and ask the owner to correct an uncertain pin. [S07]

## 8. Event-to-visit state machine

Use deterministic replay per user/device/session/place revision, ordered by device observation time and sequence. Preserve raw observations as immutable evidence. The server owns derived visits; an identical replay returns the same rows/identities. Add a stable visit key tied to the opening event or a persisted derivation ID.

| Previous state / new observation | Result |
|---|---|
| Registration-time inside/ambiguous initial observation | Open a start-unknown visit, or remain awaiting a true transition; not automatically eligible |
| Known outside + ENTER | Open one normal visit |
| Already inside + ENTER | Preserve raw observation but do not open another visit |
| Open visit + EXIT | Close at observed time; compute duration only when valid |
| Unknown/outside + EXIT | Record outside state; no invented arrival/duration |
| Pause, logout, revision replacement, lost session | Interrupt open visit; incomplete/review-needed, not a fake qualifying visit |
| Implausible duration/clock sequence or uncertain boundary | Preserve evidence, mark review-needed |

An initial iOS callback can report current region state. Do not treat every initial inside report as a witnessed arrival. Where callback origin cannot be distinguished reliably, mark uncertainty and require an observed outside→inside transition for automatically qualifying attendance. [S07]

A missing exit must not become an all-night gym workout. Proposed upper review thresholds: gym >4h, mosque >6h, work >16h, custom >12h. These are anomaly-review thresholds, not physiological or behavioral judgments. Do not close a visit at the review threshold to invent a duration.

M1 retains separate overlapping place observations for diagnostics and marks conflicts. No scores exist yet. M2 must choose one evidence interval for overlapping same-activity visits, favor explicitly named places over inferred ones, and flag incompatible overlapping categories instead of double-counting.

## 9. Pause, device changes, and bounded persistence

Pause is local-first: atomically save `paused=true`, end the local capture session and queue its close control record, then unregister the geofence task. In-flight callbacks must check the persisted session generation and stop flag before writing. A network failure cannot keep local tracking active.

Previously captured records may synchronize after pause if they belong to the earlier session and precede its end. Post-pause records are rejected. Offline session-close controls must be applied before validating the affected event batch. Display backend pause status as last synchronized, not instant remote knowledge.

Allow one active capture installation per user. Claiming a replacement device revokes the old server device; stale uploads are rejected or reviewable, never silently counted as a second user's activity. Reinstall/login may require explicit re-registration.

Default retention is in the PRD. M1 cleanup runs on foreground and ingestion/admin maintenance opportunities; document that server cleanup is opportunistic until a retention cron is enabled. Do not pretend data was deleted on a deadline when no job ran. The app reports queue age/count and local/server storage errors. No artificial keepalive traffic just to evade a free-tier inactivity pause.

## 10. Supabase API contract

M1 uses authenticated Postgres RPCs for ingestion, pairing, session control, place management, and data deletion. An Edge Function is not necessary for M1's core path. The RPC validates `auth.uid()` and looks up the owner; clients never choose the effective owner.

Example *contract*, not a live endpoint response:

```ts
type GeofenceObservation = {
  event_id: string;             // UUID, generated once before local persistence
  platform_event_id: string;    // TaskManager executionInfo.eventId
  session_id: string;
  device_id: string;
  place_id: string;             // immutable revision row ID
  client_seq: number;
  kind: 'ENTER' | 'EXIT';
  observed_at: string;          // UTC ISO string from callback, not boundary truth
  initial_state_possible: boolean;
};

type IngestResult = {
  accepted: string[];
  duplicates: string[];
  rejected: { event_id: string; code: string }[];
  server_time: string;
};
```

Request limits: maximum 25 events and 64 KiB per call; validate finite numbers/UUIDs/timestamps; future-clock skew over five minutes is quarantined/reviewed; evidence older than retention is rejected with a clear code. These are proposed application limits. Sanitize errors and exclude raw input from public logs.

Write events and update derived visits in one transaction, with locks for affected session/place groups and uniqueness constraints. For out-of-order delivery, replay/reconcile rather than pairing an EXIT with whichever ENTER happened to upload last. Idempotency must survive app restarts, not just an in-memory Set.

See `docs/DATABASE_AND_RLS.md` for exact fields, grants, and RPC behavior.

## 11. Future scoring and commitment architecture — do not implement in M1

M2: place pure rule evaluators in a shared TypeScript domain module. A server Edge Function reads private eligible visits, produces proposed awards, and calls a server-only transactional `apply_awards` database routine. That routine serializes each user's relevant competition day/week, enforces caps and unique award keys, writes reversals, and produces a sanitized shared feed. User clients cannot call privileged award-writing paths.

Use an idempotent work queue or DB webhook plus retry sweep; a client being closed must not be the only way a server-side score finishes. Failed scoring jobs remain visible to the owner/operator. No native push is part of this step.

M3: snapshot agreement terms and both acceptances; calculate UTC deadlines from the stored IANA timezone. A Supabase cron can check due rows periodically, with a last-evaluated cursor and catch-up after downtime. It must not depend on phone-local midnight timers or on a fixed UTC offset. [S23]

The gym commitment counts distinct qualifying dates from eligible closed visits. Mosque qualification uses continuous interval overlap with the Friday window. Evaluate earliest deadlines first, apply the 48h evidence window, and keep failures proposed until mutual result acknowledgment. Client devices cannot write final winners or settlements for both parties. The recipient alone confirms received payment.

A future `CLVisit` adapter or unknown-place classifier needs a separate native/API/cost spec. Do not implement imaginary `expo-location.startVisitMonitoringAsync` methods.

## 12. Quality gates

Code-level M1 gates: install dependencies from lockfile; TypeScript strict checking; lint; queue/reducer/auth tests; fresh-database migrations; RLS/adversarial RPC tests; native config validation; reproducible unsigned build script; IPA inspection.

Real-device gates: Release launch without Metro; permissions; locked-screen region entry/exit; durable offline upload; token refresh while locked when execution is available; pause; relaunch; both Apple Accounts; stable upgrade; SideStore refresh. Record force-quit/reboot behavior separately rather than advertising it as guaranteed.

Completion must distinguish **implemented**, **automated checks passed**, **cloud build passed**, **installed**, and **field-tested**. All unobserved states are NOT TESTED.
