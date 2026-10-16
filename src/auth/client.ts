import { createClient, isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthStorage, bindOwner, read, state } from "../db/local";
import type {
  Capture,
  IngestResult,
  Place,
  PlaceInput,
  Setup,
  Closure,
  Observation,
} from "../domain/model";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) &&
  /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
let client: SupabaseClient | undefined;
export function resetClientAfterStorageRecovery() { client = undefined; }
export function backend() {
  if (!configured) throw new Error("BACKEND_NOT_CONFIGURED");
  client ??= createClient(url, key, {
    auth: {
      storage: createAuthStorage(),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
          return await fetch(input, { ...init, signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      },
    },
  });
  return client;
}
export async function authenticatedOwner() {
  const auth = backend().auth;
  let {
    data: { session },
    error,
  } = await auth.getSession();
  // Offline, auth-js keeps the saved session but cannot refresh it. That is not a sign-out.
  if (isAuthRetryableFetchError(error)) throw new Error("NETWORK");
  if (error || !session) throw new Error("AUTH_REQUIRED");
  if (!session.expires_at || session.expires_at * 1000 < Date.now() + 30000) {
    const refreshed = await auth.refreshSession();
    session = refreshed.data.session;
    error = refreshed.error;
    if (isAuthRetryableFetchError(error)) throw new Error("NETWORK");
    if (error || !session) throw new Error("AUTH_REQUIRED");
  }
  await bindOwner(session.user.id);
  return session.user.id;
}
// The account whose session is saved on this phone, read without the network. When a refresh
// fails offline, getSession() returns no session although the saved one is still valid.
export async function savedSessionOwner() {
  if (!configured || (await read("auth_blocked", false))) return null;
  const key = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  try {
    const saved = JSON.parse((await read<string | null>("auth:" + key, null)) ?? "null") as { user?: { id?: string } } | null;
    return saved?.user?.id ?? null;
  } catch {
    return null;
  }
}
// The owner for actions that only change data on this phone (start or stop a workout, queue a
// photo). Offline with an expired token, use the saved session's owner if this phone's data is
// bound to that account. Anything that talks to the server still needs authenticatedOwner().
export async function localOwner() {
  try {
    return await authenticatedOwner();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "NETWORK") throw error;
    const owner = await savedSessionOwner();
    if (!owner || (await state()).owner !== owner) throw new Error("AUTH_REQUIRED");
    return owner;
  }
}
// A token refreshed moments ago can reach the database before its clock passes the
// token's issue time, so PostgREST answers PGRST303 "JWT issued at future". Wait and retry.
// Other PGRST303 errors, such as "JWT expired", would fail again with the same token.
const issuedInFuture = (error: { message?: string } | null) =>
  !!error && /JWT issued at future|JWT not yet valid/i.test(error.message ?? "");
export async function rpcRetryingClockSkew(name: string, args: Record<string, unknown>) {
  let result = await backend().rpc(name, args);
  for (const wait of [1000, 3000, 6000, 10000]) {
    if (!issuedInFuture(result.error)) break;
    await new Promise(resolve => setTimeout(resolve, wait));
    result = await backend().rpc(name, args);
  }
  return result;
}
// RPC return map stays coupled to the SQL contract. Generated catalog bindings
// are produced by scripts/generate-db-types.mjs against the disposable database.
type Rpc = {
  get_my_setup_state: { args: Record<string, never>; result: Setup };
  update_my_settings: {
    args: { patch: Record<string, unknown> };
    result: Setup;
  };
  create_pair_invite: {
    args: Record<string, never>;
    result: { invite_code?: string; expires_at?: string; code?: string };
  };
  join_pair: { args: { code: string }; result: { code: string } };
  end_my_pair: { args: Record<string, never>; result: { code: string } };
  claim_device: {
    args: {
      installation_id: string;
      version_info: { app: string; os: string };
    };
    result: { id: string };
  };
  save_my_place: { args: { input: PlaceInput }; result: Place };
  disable_my_place: { args: { place_id: string }; result: { code: string } };
  begin_capture: { args: { device_id: string }; result: Capture };
  end_capture: {
    args: { session_id: string; observed_end_at: string; reason: string };
    result: { code: string };
  };
  ingest_geofence_batch: {
    args: { events: Observation[]; pending_session_closures: Closure[] };
    result: IngestResult;
  };
  delete_my_app_data: {
    args: Record<string, never>;
    result: { code: string; auth_account_deleted: false };
  };
  cleanup_my_retention: {
    args: Record<string, never>;
    result: { code: string };
  };
};
export async function rpc<K extends keyof Rpc>(
  name: K,
  args: Rpc[K]["args"],
): Promise<Rpc[K]["result"]> {
  const { data, error } = await rpcRetryingClockSkew(name, args);
  if (error) throw new Error(error.message);
  return data as Rpc[K]["result"];
}
export function forgetClient() {
  client = undefined;
}
