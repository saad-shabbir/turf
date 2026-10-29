import React,{useEffect,useState} from 'react';
import {Pressable,View} from 'react-native';
import {call} from './api';
import {weekDays,fullDays,timeLabel,safeMessage,type PlanDay,type ProfilePlan} from './model';
import {formatPlanTime} from './planning';
import {Card,Icon,Row,Txt,useTheme} from './ui';
import {lastWeekLabel} from './planLabel';
export {lastWeekLabel} from './planLabel';

export function PlanCard({peerId,name,refreshKey}:{peerId?:string;name:string;refreshKey?:unknown}){
 const t=useTheme();const [plan,setPlan]=useState<ProfilePlan|null>(null);const [error,setError]=useState<unknown>(null);const [week,setWeek]=useState<'this'|'next'>('this');
 useEffect(()=>{let active=true;void call<ProfilePlan>('cs_profile_plan',{peer:peerId??null}).then(v=>{if(active){setPlan(v);setError(null);}}).catch(e=>{if(active)setError(e);});return()=>{active=false;};},[peerId,refreshKey]);
 if(error)return <Card><Txt muted size={13}>{safeMessage(error)}</Txt></Card>;
 if(!plan)return <Card><Txt muted size={13}>Loading {peerId?`${name}’s`:'your'} plan…</Txt></Card>;
 if(!plan.shared)return <Card><Txt muted size={13}>{name} keeps their weekly plan private.</Txt></Card>;
 const days=week==='this'?plan.this_week:plan.next_week;const planned=days.filter(d=>d.planned.length);
 return <View style={{gap:12}}>
  <Card style={{gap:12}}>
   <Txt bold size={13}>Last week</Txt>
   <Txt size={14}>{lastWeekLabel(plan.last_week)}</Txt>
   <DayStrip days={plan.last_week.days}/>
  </Card>
  <Card style={{gap:12}}>
   <Row style={{borderRadius:99,backgroundColor:t.line,padding:3,gap:0}}>{(['this','next'] as const).map(v=><Pressable key={v} accessibilityRole="tab" accessibilityState={{selected:week===v}} onPress={()=>setWeek(v)} style={{flex:1,padding:8,borderRadius:99,backgroundColor:week===v?t.card:'transparent',alignItems:'center'}}><Txt bold={week===v} size={12}>{v==='this'?'This week':'Next week'}</Txt></Pressable>)}</Row>
   {week==='this'&&<DayStrip days={days} today={plan.today}/>}
   {planned.length?planned.map(d=><Row key={d.day} style={{gap:12,alignItems:'flex-start'}}>
    <View style={{width:44}}><Txt bold size={12} style={{color:d.day===plan.today?t.accent:t.ink}}>{fullDays[d.weekday]!.slice(0,3)}</Txt><Txt muted size={10}>{new Date(d.day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}</Txt></View>
    <View style={{flex:1,gap:3}}>{d.planned.map((p,i)=><Txt key={i} size={13}>{p.workout_label} · {p.time?formatPlanTime(p.time):timeLabel[p.period]}</Txt>)}</View>
    {d.done&&<Icon name="check" size={16} color={t.accent}/>}
   </Row>):<Txt muted size={13}>{week==='this'?`Nothing planned for the rest of this week.`:`Nothing planned for next week yet.`}</Txt>}
  </Card>
 </View>;
}
export function DayStrip({days,today}:{days:PlanDay[];today?:string}){
 const t=useTheme();
 return <Row style={{justifyContent:'space-between'}}>{days.map(d=><View key={d.day} accessible accessibilityLabel={`${fullDays[d.weekday]}: ${d.done?'worked out':'no workout'}`} style={{alignItems:'center',gap:5}}>
  <View style={{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',borderWidth:d.day===today?1.5:0,borderColor:t.ink}}><View style={{width:12,height:12,borderRadius:6,backgroundColor:d.done?t.accent:t.line}}/></View>
  <Txt size={10} bold={d.day===today} muted={d.day!==today}>{weekDays[d.weekday]}</Txt>
 </View>)}</Row>;
}
