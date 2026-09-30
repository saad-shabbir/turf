import React,{useState} from 'react';
import {Pressable,View} from 'react-native';
import type {Snapshot} from './model';
import {activity,durationLabel} from './model';
import {dayKey,progress,type Candidate} from './engine';
import {ActiveWorkout} from './ActiveWorkout';
import {WeeklyPlan} from './WeeklyPlan';
import {ActivityArt} from './ActivityArt';
import {ActivityCard} from './Friends';
import {CommunityPreview} from './CommunityPreview';
import {Button,Card,Icon,Ring,Row,Txt,useTheme} from './ui';
import type {Action} from './SessionScreens';

export function Home({snapshot:s,now,activeWorkout,busy,tracking,action}:{snapshot:Snapshot;now:Date;activeWorkout:Candidate|null;busy:boolean;tracking?:string;action:Action}){
 const t=useTheme();const stats=progress(s.sessions,s.weeks,s.goals,s.profile.tz,now);const latest=s.sessions.find(x=>!x.removed_at);const [setup,setSetup]=useState(false);
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:s.profile.tz,hour:'numeric',hourCycle:'h23'}).format(now));const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 const navigate=(pane:string)=>action('navigate',{pane});
 return <View style={{gap:22}}><View style={{gap:8}}><Txt serif size={34}>{greeting},{'\n'}{s.profile.first_name}.</Txt><Txt muted size={14}>A little movement. A little time for you.</Txt></View>
  <ActiveWorkout compact candidate={activeWorkout} snapshot={s} action={action} busy={busy}/>
  <Card style={{padding:20,gap:12}}><Row style={{gap:17}}><Ring count={stats.count} goal={stats.goal}/><View style={{flex:1,gap:5}}><Txt bold size={15}>Your movement this week</Txt><Txt muted size={13}>{stats.count?`${stats.count} of ${stats.goal} sessions. Every one counts.`:`${stats.goal} sessions to aim for. Start where you are.`}</Txt></View></Row><Txt muted size={11}>{s.goals.filter(g=>g.goal>0).map(g=>`${activity(g.activity_key).short} · ${g.goal}`).join('     ')}{stats.streak?`  /  ${stats.streak}-week streak`:''}</Txt></Card>
  <WeeklyPlan snapshot={s} now={now}/>
  {!!tracking&&<Pressable onPress={()=>tracking.includes('ettings')?action('open_settings'):navigate('account')}><Row style={{alignItems:'flex-start',padding:4}}><Icon name="pin" size={17}/><Txt muted size={12} style={{flex:1}}>{tracking}</Txt><Icon name="chevron" size={13}/></Row></Pressable>}
  <Row><Txt serif size={27} style={{flex:1}}>Your latest movement</Txt><Pressable onPress={()=>navigate('history')} style={{paddingVertical:12}}><Txt bold size={12}>History →</Txt></Pressable></Row>
  {latest?<Pressable accessibilityLabel="Open latest workout" onPress={()=>navigate('session:'+latest.id)}><Card style={{padding:18}}><Row style={{gap:14}}><ActivityArt activityKey={latest.activity_key} size={67}/><View style={{flex:1,gap:5}}><Txt bold size={16}>{latest.workout_label}</Txt><Txt muted size={12}>{durationLabel(latest.duration_sec)} · {latest.day_key===dayKey(now,s.profile.tz)?'Today':new Date(latest.started_at).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:s.profile.tz})}{latest.source==='seed'?' · Demo':latest.source==='simulated'?' · Simulated':''}</Txt><Txt muted size={11}>{latest.place_name??'Your saved place'}</Txt></View><Icon name="chevron" size={15}/></Row></Card></Pressable>:<Card style={{gap:12,borderStyle:'dashed'}}><Txt serif size={23}>Your next visit belongs here.</Txt><Txt muted size={13}>Visit a saved gym or studio. We’ll start the timer on arrival and save the session when you finish or leave.</Txt><Button secondary small title="Check your saved places" onPress={()=>navigate('places')}/></Card>}
  <Pressable onPress={()=>setSetup(!setup)}><Row style={{paddingVertical:8}}><Txt muted size={13} style={{flex:1}}>Make ClassStreak yours</Txt><Icon name={setup?'x':'plus'} size={15}/></Row></Pressable>
  {setup&&<Card style={{gap:12}}><Txt muted size={13}>A few optional ways to get more from your week.</Txt><Button secondary title="Invite a friend" onPress={()=>navigate('add-friends')}/><Button secondary title="Create a session sticker" onPress={()=>navigate('post')}/><Button secondary title="Connect Apple Health" onPress={()=>navigate('health')}/></Card>}
  {s.feed.length>0&&<><Txt serif size={28}>Your people, showing up.</Txt>{s.feed.slice(0,5).map(item=><ActivityCard key={item.id} item={item} me={s.profile.id} action={action}/>)}<Button secondary title="See all friend activity" onPress={()=>navigate('friends')}/></>}
  <View style={{height:1,backgroundColor:t.line,marginTop:8}}/><CommunityPreview/>
 </View>;
}
