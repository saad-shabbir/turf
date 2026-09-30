import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,View} from 'react-native';
import {call} from './api';
import {activity,fullDays,safeMessage,timeLabel,type Snapshot} from './model';
import {Avatar,Button,Card,Icon,Row,Txt,useTheme} from './ui';
import {ActivityArt} from './ActivityArt';
import type {Action} from './SessionScreens';
import {createFriendProfileSession,type FriendProfileState} from './friendProfileState';

const initial:FriendProfileState={profile:null,loading:true,sending:false,error:null,sent:false};

export function FriendProfile({peerId,snapshot,action}:{peerId:string;snapshot:Snapshot;action:Action}){
 const accepted=snapshot.friends.some(friend=>friend.id===peerId&&friend.status==='accepted'&&!friend.is_demo);
 if(!accepted)return <Card style={{gap:12}}><Txt serif size={29}>Profile unavailable</Txt><Txt muted>You can view workout profiles after you both accept the friend request.</Txt><Button secondary title="Back to friends" onPress={()=>action('navigate',{pane:'friends'})}/></Card>;
 return <FriendProfileContent key={`${snapshot.profile.id}:${peerId}`} peerId={peerId} ownerId={snapshot.profile.id} action={action}/>;
}

function FriendProfileContent({peerId,ownerId,action}:{peerId:string;ownerId:string;action:Action}){
 const t=useTheme();
 const [state,setState]=useState<FriendProfileState>(initial);
 const controller=useRef<ReturnType<typeof createFriendProfileSession>|null>(null);
 const actionRef=useRef(action);
 useEffect(()=>{actionRef.current=action;},[action]);
 useEffect(()=>{
  const session=createFriendProfileSession({ownerId,peerId,request:call,onState:setState,onSnapshot:value=>actionRef.current('friend_snapshot',{snapshot:value})});
  controller.current=session;
  void session.load();
  return()=>{session.dispose();if(controller.current===session)controller.current=null;};
 },[ownerId,peerId]);
 const profile=state.profile;
 if(!profile)return <Card style={{gap:16}}>{state.loading?<><ActivityIndicator color={t.accent}/><Txt muted style={{textAlign:'center'}}>Loading your friend’s week…</Txt></>:<><Txt serif size={28}>{state.sent?'Nudge sent.':'Couldn’t load this profile'}</Txt>{state.sent&&<Txt muted size={13}>Your encouragement reached their ClassStreak inbox. We couldn’t refresh their profile yet.</Txt>}<Txt muted>{safeMessage(state.error)}</Txt><Button title="Try again" onPress={()=>void controller.current?.load()}/></>}</Card>;
 const details=[...profile.week_details].sort((a,b)=>b.day-a.day);
 const available=profile.nudge_available&&!profile.worked_out_today&&!profile.nudged_today&&!profile.is_demo;
 return <View style={{gap:18}}>
  <View style={{alignItems:'center',gap:10,paddingVertical:12}}><Avatar name={profile.first_name} size={78}/><Txt serif size={36}>{profile.first_name}</Txt><Row style={{gap:5}}><Icon name="friends" size={15} color={t.muted}/><Txt muted size={12}>Your friend</Txt></Row></View>
  <Card style={{gap:18}}><Row><Txt bold size={13} style={{flex:1}}>This week</Txt><Txt muted size={12}>Mon–Sun</Txt></Row><Row style={{alignItems:'flex-end',gap:6}}><Txt serif size={49}>{profile.weekly_count}</Txt><Txt muted size={15} style={{paddingBottom:6}}>of {profile.weekly_goal} workouts</Txt></Row><View accessibilityLabel={`${profile.weekly_count} of ${profile.weekly_goal} workouts this week`} style={{height:7,borderRadius:9,backgroundColor:t.line,overflow:'hidden'}}><View style={{height:7,borderRadius:9,backgroundColor:t.accent,width:`${Math.min(100,profile.weekly_count/Math.max(1,profile.weekly_goal)*100)}%`}}/></View><Row style={{gap:6}}><Icon name="flame" size={17} color={t.accent}/><Txt size={12}>{profile.streak>0?`${profile.streak} ${profile.streak===1?'week':'weeks'} reaching their goal`:'Building their routine, one workout at a time'}</Txt></Row></Card>
  <Card style={{gap:13,backgroundColor:t.tint}}><Row><Icon name={profile.worked_out_today?'check':'friends'} color={t.accent}/><Txt bold size={14} style={{flex:1}}>{profile.worked_out_today?'They showed up today.':'A little encouragement goes a long way.'}</Txt></Row><Txt muted size={13}>{profile.worked_out_today?`${profile.first_name} has already logged a workout today.`:profile.nudged_today?'You’ve sent them a nudge today.':'No workout logged today yet.'}</Txt>
   {available&&<><Button title={state.sending?'Sending…':`Nudge ${profile.first_name}`} disabled={state.sending||state.loading} onPress={()=>void controller.current?.nudge()}/><Txt muted size={11}>They’ll see your encouragement in their ClassStreak inbox when their app syncs.</Txt></>}
   {!profile.worked_out_today&&!profile.nudged_today&&!available&&<Txt muted size={12}>Nudges are unavailable for this friend right now.</Txt>}
   {state.sent&&<Txt bold size={12}>Nudge sent to their ClassStreak inbox.</Txt>}
   {!!state.error&&<View accessibilityLiveRegion="polite"><Txt size={12}>{safeMessage(state.error)}</Txt></View>}
  </Card>
  <Row><Txt serif size={27} style={{flex:1}}>Their week</Txt><Txt muted size={12}>{details.length} logged</Txt></Row>
  {details.length?details.map((detail,index)=><Card key={`${detail.day}:${detail.activity_key}:${index}`} style={{padding:16}}><Row style={{gap:14}}><ActivityArt activityKey={detail.activity_key} size={55}/><View style={{flex:1,gap:3}}><Txt bold size={15}>{detail.workout_label||activity(detail.activity_key).label}</Txt><Txt muted size={12}>{fullDays[detail.day]} · {timeLabel[detail.time_of_day]}</Txt><Txt muted size={12}>{Math.round(detail.duration_sec/60)} min</Txt></View></Row></Card>):<Card><Txt muted size={13}>Their completed workouts will appear here. Everyone’s week starts somewhere.</Txt></Card>}
 </View>;
}
