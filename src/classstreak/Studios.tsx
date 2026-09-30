import {SampleStudioBoard} from './CommunityPreview';
import {mondayKey} from './engine';
import React,{useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,Switch,View} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {captureRef} from "react-native-view-shot";
import NativeShare from "react-native-share";
import type {Snapshot} from "./model";
import {call} from "./api";
import {Avatar,Button,Card,Chip,Empty,Logo,Row,Txt,useTheme} from "./ui";
import type {Action} from "./SessionScreens";
export type StudioData={demo_board?:boolean;venue_id:string;name:string;visits:number;next_milestone:number;regulars:number;sample_visits:boolean;board:{row_id:string;name:string;weekly_count:number;is_me:boolean}[]};
export function StudioView({snapshot:s,data,selected,onSelect,action}:{snapshot:Snapshot;data:StudioData|null;selected:string;onSelect:(id:string)=>void;action:Action}){
 const t=useTheme();const [samples,setSamples]=useState(false);const places=s.places.filter(p=>p.enabled);const current=places.find(p=>p.id===selected);const own=data?.board.find(p=>p.is_me);const rank=own?data!.board.indexOf(own)+1:null;
 const week=mondayKey(new Date(),s.profile.tz);const ownCount=s.sessions.filter(x=>!x.removed_at&&x.counted&&x.source!=='seed'&&x.source!=='simulated'&&x.week_key===week&&(x.place_id===selected||(!!current?.venue_id&&x.venue_id===current.venue_id))).length;
 if(!places.length)return <View style={{gap:20}}><Empty title="Find your familiar place." body="Save a studio or gym to see your visits and meet its regulars." action="Add a studio or gym" onPress={()=>action("navigate",{pane:"add-place"})}/><Button secondary title={samples?'Hide example studio':'Explore an example studio'} onPress={()=>setSamples(!samples)}/>{samples&&<><Txt muted size={12}>Fictional members · sample board</Txt><SampleStudioBoard name={s.profile.first_name}/></>}</View>;
 return <View style={{gap:20}}>{places.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{places.map(p=><Chip key={p.id} title={p.name} selected={p.id===selected} onPress={()=>onSelect(p.id)}/>)}</ScrollView>}
 <Card dark style={{gap:20,padding:23}}><Txt size={11} bold style={{color:'#ffffffaa',letterSpacing:1.5}}>YOUR FAMILIAR PLACE</Txt><Txt serif size={32} style={{color:'#fff'}}>{data?.name??current?.name}</Txt><Row style={{justifyContent:'space-between',borderTopWidth:1,borderColor:'#ffffff26',paddingTop:18}}>{[['Visits',data?.visits??'—'],['Next milestone',data?.next_milestone??'—'],['Regulars',data?.regulars??'—']].map(([label,value])=><View key={label} style={{flex:1,gap:4}}><Txt serif size={30} style={{color:'#fff'}}>{value}</Txt><Txt size={11} style={{color:'#ffffffaa'}}>{label}</Txt></View>)}</Row></Card>
 <Row><Txt serif size={28} style={{flex:1}}>This week’s regulars</Txt><Txt muted size={11}>Mon–Sun</Txt></Row>
 <Card style={{backgroundColor:t.tint,padding:17}}><Row><Avatar name={s.profile.first_name} size={46}/><View style={{flex:1,gap:4}}><Txt bold>{s.profile.first_name} · You</Txt><Txt muted size={12}>{ownCount} {ownCount===1?'session':'sessions'} this week</Txt></View><View style={{alignItems:'flex-end'}}><Txt serif size={30}>{rank?'#'+rank:'—'}</Txt><Txt muted size={10}>{rank?'Your rank':s.profile.show_on_board?'Not ranked yet':'Board hidden'}</Txt></View></Row></Card>
 {data?.board.length?data.board.filter(p=>!p.is_me).map(p=><Card key={p.row_id} style={{padding:15}}><Row><Txt muted size={13} style={{width:20}}>{data.board.indexOf(p)+1}</Txt><Avatar name={p.name} size={42}/><Txt bold size={14} style={{flex:1}}>{p.name}</Txt><Txt bold size={12}>{p.weekly_count} {p.weekly_count===1?'session':'sessions'}</Txt></Row></Card>):<Txt muted size={13}>A fresh board. Your next visit is a good place to start.</Txt>}
 <Card><Row><View style={{flex:1,gap:5}}><Txt bold size={14}>Join your studio board</Txt><Txt muted size={12}>Your first name, last initial and weekly count. Your exact visit times stay private.</Txt></View><Switch accessibilityLabel="Show me on the studio board" value={s.profile.show_on_board} onValueChange={show_on_board=>action('settings',{kind:'profile',payload:{show_on_board}})}/></Row></Card>
 <Button secondary title={samples?'Hide example community':'See how a busier studio could look'} onPress={()=>setSamples(!samples)}/>{samples&&<><Txt muted size={12}>SAMPLE COMMUNITY · Fictional people and photos. Tap anyone to explore a profile.</Txt><SampleStudioBoard name={s.profile.first_name} count={ownCount}/></>}
 <Button secondary title="Add a studio or gym" icon="plus" onPress={()=>action('navigate',{pane:'add-place'})}/><Button secondary small title="Share this studio" icon="qr" onPress={()=>action('studio_qr',{id:selected})}/>
 </View>;
}
export function Studios({snapshot:s,action}:{snapshot:Snapshot;action:Action}){
 const [selected,setSelected]=useState(s.places.find(p=>p.enabled)?.id??"");const [data,setData]=useState<StudioData|null>(null);const venue=s.places.find(p=>p.id===selected)?.venue_id;
 useEffect(()=>{if(!venue)return;let active=true;void call<StudioData>("cs_studio_live",{venue_id:venue}).then(value=>{if(active)setData(value);}).catch(error=>{if(active)action("error",{error});});return()=>{active=false;};},[venue,s.server_time,s.profile.show_on_board,action]);
 return <StudioView snapshot={s} data={data?.venue_id===venue?data:null} selected={selected} onSelect={setSelected} action={action}/>;
}
export function StudioQR({name,code,action}:{name:string;code:string;action:Action}){
 const ref=useRef<View>(null);const url=(process.env.EXPO_PUBLIC_INVITE_BASE_URL??"https://classstreak.app")+"/s/"+code;
 const share=()=>{void captureRef(ref,{format:"png",width:1500}).then(uri=>NativeShare.open({url:uri,type:"image/png",message:url,failOnCancel:false})).catch(error=>action("error",{error}));};
 return <View style={{gap:18}}><View ref={ref} collapsable={false} style={{padding:30,backgroundColor:"#fff",alignItems:"center",gap:23,borderRadius:22}}><Logo/><Txt serif size={28} style={{textAlign:"center"}}>{name}</Txt><QRCode value={url} size={240}/><Txt bold>Save this studio. Just show up.</Txt><Txt muted size={11}>{url}</Txt></View><Button title="Share printable QR" icon="share" onPress={share}/><Pressable onPress={()=>action("navigate",{pane:"studios"})}><Txt style={{textAlign:"center"}}>Back to your studio</Txt></Pressable></View>;
}
