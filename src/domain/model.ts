import { z } from "zod";
import type { DatabaseRows } from "../db/database.generated";
export const category = z.enum(["gym", "work", "mosque", "home", "custom"]);
export const placeInput = z
  .object({
    place_key: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(80),
    category,
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    radius_m: z.number().int().min(75).max(400),
  })
  .strict();
export type PlaceInput = z.infer<typeof placeInput>;
export type Place = PlaceInput & DatabaseRows["places"];
export type Capture = Pick<
  DatabaseRows["tracking_sessions"],
  "id" | "device_id" | "generation" | "started_at" | "ended_at"
>;
export type Observation = {
  event_id: string;
  platform_event_id: string;
  session_id: string;
  device_id: string;
  place_id: string;
  client_seq: number;
  kind: "ENTER" | "EXIT";
  observed_at: string;
  initial_state_possible: boolean;
};
export type Closure = {
  session_id: string;
  observed_end_at: string;
  reason: "paused" | "logout" | "place_change" | "unpaired" | "deleted_data";
};
export type Registry = {
  identifier: string;
  place_id: string;
  latitude: number;
  longitude: number;
  radius: number;
};
export type LocalState = {
  owner: string | null;
  paused: boolean;
  session: Capture | null;
  device: string | null;
  regions: Registry[];
};
export const emptyState: LocalState = {
  owner: null,
  paused: true,
  session: null,
  device: null,
  regions: [],
};
export type Setup = {
  profile: { display_name: string } | null;
  settings: {
    collection_consent_at: string | null;
    share_gym: boolean;
    share_work: boolean;
    share_mosque: boolean;
    display_timezone: string;
  } | null;
  pair: {
    id: string;
    status: "pending" | "active";
    user_a: string;
    user_b: string | null;
  } | null;
  device: { id: string; active: boolean } | null;
};
export type IngestResult = {
  accepted: string[];
  duplicates: string[];
  rejected: { event_id: string; code: string }[];
  server_time: string;
};
export function mayCapture(state: LocalState, identifier: string) {
  return !!(
    state.owner &&
    !state.paused &&
    state.session &&
    state.device === state.session.device_id &&
    state.regions.some((r) => r.identifier === identifier)
  );
}
export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const codes = [
    "NOT_ALLOWLISTED",
    "AUTH_REQUIRED",
    "PAIR_REQUIRED",
    "CONSENT_REQUIRED",
    "PLACE_REQUIRED",
    "WRONG_DEVICE",
    "STALE_SESSION",
    "NOT_OWNER",
    "INVALID_INPUT",
    "PLACE_LIMIT",
    "BACKEND_NOT_CONFIGURED",
    "STORAGE_ERROR",
    "REGISTRATION_ERROR",
    "PERMISSION_REQUIRED",
  ];
  return codes.find((c) => message === c) ?? "REQUEST_FAILED";
}
