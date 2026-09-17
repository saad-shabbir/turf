import { useCallback,useState } from 'react';
import { Button,View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Action,Copy,Field,Page } from '../src/components/ui';
import { backend,rpc } from '../src/auth/client';
import { pause } from '../src/location/lifecycle';
import { placeInput,type Place,type PlaceInput,safeError } from '../src/domain/model';
export default function Places(){
 const [places,setPlaces]=useState<Place[]>([]);const [label,setLabel]=useState('');const [category,setCategory]=useState<PlaceInput['category']>('gym');const [lat,setLat]=useState('');const [lon,setLon]=useState('');const [radius,setRadius]=useState('150');const [key,setKey]=useState<string>();const [note,setNote]=useState('');
 const refresh=useCallback(async()=>{const {data,error}=await backend().from('places').select('*').eq('active',true);if(error)throw new Error('REQUEST_FAILED');setPlaces(data as Place[]);},[]);
 useFocusEffect(useCallback(()=>{void refresh().catch(e=>setNote(safeError(e)));},[refresh]));
 return <Page title="My places"><Copy>Private to you. Optional home; no automatic classification. Saving or disabling a place pauses capture; explicitly resume after reviewing the change.</Copy><Copy>{note}</Copy>{places.map(p=><View key={p.id}><Copy>{p.label} · {p.category} · {p.radius_m} m · revision {p.revision}</Copy><Button title={`Edit ${p.label}`} onPress={()=>{setKey(p.place_key);setLabel(p.label);setCategory(p.category);setLat(String(p.latitude));setLon(String(p.longitude));setRadius(String(p.radius_m));}}/><Action title={`Disable ${p.label}`} run={async()=>{await pause('place_change');await rpc('disable_my_place',{place_id:p.id});await refresh();}}/></View>)}
 <Field label="Place name" value={label} onChange={setLabel}/><Copy>Category: {category}</Copy>{(['gym','work','mosque','home','custom'] as const).map(c=><Button key={c} title={c} onPress={()=>setCategory(c)}/>)}
 <Action title="Use my current location" run={async()=>{const p=await Location.getForegroundPermissionsAsync();if(!p.granted)throw new Error('PERMISSION_REQUIRED');const fix=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});setLat(String(fix.coords.latitude));setLon(String(fix.coords.longitude));setNote(`Reported accuracy: ${fix.coords.accuracy??'unknown'} metres. Check and correct coordinates before saving.`);}}/>
 <Field label="Latitude" value={lat} onChange={setLat}/><Field label="Longitude" value={lon} onChange={setLon}/><Field label="Radius in metres (75–400)" value={radius} onChange={setRadius}/>
 <Action title={key?'Save new revision':'Add place'} run={async()=>{if(!lat.trim()||!lon.trim())throw new Error('INVALID_INPUT');const parsed=placeInput.safeParse({label,category,latitude:Number(lat),longitude:Number(lon),radius_m:Number(radius),...(key?{place_key:key}:{})});if(!parsed.success)throw new Error('INVALID_INPUT');await pause('place_change');await rpc('save_my_place',{input:parsed.data});setKey(undefined);setLabel('');setLat('');setLon('');await refresh();}}/>
 <Button title="Clear form / add another" onPress={()=>{setKey(undefined);setLabel('');setLat('');setLon('');}}/>
 </Page>;
}
