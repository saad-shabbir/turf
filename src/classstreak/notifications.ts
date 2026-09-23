import * as Notifications from "expo-notifications";
import {AppState} from "react-native";
import {read,write} from "../db/local";
import {getSnapshot} from "./api";
import {durationLabel,type Snapshot} from "./model";
import {progress} from "./engine";
import {quietUntil,reminderPlan} from "./reminder-plan";
import {track} from './analytics';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function enableNotifications(){return (await Notifications.requestPermissionsAsync()).granted;}
export async function notifySession(ids:string[]){
 if(AppState.currentState==="active")return;
 const s=await getSnapshot();const stats=progress(s.sessions,s.weeks,s.goals,s.profile.tz);await scheduleReminders(s).catch(()=>{});if(s.profile.notification_preferences.logged===false)return;
 const sent=await read<string[]>("cs:notified",[]);
 for(const id of ids){if(sent.includes(id))continue;const item=s.sessions.find(x=>x.id===id);if(!item)continue;
  const quiet=quietUntil(new Date(),s.profile.tz);
  await Notifications.scheduleNotificationAsync({identifier:"session:"+id,content:{title:"You went to class.",body:`${item.workout_label} · ${durationLabel(item.duration_sec,true)}. ${stats.count}/${stats.goal} this week${item.source==="simulated"?" · simulated":""}`,data:{pane:"session:"+id}},trigger:quiet?{type:Notifications.SchedulableTriggerInputTypes.DATE,date:quiet}:null});sent.push(id);
 }
 await write("cs:notified",sent.slice(-200));
}
export async function testReminder(){
 if(!await enableNotifications())throw new Error("Enable notifications in iPhone Settings to see reminders.");
 await Notifications.scheduleNotificationAsync({content:{title:"ClassStreak",body:"Your next session counts. This is a test reminder.",data:{pane:"home"}},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:3}});
}
export function notificationResponse(handle:(pane:string)=>void){
 const open=(r:Notifications.NotificationResponse)=>{const pane=r.notification.request.content.data?.pane;if(typeof pane==='string'){track('reminder_opened');handle(pane);}Notifications.clearLastNotificationResponse();};
 const subscription=Notifications.addNotificationResponseReceivedListener(open);const initial=Notifications.getLastNotificationResponse();if(initial)open(initial);return subscription;
}
export const clearNotifications=()=>Notifications.cancelAllScheduledNotificationsAsync();
export async function notifyPendingVisit(eventId:string){
 if(AppState.currentState==="active")return;
 const cache=await read<{value:Snapshot}|null>("cs:snapshot",null);if(!cache||cache.value.profile.notification_preferences.logged===false)return;
 const quiet=quietUntil(new Date(),cache.value.profile.tz);
 await Notifications.scheduleNotificationAsync({identifier:"pending:"+eventId,content:{title:"Your visit is saved on this phone.",body:"Open ClassStreak when you are online to finish syncing.",data:{pane:"home"}},trigger:quiet?{type:Notifications.SchedulableTriggerInputTypes.DATE,date:quiet}:null});
}
let scheduling:Promise<void>|undefined;
export function scheduleReminders(snapshot:Snapshot){
 const work=async()=>{
  if(!(await Notifications.getPermissionsAsync()).granted)return;
  await Notifications.setBadgeCountAsync(snapshot.inbox.filter(n=>!n.read_at).length);
  const planned=reminderPlan(snapshot,new Date());const fingerprint=JSON.stringify(planned);
  if(await read("cs:reminder_plan","")===fingerprint)return;
  const existing=await Notifications.getAllScheduledNotificationsAsync();
  for(const n of existing)if(/^(usual|risk|recap):/.test(n.identifier))await Notifications.cancelScheduledNotificationAsync(n.identifier);
  for(const n of planned)await Notifications.scheduleNotificationAsync({identifier:n.id,content:{title:n.title,body:n.body,data:{pane:n.pane}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:n.at}});
  await write("cs:reminder_plan",fingerprint);
 };
 scheduling=(scheduling??Promise.resolve()).catch(()=>{}).then(work);return scheduling;
}
export async function announceMilestones(snapshot:Snapshot){
 const n=snapshot.sessions.filter(s=>s.counted&&!s.removed_at).length;const seen=await read<number[]>("cs:milestones_seen",[]);const fresh=[1,10,25,50,100].filter(m=>n>=m&&!seen.includes(m));
 if(!fresh.length)return null;await write("cs:milestones_seen",[...seen,...fresh]);const milestone=fresh[fresh.length-1]!;
 if(snapshot.profile.notification_preferences.milestone===false)return null;
 if(AppState.currentState!=="active"){
  const quiet=quietUntil(new Date(),snapshot.profile.tz);
  await Notifications.scheduleNotificationAsync({identifier:"milestone:"+milestone,content:{title:`Class ${milestone}.`,body:"Say it on your story.",data:{pane:"milestone:"+milestone}},trigger:quiet?{type:Notifications.SchedulableTriggerInputTypes.DATE,date:quiet}:null});
 }
 return milestone;
}

export async function notifyArrival(placeName:string,visitId:string){
 if(!(await Notifications.getPermissionsAsync()).granted)return;
 await Notifications.scheduleNotificationAsync({identifier:"arrival:"+visitId,content:{title:"You made it!",body:`You're at ${placeName}. What are you hitting today?`,data:{pane:"active-workout",visit_id:visitId}},trigger:null});
}
