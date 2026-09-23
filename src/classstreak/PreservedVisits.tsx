import React from 'react';
import {View} from 'react-native';
import {Button,Card,Txt} from './ui';
import type {Snapshot} from './model';
import type {Action} from './SessionScreens';
export type HeldVisitEvent={event_id:string;reason:string;payload:string};
export function PreservedVisits({held,snapshot,action}:{held:HeldVisitEvent[];snapshot:Snapshot;action:Action}){
 if(!held.length)return null;
 return <Card><Txt bold>Older tracking events are preserved</Txt><Txt muted size={12}>These events could not be verified against the current tracking setup. They remain on this iPhone and no longer block new visits. Review the times below; if a workout is missing from your history, add it manually.</Txt><Button secondary title="Review session history" onPress={()=>action("navigate",{pane:"history"})}/><Button secondary title="Add a missed workout" onPress={()=>action("navigate",{pane:"manual"})}/>{held.slice(-30).map(row=>{const e=JSON.parse(row.payload);return <View key={row.event_id}><Txt size={12}>{snapshot.places.find(p=>p.id===e.place_id)?.name??'Saved place'}  -  {e.kind}  -  {new Date(e.observed_at).toLocaleString()}</Txt><Txt size={11} muted>{row.reason}</Txt></View>;})}</Card>;
}
