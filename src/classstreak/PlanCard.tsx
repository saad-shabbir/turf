import React,{useEffect,useState} from 'react';
import {Pressable,View} from 'react-native';
import {call} from './api';
import {weekDays,fullDays,timeLabel,safeMessage,type PlanDay,type ProfilePlan} from './model';
import {formatPlanTime} from './planning';
import {Card,Icon,Row,Txt,useTheme} from './ui';

// Last week's score counts planned days that had a workout ("4 of 5 planned
// days, 80%"). Friends see the same card; nobody else can load it.
export function lastWeekLabel(plan:{planned_days:number;completed_days:number;percent:number|null}){
 return plan.planned_days?`${plan.completed_days} of ${plan.planned_days} planned ${plan.planned_days===1?'day':'days'}, ${plan.percent}%`:'No workouts were planned last week';
}

export function PlanCard({peerId,name,refreshKey}:{peerId?:string;name:string;refreshKey?:unknown}){
 const t=useTheme();const [plan,setPlan]=useState<ProfilePlan|null>(null);const [error,setError]=useState<unknown>(null);const [week,setWeek]=useState<'this'|'next'>('this');
 useEffect(()=>{let active=true;void call<ProfilePlan>('cs_profile_plan',{peer:peerId??null}).then(v=>{if(active){setPlan(v);setError(null);}}).catch(e=>{if(active)setError(e);});return()=>{active=false;};},[peerId,refreshKey]);
 if(error)return <Card><Txt muted size={13}>{safeMessage(error)}</Txt></Card>;
 if(!plan)return <Card><Txt muted size={13}>Loading {peerId?`${name}’s`:'your'} plan…</Txt></Card>;
 if(!plan.shared)return <Card><Txt muted size={13}>{name} keeps their weekly plan private.</Txt></Card>;
 const days=week==='this'?plan.this_week:plan.next_week;const planned=days.filter(d=>d.planned.length);
 return <View style={{gap:12}}>
  <Card style={{gap:12}}>
   <Row><Txt bold size={13} style={{flex:1}}>Last week</Txt><Txt bold size={13} style={{color:t.accent}}>{plan.last_week.percent===null?'':`${plan.last_week.percent}%`}</Txt></Row>
   <Txt size={14}>{lastWeekLabel(plan.last_week)}</Txt>
   <DayStrip days={plan.last_week.days}/>
   <Row style={{gap:12,flexWrap:'wrap'}}><Legend color={t.accent} filled label="Planned, went"/><Legend color={t.muted} label="Planned, missed"/><Legend color={t.ink} dot label="Extra day"/></Row>
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
function Legend({color,label,filled,dot}:{color:string;label:string;filled?:boolean;dot?:boolean}){
 return <Row style={{gap:5}}><View style={{width:10,height:10,borderRadius:5,backgroundColor:filled||dot?color:'transparent',borderWidth:filled||dot?0:1.5,borderColor:color,transform:dot?[{scale:.6}]:[]}}/><Txt muted size={10}>{label}</Txt></Row>;
}
export function DayStrip({days,today}:{days:PlanDay[];today?:string}){
 const t=useTheme();
 return <Row style={{justifyContent:'space-between'}}>{days.map(d=>{const planned=d.planned.length>0;const future=!!today&&d.day>=today&&!d.done;
  const label=`${fullDays[d.weekday]}: ${planned?(d.done?'planned and went':future?'planned':'planned, missed'):d.done?'worked out':'rest day'}`;
  return <View key={d.day} accessible accessibilityLabel={label} style={{alignItems:'center',gap:4}}>
   <View style={{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:planned&&d.done?t.accent:'transparent',borderWidth:planned&&!d.done?1.5:d.day===today?1.5:0,borderStyle:future?'dashed':'solid',borderColor:planned?(future?t.accent:t.muted):t.ink}}>
    {planned&&d.done?<Icon name="check" size={14} color="#fff"/>:planned&&!future?<Icon name="x" size={12} color={t.muted}/>:!planned&&d.done?<View style={{width:8,height:8,borderRadius:4,backgroundColor:t.ink}}/>:null}
   </View>
   <Txt size={10} bold={d.day===today} muted={d.day!==today}>{weekDays[d.weekday]}</Txt>
  </View>;})}</Row>;
}
