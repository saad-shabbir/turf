import React,{useEffect,useRef,useState} from "react";
import {Pressable,Switch,View} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {captureRef} from "react-native-view-shot";
import NativeShare from "react-native-share";
import type {Snapshot} from "./model";
import {call} from "./api";
import {Avatar,Button,Card,Chip,Empty,Logo,Row,Txt,useTheme} from "./ui";
import type {Action} from "./SessionScreens";
export type StudioData={demo_board?:boolean;venue_id:string;name:string;visits:number;next_milestone:number;regulars:number;sample_visits:boolean;board:{row_id:string;name:string;weekly_count:number;is_me:boolean}[]};
export function StudioView({snapshot:s,data,selected,onSelect,action}:{snapshot:Snapshot;data:StudioData|null;selected:string;onSelect:(id:string)=>void;action:Action}){
 const t=useTheme();const places=s.places.filter(p=>p.enabled);
 if(!places.length)return <Empty title="Your studio starts here." body="Save a studio or gym to see your visits and its regulars." action="Add a studio or gym" onPress={()=>action("navigate",{pane:"add-place"})}/>;
 return <View style={{gap:13}}>{places.length>1&&<Row style={{flexWrap:"wrap"}}>{places.map(p=><Chip key={p.id} title={p.name} selected={p.id===selected} onPress={()=>onSelect(p.id)}/>)}</Row>}
 <Card dark style={{gap:10,padding:18}}><Txt size={12} bold style={{color:"#dac5d0"}}>Your studio</Txt><Txt serif size={28} style={{color:"#fff"}}>{data?.name??places.find(p=>p.id===selected)?.name}</Txt><Row style={{justifyContent:"space-between"}}>{[["You’ve been",data?.visits??"—"],["Next milestone",data?.next_milestone??"—"],["Regulars",data?.regulars??"—"]].map(([label,value])=><View key={label} style={{flex:1}}><Txt size={11} style={{color:"#dac5d0"}}>{label}</Txt><Txt serif size={32} style={{color:"#fff"}}>{value}</Txt></View>)}</Row>{data?.sample_visits&&<Txt size={10} style={{color:"#dac5d0"}}>Your visit total includes demo or simulated sessions.</Txt>}</Card>
 <Row><Txt serif size={24} style={{flex:1}}>{data?.demo_board?"Demo regulars this week":"Regulars this week"}</Txt><Txt muted size={12}>Mon–Sun</Txt></Row>
 {data?.demo_board&&<Txt muted size={12}>Sample people and visits for your walkthrough. Visible only in your demo.</Txt>}{data&&!data.board.length&&<Empty title="Be the first familiar face." body="Your next session could start this week’s board."/>}
 {data?.board.map((p,i)=><Card key={p.row_id} style={{padding:12,borderRadius:16,backgroundColor:p.is_me?t.tint:t.card,borderColor:p.is_me?t.ink:t.line}}><Row><Txt muted size={12} style={{width:18}}>{i+1}</Txt><Avatar name={p.name} size={32}/><Txt bold size={14} style={{flex:1}}>{p.name}</Txt><Txt bold size={13}>{p.weekly_count} {p.weekly_count===1?"session":"sessions"}</Txt></Row></Card>)}
 <Card><Row><View style={{flex:1}}><Txt bold size={14}>Show me on the studio board</Txt><Txt muted size={12}>First name and last initial only. Friends still see your sessions.</Txt></View><Switch accessibilityLabel="Show me on the studio board" value={s.profile.show_on_board} onValueChange={show_on_board=>action("settings",{kind:"profile",payload:{show_on_board}})}/></Row></Card>
 <Button secondary title="Add a studio or gym" icon="plus" onPress={()=>action("navigate",{pane:"add-place"})}/><Button secondary small title="Studio QR" icon="qr" onPress={()=>action("studio_qr",{id:selected})}/>
 </View>;
}
export function Studios({snapshot:s,action}:{snapshot:Snapshot;action:Action}){
 const [selected,setSelected]=useState(s.places.find(p=>p.enabled)?.id??"");const [data,setData]=useState<StudioData|null>(null);const venue=s.places.find(p=>p.id===selected)?.venue_id;
 useEffect(()=>{if(!venue)return;let active=true;void call<StudioData>("cs_studio",{venue_id:venue}).then(value=>{if(active)setData(value);}).catch(error=>{if(active)action("error",{error});});return()=>{active=false;};},[venue,s.server_time,s.profile.show_on_board,action]);
 return <StudioView snapshot={s} data={data?.venue_id===venue?data:null} selected={selected} onSelect={setSelected} action={action}/>;
}
export function StudioQR({name,code,action}:{name:string;code:string;action:Action}){
 const ref=useRef<View>(null);const url=(process.env.EXPO_PUBLIC_INVITE_BASE_URL??"https://classstreak.app")+"/s/"+code;
 const share=()=>{void captureRef(ref,{format:"png",width:1500}).then(uri=>NativeShare.open({url:uri,type:"image/png",message:url,failOnCancel:false})).catch(error=>action("error",{error}));};
 return <View style={{gap:18}}><View ref={ref} collapsable={false} style={{padding:30,backgroundColor:"#fff",alignItems:"center",gap:23,borderRadius:22}}><Logo/><Txt serif size={28} style={{textAlign:"center"}}>{name}</Txt><QRCode value={url} size={240}/><Txt bold>Save this studio. Just show up.</Txt><Txt muted size={11}>{url}</Txt></View><Button title="Share printable QR" icon="share" onPress={share}/><Pressable onPress={()=>action("navigate",{pane:"studios"})}><Txt style={{textAlign:"center"}}>Back to your studio</Txt></Pressable></View>;
}
