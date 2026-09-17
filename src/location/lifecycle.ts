import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { backend, authenticatedOwner, rpc, forgetClient } from '../auth/client';
import { cleanupLocal, pauseLocal, purge, read, state, transaction, write } from '../db/local';
import { emptyState, type Closure, type Place } from '../domain/model';
import { sync } from '../sync/worker';
import { TASK } from './tasks';

export async function permissions() {
  const [foreground,background,enabled,registered]=await Promise.all([Location.getForegroundPermissionsAsync(),Location.getBackgroundPermissionsAsync(),Location.hasServicesEnabledAsync(),Location.hasStartedGeofencingAsync(TASK)]);
  return {foreground:foreground.status,background:background.status,enabled,registered};
}
export async function pause(reason:Closure['reason']='paused') {
  // Durable stop is committed before native unregistration or any network work.
  try { await pauseLocal(reason); }
  finally { if(await Location.hasStartedGeofencingAsync(TASK)) await Location.stopGeofencingAsync(TASK); }
}
export async function resume() {
  const p=await permissions();
  if(p.foreground!=='granted'||p.background!=='granted'||!p.enabled) throw new Error('PERMISSION_REQUIRED');
  await pause(); await sync();
  const epoch=await read('epoch',0);
  const owner=await authenticatedOwner(); const setup=await rpc('get_my_setup_state',{});
  if(setup.pair?.status!=='active') throw new Error('PAIR_REQUIRED');
  let installation=await read<string|null>('installation',null);
  if(!installation){installation=Crypto.randomUUID();await write('installation',installation);}
  const device=await rpc('claim_device',{installation_id:installation,version_info:{app:'1.0.0',os:String(Platform.Version)}});
  const {data,error}=await backend().from('places').select('*').eq('active',true);
  if(error) throw new Error('REQUEST_FAILED');
  const places=data as Place[];
  if(!places.length||places.length>10) throw new Error('PLACE_REQUIRED');
  const session=await rpc('begin_capture',{device_id:device.id});
  const regions=places.map(place=>({identifier:`${session.id}:${place.id}`,place_id:place.id,latitude:place.latitude,longitude:place.longitude,radius:place.radius_m}));
  await transaction(async db=>{
    const current=await read('state',emptyState,db);
    if(current.owner!==owner || await read('epoch',0,db)!==epoch) throw new Error('AUTH_REQUIRED');
    await write('state',{owner,paused:false,session,device:device.id,regions},db);
  });
  try { await Location.startGeofencingAsync(TASK,regions.map(r=>({...r,notifyOnEnter:true,notifyOnExit:true}))); }
  catch { await pause(); throw new Error('REGISTRATION_ERROR'); }
  // A concurrent Pause wins, even if native registration completed after it.
  const current=await state();
  if(current.paused||current.session?.id!==session.id) await Location.stopGeofencingAsync(TASK);
}
export async function reconcile() {
  await cleanupLocal();
  const current=await state(); const p=await permissions();
  if(current.paused || !current.session) {
    if(p.registered) await Location.stopGeofencingAsync(TASK);
  } else if(p.foreground!=='granted'||p.background!=='granted'||!p.enabled||!p.registered) {
    await pause(); await write('safe_error','PERMISSION_REQUIRED');
  } else {
    try {
      await authenticatedOwner();
      const {data,error}=await backend().from('tracking_sessions').select('id,ended_at').eq('id',current.session.id).maybeSingle();
      if(!error && (!data || data.ended_at)) await pause();
    } catch { /* Offline monitoring stays active; sync reports auth/network state. */ }
  }
  await sync();
  await rpc('cleanup_my_retention',{}).catch(()=>{});
}
export async function registeredRegions() {
  return (await TaskManager.getRegisteredTasksAsync()).find(t=>t.taskName===TASK)?.options ?? null;
}
export async function logout() {
  const before=await state();
  try {
    await pause('logout');
    if(before.session)await rpc('end_capture',{session_id:before.session.id,observed_end_at:new Date().toISOString(),reason:'logout'}).catch(()=>{});
  }
  finally {
    try { await backend().auth.signOut({scope:'local'}); } catch { /* local purge is mandatory */ }
    await purge(); forgetClient();
  }
}
