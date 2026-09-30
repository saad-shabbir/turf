import {HistoryContent} from './HistoryScreen';
import React, { useState } from "react";
import { View } from "react-native";
import { activity, activities, durationLabel, type Session, type Snapshot } from "./model";
import { Button, Card, Chip, Icon, Input, Logo, Row, Txt, useTheme } from "./ui";
import { dayKey } from "./engine";
import {localTime} from './reminder-plan';
export type Action = (name:string,payload?:Record<string,unknown>)=>void;
export type StickerDesign='glass'|'minimal'|'ticket';
export function Sticker({session,count,goal,streak,frosted=false,design='glass',opacity=.36}: {session:Session;count:number;goal:number;streak:number;frosted?:boolean;design?:StickerDesign;opacity?:number}){
 const t=useTheme();const light=design==='ticket';const color=light?'#292A27':'#fff';const alpha=Math.round(Math.max(.12,Math.min(.9,opacity))*255).toString(16).padStart(2,'0');
 return <View style={{padding:design==='minimal'?12:19,borderRadius:design==='ticket'?5:22,backgroundColor:design==='minimal'?'transparent':frosted?(light?'#FDFBF7':'#1E211E')+alpha:light?'#FDFBF7':t.ink,borderWidth:design==='glass'&&frosted?1:0,borderColor:'#ffffff35',gap:12}}>
  <Txt serif size={30} style={{color,textAlign:design==='minimal'?'left':'center',textShadowColor:design==='minimal'?'#00000088':'transparent',textShadowRadius:8,textShadowOffset:{width:0,height:1}}}>{session.workout_label}</Txt>
  <Row style={{width:'100%',justifyContent:'space-between',gap:8}}>{[['Time',durationLabel(session.duration_sec,true)],['This week',`${count}/${goal}`],['Streak',`${streak} wk`]].map(([label,value])=><View key={label} style={{alignItems:design==='minimal'?'flex-start':'center',gap:2}}><Txt size={10} style={{color,opacity:.82}}>{label}</Txt><Txt bold size={19} style={{color}}>{value}</Txt></View>)}</Row>
  <View style={{alignItems:design==='minimal'?'flex-start':'center',paddingTop:3}}><Logo white={!light} size={17}/></View>
 </View>;
}
export function SessionDetails({session:s,snapshot,stats,action}:{session:Session;snapshot:Snapshot;stats:{count:number;goal:number;streak:number};action:Action}){
 const [minutes,setMinutes]=useState(String(Math.round(s.duration_sec/60)));const [custom,setCustom]=useState(s.workout_label);const [editing,setEditing]=useState(false);
 const choices=s.activity_key==="gym"?["Legs","Upper","Cardio","Full body","Other"]:['reformer','mat','hot'].includes(s.activity_key)?["Reformer","Mat","Hot Pilates","Other"]:[activity(s.activity_key).label,'Other'];
 return <View style={{gap:14}}><Txt muted size={12}>{s.place_name??snapshot.places.find(p=>p.id===s.place_id)?.name??"Your session"}</Txt><Txt serif size={33}>You showed up.</Txt><Sticker session={s} {...stats}/>
  {s.verified&&<Row><Icon name="check" size={14}/><Txt muted size={12}>Verified with Apple Health</Txt></Row>}
  {s.source!=="geofence"&&<Chip title={s.source==="manual"?"Manual · unverified":s.source==="seed"?"Demo session":"Simulated session"} selected/>}
  {s.estimated&&<Card><Txt bold size={13}>Estimated finish time</Txt><Txt muted size={12}>The departure alert was missed. We used a confirmed location outside your gym or the four-hour safety limit. Adjust the duration if needed.</Txt><Input label="Duration in minutes" value={minutes} onChange={setMinutes} keyboard="numeric"/></Card>}
  <Row style={{alignItems:"flex-start"}}><Txt bold size={12} style={{width:77}}>Workout type</Txt><Txt muted size={11} style={{flex:1}}>We guessed from the studio. Fix it if we are wrong.</Txt></Row>
  <Row style={{flexWrap:"wrap",gap:6}}>{choices.map(label=><Chip key={label} title={label} selected={s.workout_label===label||(label==="Reformer"&&s.workout_label==="Reformer Pilates")} onPress={()=>action("edit_session",{id:s.id,workout_label:label})}/>)}</Row>
  <Button title="Post it with a photo" icon="camera" onPress={()=>action("post",{id:s.id})}/>
  {editing&&<Input label="Workout label" value={custom} onChange={setCustom}/>}<Row><View style={{flex:1}}><Button secondary title={editing?'Save workout type':"Edit workout type"} icon="edit" onPress={()=>{if(!editing){setEditing(true);return;}action("edit_session",{id:s.id,workout_label:custom,...(s.estimated?{minutes:Number(minutes)}:{})});setEditing(false);}}/></View><View style={{flex:1}}><Button secondary title="Not me? Remove" onPress={()=>action("remove_session",{id:s.id})}/></View></Row>
 </View>;
}
export function History({snapshot,action}:{snapshot:Snapshot;action:Action}){return <HistoryContent snapshot={snapshot} action={action}/>;}
export function ManualSession({snapshot,action}:{snapshot:Snapshot;action:Action}){
 const [place,setPlace]=useState(snapshot.places.find(p=>p.enabled)?.id??"");const [key,setKey]=useState(snapshot.places[0]?.activity_key??"reformer");
 const [date,setDate]=useState(dayKey(new Date(),snapshot.profile.tz));const [time,setTime]=useState("12:00");const [minutes,setMinutes]=useState("45");
 return <View style={{gap:14}}><Txt serif size={32}>Add a session</Txt><Txt muted>Missed a visit? You can add one manual session each week. It counts toward your goal and is marked unverified.</Txt><Txt bold size={12}>Place</Txt><Row style={{flexWrap:"wrap"}}>{snapshot.places.filter(p=>p.enabled).map(p=><Chip key={p.id} title={p.name} selected={place===p.id} onPress={()=>{setPlace(p.id);setKey(p.activity_key);}}/>)}</Row>
  <Row style={{flexWrap:"wrap"}}>{[...new Set([...activities.map(a=>a.key),...snapshot.goals.map(g=>g.activity_key),...snapshot.pending_goals.map(g=>g.activity_key)])].map(activity).map(a=><Chip key={a.key} title={a.short} selected={key===a.key} onPress={()=>setKey(a.key)}/>)}</Row>
  <Input label="Date (YYYY-MM-DD)" value={date} onChange={setDate}/><Input label="Start time (HH:MM)" value={time} onChange={setTime}/><Input label="Duration in minutes" value={minutes} onChange={setMinutes} keyboard="numeric"/>
  <Button title="Add session" disabled={!place||!Number(minutes)} onPress={()=>{const start=localTime(date,Number(time.slice(0,2)),Number(time.slice(3,5)),snapshot.profile.tz);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||Number.isNaN(start.getTime())){action("message",{text:"Enter a valid date and time."});return;}action("manual_session",{place_id:place,activity_key:key,started_at:start.toISOString(),minutes:Number(minutes)});}}/>
 </View>;
}
