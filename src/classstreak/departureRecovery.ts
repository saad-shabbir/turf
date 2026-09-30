import { distanceMeters, type Candidate, type Fix } from './engine';

// Only timestamps are retained outside a saved place. Never keep a route home.
export type DepartureEvidence = { entered_at: string; first_at: number; last_at: number };
export const DEPARTURE_CONFIRM_MS = 30_000;
const MAX_FIX_AGE_MS = 120_000;
const MAX_CONFIRM_GAP_MS = 5 * 60_000;
const OUTSIDE_BUFFER_M = 75;

/** A boundary notification is best effort. Two accurate, fresh observations
 * beyond the radius AND its accuracy uncertainty provide an independent exit.
 * The first observed outside timestamp is an estimate, never a guessed leave time.
 */
export function observeDeparture(candidate: Candidate, fixes: Fix[], previous: DepartureEvidence | null, now: number) {
  let evidence = previous?.entered_at === candidate.entered_at ? previous : null;
  if (evidence && now - evidence.last_at > MAX_CONFIRM_GAP_MS) evidence = null;
  for (const fix of [...fixes].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!Number.isFinite(fix.timestamp) || fix.timestamp < Date.parse(candidate.entered_at)
      || fix.timestamp > now || now - fix.timestamp > MAX_FIX_AGE_MS
      || fix.accuracy === null || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 100
      || !Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)
      || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180) continue;
    if (evidence && fix.timestamp <= evidence.last_at) continue;
    const distance = distanceMeters({ lat: fix.latitude, lng: fix.longitude }, candidate);
    if (distance - fix.accuracy <= candidate.radius_m + OUTSIDE_BUFFER_M) {
      evidence = null; // Indoor drift / a return inside breaks the confirmation.
      continue;
    }
    if (!evidence || fix.timestamp - evidence.last_at > MAX_CONFIRM_GAP_MS) {
      evidence = { entered_at: candidate.entered_at, first_at: fix.timestamp, last_at: fix.timestamp };
    } else {
      evidence = { ...evidence, last_at: fix.timestamp };
    }
    if (evidence.last_at - evidence.first_at >= DEPARTURE_CONFIRM_MS) {
      return { evidence, exitedAt: new Date(evidence.first_at).toISOString() };
    }
  }
  return { evidence, exitedAt: null };
}
