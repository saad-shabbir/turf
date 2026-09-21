import * as Notifications from "expo-notifications";
import {AppState} from "react-native";
import {read,write} from "../db/local";
import {getSnapshot} from "./api";
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function enableNotifications(){return (await Notifications.requestPermissionsAsync()).granted;}
export async function notifySession(ids:string[]){
 if(AppState.currentState==="active")return;
 const s=await getSnapshot();if(s.profile.notification_preferences.logged===false)return;
 const sent=await read<string[]>("cs:notified",[]);
 for(const id of ids){if(sent.includes(id))continue;const item=s.sessions.find(x=>x.id===id);if(!item)continue;
  await Notifications.scheduleNotificationAsync({identifier:"session:"+id,content:{title:"You went to class.",body:`${item.workout_label} · ${Math.floor(item.duration_sec/60)} min${item.source==="simulated"?" · simulated":""}`,data:{pane:"session:"+id}},trigger:null});sent.push(id);
 }
 await write("cs:notified",sent.slice(-200));
}
export async function testReminder(){
 if(!await enableNotifications())throw new Error("Enable notifications in iPhone Settings to see reminders.");
 await Notifications.scheduleNotificationAsync({content:{title:"ClassStreak",body:"Your next session counts. This is a test reminder.",data:{pane:"home"}},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:3}});
}
export const notificationResponse=(handle:(pane:string)=>void)=>Notifications.addNotificationResponseReceivedListener(r=>{const pane=r.notification.request.content.data?.pane;if(typeof pane==="string")handle(pane);});
export const clearNotifications=()=>Notifications.cancelAllScheduledNotificationsAsync();
