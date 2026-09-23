import { backend, configured, authenticatedOwner } from "../auth/client";
import type { Draft, Snapshot } from "./model";
import { write } from "../db/local";
import {track} from './analytics';
export { configured };
export async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  await authenticatedOwner();
  const { data, error } = await backend().rpc(name, args);
  if (error) throw new Error(error.message);
  const p=(args.payload??{}) as Record<string,unknown>;
  if(name==='cs_session')track(args.action==='remove'?'session_removed':args.action==='edit'?'workout_type_edited':'session_logged',args.action==='manual'?{source:'manual',activity:String(p.activity_key),duration:Number(p.minutes)*60}:{});
  if(name==='cs_bootstrap')track('account_created');
  if(name==='cs_settings'&&args.kind==='place')track('place_saved',{activity:String(p.activity_key),radius:Number(p.radius_m)});
  if(name==='cs_social'){const kind=String(args.action);const event=({request:'friend_request_sent',accept:'friend_added',invite:'friend_added',reaction:'reaction',comment:'comment',nudge:'nudge_sent'} as Record<string,string>)[kind];if(event)track(event,kind==='request'?{method:'contacts'}:{});}
  return data as T;
}
export const getSnapshot = () => call<Snapshot>("cs_snapshot");
export const saveSettings = (kind: string, payload: Record<string, unknown>) => call<Snapshot>("cs_settings", { kind, payload });
export async function finishOnboarding(draft: Draft) {
  return call<Snapshot>("cs_bootstrap", { draft: { ...draft, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
}
export async function signIn(email: string, password: string) {
  await write("auth_blocked", false);
  const { error } = await backend().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}
export async function signUp(email: string, password: string) {
  await write("auth_blocked", false);
  const { data, error } = await backend().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: "turf://account" } });
  if (error) throw error;
  return !!data.session;
}
export async function resetEmail(email: string) {
  const { error } = await backend().auth.resetPasswordForEmail(email.trim(), { redirectTo: "turf://account" });
  if (error) throw error;
}
