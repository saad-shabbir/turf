import {PreservedVisits} from '../src/classstreak/PreservedVisits';
import {ActiveWorkout} from "../src/classstreak/ActiveWorkout";
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {View} from 'react-native';
import {Theme,Button,Card,Txt,Logo,Input,Screen} from '../src/classstreak/ui';
import {Product} from '../src/classstreak/Product';
import {Onboarding} from '../src/classstreak/Onboarding';
import {Friends} from '../src/classstreak/Friends';
import {StudioView} from '../src/classstreak/Studios';
import {Plus} from '../src/classstreak/Plus';
import {PlacesPicker} from '../src/classstreak/PlacesPicker';
import {Post,Celebration} from '../src/classstreak/Post';
import {newDraft,activity} from '../src/classstreak/model';
/* global __CLASSSTREAK_FIXTURE__ */
const fixture=__CLASSSTREAK_FIXTURE__;
const pages=['welcome','activities','sessions','find','usual-days','permission','look','name','identify','account','home','studios','friends','profile','session','post','plus','recap','milestone','active-workout','sync-review'];
function Gallery(){
 const [live,setLive]=useState(()=>({visit_id:'preview-arrival',place_id:'preview',activity_key:'gym',workout_label:'Gym / weights',entered_at:new Date(Date.now()-12*60000).toISOString()}));
 const [page,setPage]=useState(new URLSearchParams(location.search).get('page')||'welcome');
 const [theme,setTheme]=useState('clay');const [data,setData]=useState(fixture);const [selectedStudio,setSelectedStudio]=useState(fixture.places[0]?.id);const [message,setMessage]=useState('');
 const [draft,setDraft]=useState({...newDraft(),selected:['reformer','yoga','gym'],goals:{reformer:2,yoga:1,gym:0},days:[1,3,5],first_name:'Saad',last_name:'Shabbir',place:fixture.places[0],gender:'Woman'});
 const s={...data,profile:{...data.profile,theme}};
 const action=(name,payload={})=>{
  if(name==='workout_select'){setLive(c=>({...c,activity_key:payload.activity_key,workout_label:activity(payload.activity_key).label}));return;}
  if(name==='workout_restart'){setLive(c=>({...c,entered_at:new Date().toISOString()}));return;}
  if(name==='workout_stop'){setLive(null);setMessage('Preview workout stopped and saved.');return;}
  if(name==='navigate'){setPage(payload.pane);setMessage('');}
  else if(name==='post')setPage('post');
  else if(name==='settings'){
   const p=payload.payload;
   if(payload.kind==='goals')setData(d=>({...d,pending_goals:p.goals}));
   if(payload.kind==='days')setData(d=>({...d,usual_days:p.schedules.flatMap(v=>v.days.map(weekday=>({weekday,activity_key:v.activity_key,time_of_day:v.time})))}));
   if(payload.kind==='profile'){setData(d=>({...d,profile:{...d.profile,...p}}));if(p.theme)setTheme(p.theme);}
   setMessage(payload.kind==='goals'?'Saved for next Monday.':payload.kind==='days'?'Usual days saved.':'Saved.');
  }else if(name==='social'){
   const p=payload.payload;
   setData(d=>({...d,feed:d.feed.map(item=>{if(item.id!==p.session_id)return item;
    if(payload.action==='comment')return {...item,comments:[...item.comments,{id:crypto.randomUUID(),user_id:d.profile.id,first_name:d.profile.first_name,body:p.body}]};
    if(payload.action==='reaction'){
     const previous=item.reactions.find(r=>r.mine);const reactions=item.reactions.map(r=>({...r,count:r.count-(r.mine?1:0),mine:false})).filter(r=>r.count>0);
     if(previous?.emoji!==p.emoji){const found=reactions.find(r=>r.emoji===p.emoji);if(found){found.count++;found.mine=true;}else reactions.push({emoji:p.emoji,count:1,mine:true});}
     return {...item,reactions};
    }return item;
   })}));
   if(payload.action==='comment')setMessage('Comment posted in the sample feed.');
   if(payload.action==='nudge')setMessage('Sample nudge sent. You’ve got this.');
  }else if(name==='message')setMessage(payload.text);
  else setMessage('This phone-only action is unavailable in the browser sample.');
 };
 const change=patch=>{setDraft(d=>({...d,...patch}));if(patch.theme)setTheme(patch.theme);if(patch.step!==undefined)setPage(patch.step===-1?'how-it-works':pages[patch.step]);};
 const idx=pages.indexOf(page);const pane=page==='session'?'session:'+s.sessions[0].id:page;
 return <><nav><select aria-label="Preview screen" value={page} onChange={e=>{setPage(e.target.value);setMessage('');}}>{[...new Set([...pages,page])].map(p=><option key={p}>{p}</option>)}</select><select aria-label="Color theme" value={theme} onChange={e=>setTheme(e.target.value)}>{['blush','sage','clay'].map(p=><option key={p}>{p}</option>)}</select><span>UI preview · sample data</span></nav><main><Theme name={theme}>{message&&<Card><Txt size={11}>{message}</Txt></Card>}{(idx>=0&&idx<10)||page==='how-it-works'?<Onboarding key={page} draft={{...draft,step:page==='how-it-works'?-1:idx,theme}} change={change} next={()=>setPage(pages[idx+1])} requestLocation={()=>setPage('look')} search={<PlacesPicker preview value={null} onSelect={place=>change({place,places:[...(draft.places??(draft.place?[draft.place]:[])),{...place,id:crypto.randomUUID()}]})} onError={()=>{}}/>} account={<View style={{gap:12}}><Input label="Email" value="" onChange={()=>{}}/><Input label="Password" value="" onChange={()=>{}} secure/><Button title="Create account" onPress={()=>setPage('home')}/><Button secondary title="Already have an account? Sign in" onPress={()=>{}}/></View>}/>:page==='plus'?<Plus close={()=>setPage('profile')} start={()=>setMessage('Coming soon')}/>:page==='post'?<Post snapshot={s} action={action} now={new Date()} onSaved={async()=>{}}/>:page==='recap'||page==='milestone'||page.startsWith('milestone:')?<Screen><Celebration snapshot={s} action={action} now={new Date()} milestone={page==='milestone'?10:page.startsWith('milestone:')?Number(page.slice(10)):undefined}/></Screen>:<Product snapshot={s} pane={pane} action={action} extra={p=>p==='sync-review'?<PreservedVisits snapshot={s} action={action} held={['ENTER','EXIT'].map((kind,i)=>({event_id:String(i),reason:'Previous tracking setup',payload:JSON.stringify({kind,place_id:s.places[0]?.id,observed_at:i?'2026-09-23T05:12:08Z':'2026-09-23T03:18:01Z'})}))}/>:p==='active-workout'?<ActiveWorkout candidate={live} snapshot={s} action={action}/>:p==='friends'?<Friends snapshot={s} action={action} now={new Date()}/>:p==='studios'?<StudioView snapshot={s} selected={selectedStudio} onSelect={setSelectedStudio} action={action} data={{name:s.places.find(p=>p.id===selectedStudio)?.name,visits:22,next_milestone:25,regulars:8,sample_visits:true,demo_board:true,board:['Priya S.','Jess M.','Maya K.','Lena R.','Noah T.','Amara B.','Theo L.','Riley W.'].map((name,i)=>({row_id:'sample:'+i,name,weekly_count:i<3?3:2,is_me:false}))}}/>:<><Logo/><Txt>{p}</Txt></>}/>}</Theme></main></>;
}
createRoot(document.getElementById('root')).render(<Gallery/>);
