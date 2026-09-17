// Generated from applied M1 migrations by npm run db:types. Do not edit.
export interface DatabaseRows {
  devices: {
    id: string;
    user_id: string;
    installation_id: string;
    active: boolean;
    created_at: string;
    last_runtime_at: string | null;
    last_sync_at: string | null;
    app_version: string;
    os_version: string;
  };
  diagnostic_events: {
    id: string;
    user_id: string;
    device_id: string | null;
    session_id: string | null;
    code: string;
    detail_safe: string | null;
    observed_at: string;
    received_at: string;
  };
  geofence_events: {
    id: string;
    user_id: string;
    device_id: string;
    session_id: string;
    place_id: string;
    platform_event_id: string;
    client_seq: number;
    kind: string;
    observed_at: string;
    received_at: string;
    initial_state_possible: boolean;
    validation_status: string;
    validation_reason: string | null;
  };
  pairs: {
    id: string;
    user_a: string;
    user_b: string | null;
    status: string;
    competition_timezone: string;
    created_at: string;
    activated_at: string | null;
    ended_at: string | null;
  };
  places: {
    id: string;
    user_id: string;
    place_key: string;
    revision: number;
    label: string;
    category: string;
    latitude: number;
    longitude: number;
    radius_m: number;
    min_dwell_seconds: number;
    active: boolean;
    created_at: string;
    disabled_at: string | null;
  };
  profiles: {
    user_id: string;
    display_name: string;
    created_at: string;
    updated_at: string;
  };
  tracking_sessions: {
    id: string;
    user_id: string;
    device_id: string;
    pair_id: string | null;
    generation: number;
    started_at: string;
    ended_at: string | null;
    end_reason: string | null;
    created_at: string;
  };
  user_settings: {
    user_id: string;
    display_timezone: string;
    collection_consent_at: string | null;
    share_gym: boolean;
    share_work: boolean;
    share_mosque: boolean;
    updated_at: string;
  };
  visits: {
    id: string;
    user_id: string;
    device_id: string;
    session_id: string;
    pair_id: string | null;
    place_id: string;
    category: string;
    opening_event_id: string | null;
    closing_event_id: string | null;
    stable_visit_key: string;
    observed_start_at: string | null;
    observed_end_at: string | null;
    dwell_seconds: number | null;
    status: string;
    start_known: boolean;
    quality_reason: string | null;
    derived_version: number;
    created_at: string;
    updated_at: string;
  };
}
