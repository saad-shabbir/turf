import {SampleStudioBoard} from './CommunityPreview';
import {mondayKey} from './engine';
import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Switch,View} from 'react-native';
import Svg,{Path,Line} from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import {captureRef} from 'react-native-view-shot';
import NativeShare from 'react-native-share';
import type {Snapshot} from './model';
import {call} from './api';
import {Avatar,Button,Card,Chip,Empty,Icon,Logo,Row,Txt,useTheme} from './ui';
import type {Action} from './SessionScreens';
export type StudioData={demo_board?:boolean;venue_id:string;name:string;visits:number;next_milestone:number;regulars:number;sample_visits:boolean;board:{row_id:string;name:string;weekly_count:number;is_me:boolean}[]};
function StudioFacade({name,visits,milestone,regulars}:{name:string;visits:number;milestone:number;regulars:number|string}){
 const t=useTheme();return <View accessibilityLabel="Your studio" style={{marginTop:4}}>
  <Svg width="100%" height={54} viewBox="0 0 340 54" preserveAspectRatio="none"><Path d="M24 8 Q26 2 34 2 H306 Q314 2 316 8 L339 51 H1 Z" fill={t.accent}/>{[45,95,145,195,245,295].map((x,i)=><Line key={x} x1={x} y1={8} x2={x+(i-2.5)*7} y2={47} stroke="#ffffff45" strokeWidth={2}/>)}</Svg>
  <View style={{marginHorizontal:8,backgroundColor:t.tint,bottom:1,borderBottomLeftRadius:26,borderBottomRightRadius:26,overflow:'hidden'}}>
   <Row style={{gap:0,height:15}}>{Array.from({length:12},(_,i)=><View key={i} style={{flex:1,height:15,borderBottomLeftRadius:7,borderBottomRightRadius:7,backgroundColor:i%2?t.card:t.accent}}/>)}</Row>
   <View style={{padding:21,gap:18}}><Row style={{gap:7}}><Icon name="pin" size={13} color={t.accent}/><Txt bold size={10} style={{letterSpacing:1.5,color:t.accent}}>YOUR FAMILIAR PLACE</Txt></Row><Txt serif size={28}>{name}</Txt>
    <Row style={{gap:8,alignItems:'stretch'}}>{[['Visits',visits],['Next milestone',milestone],['Regulars',regulars]].map(([label,value])=><View key={label} style={{flex:1,backgroundColor:t.card,borderWidth:1,borderColor:t.line,borderTopLeftRadius:20,borderTopRightRadius:20,borderBottomLeftRadius:8,borderBottomRightRadius:8,paddingVertical:14,alignItems:'center',gap:5}}><Txt serif size={28}>{value}</Txt><Txt muted size={9}>{label}</Txt></View>)}</Row>
    <Row style={{justifyContent:'center',gap:6}}><View style={{height:1,width:27,backgroundColor:t.accent}}/><Txt size={10} bold style={{color:t.accent}}>A PLACE TO SHOW UP</Txt><View style={{height:1,width:27,backgroundColor:t.accent}}/></Row>
   </View>
  </View>
 </View>;
}
export function StudioView({snapshot:s,data,selected,onSelect,action,status='',onRetry}:{snapshot:Snapshot;data:StudioData|null;selected:string;onSelect:(id:string)=>void;action:Action;status?:string;onRetry?:()=>void}){
 const t=useTheme();const places=s.places.filter(p=>p.enabled);const current=places.find(p=>p.id===selected);const own=data?.board.find(p=>p.is_me);const rank=own?data!.board.indexOf(own)+1:null;
 const week=mondayKey(new Date(),s.profile.tz);const ownVisits=s.sessions.filter(x=>!x.removed_at&&x.counted&&x.source!=='seed'&&x.source!=='simulated'&&(x.place_id===selected||(!!current?.venue_id&&x.venue_id===current.venue_id)));const ownCount=ownVisits.filter(x=>x.week_key===week).length;
 if(!places.length)return <View style={{gap:20}}><Empty title="Find your familiar place." body="Save a studio or gym to see your visits and meet its regulars." action="Add a studio or gym" onPress={()=>action('navigate',{pane:'add-place'})}/><Txt serif size={28}>Meet the regulars.</Txt><Txt muted size={12}>EXAMPLE COMMUNITY · Fictional members</Txt><SampleStudioBoard name={s.profile.first_name}/></View>;
 const visits=data?.visits??ownVisits.length;const milestone=data?.next_milestone??[1,5,10,25,50,100].find(n=>n>visits)??(Math.floor(visits/100)+1)*100;
 return <View style={{gap:20}}>{places.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{places.map(p=><Chip key={p.id} title={p.name} selected={p.id===selected} onPress={()=>onSelect(p.id)}/>)}</ScrollView>}
 <StudioFacade name={data?.name??current?.name??'Your studio'} visits={visits} milestone={milestone} regulars={data?.regulars??'—'}/>
 {!!status&&<View style={{gap:5}}><Txt muted size={12}>{status}</Txt>{onRetry&&<Pressable accessibilityRole="button" onPress={onRetry} style={{paddingVertical:10}}><Txt bold size={12} style={{color:t.accent}}>Retry live board</Txt></Pressable>}</View>}
 <Row><Txt serif size={28} style={{flex:1}}>This week’s regulars</Txt><Txt muted size={11}>Mon–Sun</Txt></Row>
 <Card style={{backgroundColor:t.tint,padding:17}}><Row><Avatar name={s.profile.first_name} size={46}/><View style={{flex:1,gap:4}}><Txt bold>{s.profile.first_name} · You</Txt><Txt muted size={12}>{ownCount} {ownCount===1?'session':'sessions'} this week</Txt></View><View style={{alignItems:'flex-end'}}><Txt serif size={30}>{rank?'#'+rank:'—'}</Txt><Txt muted size={10}>{rank?'Your rank':!data?'Rank unavailable':s.profile.show_on_board?'Not ranked yet':'Board hidden'}</Txt></View></Row></Card>
 {data?.board.filter(p=>!p.is_me).map(p=><Card key={p.row_id} style={{padding:15}}><Row><Txt muted size={13} style={{width:20}}>{data.board.indexOf(p)+1}</Txt><Avatar name={p.name} size={42}/><Txt bold size={14} style={{flex:1}}>{p.name}</Txt><Txt bold size={12}>{p.weekly_count} {p.weekly_count===1?'session':'sessions'}</Txt></Row></Card>)}
 <View style={{gap:8}}><Txt bold size={10} style={{letterSpacing:1.2,color:t.accent}}>EXAMPLE REGULARS</Txt><Txt muted size={12}>Fictional members to bring the board to life. They don’t affect your real rank or totals.</Txt></View><SampleStudioBoard name={s.profile.first_name} count={ownCount} showYou={false}/>
 <Card><Row><View style={{flex:1,gap:5}}><Txt bold size={14}>Join your studio board</Txt><Txt muted size={12}>Your first name, last initial and weekly count. Your exact visit times stay private.</Txt></View><Switch accessibilityLabel="Show me on the studio board" value={s.profile.show_on_board} onValueChange={show_on_board=>action('settings',{kind:'profile',payload:{show_on_board}})}/></Row></Card>
 <Button secondary title="Add a studio or gym" icon="plus" onPress={()=>action('navigate',{pane:'add-place'})}/><Button secondary small title="Share this studio" icon="qr" onPress={()=>action('studio_qr',{id:selected})}/>
 </View>;
}
export function Studios({snapshot:s,action}:{snapshot:Snapshot;action:Action}){
 const [picked,setSelected]=useState('');const selected=s.places.find(p=>p.id===picked&&p.enabled)?.id??s.places.find(p=>p.enabled)?.id??'';const [result,setResult]=useState<{key:string;data:StudioData|null;status:string}|null>(null);const [retry,setRetry]=useState(0);const venue=s.places.find(p=>p.id===selected)?.venue_id;const requestKey=[s.profile.id,venue,s.server_time,s.profile.show_on_board,retry].join(':');
 useEffect(()=>{let active=true;if(!venue)return;void call<StudioData>('cs_studio_live',{venue_id:venue}).then(data=>{if(active)setResult({key:requestKey,data,status:''});}).catch(error=>{if(!active)return;const missing=error instanceof Error&&/cs_studio_live.*schema cache|function.*cs_studio_live.*does not exist/i.test(error.message);setResult({key:requestKey,data:null,status:missing?'Studio rankings are waiting for the latest server update. Your saved workouts are safe.':'The live board couldn’t load. Your saved workouts are safe. Try again when you’re connected.'});});return()=>{active=false;};},[venue,requestKey]);
 const current=result?.key===requestKey?result:null;
 return <StudioView snapshot={s} data={current?.data??null} status={current?.status??''} onRetry={()=>setRetry(n=>n+1)} selected={selected} onSelect={setSelected} action={action}/>;
}
export function StudioQR({name,code,action}:{name:string;code:string;action:Action}){
 const ref=useRef<View>(null);const url=(process.env.EXPO_PUBLIC_INVITE_BASE_URL??"https://classstreak.app")+"/s/"+code;
 const share=()=>{void captureRef(ref,{format:"png",width:1500}).then(uri=>NativeShare.open({url:uri,type:"image/png",message:url,failOnCancel:false})).catch(error=>action("error",{error}));};
 return <View style={{gap:18}}><View ref={ref} collapsable={false} style={{padding:30,backgroundColor:"#fff",alignItems:"center",gap:23,borderRadius:22}}><Logo/><Txt serif size={28} style={{textAlign:"center"}}>{name}</Txt><QRCode value={url} size={240}/><Txt bold>Save this studio. Just show up.</Txt><Txt muted size={11}>{url}</Txt></View><Button title="Share printable QR" icon="share" onPress={share}/><Pressable onPress={()=>action("navigate",{pane:"studios"})}><Txt style={{textAlign:"center"}}>Back to your studio</Txt></Pressable></View>;
}
