import React,{useEffect,useState} from 'react';
import {Pressable,View,useWindowDimensions} from 'react-native';
import Svg,{Circle} from 'react-native-svg';
import type {Snapshot} from './model';
import {activity,durationLabel} from './model';
import {dayKey,progress,type Candidate} from './engine';
import {ActiveWorkout} from './ActiveWorkout';
import {WeeklyPlan} from './WeeklyPlan';
import {homeGreeting} from './greeting';
import {ActivityArt} from './ActivityArt';
import {ActivityCard} from './Friends';
import {CommunityPreview} from './CommunityPreview';
import {dismissSetup,loadSetupDismissed,setupProgress} from './homeSetup';
import {Button,Card,Icon,Row,Txt,useTheme} from './ui';
import type {Action} from './SessionScreens';

function WeeklyProgress({snapshot:s,now}:{snapshot:Snapshot;now:Date}){
 const t=useTheme();const stats=progress(s.sessions,s.weeks,s.goals,s.profile.tz,now);const remaining=Math.max(0,stats.goal-stats.count);
 const currentGoals=[...s.weeks].filter(w=>w.week_key<=stats.week).sort((a,b)=>b.week_key.localeCompare(a.week_key))[0]?.goals??s.goals;
 const goals=currentGoals.filter(g=>g.goal>0);const primary=goals[0]?.activity_key??s.goals[0]?.activity_key??'gym';const compact=useWindowDimensions().width<350;const artSize=compact?91:116;
 const ratio=Math.min(1,stats.count/Math.max(1,stats.goal));const complete=stats.goal>0&&stats.count>=stats.goal;
 return <Card style={{backgroundColor:t.tint,borderWidth:0,padding:20,gap:16,overflow:'hidden'}}>
  <Row style={{justifyContent:'space-between'}}><Txt bold size={10} style={{letterSpacing:1.6,color:t.accent}}>THIS WEEK</Txt>{stats.streak>0&&<Row style={{gap:5}}><Icon name="flame" color={t.accent} size={15}/><Txt bold size={11} style={{color:t.accent}}>{stats.streak}-week streak</Txt></Row>}</Row>
  <Row style={{gap:12,alignItems:'center'}}><View style={{flex:1,gap:2}}><Row style={{gap:7,alignItems:'baseline'}}><Txt numeric size={compact?46:54}>{stats.count}</Txt><Txt numeric size={compact?20:23} style={{color:t.muted}}>of {stats.goal}</Txt></Row><Txt bold size={compact?12:14}>workouts logged</Txt><Txt size={12} style={{color:t.muted,marginTop:5}}>{complete?'Goal reached. Strong work.':stats.goal===0?'Set a weekly goal in Profile.':stats.count===0?'Start with one. You’ve got this.':`${remaining} more to reach your goal.`}</Txt></View>
   <View accessible accessibilityRole="progressbar" accessibilityLabel="Weekly workout goal" accessibilityValue={{min:0,max:Math.max(stats.goal,stats.count,1),now:stats.count,text:`${stats.count} of ${stats.goal} workouts`}} style={{width:artSize,height:artSize,alignItems:'center',justifyContent:'center'}}><Svg width={artSize} height={artSize} viewBox="0 0 116 116" style={{position:'absolute'}}><Circle cx={58} cy={58} r={51} stroke={t.card} strokeWidth={6} fill={t.card}/><Circle cx={58} cy={58} r={51} stroke={t.accent} strokeWidth={6} fill="none" strokeDasharray="320.44 320.44" strokeDashoffset={320.44*(1-ratio)} strokeLinecap="round" transform="rotate(-90 58 58)"/></Svg><ActivityArt activityKey={primary} size={artSize*.715}/>{complete&&<View style={{position:'absolute',bottom:0,right:0,width:28,height:28,borderRadius:14,backgroundColor:t.accent,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:t.tint}}><Icon name="check" size={15} color="#fff"/></View>}</View>
  </Row>
  {goals.length>0&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{goals.map(g=>{const count=s.sessions.filter(x=>!x.removed_at&&x.counted&&x.week_key===stats.week&&x.activity_key===g.activity_key&&Date.parse(x.started_at)<=now.getTime()).length;return <View key={g.activity_key} style={{flexGrow:1,minWidth:0,flexBasis:goals.length<=3?'25%':'40%',backgroundColor:t.card,borderRadius:15,paddingHorizontal:compact?8:10,paddingVertical:9,gap:5}}><Row style={{gap:5,justifyContent:'space-between'}}><Icon name={activity(g.activity_key).icon} size={15} color={t.accent}/><Txt bold size={12}>{count}/{g.goal}</Txt></Row><Txt size={10} lines={1}>{g.activity_key==='gym'?'Weights':activity(g.activity_key).short}</Txt></View>;})}</View>}
 </Card>;
}

function SetupChecklist({snapshot:s,action}:{snapshot:Snapshot;action:Action}){
 const t=useTheme();const [saved,setSaved]=useState<{owner:string;dismissed:boolean}|null>(null);const [busy,setBusy]=useState(false);const state=setupProgress(s);const owner=s.profile.id;
 useEffect(()=>{let current=true;void loadSetupDismissed(owner).then(dismissed=>{if(current)setSaved({owner,dismissed});}).catch(()=>{if(current)setSaved({owner,dismissed:false});});return()=>{current=false;};},[owner]);
 if(saved?.owner!==owner||saved.dismissed||state.done===3)return null;
 const hide=()=>{setBusy(true);void dismissSetup(owner).then(()=>setSaved(previous=>previous?.owner===owner?{owner,dismissed:true}:previous)).catch(error=>action('error',{error})).finally(()=>setBusy(false));};
 const rows=[
  {title:'Save your gym or studio',body:state.place?'Ready to notice your next visit.':'Choose where your workouts happen.',done:state.place,icon:'pin',pane:'places'},
  {title:'Add 3 friends',body:state.friends===3?'Your workout people are here.':'Cheer each other on. A little company helps.',done:state.friends===3,icon:'friends',pane:'add-friends'},
  {title:'Log your first workout',body:state.workout?'You showed up. That’s a great start.':'Visit your saved place, or add a missed workout.',done:state.workout,icon:'flame',pane:state.workout?'history':'manual'},
 ];
 return <Card style={{padding:18,gap:15}}><Row style={{alignItems:'flex-start'}}><View style={{flex:1,gap:5}}><Txt serif size={26}>Off to a great start.</Txt><Txt muted size={12}>{state.done} of 3 steps complete</Txt></View><Pressable accessibilityRole="button" accessibilityLabel="Dismiss setup checklist" disabled={busy} onPress={hide} style={{padding:10,marginTop:-5,marginRight:-6}}><Icon name="x" size={16} color={t.muted}/></Pressable></Row><Row style={{gap:5}}>{[0,1,2].map(i=><View key={i} style={{flex:1,height:4,borderRadius:3,backgroundColor:i<state.done?t.accent:t.line}}/>)}</Row>
  {rows.map((item,i)=><Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`${item.title}${i===1?`, ${state.friends} of 3`:''}${item.done?', complete':''}`} onPress={()=>action('navigate',{pane:item.pane})} style={{paddingVertical:7}}><Row style={{gap:11,alignItems:'center'}}><View style={{width:35,height:35,borderRadius:13,backgroundColor:item.done?t.tint:t.paper,alignItems:'center',justifyContent:'center'}}><Icon name={item.done?'check':item.icon} size={17} color={t.accent}/></View><View style={{flex:1,gap:4}}><Row style={{gap:8}}><Txt bold size={13} style={{flex:1}}>{item.title}</Txt>{i===1&&<Txt bold size={11} style={{color:t.accent}}>{state.friends}/3</Txt>}</Row><Txt muted size={11}>{item.body}</Txt></View><Icon name="chevron" size={13} color={t.muted}/></Row></Pressable>)}
 </Card>;
}

export function Home({snapshot:s,now,activeWorkout,busy,tracking,action}:{snapshot:Snapshot;now:Date;activeWorkout:Candidate|null;busy:boolean;tracking?:string;action:Action}){
 const t=useTheme();const latest=s.sessions.find(x=>!x.removed_at);const greeting=homeGreeting(now,Intl.DateTimeFormat().resolvedOptions().timeZone);
 const navigate=(pane:string)=>action('navigate',{pane});
 return <View style={{gap:23}}><View style={{gap:8}}><Txt serif size={34}>{greeting==='Hello, night owl'?'Hello, night owl.':`${greeting},\n${s.profile.first_name}.`}</Txt><Txt muted size={14}>Let’s get a good workout in.</Txt></View>
  <WeeklyPlan snapshot={s} now={now} afterCalendar={<><SetupChecklist snapshot={s} action={action}/><WeeklyProgress snapshot={s} now={now}/><ActiveWorkout compact candidate={activeWorkout} snapshot={s} action={action} busy={busy}/></>}/>
  {!!tracking&&<Pressable accessibilityRole="button" onPress={()=>tracking.includes('ettings')?action('open_settings'):navigate('account')}><Row style={{alignItems:'flex-start',padding:4}}><Icon name="pin" size={17} color={t.accent}/><Txt muted size={12} style={{flex:1}}>{tracking}</Txt><Icon name="chevron" size={13}/></Row></Pressable>}
  <Row><Txt serif size={27} style={{flex:1}}>Your latest workout</Txt><Pressable accessibilityRole="button" onPress={()=>navigate('history')} style={{paddingVertical:12}}><Txt bold size={12} style={{color:t.accent}}>History →</Txt></Pressable></Row>
  {latest?<Pressable accessibilityRole="button" accessibilityLabel="Open latest workout" onPress={()=>navigate('session:'+latest.id)}><Card style={{padding:18}}><Row style={{gap:14}}><ActivityArt activityKey={latest.activity_key} size={67}/><View style={{flex:1,gap:5}}><Txt bold size={16}>{latest.workout_label}</Txt><Txt muted size={12}>{durationLabel(latest.duration_sec)} · {latest.day_key===dayKey(now,s.profile.tz)?'Today':new Date(latest.started_at).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:s.profile.tz})}{latest.source==='seed'?' · Demo':latest.source==='simulated'?' · Simulated':''}</Txt><Txt muted size={11}>{latest.place_name??'Your saved place'}</Txt></View><Icon name="chevron" size={15}/></Row></Card></Pressable>:<Card style={{gap:12,borderStyle:'dashed'}}><Txt serif size={23}>Your first workout goes here.</Txt><Txt muted size={13}>We’ll start the timer at your saved gym or studio. Finish in the app or leave when you’re done.</Txt><Button secondary small title="Check your saved places" onPress={()=>navigate('places')}/></Card>}
  <View style={{height:1,backgroundColor:t.line,marginTop:8}}/>
  {s.feed.length>0&&<><Txt serif size={28}>Your people, showing up.</Txt>{s.feed.slice(0,5).map(item=><ActivityCard key={item.id} item={item} me={s.profile.id} action={action} acceptedFriendIds={s.friends.filter(f=>f.status==='accepted'&&!f.is_demo).map(f=>f.id)}/>)}<Button secondary title="See all friend activity" onPress={()=>navigate('friends')}/></>}
  <CommunityPreview/>
 </View>;
}
