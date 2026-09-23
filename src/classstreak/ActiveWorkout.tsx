import React,{useEffect,useState} from 'react';
import {Alert,View} from 'react-native';
import {activities,activity,type Snapshot} from './model';
import type {Candidate} from './engine';
import {CustomActivity} from './ActivitySetup';
import {Button,Card,Chip,Empty,Row,Txt,useTheme} from './ui';
import type {Action} from './SessionScreens';
export function elapsedWorkout(start:string,now:number){
 const seconds=Math.min(14400,Math.max(0,Math.floor((now-Date.parse(start))/1000)));
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
export function ActiveWorkout({candidate:c,snapshot:s,action,compact=false,busy=false}:{candidate:Candidate|null;snapshot:Snapshot;action:Action;compact?:boolean;busy?:boolean}){
 const t=useTheme();const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 if(!c?.visit_id)return compact?null:<Empty title="Ready for your next workout." body="Your timer appears when an arrival at a saved place is detected." action="Back to Home" onPress={()=>action('navigate',{pane:'home'})}/>;
 const send=(name:string,key?:string)=>action(name,{visit_id:c.visit_id,activity_key:key});
 const keys=[...new Set([...activities.map(a=>a.key),...s.goals.map(g=>g.activity_key),...s.pending_goals.map(g=>g.activity_key),c.activity_key])];
 return <Card style={{gap:16}}><Txt bold size={12}>WORKOUT IN PROGRESS</Txt><Txt serif size={28}>{c.workout_label}</Txt><Txt muted size={12}>{s.places.find(p=>p.id===c.place_id)?.name??'Your saved place'}</Txt>
  <Txt size={44} bold style={{fontVariant:['tabular-nums'],color:t.accent}}>{elapsedWorkout(c.entered_at,now)}</Txt>
  {compact?<Button secondary title="Choose workout / view timer" onPress={()=>action('navigate',{pane:'active-workout'})}/>:<><Txt bold>What are you hitting today?</Txt><Row style={{flexWrap:'wrap'}}>{keys.map(key=><View key={key} style={{maxWidth:'100%'}}><Chip title={activity(key).label} selected={c.activity_key===key} onPress={()=>{if(!busy)send('workout_select',key);}}/></View>)}</Row><CustomActivity onAdd={key=>{if(!busy)send('workout_select',key);}}/></>}
  <Button title={busy?'Saving…':'Stop workout'} disabled={busy} onPress={()=>send('workout_stop')}/>
  {!compact&&<Button secondary small title="Started too early? Restart timer" disabled={busy} onPress={()=>Alert.alert('Restart the timer?','Your workout will start from now. Time already elapsed will not count.',[{text:'Cancel',style:'cancel'},{text:'Restart timer',onPress:()=>send('workout_restart')}])}/>}
 </Card>;
}
