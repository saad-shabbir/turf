import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Theme,Button,Card,Txt,Logo,Input,Screen} from '../src/classstreak/ui';
import {Product} from '../src/classstreak/Product';
import {Onboarding} from '../src/classstreak/Onboarding';
import {Friends} from '../src/classstreak/Friends';
import {StudioView} from '../src/classstreak/Studios';
import {Plus} from '../src/classstreak/Plus';
import {PlacesPicker} from '../src/classstreak/PlacesPicker';
import {Post,Celebration} from '../src/classstreak/Post';
import {ActiveWorkout} from '../src/classstreak/ActiveWorkout';
import {PreservedVisits} from '../src/classstreak/PreservedVisits';
import {CommunityPreview,SampleStudioBoard} from '../src/classstreak/CommunityPreview';
import {newDraft,activity} from '../src/classstreak/model';

/* global __CLASSSTREAK_FIXTURE__ */
const fixture=__CLASSSTREAK_FIXTURE__;
const onboarding=['welcome','activities','sessions','find','usual-days','permission','look','name','identify','account'];
const pages=[...onboarding,'how-it-works','home-empty','home-sample','studios','studio-sample','friends','history','profile','session','post','community','plus','recap','milestone','active-workout','sync-review'];
function Gallery(){
 const params=new URLSearchParams(location.search);
 const [page,setPage]=useState(params.get('page')||'home-empty');
 const [theme,setTheme]=useState(params.get('theme')||'clay');
 const [dataMode,setDataMode]=useState(params.get('page')==='home-empty'?'empty':'example');
 const [data,setData]=useState(fixture);
 const [selectedStudio,setSelectedStudio]=useState(fixture.places[0]?.id);
 const [message,setMessage]=useState('');
 const [live,setLive]=useState(()=>({visit_id:'preview-arrival',place_id:fixture.places[0]?.id,activity_key:'gym',workout_label:'Weights',entered_at:new Date(Date.now()-12*60000).toISOString()}));
 const [draft,setDraft]=useState({...newDraft(),selected:['reformer','yoga','gym'],goals:{reformer:2,yoga:1,gym:2},days:[1,3,5],first_name:'Saad',last_name:'Shabbir',place:fixture.places[0],gender:null});
 const empty=dataMode==='empty';
 const s={...data,...(empty?{sessions:[],friends:[],feed:[],inbox:[],weeks:[],achievements:[]}:{}),profile:{...data.profile,id:empty?'preview-empty-owner':data.profile.id,theme,show_on_board:false}};
 const go=target=>{if(target==='home-empty')setDataMode('empty');if(target==='home-sample')setDataMode('example');setPage(target);setMessage('');const query=new URLSearchParams(location.search);query.set('page',target);history.replaceState({},'',`${location.pathname}?${query}`);};
 const action=(name,payload={})=>{
  if(name==='workout_select'){setLive(c=>({...c,activity_key:payload.activity_key,workout_label:activity(payload.activity_key).label}));return;}
  if(name==='workout_restart'){setLive(c=>({...c,entered_at:new Date().toISOString()}));return;}
  if(name==='workout_stop'){setLive(null);setMessage('Preview workout stopped. No workout was saved to your account.');return;}
  if(name==='navigate'){go(payload.pane);return;}
  if(name==='post'){go('post');return;}
  if(name==='settings'){
   const p=payload.payload;
   if(payload.kind==='goals')setData(d=>({...d,pending_goals:p.goals}));
   if(payload.kind==='days')setData(d=>({...d,usual_days:p.schedules.flatMap(v=>v.days.map(weekday=>({weekday,activity_key:v.activity_key,time_of_day:v.time})))}));
   if(payload.kind==='profile'){setData(d=>({...d,profile:{...d.profile,...p}}));if(p.theme)setTheme(p.theme);}
   setMessage('Updated in this preview only.');return;
  }
  if(name==='social'){
   const p=payload.payload;
   setData(d=>({...d,feed:d.feed.map(item=>{if(item.id!==p.session_id)return item;
    if(payload.action==='comment')return {...item,comments:[...item.comments,{id:crypto.randomUUID(),user_id:d.profile.id,first_name:d.profile.first_name,body:p.body}]};
    if(payload.action==='reaction'){
     const previous=item.reactions.find(r=>r.mine),reactions=item.reactions.map(r=>({...r,count:r.count-(r.mine?1:0),mine:false})).filter(r=>r.count>0);
     if(previous?.emoji!==p.emoji){const found=reactions.find(r=>r.emoji===p.emoji);if(found){found.count++;found.mine=true;}else reactions.push({emoji:p.emoji,count:1,mine:true});}
     return {...item,reactions};
    }return item;
   })}));setMessage('Preview interaction. No request or notification was sent.');return;
  }
  if(name==='message'){setMessage(payload.text);return;}
  if(name==='error'){setMessage(payload.error?.message??'This device action is unavailable in the browser preview.');return;}
  setMessage('This device action is unavailable in the browser preview.');
 };
 const change=patch=>{setDraft(d=>({...d,...patch}));if(patch.theme)setTheme(patch.theme);if(patch.step!==undefined)go(patch.step===-1?'how-it-works':onboarding[patch.step]);};
 const idx=onboarding.indexOf(page);
 const pane=page==='session'?(s.sessions.length?'session:'+s.sessions[0].id:'history'):page==='home-empty'||page==='home-sample'?'home':page==='studio-sample'?'studios':page;
 const extra=p=>p==='sync-review'?<PreservedVisits snapshot={s} action={action} held={['ENTER','EXIT'].map((kind,i)=>({event_id:String(i),reason:'Previous tracking setup',payload:JSON.stringify({kind,place_id:s.places[0]?.id,observed_at:i?'2026-09-23T05:12:08Z':'2026-09-23T03:18:01Z'})}))}/>:
  p==='active-workout'?<ActiveWorkout candidate={live} snapshot={s} action={action}/>:
  p==='friends'?<Friends snapshot={s} action={action} now={new Date()}/>:
  p==='studios'?<><StudioView snapshot={s} selected={selectedStudio} onSelect={setSelectedStudio} action={action} data={{venue_id:s.places[0]?.venue_id,name:s.places.find(p=>p.id===selectedStudio)?.name,visits:empty?0:22,next_milestone:empty?1:25,regulars:0,sample_visits:!empty,demo_board:false,board:[]}}/>{page==='studio-sample'&&<><Txt muted size={11}>EXAMPLE BOARD · Fictional profiles</Txt><SampleStudioBoard name="Saad" count={2}/></>}</>:
  <><Logo/><Txt>{p}</Txt><Button secondary title="Back home" onPress={()=>go('home')}/></>;
 return <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}>
  <nav><select aria-label="Preview screen" value={page} onChange={e=>go(e.target.value)}>{[...new Set([...pages,page])].map(p=><option key={p}>{p}</option>)}</select><select aria-label="Color theme" value={theme} onChange={e=>setTheme(e.target.value)}>{['clay','sage','blush'].map(p=><option key={p}>{p}</option>)}</select><select aria-label="Preview data" value={dataMode} onChange={e=>setDataMode(e.target.value)}><option value="empty">Empty account</option><option value="example">Example account</option></select><span>PREVIEW</span></nav>
  <main><Theme name={theme}>{message&&<Card style={{padding:10,borderRadius:0}}><Txt size={11}>{message}</Txt></Card>}
   {idx>=0||page==='how-it-works'?<Onboarding key={page} draft={{...draft,step:page==='how-it-works'?-1:idx,theme}} change={change} next={()=>go(onboarding[idx+1]??'home-empty')} requestLocation={()=>go('look')} search={<PlacesPicker preview value={null} onSelect={place=>change({place,places:[...(draft.places??(draft.place?[draft.place]:[])),{...place,id:crypto.randomUUID()}]})} onError={error=>setMessage(error?.message??'Preview search unavailable')}/>} account={<View style={{gap:12}}><Input label="Email" value="" onChange={()=>{}}/><Input label="Password" value="" onChange={()=>{}} secure/><Button title="Create account · preview" onPress={()=>go('home-empty')}/><Button secondary title="Already have an account? Sign in" onPress={()=>setMessage('Account sign-in is only available in the installed app.')}/></View>}/>:
    page==='plus'?<Plus close={()=>go('profile')} start={()=>setMessage('Coming soon')}/>:
    page==='post'?<Post snapshot={s} action={action} now={new Date()} onSaved={async()=>{}}/>:
    page==='community'?<Screen><Txt muted size={11}>DESIGN REVIEW · SAMPLE CONTENT</Txt><CommunityPreview/></Screen>:
    page==='recap'||page==='milestone'||page.startsWith('milestone:')?<Screen><Celebration snapshot={s} action={action} now={new Date()} milestone={page==='milestone'?10:page.startsWith('milestone:')?Number(page.slice(10)):undefined}/></Screen>:
    <Product snapshot={s} pane={pane} action={action} now={new Date()} activeWorkout={page==='active-workout'?live:null} extra={extra}/>
   }
  </Theme></main>
 </SafeAreaProvider>;
}
createRoot(document.getElementById('root')).render(<Gallery/>);
