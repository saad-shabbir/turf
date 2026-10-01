import React, {useMemo, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {SoftPressable as Pressable} from './motion';
import {ActivityArt} from './ActivityArt';
import {activity, durationLabel, type Session, type Snapshot} from './model';
import {mondayKey, shiftDay} from './engine';
import {Button, Card, Chip, Icon, Row, Txt, useTheme} from './ui';
import type {Action} from './SessionScreens';

function weekLabel(key:string) {
 const date=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
 return `${date(key)} – ${date(shiftDay(key,6))}`;
}

export function HistoryContent({snapshot,action}:{snapshot:Snapshot;action:Action}) {
 const t=useTheme(),tz=snapshot.profile.tz;
 const [filter,setFilter]=useState('all');
 const [collapsed,setCollapsed]=useState<string[]>([]);
 const sessions=useMemo(()=>snapshot.sessions.filter(s=>!s.removed_at).sort((a,b)=>b.started_at.localeCompare(a.started_at)),[snapshot.sessions]);
 const filters=[...new Set(sessions.map(s=>s.activity_key))];
 const visible=sessions.filter(s=>filter==='all'||s.activity_key===filter);
 const weeks=new Map<string,Session[]>();
 for(const s of visible){const week=s.week_key||mondayKey(s.started_at,tz);weeks.set(week,[...(weeks.get(week)??[]),s]);}
 return <View style={{gap:23}}>
  <Row style={{alignItems:'flex-end',justifyContent:'space-between'}}><Txt serif size={40}>History</Txt><Txt muted size={13} style={{paddingBottom:4}}>{sessions.length} {sessions.length===1?'workout':'workouts'}</Txt></Row>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:2}}>
   <Chip title="All" selected={filter==='all'} onPress={()=>setFilter('all')}/>
   {filters.map(key=><Chip key={key} title={activity(key).short} selected={filter===key} onPress={()=>setFilter(key)}/>)}
  </ScrollView>
  {!sessions.length?<View style={{alignItems:'center',paddingVertical:27,gap:16}}><ActivityArt activityKey={snapshot.goals[0]?.activity_key??'gym'} size={115}/><Txt serif size={29} style={{textAlign:'center'}}>Your first workout is ahead.</Txt><Txt muted size={14} style={{textAlign:'center',maxWidth:290}}>Visit a saved place, then finish your timer or leave. Your completed workouts will collect here.</Txt><Button title="Add a missed workout" secondary icon="plus" onPress={()=>action('navigate',{pane:'manual'})}/></View>:
   [...weeks].map(([week,items])=><View key={week} style={{gap:12}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${weekLabel(week)}, ${items.length} workouts`} accessibilityState={{expanded:!collapsed.includes(week)}} onPress={()=>setCollapsed(current=>current.includes(week)?current.filter(key=>key!==week):[...current,week])} style={{paddingVertical:5}}><Row><Txt bold size={15} style={{flex:1}}>{weekLabel(week)}</Txt><Txt muted size={12}>{items.length} {items.length===1?'workout':'workouts'}</Txt><View style={{transform:[{rotate:collapsed.includes(week)?'0deg':'90deg'}]}}><Icon name="chevron" size={15} color={t.muted}/></View></Row></Pressable>
    {!collapsed.includes(week)&&items.map(s=><Card key={s.id} style={{padding:15,borderRadius:24}}><Row style={{gap:11,alignItems:'center'}}>
     <Pressable accessibilityLabel={`View ${s.workout_label}, ${durationLabel(s.duration_sec)}`} onPress={()=>action('navigate',{pane:`session:${s.id}`})} style={{flex:1,flexDirection:'row',alignItems:'center',gap:13,minHeight:90}}>
      <ActivityArt activityKey={s.activity_key} size={65}/>
      <View style={{flex:1,gap:4}}><Txt muted size={11}>{new Date(s.started_at).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:tz})} · {durationLabel(s.duration_sec)}</Txt><Txt bold size={16}>{s.workout_label}</Txt><Txt muted size={12}>{s.place_name??snapshot.places.find(p=>p.id===s.place_id)?.name??'Your workout'}</Txt>
       {s.source==='seed'||s.source==='simulated'?<Txt muted size={10}>{s.source==='seed'?'Sample workout':'Simulated workout'}</Txt>:s.source==='manual'?<Txt muted size={10}>Added manually</Txt>:null}
       {!s.counted&&<Txt muted size={10}>Saved · not counted toward your goal</Txt>}
       {s.estimated&&<Txt muted size={10}>Estimated finish · tap to review</Txt>}
       {s.verified&&<Txt muted size={10}>Verified with Apple Health</Txt>}
      </View>
     </Pressable>
     <Pressable accessibilityLabel={`Make a sticker for ${s.workout_label}`} onPress={()=>action('post',{id:s.id})} style={{width:36,minHeight:44,alignItems:'center',justifyContent:'center'}}><Icon name="share" size={21} color={t.muted}/></Pressable>
    </Row></Card>)}
   </View>)}
  {!!sessions.length&&<Button secondary icon="plus" title="Add a missed workout" onPress={()=>action('navigate',{pane:'manual'})}/>}
  {!!sessions.length&&<Txt muted size={11} style={{textAlign:'center',paddingBottom:8}}>Your saved workouts stay here, including visits that didn’t count toward your weekly goal.</Txt>}
 </View>;
}
