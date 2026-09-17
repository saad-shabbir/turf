# Turf — Database, RLS, and RPC contracts

**M1 contract, with clearly separated future schema.** Codex must produce executable, tested migrations from this design. This document is not a migration that has already run.

## 1. Principles

Enable RLS on every exposed application table and use least-privilege grants. A public schema is not the same thing as public access. Separate private observation tables from future peer-readable summaries. RLS filters rows; selecting only a category in the app does not protect other columns. [S14, S25]

Use `auth.users` for credentials. Never store passwords in application tables. All user-owned rows reference Auth UUIDs with deliberate deletion behavior. `auth.uid()` is the authority; a payload `user_id` is not.

An administrative database/secret key can access private rows. Do not claim E2E encryption or protection from the project administrator. Secret keys stay out of app/CI build configuration. [S17]

## 2. Types

Use Postgres enums or checked text, with identical generated TypeScript unions:

- `place_category`: gym, work, mosque, home, custom.
- `pair_status`: pending, active, ended.
- `visit_status`: open, closed, interrupted, needs_review, rejected.
- `observation_kind`: ENTER, EXIT.
- `capture_end_reason`: paused, logout, place_change, unpaired, replaced_device, deleted_data.

Use `uuid` identifiers, `timestamptz` UTC instants, `date` for local competition dates, and `integer/bigint` for counters. Lat/lng are finite checked doubles in geographic ranges, never text. Store radius in metres and duration in integer seconds. No floating-point currency.

## 3. M1 tables and constraints

All timestamps below are UTC except explicitly local scheduling settings.

### Non-exposed `private` schema

**`private.allowed_users`**

`slot smallint primary key CHECK (slot IN (1,2)), user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now()`

Only the administrator seeds these slots. No app role may add a third row or reassign a slot. Removing an account from this list invalidates its app access even if its Auth token is still valid.

**`private.pair_invites`**

`id uuid PK, pair_id uuid FK pairs ON DELETE CASCADE, created_by uuid FK auth.users, code_digest bytea UNIQUE, created_at, expires_at, consumed_at nullable`

Hash a cryptographically generated six-character code. Return plaintext only to its creator at creation; never expose this table through the API. Old/reissued/expired codes cannot join a pair.

**`private.invite_attempts`**

`user_id uuid FK auth.users ON DELETE CASCADE, window_started_at timestamptz, attempts integer CHECK >=0, PRIMARY KEY(user_id, window_started_at)`

The public join RPC updates this transactionally and returns failure codes without rolling back the counter. No client write privileges.

### Exposed `public` schema with RLS

**`profiles`**

`user_id uuid PK REFERENCES auth.users ON DELETE CASCADE, display_name text CHECK length 1..40, created_at timestamptz, updated_at timestamptz`

This table contains only safe display identity, not email, mosque preference, work schedule, coordinates, or tokens.

**`user_settings`**

`user_id uuid PK REFERENCES auth.users ON DELETE CASCADE, display_timezone text, collection_consent_at timestamptz nullable, share_gym boolean, share_work boolean, share_mosque boolean DEFAULT false, updated_at timestamptz`

Validate timezone against Postgres timezone names. Defaults for gym/work sharing are displayed and affirmatively saved by the owner during setup; do not infer consent just because a seed row exists. Work schedule/rule settings arrive in M2, not M1.

**`pairs`**

`id uuid PK, user_a uuid NOT NULL FK auth.users, user_b uuid nullable FK auth.users, status pair_status, competition_timezone text DEFAULT 'America/Los_Angeles', created_at, activated_at nullable, ended_at nullable`

Checks: users distinct; pending has no user_b; active has both users and activation time; ended has end time. RPC verifies both IDs are allowlisted. A partial unique index on a constant WHERE status IN ('pending','active') allows only one live pair for this app. Ended historical pairs can remain.

Auth identity deletion removes/ends the pair and revokes sharing. Avoid cascading a user's deletion into the other user's owner-only raw data: referencing capture/visit `pair_id` uses `ON DELETE SET NULL` where retention of the peer's personal rows is appropriate.

**`devices`**

`id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, installation_id uuid, active boolean, created_at, last_runtime_at nullable, last_sync_at nullable, app_version text, os_version text, UNIQUE(user_id, installation_id)`

Partial unique index `(user_id) WHERE active` enforces one capture installation per user. Device model/name is not necessary. No precise device fingerprints or Apple IDs.

**`places`**

`id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, place_key uuid, revision integer CHECK >0, label text CHECK length 1..80, category place_category, latitude double precision, longitude double precision, radius_m integer CHECK BETWEEN 75 AND 400, min_dwell_seconds integer CHECK BETWEEN 0 AND 86400, active boolean, created_at, disabled_at nullable, UNIQUE(user_id, place_key, revision)`

Geographic checks: finite latitude −90..90 and longitude −180..180. Partial unique `(user_id, place_key) WHERE active`. Max 10 active places per user enforced in a locking RPC. Coordinates/category/dwell/radius are immutable on an existing revision. Changing them deactivates that revision and inserts the next. Event evidence retains its referenced revision until history deletion/retention.

**`tracking_sessions`**

`id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, device_id uuid FK devices, pair_id uuid nullable FK pairs ON DELETE SET NULL, generation bigint, started_at timestamptz, ended_at nullable, end_reason nullable, created_at timestamptz DEFAULT now(), UNIQUE(device_id, generation)`

A session binds an active device, current pair and consent. Max one active session per device. Closing a session is idempotent. Offline-close time is an observation subject to validation; it is not a trusted server timestamp.

**`geofence_events`**

`id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, device_id uuid FK devices, session_id uuid FK tracking_sessions, place_id uuid FK places, platform_event_id text, client_seq bigint CHECK >0, kind observation_kind, observed_at timestamptz, received_at timestamptz DEFAULT now(), initial_state_possible boolean, validation_status text, validation_reason text nullable`

Uniqueness: `(device_id, platform_event_id)` and `(device_id, client_seq)`. RPC accepts the client UUID once and treats retries idempotently. Validate all referenced records belong to the same authenticated owner and the approved device/session. Include composite keys/FKs or explicit validation to prevent cross-owner references. Events contain **no new latitude/longitude fields**: the private place revision holds the region center.

**`visits`**

`id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, device_id uuid FK devices, session_id uuid FK tracking_sessions, pair_id uuid nullable FK pairs ON DELETE SET NULL, place_id uuid FK places, category place_category, opening_event_id uuid nullable FK geofence_events, closing_event_id uuid nullable FK geofence_events, stable_visit_key text, observed_start_at timestamptz nullable, observed_end_at timestamptz nullable, dwell_seconds integer nullable CHECK >=0, status visit_status, start_known boolean, quality_reason text nullable, derived_version integer, created_at, updated_at, UNIQUE(user_id,stable_visit_key)`

Times/duration may be null when evidence is incomplete. Do not make null start equal the upload time. Deleting old raw events sets visit event references to null, retaining explicit retention metadata and derived summary until the visit's own deadline. Invalid intervals cannot become eligible. Client read only; derivation is server-controlled.

**`diagnostic_events`**

`id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, device_id uuid nullable, session_id uuid nullable, code text, detail_safe text nullable, observed_at, received_at`

Strict allowlist of diagnostic codes and a short sanitized detail. No raw headers, credentials, addresses, complete task payloads, or arbitrary third-party JSON. Exclude detailed private diagnostics from CI logs and shared feed.

## 4. RLS access matrix

All app access first requires allowlisting. “Peer” means the other participant in the **current active** pair, not any historically paired user.

| Table | Owner read | Current peer read | Client direct writes |
|---|---|---|---|
| profiles | Yes | Safe profile row only | Own `display_name` only, or guarded RPC |
| user_settings | Yes | No | Guarded owner settings RPC |
| pairs | If participant | Same pair row | None; pairing/unpair RPCs |
| devices | Yes | No | None; guarded device RPCs |
| places | Yes | No | None; guarded revision RPCs |
| tracking_sessions | Yes | No | None; session RPCs |
| geofence_events | Yes | No | None; ingestion RPC only |
| visits | Yes | No | None; derived on server |
| diagnostic_events | Yes | No | Guarded sanitized ingestion only |
| private schema tables | No | No | No |

Anonymous, non-allowlisted, and unrelated users get no records. No Realtime publication of owner-only raw tables for the peer. M1 needs no shared visit feed. Pairing synchronization can use a minimal refresh/foreground fetch or RLS-protected pair subscription.

### Policy pattern

Illustrative SQL to incorporate into tested migrations:

```sql
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.places FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.places FROM authenticated;
GRANT SELECT ON public.places TO authenticated;

CREATE POLICY places_read_owner ON public.places
FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND (SELECT private.is_allowed())
);
```

`private.is_allowed()` and `private.is_current_peer(target_user_id)` are small vetted helpers with no side effects or private-data return values. They may be `SECURITY DEFINER` to avoid recursive RLS, with `SET search_path = ''` and fully qualified object names. Grant only schema usage plus narrowly required function execution; no direct table access. The private schema is not exposed in Data API settings.

Every exposed definer RPC checks allowlist and actor identity internally because its owner can bypass RLS. Revoke default PUBLIC/anon EXECUTE; explicitly grant each intended RPC to authenticated. Define service-only future routines separately. Do not rely on a user-supplied actor ID or on RLS to rescue an unchecked definer function. [S15]

Use real sanitized tables for later sharing. A broad default-security view over private visits is not a safe substitute; views require their own deliberate security design. [S14]

## 5. Required M1 RPC interfaces

Names may differ only if docs and generated types are updated together. Returns are typed success/error records with stable codes, not unstructured exception text.

| RPC | Required behavior |
|---|---|
| `get_my_setup_state()` | Return current safe profile, own settings, pair status, and device status; no peer-private data |
| `update_my_settings(patch)` | Allowlist fields and actor; collection/sharing changes do not edit peer settings |
| `create_pair_invite()` | One live pair, random code, digest+expiry, rotate prior unused code, return code once |
| `join_pair(code)` | Normalize, persist rate limit, verify digest/expiry, row lock, reject self/third user, consume once |
| `end_my_pair()` | Participant only; end pair, invalidate invites, close capture sessions, revoke future shared access |
| `claim_device(installation_id, version_info)` | Atomically activate one device; revoke prior capture sessions |
| `save_my_place(input)` | Validate owner/category/geometry; enforce 10-place cap; add immutable revision |
| `disable_my_place(place_id)` | Owner only, deactivate for future capture; no invented departure |
| `begin_capture(device_id)` | Require active pair/consent/device; create server session; no auto-start of phone permissions |
| `end_capture(session_id, observed_end_at, reason)` | Owner/session check; idempotent; valid pre-end queued evidence remains ingestible |
| `ingest_geofence_batch(events, pending_session_closures)` | Apply validated closure controls, insert once, reconcile visits transactionally, return per-ID acknowledgments |
| `record_my_diagnostic(code, safe_detail)` | Strictly limited text/codes; owner derived from auth |
| `delete_my_app_data()` | Stop/end own sessions, end pair, purge owner's raw/derived/settings data and sharing; return a real deletion result |

`delete_my_app_data` need not delete `auth.users` in M1; its UI must state the distinction and provide admin-assisted account deletion steps. Re-bootstrap only deliberately, never automatically restore deleted tracking data at next sign-in.

Ingestion validates all entity ownership and session timestamps. A late older event may require replaying the affected visit sequence; a batch's commit and deterministic derivation must be atomic. Do not silently drop a rejected record from the local debug queue. Do not trust a session's posted user ID or the order batches reach the server.

Suggested stable error codes: `NOT_ALLOWLISTED`, `PAIR_REQUIRED`, `PAIR_ALREADY_EXISTS`, `INVALID_OR_EXPIRED_CODE`, `RATE_LIMITED`, `WRONG_DEVICE`, `STALE_SESSION`, `NOT_OWNER`, `INVALID_INPUT`, `CLOCK_REVIEW`, `RETENTION_EXPIRED`, `AUTH_REQUIRED`.

## 6. Future tables — design only, do not create in M1

- `rules(id, key UNIQUE, label, config jsonb, points integer, default_on, negative, version)` and `user_rules(user_id, rule_id, enabled, effective_from)`.
- `point_events(id, pair_id nullable, user_id, rule_key, rule_version, visit_ref_private, base_points, multiplier_snapshot, final_points, award_key UNIQUE, reversal_of nullable, occurred_at, week_start_utc)`; clients cannot write awards.
- `shared_activity(id, pair_id, subject_user_id, category, template_key, points, safe_day, created_at, revoked_at nullable)`; **no raw visit/place IDs, names, coordinates or free-form private notes**. An operator-only mapping relates it to source evidence.
- `streaks(user_id, rule_key, current, best, last_qualified_period)` and `badges(user_id, badge_key, earned_at)`.
- `commitments(id, pair_id, terms_version, timezone, starts_at, gym_days_target, gym_dwell_seconds, friday_window_start/end, mosque_dwell_seconds, stake_minor, currency, evidence_grace_hours, state)`.
- `commitment_acceptances(commitment_id, user_id, terms_hash, accepted_at)`; both accept exactly the same immutable terms.
- `commitment_periods(id, commitment_id, week_start_utc, mosque_deadline, gym_deadline, review_deadlines, evaluation_state)`.
- `commitment_progress(period_id, user_id, gym_days_count, mosque_met, evidence_state, evaluated_at)`; sanitized peer-readable aggregates, no exact places.
- `commitment_reviews(id, commitment_id, deadline_at, proposed_outcome, proposed_loser nullable, reason_code, status, created_at)` and `review_votes(review_id, user_id, decision, submitted_at)`.
- `settlements(commitment_id, payer_id, recipient_id, amount_minor, currency, state, reported_paid_at, confirmed_received_at)`; recipient controls confirmation.
- `visit_corrections(id, user_id, visit_id, proposed_change, reason, affects_commitment, state, created_at)` and approvals; private raw changes, sanitized shared consequences.
- `reactions(shared_activity_id, user_id, emoji, created_at)` with membership and allowed-emoji checks.
- Non-exposed idempotent work queue/scheduling cursor and private source mappings.

Use distinct sanitized progress tables instead of granting a peer read access to private evidence. No privileged `winner_id`, `points`, `confirmed_received`, or other participant's acceptance can be supplied as an unchecked update.

## 7. Required database tests

Use disposable fixtures, then run as `anon`, authenticated A, authenticated B, and authenticated C (a real Auth fixture deliberately absent from the two-slot allowlist). Admin fixture setup is not evidence that RLS works; assertions must execute under the intended roles/JWT subjects.

M1 tests must verify:

1. Exactly two allowlist slots; a third slot and non-allowlisted app access fail.
2. A can read A's private place/events/visits, while B cannot—even when selecting `*` or guessing IDs. C and anon cannot read either.
3. Both see only the safe active pairing and display names. Ending the pair revokes peer reads.
4. A cannot modify B's settings/place, ingest with B's session/place/device, or start monitoring for B.
5. Clients cannot directly insert/update derived visits, memberships or raw events outside the guarded RPC.
6. Expired/self/reused invite and concurrent join attempts are handled; failed code attempts really increment the persisted limiter.
7. Repeated upload returns duplicate acknowledgment and one logical event/visit. Out-of-order delivery produces the same derived result as ordered delivery.
8. Start-unknown, orphan EXIT, short stay, duplicate ENTER, reversed time, large clock skew and session interruption never become fabricated qualifying duration.
9. A device replacement and a paused/ended generation cannot produce new valid attendance. Legitimate pre-pause queued events still upload.
10. Data deletion purges the correct owner's records and invalidates sharing without exposing or deleting the peer's unrelated private history.
11. A future `point_events`/shared summary migration will need its own privilege tests; M1 does not pass that work by implication.

Include SQL/migration tests for unique indexes, nullable incomplete timestamps, exact function grants, private-schema exposure, and policy recursion. Report NOT RUN explicitly if the database test environment was unavailable.
