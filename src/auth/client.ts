import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authStorage, bindOwner } from '../db/local';
import type { Capture, IngestResult, Place, PlaceInput, Setup, Closure, Observation } from '../domain/model';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
let client: SupabaseClient | undefined;
export function backend() {
  if (!configured) throw new Error('BACKEND_NOT_CONFIGURED');
  client ??= createClient(url,key,{auth:{storage:authStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async (input,init) => { const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),5000); try { return await fetch(input,{...init,signal:controller.signal}); } finally {clearTimeout(timer);} }},
  });
  return client;
}
export async function authenticatedOwner() {
  const auth=backend().auth;
  let {data:{session},error}=await auth.getSession();
  if (error || !session) throw new Error('AUTH_REQUIRED');
  if (!session.expires_at || session.expires_at*1000<Date.now()+30000) {
    const refreshed=await auth.refreshSession(); session=refreshed.data.session; error=refreshed.error;
    if (error || !session) throw new Error('AUTH_REQUIRED');
  }
  await bindOwner(session.user.id); return session.user.id;
}
// RPC return map stays coupled to the SQL contract. Generated catalog bindings
// are produced by scripts/generate-db-types.mjs against the disposable database.
type Rpc = {
 get_my_setup_state: {args: Record<string,never>; result: Setup};
 update_my_settings: {args: {patch: Record<string,unknown>}; result: Setup};
 create_pair_invite: {args: Record<string,never>; result: {invite_code?:string; expires_at?:string; code?:string}};
 join_pair: {args:{code:string}; result:{code:string}};
 end_my_pair: {args:Record<string,never>;result:{code:string}};
 claim_device: {args:{installation_id:string;version_info:{app:string;os:string}};result:{id:string}};
 save_my_place: {args:{input:PlaceInput};result:Place};
 disable_my_place: {args:{place_id:string};result:{code:string}};
 begin_capture: {args:{device_id:string};result:Capture};
 end_capture: {args:{session_id:string;observed_end_at:string;reason:string};result:{code:string}};
 ingest_geofence_batch: {args:{events:Observation[];pending_session_closures:Closure[]};result:IngestResult};
 delete_my_app_data: {args:Record<string,never>;result:{code:string;auth_account_deleted:false}};
 cleanup_my_retention: {args:Record<string,never>;result:{code:string}};
};
export async function rpc<K extends keyof Rpc>(name:K,args:Rpc[K]['args']):Promise<Rpc[K]['result']> {
  const {data,error}=await backend().rpc(name,args);
  if(error) throw new Error(error.message);
  return data as Rpc[K]['result'];
}
export function forgetClient() { client=undefined; }
