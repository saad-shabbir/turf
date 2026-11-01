import * as Updates from 'expo-updates';
import {shouldCheckForUpdate} from './updateRules';
import {applyUpdateNow,type ApplyOutcome} from './updateFlow';

// Checks at most every 15 minutes (or right away when an update notification
// arrives), downloads in the background and reports when a new version is
// ready. Only a tap on Restart or on the update notification reloads the app.
let lastCheck:number|null=null;let ready=false;let inflight:Promise<boolean>|null=null;
const listeners=new Set<()=>void>();
function markReady(){if(ready)return;ready=true;for(const listener of listeners)listener();}
export function onUpdateReady(listener:()=>void){listeners.add(listener);if(ready)listener();return()=>{listeners.delete(listener);};}
export const updateDownloaded=()=>ready;
export const updatesEnabled=()=>Updates.isEnabled&&!__DEV__;

export function checkForAppUpdate(force=false):Promise<boolean>{
 if(ready)return Promise.resolve(true);
 if(inflight)return inflight;
 const now=Date.now();
 if(!shouldCheckForUpdate({now,lastCheck:force?null:lastCheck,enabled:Updates.isEnabled,dev:__DEV__,busy:false}))return Promise.resolve(false);
 lastCheck=now;
 inflight=(async()=>{
  try{
   const result=await Updates.checkForUpdateAsync();
   if(!result.isAvailable)return false;
   await Updates.fetchUpdateAsync();markReady();return true;
  }catch{return false;}
 })().finally(()=>{inflight=null;});
 return inflight;
}

// Tapping an update notification: check, download and reload now, within
// about 20 seconds. A background check already running is reused.
export async function applyUpdateFromTap(timeoutMs=20000):Promise<ApplyOutcome>{
 if(ready){try{await Updates.reloadAsync();return 'reloaded';}catch{return 'error';}}
 lastCheck=Date.now();
 const running=inflight;
 return applyUpdateNow({
  enabled:updatesEnabled(),
  check:async()=>running&&await running?{isAvailable:true}:Updates.checkForUpdateAsync(),
  // Marked ready first, so a failed reload still leaves the Restart banner.
  fetch:async()=>{if(!ready)await Updates.fetchUpdateAsync();markReady();},
  reload:()=>Updates.reloadAsync(),
  timeoutMs,
  onLateReady:markReady,
 });
}
export const restartForUpdate=()=>Updates.reloadAsync();
