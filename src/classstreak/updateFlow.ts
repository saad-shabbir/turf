// What tapping an "update ready" notification does, kept free of React Native
// so it can be tested in Node.
export type UpdateTapPlan='reload'|'apply'|'background';
// Never reload during a workout or while the camera is open: download in the
// background instead, and the Restart banner appears once it's safe.
export function planUpdateTap({workoutRunning,cameraOpen,downloaded}:{workoutRunning:boolean;cameraOpen:boolean;downloaded:boolean}):UpdateTapPlan{
 if(workoutRunning||cameraOpen)return 'background';
 return downloaded?'reload':'apply';
}

export type ApplyOutcome='reloaded'|'latest'|'timeout'|'error'|'unavailable';
type Steps={
 enabled:boolean;
 check:()=>Promise<{isAvailable:boolean}>;
 fetch:()=>Promise<unknown>;
 reload:()=>Promise<void>;
 timeoutMs?:number;
 // A download that finishes after the time limit: show the Restart banner.
 onLateReady?:()=>void;
};
// Check, download and reload, giving up after about 20 seconds. A download that
// is still running carries on in the background; it never reloads by itself.
export async function applyUpdateNow({enabled,check,fetch,reload,timeoutMs=20000,onLateReady}:Steps):Promise<ApplyOutcome>{
 if(!enabled)return 'unavailable';
 let timedOut=false;let timer:ReturnType<typeof setTimeout>|undefined;
 const work=(async():Promise<'fetched'|'latest'>=>{
  const result=await check();if(!result.isAvailable)return 'latest';
  await fetch();return 'fetched';
 })();
 work.then(result=>{if(timedOut&&result==='fetched')onLateReady?.();},()=>{});
 try{
  const result=await Promise.race([work,new Promise<'timeout'>(resolve=>{timer=setTimeout(()=>resolve('timeout'),timeoutMs);})]);
  if(result==='timeout'){timedOut=true;return 'timeout';}
  if(result==='latest')return 'latest';
  await reload();return 'reloaded';
 }catch{return 'error';}
 finally{if(timer)clearTimeout(timer);}
}

export function updateOutcomeMessage(outcome:ApplyOutcome):{text:string;tone:'success'|'info'|'error'}|null{
 switch(outcome){
  case 'reloaded':return null;
  case 'latest':return {text:'You’re on the latest version',tone:'success'};
  case 'timeout':return {text:'The update is still downloading. We’ll let you know when it’s ready.',tone:'info'};
  case 'unavailable':return {text:'Updates aren’t available in this version of the app.',tone:'info'};
  case 'error':return {text:'Couldn’t update right now. ClassStreak will try again later.',tone:'error'};
 }
}
// Notification payloads: data {type:'app_update'} from classstreak.announce_update.
export const isUpdateNotification=(data:unknown)=>!!data&&typeof data==='object'&&(data as {type?:unknown}).type==='app_update';
