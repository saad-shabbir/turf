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
import {newDraft} from '../src/classstreak/model';
/* global __CLASSSTREAK_FIXTURE__ */
const fixture=__CLASSSTREAK_FIXTURE__;
const pages=['welcome','activities','sessions','find','usual-days','permission','look','name','identify','account','home','studios','friends','profile','session','post','plus','recap','milestone'];
function Gallery(){
 const [page,setPage]=useState(new URLSearchParams(location.search).get('page')||'welcome');
 const [theme,setTheme]=useState('blush');const [message,setMessage]=useState('');
 const [draft,setDraft]=useState({...newDraft(),selected:['reformer','yoga','gym'],goals:{reformer:2,yoga:1,gym:0},days:[1,3,5],first_name:'Saad',last_name:'Shabbir',place:fixture.places[0],gender:'Woman'});
 const s={...fixture,profile:{...fixture.profile,theme}};
 const action=(name,payload={})=>{if(name==='navigate')setPage(payload.pane);else if(name==='post')setPage('post');else setMessage('Preview only · '+name);};
 const change=patch=>{setDraft(d=>({...d,...patch}));if(patch.theme)setTheme(patch.theme);};
 const idx=pages.indexOf(page);const pane=page==='session'?'session:'+s.sessions[0].id:page;
 return <><nav><select aria-label="Preview screen" value={page} onChange={e=>{setPage(e.target.value);setMessage('');}}>{pages.map(p=><option key={p}>{p}</option>)}</select><select aria-label="Color theme" value={theme} onChange={e=>setTheme(e.target.value)}>{['blush','sage','clay'].map(p=><option key={p}>{p}</option>)}</select><span>UI preview · sample data</span></nav><main><Theme name={theme}>{message&&<Card><Txt size={11}>{message}</Txt></Card>}{idx>=0&&idx<10?<Onboarding draft={{...draft,step:idx,theme}} change={change} next={()=>setPage(pages[idx+1])} requestLocation={()=>setPage('look')} search={<PlacesPicker preview value={null} onSelect={place=>change({place})} onError={()=>{}}/>} account={<View style={{gap:12}}><Input label="Email" value="" onChange={()=>{}}/><Input label="Password" value="" onChange={()=>{}} secure/><Button title="Create account" onPress={()=>setPage('home')}/><Button secondary title="Already have an account? Sign in" onPress={()=>{}}/></View>}/>:page==='plus'?<Plus close={()=>setPage('profile')} start={()=>setMessage('Coming soon')}/>:page==='post'?<Post snapshot={s} action={action} now={new Date()} onSaved={async()=>{}}/>:page==='recap'||page==='milestone'?<Screen><Celebration snapshot={s} action={action} now={new Date()} milestone={page==='milestone'?10:undefined}/></Screen>:<Product snapshot={s} pane={pane} action={action} extra={p=>p==='friends'?<Friends snapshot={s} action={action} now={new Date()}/>:p==='studios'?<StudioView snapshot={s} selected={s.places[0]?.id} onSelect={()=>{}} action={action} data={{name:s.places[0]?.name,visits:22,next_milestone:25,regulars:0,sample_visits:true,board:[]}}/>:<><Logo/><Txt>{p}</Txt></>}/>}</Theme></main></>;
}
createRoot(document.getElementById('root')).render(<Gallery/>);
