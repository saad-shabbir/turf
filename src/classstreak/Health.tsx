import React from "react";
import {View} from "react-native";
import {requireOptionalNativeModule} from "expo-modules-core";
import {Button,Card,Txt} from "./ui";
import {call,saveSettings} from "./api";
import type {Snapshot} from "./model";
import type {Action} from "./SessionScreens";
type Workout={id:string;started_at:string;ended_at:string};
const native=requireOptionalNativeModule<{available:()=>boolean;authorize:()=>Promise<boolean>;workouts:(from:number,until:number)=>Promise<Workout[]>}>("ClassStreakHealth");
let lastSync=0;
export async function connectHealth(){
 if(!native?.available())throw new Error("Apple Health is not available in this build or on this device.");
 if(!await native.authorize())throw new Error("Apple Health access was not enabled.");
 const snapshot=await saveSettings("profile",{health_verify:true});await syncHealth(snapshot,true);
}
export async function syncHealth(snapshot:Snapshot,force=false){
 if(!snapshot.profile.health_verify||!native||(!force&&Date.now()-lastSync<60000))return;
 lastSync=Date.now();const workouts=await native.workouts(Date.now()-30*86400000,Date.now());
 // The OS intentionally does not reveal whether read access was denied; empty is not proof of permission.
 for(let i=0;i<workouts.length;i+=100)await call("cs_health",{workouts:workouts.slice(i,i+100)});
}
export function Health({snapshot:s,action}:{snapshot:Snapshot;action:Action}){
 return <View style={{gap:16}}><Txt serif size={34}>Apple Health</Txt><Card><Txt bold>One more way to count it.</Txt><Txt muted>A workout that overlaps your recorded visit by at least 15 minutes adds a Health check. Apple Watch is optional.</Txt></Card><Txt muted size={13}>ClassStreak reads workout times only. It does not write to Apple Health. You choose access in the Health permission screen.</Txt><Button title={s.profile.health_verify?"Check for matching workouts":"Connect Apple Health"} onPress={()=>action(s.profile.health_verify?"sync_health":"connect_health")}/>{s.profile.health_verify&&<Button secondary title="Turn off Health matching" onPress={()=>action("settings",{kind:"profile",payload:{health_verify:false}})}/>}<Txt muted size={12}>No matches can mean there are no overlapping workouts or read access was not granted. You can change access in iPhone Settings.</Txt></View>;
}
