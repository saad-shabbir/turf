import React, {useState} from 'react';
import {View} from 'react-native';
import {SoftPressable as Pressable} from './motion';
import {ActivitySchedules, CustomActivity} from './ActivitySetup';
import {ActivityArt} from './ActivityArt';
import {activities, activity, draftGoals, fullDays, type Draft} from './model';
import {Avatar, Button, Card, Chip, Divider, Icon, Input, Logo, Row, Screen, Txt, themes, useTheme} from './ui';

export function Onboarding({draft:d,change,next,requestLocation,search,account}:{
 draft:Draft; change:(value:Partial<Draft>)=>void; next:()=>void; requestLocation:()=>void;
 search:React.ReactNode; account:React.ReactNode;
}) {
 const t=useTheme();
 const [privacy,setPrivacy]=useState(false);
 const [addingPlace,setAddingPlace]=useState(false);
 const [noSetDays,setNoSetDays]=useState(false);
 const places=d.places??(d.place?[d.place]:[]);
 const schedules=d.schedules??d.selected.map(activity_key=>({activity_key,days:d.days,time:d.time}));
 const advance=()=>d.step===0?change({step:-1}):d.step===-1?change({step:1}):next();
 const back=()=>change({step:d.step===-1?0:d.step===1?-1:Math.max(0,d.step-1)});
 const titles=['','What moves you?',"What’s your\nweekly goal?",'Find your place.','Your usual days.','Let your visits\nlog themselves.','Make it yours.',"What’s your name?",'How do you identify?','Save your routine.'];
 const descriptions=['','Choose the workouts that are part of your routine.','Pick a goal that feels realistic. You can change it later.','Save your gym or studio. We’ll use arrivals and departures here to log your visits.','A little routine goes a long way. Set days and a time for each activity.','Location helps ClassStreak notice when you arrive at, and leave, your saved places.','The same ClassStreak, in your colors.','Friends see your first name. Studio boards show your first name and last initial.','Optional, and private to your account.','Create an account to keep your places, goals and workouts together.'];
 const stepOrder=[1,2,3,4,5,6,7,8,9];
 const stepIndex=stepOrder.indexOf(d.step);
 const total=d.selected.reduce((sum,key)=>sum+(d.goals[key]??0),0);
 const header=<View style={{paddingHorizontal:22,paddingTop:10,paddingBottom:8,gap:17}}>
  <Row style={{justifyContent:'space-between',minHeight:44}}>
   {d.step!==0?<Pressable accessibilityLabel="Previous step" onPress={back} style={{width:42,height:42,borderRadius:30,backgroundColor:t.card,alignItems:'center',justifyContent:'center'}}><Icon name="back" size={21}/></Pressable>:<View style={{width:1}}/>}
   <Logo size={23}/><View style={{width:d.step!==0?42:1}}/>
  </Row>
  {stepIndex>=0&&<View accessible accessibilityRole="progressbar" accessibilityLabel="Setup progress" accessibilityValue={{min:0,max:9,now:stepIndex+1,text:`Step ${stepIndex+1} of 9`}} style={{height:3,borderRadius:3,backgroundColor:t.line,overflow:'hidden'}}><View style={{height:3,width:`${(stepIndex+1)/9*100}%`,backgroundColor:t.ink,borderRadius:3}}/></View>}
 </View>;
 const footer=d.step===9?undefined:d.step===3?<>
  {!!places.length&&<Button title="Done adding places" onPress={advance}/>}
  {!places.length&&<Button secondary title="Add a place later" onPress={advance}/>}
 </>:d.step===5?<><Button title="Enable automatic logging" icon="pin" onPress={requestLocation}/><Button title="Set up later" secondary onPress={advance}/></>:<>
  <Button title={d.step===0?'Build my routine':d.step===6?'That’s my look':'Continue'} disabled={(d.step===1&&!d.selected.length)||(d.step===2&&total===0)||(d.step===7&&!d.first_name.trim())} onPress={advance}/>
  {d.step===8&&<Button title="Skip" secondary onPress={()=>{change({gender:null});next();}}/>}
  {d.step===0&&<Txt size={11} muted style={{textAlign:'center'}}>About two minutes. Create your account at the end.</Txt>}
 </>;

 if(privacy) return <Screen header={<View style={{padding:22}}><Logo size={23}/></View>} footer={<Button title="Back to setup" onPress={()=>setPrivacy(false)}/>}>
  <Txt serif size={36}>{'Your places.\nYour privacy.'}</Txt>
  <Txt>ClassStreak monitors an arrival area around the places you save. A detected arrival starts a possible visit; a departure helps finish it.</Txt>
  <Txt>Location samples are collected during a possible visit. They help estimate whether you’re still there. Arrival areas can include a pavement or car park, so a visit is an estimate, not proof of exercise.</Txt>
  <Txt>Exact times and location samples stay private. Friends can see your completed workout summary. Sharing a photo is always your choice.</Txt>
  <Txt muted>iPhone location updates can be delayed. You can stop or restart the timer yourself, and add a missed workout from your history.</Txt>
  <Divider/><Txt>Pause tracking in Account, remove a saved place, or change location access in iPhone Settings whenever you like.</Txt>
 </Screen>;

 if(d.step===0) return <Screen header={header} footer={footer} style={{gap:24,paddingTop:26}}>
  <View style={{gap:14}}><Txt serif size={43}>{'Your workouts,\nlogged for you.'}</Txt><Txt muted size={16}>Save your gym or studio. We’ll log your visits, so you can focus on showing up.</Txt></View>
  <Card style={{padding:20,gap:15}}><Row style={{alignItems:'flex-start'}}><ActivityArt activityKey="gym" size={72}/><View style={{flex:1,gap:4,paddingTop:9}}><Txt muted size={10} style={{letterSpacing:1.4}}>A LITTLE PROGRESS, EVERY WEEK</Txt><Txt serif size={26}>You showed up.</Txt><Txt muted size={12}>Weights · 52 min</Txt></View></Row><Divider/><Row style={{justifyContent:'space-between'}}><Txt bold size={14}>2 of 3 workouts this week</Txt><Icon name="check" size={19}/></Row><View style={{height:5,borderRadius:4,backgroundColor:t.line}}><View style={{height:5,width:'66%',borderRadius:4,backgroundColor:t.ink}}/></View><Txt muted size={10}>Example workout</Txt></Card>
  <View style={{gap:15}}><Txt serif size={26}>Better with your people.</Txt><Row style={{alignItems:'flex-start'}}><Avatar name="Maya" size={36}/><View style={{flex:1,gap:3}}><Txt bold size={14}>A little encouragement goes a long way.</Txt><Txt muted size={13}>“You’ve got this. See you tomorrow?”</Txt><Txt muted size={10}>Example from a friend</Txt></View><Icon name="heart" size={19}/></Row></View>
 </Screen>;

 if(d.step===-1) return <Screen header={header} footer={footer} style={{paddingTop:22,gap:27}}>
  <Txt serif size={40}>{'Show up.\nWe’ll take it from here.'}</Txt>
  {[
   ['01','Save your place.','Choose the gym or studio you go to. You can save more than one.','pin'],
   ['02','Arrive. Your timer starts.','Pick your workout, or just let the visit count. Started early? Restart it.','clock'],
   ['03','Finish on your terms.','Tap Stop when you’re done, or let your departure finish the visit.','check'],
  ].map(([n,title,body,icon])=><View key={n} style={{gap:19}}><Row style={{alignItems:'flex-start',gap:16}}><View style={{width:48,height:48,borderRadius:18,backgroundColor:t.tint,alignItems:'center',justifyContent:'center'}}><Icon name={icon!} size={23}/></View><View style={{flex:1,gap:7}}><Txt serif size={25}>{title}</Txt><Txt muted size={14}>{body}</Txt></View></Row>{n!=='03'&&<Divider/>}</View>)}
  <Txt muted size={12}>Your visits build your weekly goal and streak. Photos and sharing are optional.</Txt>
 </Screen>;

 return <Screen header={header} footer={footer} style={{gap:22,paddingTop:24}}>
  <View style={{gap:12}}><Txt serif size={37}>{titles[d.step]}</Txt>{!!descriptions[d.step]&&<Txt muted size={15}>{descriptions[d.step]}</Txt>}</View>
  {d.step===1&&<>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>{activities.map(a=>{
    const selected=d.selected.includes(a.key);
    return <Pressable key={a.key} accessibilityRole="checkbox" accessibilityState={{checked:selected}} accessibilityLabel={a.label} onPress={()=>{const selectedKeys=selected?d.selected.filter(k=>k!==a.key):[...d.selected,a.key];change({selected:selectedKeys,goals:draftGoals(selectedKeys,d.goals)});}} style={{width:'31%',minHeight:121,padding:9,paddingTop:14,borderRadius:20,borderWidth:selected?1.4:0.7,borderColor:selected?t.ink:t.card,backgroundColor:t.card,alignItems:'center',justifyContent:'space-between',gap:8}}>
     {selected&&<View style={{position:'absolute',top:7,right:7,width:18,height:18,borderRadius:10,backgroundColor:t.ink,alignItems:'center',justifyContent:'center'}}><Icon name="check" size={11} color="#fff"/></View>}
     <ActivityArt activityKey={a.key} size={62}/><Txt size={12} style={{textAlign:'center'}}>{a.key==='gym'?'Weights':a.label}</Txt>
    </Pressable>;
   })}</View>
   {!!d.selected.filter(key=>key.startsWith('custom:')).length&&<Row style={{flexWrap:'wrap'}}>{d.selected.filter(key=>key.startsWith('custom:')).map(key=><Chip key={key} title={activity(key).label} selected onPress={()=>change({selected:d.selected.filter(k=>k!==key),goals:Object.fromEntries(Object.entries(d.goals).filter(([k])=>k!==key))})}/>)}</Row>}
   <CustomActivity onAdd={key=>{const selected=[...new Set([...d.selected,key])];change({selected,goals:draftGoals(selected,d.goals)});}}/>
   <Txt muted size={12}>Climbing, running, something else? Add your own. You can change these later.</Txt>
  </>}
  {d.step===2&&<>
   <View style={{alignItems:'center',paddingVertical:10,gap:3}}><Txt size={76} style={{lineHeight:86,letterSpacing:-5}}>{total}</Txt><Txt muted size={11} style={{letterSpacing:2}}>WORKOUTS / WEEK</Txt></View>
   <View style={{gap:9}}>{d.selected.map(key=>{const count=d.goals[key]??0;return <Card key={key} style={{padding:12,borderRadius:20}}><Row style={{gap:9}}><ActivityArt activityKey={key} size={43}/><View style={{flex:1}}><Txt bold size={14}>{activity(key).label}</Txt><Txt muted size={11}>{count===0?'Track without a weekly goal':`${count} ${count===1?'workout':'workouts'} a week`}</Txt></View><Row style={{gap:6}}><Pressable disabled={count<=0} accessibilityLabel={`Decrease ${activity(key).label} weekly goal`} onPress={()=>change({goals:{...d.goals,[key]:Math.max(0,count-1)}})} style={{width:36,height:40,borderRadius:16,alignItems:'center',justifyContent:'center',opacity:count<=0?.3:1}}><Icon name="minus" size={17}/></Pressable><Txt bold size={20} style={{minWidth:23,textAlign:'center'}}>{count}</Txt><Pressable disabled={count>=7} accessibilityLabel={`Increase ${activity(key).label} weekly goal`} onPress={()=>change({goals:{...d.goals,[key]:Math.min(7,count+1)}})} style={{width:36,height:40,borderRadius:16,backgroundColor:t.tint,alignItems:'center',justifyContent:'center',opacity:count>=7?.3:1}}><Icon name="plus" size={17}/></Pressable></Row></Row></Card>;})}</View>
   <Txt muted size={12} style={{textAlign:'center'}}>Every selected activity is included. Your goal is the total shown above.</Txt>
  </>}
  {d.step===3&&<>
   {!!places.length&&<><Txt muted size={11} style={{letterSpacing:1.4}}>YOUR SAVED PLACES</Txt>{places.map((p,i)=><Card key={p.name+i} style={{padding:14}}><Row><ActivityArt activityKey={p.activity_key} size={48}/><View style={{flex:1,gap:3}}><Txt bold size={14}>{p.name}</Txt><Txt muted size={12}>{activity(p.activity_key).label}</Txt></View><Icon name="check" size={17}/></Row></Card>)}<Button secondary icon={addingPlace?'x':'plus'} title={addingPlace?'Close search':'Add another place'} onPress={()=>setAddingPlace(!addingPlace)}/></>}
   {(!places.length||addingPlace)&&search}
  </>}
  {d.step===4&&<>
   <Row><View style={{flex:1}}><Chip title="Usual days" selected={!noSetDays} onPress={()=>setNoSetDays(false)}/></View><View style={{flex:1}}><Chip title="No set days" selected={noSetDays} onPress={()=>{setNoSetDays(true);change({days:[],schedules:schedules.map(s=>({...s,days:[]}))});}}/></View></Row>
   {noSetDays?<Card style={{gap:10,paddingVertical:26}}><Icon name="calendar" size={27}/><Txt serif size={26}>Go when it works for you.</Txt><Txt muted size={14}>Your visits still log whenever you go. You can add a day and a reminder from Home later.</Txt></Card>:<ActivitySchedules selected={d.selected} schedules={schedules} onChange={value=>change({schedules:value,days:[...new Set(value.flatMap(s=>s.days))]})}/>}
  </>}
  {d.step===5&&<>
   <Card style={{gap:0,paddingVertical:4}}>{[['pin','Only your saved places','Arrival and departure help estimate your workout.'],['clock','Works while your phone is away','Background logging needs Always location access.'],['lock','Your location stays private','Friends see completed workouts, never a live location.']].map(([icon,title,body],i)=><View key={title}><Row style={{alignItems:'flex-start',paddingVertical:19,gap:14}}><View style={{width:40,height:40,borderRadius:14,backgroundColor:t.tint,alignItems:'center',justifyContent:'center'}}><Icon name={icon!} size={20}/></View><View style={{flex:1,gap:4}}><Txt bold size={15}>{title}</Txt><Txt muted size={13}>{body}</Txt></View></Row>{i<2&&<Divider/>}</View>)}</Card>
   <Txt size={13} muted>iPhone may first ask for “While Using the App.” Allow it, then choose “Always” when offered or in Settings.</Txt>
   <Txt size={13} muted>Photos and notifications are separate choices. Nothing posts automatically.</Txt>
   <Pressable accessibilityRole="link" onPress={()=>setPrivacy(true)} style={{paddingVertical:10}}><Row style={{justifyContent:'space-between'}}><Txt size={13}>How we handle your location</Txt><Icon name="chevron" size={15}/></Row></Pressable>
  </>}
  {d.step===6&&(['clay','sage','blush'] as const).map(name=><Pressable key={name} accessibilityRole="radio" accessibilityState={{selected:d.theme===name}} accessibilityLabel={`${name} theme`} onPress={()=>change({theme:name})}><Card style={{minHeight:123,borderWidth:d.theme===name?1.3:.7,borderColor:d.theme===name?t.ink:t.line,padding:16}}><Row style={{gap:18}}><View style={{width:75,height:91,borderRadius:15,padding:10,gap:8,backgroundColor:themes[name].paper,borderWidth:1,borderColor:themes[name].line}}><View style={{width:28,height:4,backgroundColor:themes[name].ink,borderRadius:3}}/><Txt serif size={25} style={{color:themes[name].ink}}>2/3</Txt><View style={{height:5,borderRadius:4,backgroundColor:themes[name].tint}}/><View style={{height:13,borderRadius:8,backgroundColor:themes[name].accent}}/></View><View style={{flex:1,gap:8}}><Txt serif size={25}>{name[0]!.toUpperCase()+name.slice(1)}</Txt><Txt muted size={12}>{name==='clay'?'Warm, calm and considered.':name==='sage'?'A softer shade of green.':'A little warmth in every day.'}</Txt><Row style={{gap:6}}>{['paper','tint','accent'].map(token=><View key={token} style={{width:17,height:17,borderRadius:12,backgroundColor:themes[name][token as keyof typeof t],borderWidth:.7,borderColor:t.line}}/>)}</Row></View><View style={{width:23,height:23,borderRadius:14,backgroundColor:d.theme===name?t.ink:'transparent',borderWidth:1,borderColor:d.theme===name?t.ink:t.line,alignItems:'center',justifyContent:'center'}}>{d.theme===name&&<Icon name="check" color="#fff" size={13}/>}</View></Row></Card></Pressable>)}
  {d.step===7&&<><Input label="First name" value={d.first_name} onChange={first_name=>change({first_name})}/><Input label="Last name · optional" value={d.last_name} onChange={last_name=>change({last_name})}/></>}
  {d.step===8&&['Woman','Man','Non-binary','Prefer not to say'].map(gender=><Pressable key={gender} accessibilityRole="radio" accessibilityState={{selected:d.gender===gender}} onPress={()=>change({gender})}><Card style={{backgroundColor:d.gender===gender?t.tint:t.card,borderColor:d.gender===gender?t.ink:t.line,minHeight:64,justifyContent:'center'}}><Row><Txt size={16} style={{flex:1}}>{gender}</Txt><View style={{width:23,height:23,borderRadius:14,borderWidth:1,borderColor:d.gender===gender?t.ink:t.line,backgroundColor:d.gender===gender?t.ink:'transparent'}}/></Row></Card></Pressable>)}
  {d.step===9&&<><Card style={{gap:18}}><Row style={{justifyContent:'space-between'}}><Txt muted size={11} style={{letterSpacing:1.5}}>YOUR ROUTINE</Txt><Icon name="check" size={17}/></Row><Txt serif size={31}>{total} workouts a week.</Txt><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{d.selected.map(key=><Chip key={key} title={activity(key).label} selected/>)}</View>{!!places.length&&<><Divider/>{places.map((p,i)=><Row key={p.name+i}><Icon name="pin" size={15}/><Txt size={13} style={{flex:1}}>{p.name}</Txt></Row>)}</>}{!!d.days.length&&<Txt muted size={12}>{d.days.map(i=>fullDays[i]!.slice(0,3)).join(' · ')}</Txt>}</Card><View style={{flex:1,minHeight:25}}/>{account}</>}
 </Screen>;
}
