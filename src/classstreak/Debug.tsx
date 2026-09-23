import {PreservedVisits} from './PreservedVisits';
import React, {useEffect,useState} from "react";
import {View,Switch} from "react-native";
import * as Location from "expo-location";
import {read,write,database} from "../db/local";
import {simulate,startTracking,syncVisits,trackingState,type TrackingLog} from "./tracking";
import {safeMessage,type Snapshot} from "./model";
import {Button,Card,Chip,Row,Txt} from "./ui";
import type {Action} from "./SessionScreens";
export function Debug({snapshot,action,refresh}:{snapshot:Snapshot;action:Action;refresh:()=>Promise<void>}){
 const [held,setHeld]=useState<{event_id:string;reason:string;payload:string}[]>([]);
 const [place,setPlace]=useState(snapshot.places.find(p=>p.enabled)?.id??"");const [logs,setLogs]=useState<TrackingLog[]>([]);const [diagnostic,setDiagnostic]=useState("");const [busy,setBusy]=useState(false);
 const update=async()=>{
  setLogs(await read("cs:logs",[]));const p=await Location.getBackgroundPermissionsAsync();const s=await trackingState();const db=await database();
  const fix=await read("cs:last_fix","Not observed");
  const queue=await db.getFirstAsync<{n:number}>("SELECT count(*) n FROM cs_outbox WHERE owner=?",s.owner).catch(()=>({n:0}));
  const heldRows=await db.getAllAsync<{event_id:string;reason:string;payload:string}>("SELECT o.event_id,h.reason,o.payload FROM cs_outbox o JOIN cs_outbox_holds h ON h.event_id=o.event_id AND h.owner=o.owner WHERE o.owner=? ORDER BY o.seq",s.owner).catch(()=>[]);
  setHeld(heldRows);const error=await read("cs:sync_error","");
  setDiagnostic(`Location: ${p.status}  -  ${s.paused?"paused":"monitoring"}\nLast GPS fix: ${fix}\nRegistered places: ${s.places.length}  -  Waiting to sync: ${Math.max(0,(queue?.n??0)-heldRows.length)}\nPreserved for review: ${heldRows.length}${error?'\nLast sync: '+safeMessage(error):''}`);
 };
 useEffect(()=>{const timer=setTimeout(()=>{void update();},0);return()=>clearTimeout(timer);},[]);
 const run=(fn:()=>Promise<void>)=>{setBusy(true);void fn().then(refresh).then(update).catch(e=>action("error",{error:e})).finally(()=>setBusy(false));};
 const chosen=snapshot.places.find(p=>p.id===place);
 return <View style={{gap:12}}><Txt serif size={32}>Debug</Txt><Card><Txt bold>Simulation tools</Txt><Txt muted size={12}>These sessions are labeled simulated. They do not prove a real visit or two-phone tracking.</Txt></Card>
  <Row style={{flexWrap:"wrap"}}>{snapshot.places.filter(p=>p.enabled).map(p=><Chip key={p.id} title={p.name} selected={place===p.id} onPress={()=>setPlace(p.id)}/>)}</Row>
  {([["Walk into place","ENTER"],["Walk out now","EXIT"],["Walk out 40 minutes later","LATER"],["Drive past","DRIVE"]] as const).map(([title,kind])=><Button key={kind} secondary title={title} disabled={busy||!chosen} onPress={()=>chosen&&run(async()=>simulate(kind,chosen,await read("cs:clock_offset",0)))}/>)}
  <Button secondary title="It is next week" onPress={()=>run(async()=>{await write("cs:clock_offset",(await read("cs:clock_offset",0))+604800000);})}/>
  <Button secondary title="Reset clock" onPress={()=>run(async()=>{await write("cs:clock_offset",0);})}/>
  <Button secondary title="Run nightly rollup now" onPress={()=>action("rollup")}/><Button secondary title="Load demo friends" onPress={()=>action("seed_demo")}/><Button secondary title="Remove demo friends" onPress={()=>action("remove_demo")}/>
  <Card><Row><Txt style={{flex:1}}>Show simulated sessions to friends</Txt><Switch accessibilityLabel="Show simulated sessions to friends" value={snapshot.profile.share_simulated} onValueChange={share_simulated=>action("settings",{kind:"profile",payload:{share_simulated}})}/></Row><Txt size={11} muted>Friends see a simulated label. Studio boards always exclude them.</Txt></Card>
  <Button secondary title="Re-register geofences" onPress={()=>run(startTracking)}/><Button secondary title="Reset onboarding" onPress={()=>action("reset_onboarding")}/><Button secondary title="Send me a test reminder" onPress={()=>action("test_reminder")}/>
  <Button secondary title="Retry saved visits" disabled={busy} onPress={()=>run(syncVisits)}/>
  <Card><Txt size={12}>{diagnostic}</Txt></Card>
  <PreservedVisits held={held} snapshot={snapshot} action={action}/>
  {logs.slice(-12).reverse().map((l,i)=><Card key={i}><Txt size={11}>{l.source} · {l.kind} · {new Date(l.at).toLocaleTimeString()}</Txt><Txt size={12}>{l.reason}</Txt></Card>)}
 </View>;
}
