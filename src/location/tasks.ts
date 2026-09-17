import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { capture, write } from '../db/local';
import { sync } from '../sync/worker';
export const TASK='TURF_GEOFENCE_V1';
const observedThisRuntime=new Set<string>();
TaskManager.defineTask<{eventType:Location.GeofencingEventType;region:Location.LocationRegion}>(TASK,async ({data,error,executionInfo}) => {
  if(error || !data?.region?.identifier || !executionInfo.eventId) { await write('safe_error','TASK_ERROR').catch(()=>{}); return; }
  const kind=data.eventType===Location.GeofencingEventType.Enter?'ENTER':data.eventType===Location.GeofencingEventType.Exit?'EXIT':null;
  if(!kind) return;
  try {
    // Observation time is when JS receives the callback, not a precise crossing.
    if(await capture(data.region.identifier,executionInfo.eventId,kind,new Date().toISOString(),!observedThisRuntime.has(data.region.identifier))) {
      observedThisRuntime.add(data.region.identifier); await sync();
    }
  } catch { await write('safe_error','STORAGE_ERROR').catch(()=>{}); }
});
