import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { activity, activities, durationLabel, type Session, type Snapshot } from "./model";
import { Button, Card, Chip, Empty, Icon, Input, Logo, Row, Txt, useTheme } from "./ui";
import { dayKey } from "./engine";
import {localTime} from './reminder-plan';
export type Action = (name:string,payload?:Record<string,unknown>)=>void;
export function Sticker({session,count,goal,streak,frosted=false}: {session:Session;count:number;goal:number;streak:number;frosted?:boolean}){
 const t=useTheme();return <View style={{padding:20,borderRadius:24,backgroundColor:frosted?"#3B1D2E6B":t.ink,borderWidth:frosted?1:0,borderColor:"#ffffff44",alignItems:"center",gap:10}}>
  <Txt size={11} bold style={{color:"#ffffffcc"}}>Workout type</Txt><Txt size={30} bold style={{color:"#fff",textAlign:"center",fontFamily:"Manrope_800ExtraBold"}}>{session.workout_label}</Txt>
  <Row style={{width:"100%",justifyContent:"space-between",marginVertical:4}}>{[["Time",durationLabel(session.duration_sec,true)],["This week",`${count}/${goal}`],["Streak",`${streak} wk`]].map(([label,value])=><View key={label} style={{alignItems:"center",gap:2}}><Txt size={11} style={{color:"#ffffffcc"}}>{label}</Txt><Txt bold size={21} style={{color:"#fff"}}>{value}</Txt></View>)}</Row><Logo white size={21}/>
 </View>;
}
export function SessionDetails({session:s,snapshot,stats,action}:{session:Session;snapshot:Snapshot;stats:{count:number;goal:number;streak:number};action:Action}){
 const [minutes,setMinutes]=useState(String(Math.round(s.duration_sec/60)));const [custom,setCustom]=useState(s.workout_label);const [editing,setEditing]=useState(false);
 const choices=s.activity_key==="gym"?["Legs","Upper","Cardio","Full body","Other"]:['reformer','mat','hot'].includes(s.activity_key)?["Reformer","Mat","Hot Pilates","Other"]:[activity(s.activity_key).label,'Other'];
 return <View style={{gap:14}}><Txt muted size={12}>{s.place_name??snapshot.places.find(p=>p.id===s.place_id)?.name??"Your session"}</Txt><Txt serif size={33}>You went to class.</Txt><Sticker session={s} {...stats}/>
  {s.verified&&<Row><Icon name="check" size={14}/><Txt muted size={12}>Verified with Apple Health</Txt></Row>}
  {s.source!=="geofence"&&<Chip title={s.source==="manual"?"Manual · unverified":s.source==="seed"?"Demo session":"Simulated session"} selected/>}
  {s.estimated&&<Card><Txt bold size={13}>We guessed when you left</Txt><Txt muted size={12}>No departure arrived. This is a four-hour estimate. Correct the duration below.</Txt><Input label="Duration in minutes" value={minutes} onChange={setMinutes} keyboard="numeric"/></Card>}
  <Row style={{alignItems:"flex-start"}}><Txt bold size={12} style={{width:77}}>Workout type</Txt><Txt muted size={11} style={{flex:1}}>We guessed from the studio. Fix it if we are wrong.</Txt></Row>
  <Row style={{flexWrap:"wrap",gap:6}}>{choices.map(label=><Chip key={label} title={label} selected={s.workout_label===label||(label==="Reformer"&&s.workout_label==="Reformer Pilates")} onPress={()=>action("edit_session",{id:s.id,workout_label:label})}/>)}</Row>
  <Button title="Post it with a photo" icon="camera" onPress={()=>action("post",{id:s.id})}/>
  {editing&&<Input label="Workout label" value={custom} onChange={setCustom}/>}<Row><View style={{flex:1}}><Button secondary title={editing?'Save workout type':"Edit workout type"} icon="edit" onPress={()=>{if(!editing){setEditing(true);return;}action("edit_session",{id:s.id,workout_label:custom,...(s.estimated?{minutes:Number(minutes)}:{})});setEditing(false);}}/></View><View style={{flex:1}}><Button secondary title="Not me? Remove" onPress={()=>action("remove_session",{id:s.id})}/></View></Row>
 </View>;
}
export function History({snapshot,action}:{snapshot:Snapshot;action:Action}){
 const t=useTheme();const sessions=snapshot.sessions.filter(s=>!s.removed_at);
 return <View style={{gap:12}}><Row><Txt serif size={32} style={{flex:1}}>Your sessions</Txt><Button small title="Add" icon="plus" onPress={()=>action("navigate",{pane:"manual"})}/></Row>
  {!sessions.length&&<Empty title="Your first session starts here." body="Visit a saved studio or gym. Your history will appear after you leave."/>}
  {sessions.map(s=><Pressable key={s.id} onPress={()=>action("navigate",{pane:"session:"+s.id})}><Card style={{gap:6}}><Row><View style={{backgroundColor:t.tint,padding:12,borderRadius:14}}><Icon name={activity(s.activity_key).icon}/></View><View style={{flex:1}}><Txt bold size={14}>{s.workout_label}</Txt><Txt muted size={12}>{s.place_name??"Your saved place"}</Txt></View><Icon name="chevron" size={15}/></Row><Txt muted size={12}>{new Date(s.started_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})} · {durationLabel(s.duration_sec)}{s.counted?"":" · double"}{s.verified?" · Health verified":""}{s.estimated?" · estimated departure":""}</Txt>{s.source!=="geofence"&&<Txt bold size={11} style={{color:t.accent}}>{s.source==="manual"?"Manual · unverified":s.source==="seed"?"Demo session":"Simulated session"}</Txt>}</Card></Pressable>)}
 </View>;
}
export function ManualSession({snapshot,action}:{snapshot:Snapshot;action:Action}){
 const [place,setPlace]=useState(snapshot.places.find(p=>p.enabled)?.id??"");const [key,setKey]=useState(snapshot.places[0]?.activity_key??"reformer");
 const [date,setDate]=useState(dayKey(new Date(),snapshot.profile.tz));const [time,setTime]=useState("12:00");const [minutes,setMinutes]=useState("45");
 return <View style={{gap:14}}><Txt serif size={32}>Add a session</Txt><Txt muted>Missed a visit? You can add one manual session each week. It counts toward your goal and is marked unverified.</Txt><Txt bold size={12}>Place</Txt><Row style={{flexWrap:"wrap"}}>{snapshot.places.filter(p=>p.enabled).map(p=><Chip key={p.id} title={p.name} selected={place===p.id} onPress={()=>{setPlace(p.id);setKey(p.activity_key);}}/>)}</Row>
  <Row style={{flexWrap:"wrap"}}>{activities.map(a=><Chip key={a.key} title={a.short} selected={key===a.key} onPress={()=>setKey(a.key)}/>)}</Row>
  <Input label="Date (YYYY-MM-DD)" value={date} onChange={setDate}/><Input label="Start time (HH:MM)" value={time} onChange={setTime}/><Input label="Duration in minutes" value={minutes} onChange={setMinutes} keyboard="numeric"/>
  <Button title="Add session" disabled={!place||!Number(minutes)} onPress={()=>{const start=localTime(date,Number(time.slice(0,2)),Number(time.slice(3,5)),snapshot.profile.tz);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||Number.isNaN(start.getTime())){action("message",{text:"Enter a valid date and time."});return;}action("manual_session",{place_id:place,activity_key:key,started_at:start.toISOString(),minutes:Number(minutes)});}}/>
 </View>;
}
