# Turf — Product requirements

**Version:** 1.0 · **Date:** September 16, 2026  
**Product:** Private two-player native iPhone location game  
**Current implementation authorization:** Milestone 1 only

## 1. Product and promise

Turf turns visits to places into a private game between Saad and one friend. Its working pitch is **“Find My, but it keeps score.”** The product has its own location consent and event collection; no Find My integration or access to another app's location stream is part of the implementation.

After one-time account, pairing, permission, and place setup, normal visits require no manual check-in, photograph, Shortcut, Safari session, or running Windows computer. A phone observes an arrival/departure, Turf derives a visit, and the backend evaluates the agreed rules. The other person sees permitted activity summaries and scores, not a live trail.

A visit establishes apparent presence, not proof of exercising, working, or participating in prayer. Turf is a trust-based game, not an attendance certification or anti-cheating system.

## 2. Constraints and explicit limitations

Exactly **two allowlisted accounts** and at most one live pair. Both people use their own iPhones and consent for themselves. No public sign-up, follower graph, third player, advertisements, or monetization in v1.

Development uses Windows. A GitHub-hosted Mac performs native compilation; SideStore signs the resulting unsigned physical-device IPA on each phone with that person's Apple Account. This proposed combination requires end-to-end testing. It is not an EAS free-account signing feature. [S03–S05, S09–S11]

There is no native remote push in the free alpha. A server cannot instantly alert a closed friend's native app through APNs on this free Personal Team route. The feed updates while connected/open and reloads on foreground. Later local reminders are optional and must not be confused with remote friend notifications. [S02]

Seven-day provisioning renewal and SideStore's setup are accepted alpha compromises, not a seamless-install promise. Background location itself is also subject to permissions and system execution. No promise of surviving every force-quit, reboot, expired signature, network loss, or OS update. [S01, S04, S05, S07, S20]

## 3. Scope: full plan versus first build

| Stage | Included | Not included at that stage |
|---|---|---|
| **M1 — feasibility and private capture** | App shell, two accounts, invite pairing, permissions, one or more named places, geofence ENTER/EXIT capture, offline queue, private raw-visit debug screen, pause, privacy controls, unsigned IPA workflow | Points, scoreboard, shared activity feed, bet logic, streaks, inference, notifications |
| **M2 — basic game** | Gym/work scoring, safe shared feed, weekly and lifetime scores, rule consent, corrections, reactions | Multipliers, broad inference, money handling |
| **M3 — private commitment** | Gym 3 days/week + Friday mosque agreement, progress, deadline evaluation, review, manual settlement record | Payment collection or enforcement |
| **M4 — optional game depth** | Weekly goal streaks, badges, fixed challenges, optional self-accountability, history, in-app recaps | Paid features enabled without permission |
| **Later research** | Unknown-place detection/classification; advanced multipliers and proximity rules; paid native distribution and push if separately approved | Not required for the zero-cost launch |

M2–later are roadmap descriptions, **not authorization for Codex to implement them now**.

## 4. First-run experience

Each person signs in with their pre-created Turf email/password account. Apple credentials are used only in SideStore's installation process, never as Turf credentials. No anonymous/device-only account, Sign in with Apple entitlement, or emailed magic-link dependency in the alpha.

One user generates a six-character invite code; the other enters it. The code expires after 24 hours and is single-use. Pairing requires an already allowlisted account. Pending users can manage their account and see setup/help; normal tracking starts only after pairing. Sign-out, privacy, and deletion controls must remain accessible when setup is incomplete.

Each person sees what activity categories may be shared and grants location permission through a staged explanation. Request foreground access first, then background access. Show the actual permission state; do not label “While Using” as automatic background tracking. Denial leaves read-only/account access usable, with a settings link rather than a permission prompt loop.

Named places can be added using current location or an entered latitude/longitude in M1. A map pin is later polish, not a paid API dependency. Categories are `gym`, `work`, `mosque`, `home`, and `custom`. A mosque is added and labeled only by its owner; there is no automatic religious-place classification in the alpha.

Proposed geofence radius: **150 metres**, adjustable from 75 to 400 metres. This is an observation boundary, not a promise of GPS precision. Cap enabled places at **10 per user** initially, below iOS's documented 20-region limit. [S07]

Home is **optional**, not required for gym/work/mosque play. Enable home-dependent rules only after the owner explicitly adds a home place.

## 5. Visit detection and correction

### Named places

Register enabled places in the native geofence task. Log received ENTER and EXIT callbacks, then derive open/closed visits. Record observation time and server receipt time separately. Do not pretend a callback includes an exact border-crossing timestamp, fresh GPS fix, or accuracy measurement it does not provide.

Normal points are calculated after a visit closes. An apparent arrival does not immediately establish 25 minutes at a gym. No permanent background JavaScript timer is required or assumed.

Proposed minimum dwell times:

| Category | Minimum for its usual rule |
|---|---:|
| Gym | 25 minutes |
| Work on-time eligibility | 20 minutes |
| Friday mosque commitment | 15 minutes, within the Friday eligibility period |
| Custom visit | 10 minutes |
| Home | Presence only; no default points |

Handle initial “already inside” states, duplicate callbacks, missing exits, overlapping regions, and late uploads explicitly. Unknown start times or interrupted tracking create reviewable visits, not invented durations. Short visits remain visible to the owner but do not qualify.

Editing a place applies to future tracking and creates a new configuration revision; it must not silently reclassify past visits. Retroactive corrections are explicit records. Known gym observations take precedence over any later inferred classification of the same visit.

### Unknown places — deferred

The original grocery/park/errand inference remains a future feature. It is not achievable merely by registering known geofences. Any future `CLVisit`/significant-change bridge or continuous-location experiment requires a separate technical milestone and battery evaluation; do not invent Expo APIs.

Google Places is disabled by default and is not a M1 dependency. A future third-party lookup requires explicit approval of billing, data disclosure, request quotas, and classification uncertainty. Never use the nearest business as unquestionable proof.

The old “ignore for 24 hours and keep inferred points” policy is **not a launch rule**. A future inference design must decide its confirmation policy before implementation. Inferred/unconfirmed evidence never settles the private monetary commitment automatically.

## 6. Basic scoring and sharing

The following simple positive rules are the proposed M2 launch defaults. Each person can disable their own sharing/scoring before collection. Mosque attendance has **no default general-score reward**; it is used in the separately accepted commitment.

| Rule | Eligibility | Points/cap |
|---|---|---|
| Gym visit | Closed gym visit ≥25 minutes | +10, maximum once per local competition day |
| Long gym visit | Same visit ≥60 minutes | +5 bonus to that day's qualifying visit |
| On time to work | First work arrival, then ≥20-minute visit; arrival no later than the configured start | +10 on configured workdays |
| Early arrival | Same qualifying arrival ≥20 minutes early | +5 |
| Full workday | Qualifying observed work duration ≥6 hours | +5, maximum once per day |

For multiple qualifying gym visits on one date, the earliest qualifying instant determines that day's scoring visit; later visits do not add another award or substitute a longer-visit bonus.

No continuous location proof means no “worked six productive hours” claim; copy describes a work visit. If the first work arrival was late or ambiguous, a later return must not become “first arrival.” Work start time/days belong to the owner and take effect prospectively. Potentially imprecise arrival times can be corrected.

Scoring is server-authoritative: clients submit observations, not arbitrary point values. Store an auditable ledger; corrections reverse/recompute prior awards rather than silently altering totals. A visit is never scored twice because a request was retried.

The general competition uses one shared timezone, initially **America/Los_Angeles**. Weeks are Monday 00:00 up to, but not including, the following Monday 00:00. Store UTC boundaries and the chosen IANA timezone. Travel does not change an active week's deadline.

A qualifying gym day is the local day when its minimum duration was reached (`observed_start + 25 minutes`), provided the completed visit supports that duration. This prevents a Sunday 23:55 arrival from earning Sunday's visit when 25 minutes were only reached on Monday. A continuous visit counts on one day, not two.

The weekly scoreboard resets by querying the new week; lifetime history is not deleted. A Sunday 20:00 message, if later implemented, is a progress preview. The final recap is after the week closes and pending records are resolved.

## 7. Private commitment: Gym + Friday Mosque

### Agreement

An optional private challenge between the same two users. Each commits to:

- **Gym on at least three different days every competition week.** A qualifying visit lasts at least 25 minutes. At most one gym day counts per date, even across multiple gyms.
- **A qualifying mosque visit on Friday every week.** Proposed minimum: 15 continuous minutes overlapping the accepted Friday window.

The first confirmed failure owes the other the agreed stake. Start date, stake, currency, timezone, and thresholds are shown to both people before they accept the same version. **No amount is pre-filled as an agreed debt.** Store the amount in integer minor units and currency separately; money never enters Turf.

A challenge starts on a full Monday. Proposed timezone: America/Los_Angeles. Proposed Friday window: Friday 00:00 to Saturday 00:00. This is a Friday mosque visit, **not verified attendance at Friday prayer**. The two people can choose a narrower agreed attendance window before accepting; there is no automatic prayer-time lookup.

At least 15 continuous minutes must overlap the eligible window. Time spent there only on Thursday or Saturday does not count. Both people may designate multiple private gyms/mosques. Late corrections require review; no silent retrospective relabeling.

### Deadlines and outcomes

Friday's mosque requirement closes when Saturday begins. The gym requirement closes when Monday begins. The earlier missed deadline determines the outcome, not upload order.

| Observation after review | Proposed result |
|---|---|
| One person misses Friday mosque; the other satisfies it | The person who missed Friday is the first loser |
| Both pass Friday; only one misses the three gym days | That person loses at the Monday boundary |
| Both pass both requirements | Continue into the next week under the same agreement |
| Both fail at the earliest unresolved deadline | Tie; no automatic debt, challenge ends unless both accept a restart |
| Data is missing, paused, late, or disputed | Needs review; do not declare a definitive financial result |

Allow a **48-hour synchronization/review window after each deadline** as a proposed default. This extends the time to supply evidence, not the time to perform the activity. Evidence that occurred after the deadline cannot repair a missed requirement.

Always resolve the earliest pending deadline before a later one. A clean pass can be computed automatically. A shortfall produces a **proposed failure**, never proof that the person failed to attend. Both participants acknowledge a monetary outcome before it is marked final. Unanswered reviews remain pending rather than silently becoming a debt.

An exception for illness, travel, or other circumstances requires both people's acceptance and an audit entry. Pausing stops collection but does not automatically count as attendance or waive an obligation. Either person can unpair/withdraw without continued tracking; an unresolved challenge becomes cancelled/review-needed, not an automatic forfeiture.

### Settlement and independence

After a confirmed loss, show “You owe [friend] $X under this agreement.” Track `unsettled`, `reported_paid`, and `confirmed_received`. The recipient confirms receipt. No bank, card, payment link, automatic debit, credit, collection, or legal-enforceability claim.

The challenge ends after the first confirmed loss or tie. It does not accrue a new debt every week. A rematch needs a new acceptance.

Scoreboard points, streaks, double days, and comeback bonuses cannot satisfy the commitment. Mosque progress is visible only within the accepted private challenge unless the subject separately opts into a broader category summary. Never publish coordinates or a mosque name to the peer by default.

## 8. Roadmap preserved from the original idea

Once M1–M3 are reliable, separately scope the following:

| Later feature | Original proposal retained as a starting point |
|---|---|
| Groceries | +8 for 15–90 minutes; up to two per week |
| Errands | +5 for ≥10 minutes; bonus for three distinct qualifying errands |
| Outdoors/study | +10 for ≥30/45 minutes respectively |
| Explorer/traveler | Novel-place and airport badges/points, after inference definitions are settled |
| Hangout | Both phones suggest a shared ≥45-minute visit; needs its own privacy/error design |
| Weekly streaks/badges | Reward meeting agreed goals; exact formulas are not M1 requirements |
| Optional negative rules | Missed gym goal, late work, home curfew; subject enables each rule; gaps block penalties |
| Multipliers | Rival bonus/double day remain optional; deterministic ordering and caps need a later spec |
| Custom challenges | Proposal, mutual acceptance, progress, result; no payment handling |

Do not add these dependencies, tables, unfinished tabs, or placeholder scoring to M1.

## 9. Screens and states

M1 screens: **Sign in; Pairing; Tracking status; Places; My debug events/visits; Privacy/settings.** Plain native layouts are enough. “Connected,” “queued,” “last synchronized,” and actual permission states must be distinguishable. Do not put a green “tracking reliable” indicator on a registration success alone.

Full product screens: Home scoreboard and commitment card; category-only Feed with reactions; Places; Rules/targets; private Commitment details; Profile/history; Settings.

One-tap Pause is available on the tracking/home screen without a confirmation. Data deletion is destructive and does need confirmation. A paused subject is described as paused, never as being at a specific location. The peer may see stale status until synchronization; do not imply remote live knowledge.

Readability, accessible labels, adequate touch targets, and visible error recovery take precedence over animations. No dependence on third-party analytics to measure success.

## 10. Privacy, consent, and data lifecycle

Raw coordinates, named places, visit timestamps, diagnostic events, and personal targets are owner-only through the API. The peer sees only purpose-built sanitized activity/score/progress records after opt-in. Hiding a field in a UI is not authorization.

No stealth tracking, remote activation, tracking nonparticipants, private-residence inference, relationship/ex-location labeling, or extraction from Find My. No external location lookup until explicitly enabled in a later scope.

Pause sets a durable local stop flag before unregistering tasks. Ignore late callbacks from an ended capture session. Sign-out stops monitoring and clears account-specific credentials/caches. Unpairing immediately revokes online sharing; an offline device learns this on its next connection. Already delivered summaries cannot be recalled from human memory or screenshots.

Proposed retention: raw server events 30 days, private visits 90 days, acknowledged local event logs 7 days, unsent queue at most 30 days with a warning before expiration. Saved places remain until deleted. Later score/challenge summaries can remain until account deletion. Do not retain raw data indefinitely for a disagreement; ask participants to resolve from the remaining summary.

“Delete my data” removes the owner's app records and stops tracking. “Delete account” additionally removes the Auth identity through an authenticated server/admin process. Do not claim hosted backup erasure or end-to-end encryption. The Supabase project administrator can access database contents; the peer app user cannot access owner-only data.

## 11. Operational targets and release gates

M1 passes only with a documented standalone IPA build, successful installation on both actual iPhones, correct private access controls, and observed background ENTER/EXIT plus offline synchronization. A simulator or debug button is insufficient evidence.

For the later 14-day alpha, measure missing/duplicate visits, detection/upload delay, battery use, signing interruptions, and correction rate. The original <5%/day battery target and ≥80% accepted inferred classifications are goals, not measured results. Inference accuracy is irrelevant until that feature exists.

Do not enable monetary outcomes during the first capture test. Both people should complete a no-money rehearsal week before enabling the commitment.

## 12. Decisions still supplied during setup

The friend's display name; both Auth user IDs; each person's places and work schedule; bet amount/currency; starting Monday; and final acceptance of proposed dwell/window/tie/review defaults. No implementation needs a private address or Apple password pasted into Codex.

See `docs/DECISIONS.md` for the decision log and `docs/SOURCES.md` for source keys. This document supersedes incompatible implementation assumptions in the earlier conversation, while preserving the two-player automatic-visit concept.
