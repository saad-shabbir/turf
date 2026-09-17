# Turf M1 — Real-iPhone field test record

All results initially **NOT TESTED**. This document is an evidence worksheet, not a passing test report. Use one copy per participant. Do not enable the money agreement during M1.

Participant alias: __________  App version/commit: __________  Test date: __________  
iPhone/iOS version: __________  SideStore version: __________  
Turf installation expiry shown by SideStore: __________

## Preparation

Confirm the app is a physical-device Release and its signing is valid. Open it once after boot/unlock. Log into the correct Turf account, pair, and save a place with a clearly understood boundary. Both location permissions and relevant background settings should be checked. Use a safe location; do not walk into traffic or trespass to cross a boundary.

Use the owner-only debug screen for exact records. Record only coarse elapsed times in shared feedback. A missing event is a finding, not a reason to manually insert a fake pass.

| Test | Expected evidence | Result / notes |
|---|---|---|
| Launch with Windows off / Metro stopped | Native UI opens; no development-server prompt | NOT TESTED |
| Backend configuration | Real project connection or clear error, never fake success | NOT TESTED |
| Auth persistence | Own account remains after normal close/reopen | NOT TESTED |
| Pairing | Both accounts show the same active pair | NOT TESTED |
| Raw-data privacy | Each sees own records; direct peer raw queries are denied | NOT TESTED |
| Initial state | Saving while already inside does not invent an earlier arrival | NOT TESTED |
| Locked-screen entry | From clearly outside, enter with screen locked; callback appears without manually logging | NOT TESTED |
| Locked-screen exit | Leave clearly beyond the radius; separate EXIT and a derived visit appear | NOT TESTED |
| Callback/upload timing | Record observed time versus server receipt; no fixed-latency assumption | NOT TESTED |
| Offline callback | Native event, if delivered offline, remains in the durable local queue | NOT TESTED |
| Reconnect | Queue uploads once; duplicated retries do not create extra visits | NOT TESTED |
| Expired access token | On a later execution opportunity, session refresh or explicit auth-required state | NOT TESTED |
| Pause while online | Local capture stops immediately; no later qualifying events | NOT TESTED |
| Pause while offline | Same immediate stop; backend state catches up honestly | NOT TESTED |
| Resume | Explicit restart/reconciliation creates correct active session | NOT TESTED |
| Permission downgrade | UI warns; no invented tracking/attendance evidence | NOT TESTED |
| Sign out | Monitoring stopped, private local state purged | NOT TESTED |
| Normal background/reopen | App retains legitimate queued data and reconciles state | NOT TESTED |
| Force-quit, then movement | Document observed behavior/limitations; do not assume success | NOT TESTED |
| Reboot and first unlock | Document storage/monitoring recovery; no assumed pre-unlock capture | NOT TESTED |
| Background App Refresh disabled | Document limitations, warning and recovery | NOT TESTED |
| Low Power Mode | Document actual capture/delay, not a guarantee | NOT TESTED |
| App update with same signer | Login, private cache and registry persist or recover correctly | NOT TESTED |
| SideStore renewal | App remains installable/openable; refresh outcome verified | NOT TESTED |
| Delete app data | Owner's app records removed, tracking stops, sharing ends | NOT TESTED |

## What counts as M1 field acceptance

Both phones launch the standalone app; real pairing persists; owner isolation is verified; each has at least two independently observed outside→inside→outside sequences under normal background/locked conditions; real events reach the backend; retries do not duplicate; and pause works offline and online.

The two sequences are an initial feasibility test, not a statistical reliability claim. Longer testing is necessary before interpreting absence or using a stake. An offline period without a geofence callback tests no callback persistence; repeat with a known real callback rather than asserting success.

## Sanitized problem report

Commit/build: __________  iOS/SideStore: __________  
Action taken: __________  Expected: __________  Observed: __________  
Permission state: __________  Queue count/age: __________  
Safe error code: __________  Approximate callback-to-upload delay: __________

Do not attach passwords, Apple pairing files, access/refresh tokens, database admin keys, real home/mosque/gym coordinates, or unredacted screenshots of another person's private records.
