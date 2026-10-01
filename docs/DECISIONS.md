# Decision register

Prepared September 16, 2026. This register distinguishes user requirements from proposed engineering defaults; defaults can be changed before challenge acceptance.

## Fixed requirements

- Two consenting iPhone users, one private pair, no public users.
- Native automatic place monitoring, not a PWA or Shortcuts bridge.
- Windows locally; cloud macOS for compiling; SideStore/free Apple Accounts for alpha installation.
- Supabase Free; no mandatory paid APIs, domain hosting, payment processing, or Apple membership.
- Gym, work, mosque support. Private gym-three-days + Friday-mosque commitment, separate from normal points.
- No native remote friend push promised on free signing.
- Subject controls permissions, pause, data deletion, sharing, and optional accountability.
- Only M1 is currently authorized for coding.

## Proposed defaults, not previously confirmed personal settings

| Decision | Default |
|---|---|
| Shared competition timezone | America/Los_Angeles |
| Week | Monday 00:00 to next Monday 00:00 |
| Enabled places | At most 10 per user |
| Geofence radius | 150m; adjustable 75–400m |
| Gym minimum | 25 minutes; 3 distinct days for the commitment |
| Mosque minimum/window | 15 continuous minutes overlapping Friday; all-day Friday unless narrowed |
| Work threshold | 20 minutes for on-time eligibility; 6h for full-day award |
| Bet tie | No debt; end in tie; mutual restart only |
| Missing/late evidence | 48h evidence window, then unresolved cases remain reviewable |
| Financial finalization | Both acknowledge the proposed result |
| Local diagnostics/server raw retention | 7 days acknowledged / 30 days raw |
| Private visits retention | 90 days |
| Friend identity | User-entered; no hardcoded assumed name |
| Home requirement | Optional; only required for a specifically enabled home-based rule |

## Deliberate corrections to earlier drafts

1. Free installation is experimental, not equivalent to TestFlight. Seven-day refresh remains necessary. An unsigned IPA is not directly installable. [S01–S05]
2. Use a standalone **Release** physical-device build. A development client or simulator build does not meet the goal of running without a local Metro server. [S10]
3. The macOS cloud build needs no Apple account credentials. Signing happens on each phone; it is not a free EAS signing flow.
4. The two-person free Auth path is confirmed email/password accounts, not anonymous identities or Sign in with Apple.
5. M1 uses named geofences only. No claim that `expo-location` automatically exposes an Apple visit-monitoring API, classifies all unknown places, or wakes at fixed intervals.
6. Keep real callback observation times separate from server receive times. Geofence center coordinates are not a measured current location.
7. RLS restricts rows, not automatically individual columns. Separate private raw data from sanitized shared records. [S14, S25]
8. One shared competition clock replaces comparing week strings computed in different timezones.
9. Sunday 20:00 is only a preview. Final results follow the closing deadline and evidence resolution.
10. Gym/mosque absence is not established by a missing sensor event. Inferred, paused, or uncertain observations cannot automatically finalize money owed.
11. Do not implement original point multipliers or inferred-visit auto-confirmation until a later milestone defines them precisely.
12. A lack of callbacks for six hours is not a broken-tracking diagnosis; a stationary user can be legitimately silent. Status reports last observed information and uncertainty.

## Setup values left blank

Bet amount and currency, starting week, friend's chosen name, user credentials, backend identifiers, exact places and schedules. These are supplied securely during setup, not invented in the code or seeded from this chat.

### Number and boxing-icon follow-up

Updated app stats to Manrope semibold tabular figures, preserving serif editorial headings. Boxing now uses a rounded glove with a thumb and cuff instead of the previous angular outline. Missing server-function responses now show a recovery message without database identifiers; the actual Studio and friend-profile functions were deployed in the preceding release.

Validation: typecheck, ESLint, configuration and seven focused domain/reminder tests passed. Reviewed the weights/boxing goal card in the phone web preview. Packaged JS commit 6cd4bab against the unchanged verified native payload; Hermes compatibility, ZIP integrity and all 165 native entries checked. Physical iPhone installation and visual acceptance remain untested. Updated the existing private Drive IPA in place.


### Preserve active timers during unconfirmed boundary exits

A member reported an arrival notification and timer followed by a disappearing timer and no recorded workout. Their exact cause is not yet confirmed without device diagnostics. Code inspection identified a reproducible failure path: an individual native geofence EXIT immediately cleared the arrival even when too short to count.

Native boundary exits now retain the active workout and original capture until the existing independent location confirmation observes two fresh, accurate outside readings separated by at least 30 seconds. Re-entry preserves the original timer. Manual Stop remains available if location updates cannot confirm departure. No route outside the saved place is retained. The existing four-hour limit, owner protections and server qualification rules remain unchanged. Debug now reports the active workout, pending boundary confirmation, Lock Screen activity status and last location-task issue.

Validation: nine departure adapter tests, one active-workout adapter test and nine Live Activity adapter tests passed in isolated harness processes; typecheck and ESLint passed. The reported physical-phone failure is not reproduced or proven resolved. This change prevents the identified single-boundary failure path; it does not claim to recover the previously missing workout.
