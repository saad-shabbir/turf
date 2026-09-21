import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { TASK, FIX_TASK, receiveEvent, receiveFixes } from "../classstreak/tracking";
import { write } from "../db/local";
export { TASK };
TaskManager.defineTask<{eventType:Location.GeofencingEventType;region:Location.LocationRegion}>(TASK,async({data,error,executionInfo})=>{
 if(error||!data?.region?.identifier){await write("cs:task_error","Location task could not read the region.").catch(()=>{});return;}
 const kind=data.eventType===Location.GeofencingEventType.Enter?"ENTER":data.eventType===Location.GeofencingEventType.Exit?"EXIT":null;if(!kind)return;
 await receiveEvent({event_id:/^[0-9a-f-]{36}$/i.test(executionInfo.eventId)?executionInfo.eventId:Crypto.randomUUID(),place_id:data.region.identifier,kind,observed_at:new Date().toISOString(),source:"geofence"}).catch(()=>{});
});
TaskManager.defineTask<{locations:Location.LocationObject[]}>(FIX_TASK,async({data,error})=>{if(!error&&data?.locations)await receiveFixes(data.locations).catch(()=>{});});
