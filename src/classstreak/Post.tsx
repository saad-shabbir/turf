import {Confetti} from "./motion";
import React,{useRef,useState,useEffect} from "react";
import {View} from "react-native";
import {captureRef} from "react-native-view-shot";
import {type Snapshot} from "./model";
import {progress} from "./engine";
import {Button,Card,Icon,Logo,Txt,useTheme} from "./ui";
import {type Action} from "./SessionScreens";
import {sharePhoto} from "./photos";
// The camera and posting flow lives in PhotoFlow.tsx.
const openedMilestones=new Set<string>();
export function Celebration({snapshot:s,action,now,milestone,celebrate=true}:{snapshot:Snapshot;action:Action;now:Date;milestone?:number;celebrate?:boolean}){
 const t=useTheme();const image=useRef<View>(null);const stats=progress(s.sessions,s.weeks,s.goals,s.profile.tz,now);
 const celebrationKey=s.profile.id+":"+milestone;const [firstOpen]=useState(()=>!openedMilestones.has(celebrationKey));useEffect(()=>{if(milestone)openedMilestones.add(celebrationKey);},[milestone,celebrationKey]);
 const earned=milestone?s.sessions.filter(x=>x.counted&&!x.removed_at).sort((a,b)=>a.started_at.localeCompare(b.started_at))[milestone-1]:undefined;
 const headline=milestone===1?"Congrats on your first class!":milestone===10?"Ten classes. Look at you go!":milestone===25?"25 classes. A habit worth celebrating.":milestone===50?"Fifty times you showed up.":milestone===100?"100 classes. All yours.":`${milestone} classes. Keep going!`;
 const share=()=>{void captureRef(image,{format:"jpg",quality:.95,width:1080}).then(uri=>sharePhoto(uri,s.profile.invite_code)).catch(error=>action("error",{error}));};
 return <View style={{gap:20}}><View ref={image} collapsable={false} style={{padding:22,paddingVertical:34,gap:20,alignItems:"center",backgroundColor:t.paper,borderRadius:22}}><Logo/><Icon name={milestone?"trophy":"flame"} size={82} color={t.accent}/><Txt serif size={36} style={{textAlign:"center"}}>{milestone?headline:`${stats.count} of ${stats.goal}.`}</Txt><Txt size={16} style={{textAlign:"center"}}>{milestone===1?"One good start. More good days ahead.":milestone?"Every one started with showing up.":"That was your week."}</Txt><Card dark><Txt bold size={22} style={{color:"#fff",textAlign:"center"}}>{milestone?`${milestone} ${milestone===1?"class":"classes"} counted`:`${stats.streak} weeks in a row`}</Txt></Card><Txt muted style={{textAlign:"center"}}>{earned?new Date(earned.started_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:s.profile.tz}):"Your week, one session at a time."}{earned?.source==="seed"?" · Demo milestone":""}</Txt></View>{milestone&&celebrate&&firstOpen&&<Confetti accent={t.accent} tint={t.tint}/>}<Button title="Share your card" icon="share" onPress={share}/><Button secondary title="Back" onPress={()=>action("navigate",{pane:"profile"})}/></View>;
}
