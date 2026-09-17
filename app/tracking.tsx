import { useCallback,useState } from 'react';
import { useFocusEffect,Link } from 'expo-router';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { Action,Copy,Page } from '../src/components/ui';
import { permissions,pause,resume,reconcile } from '../src/location/lifecycle';
import { state } from '../src/db/local';
import { rpc,configured } from '../src/auth/client';
import { safeError,type Setup } from '../src/domain/model';
import { sync } from '../src/sync/worker';
export default function Tracking(){
 const [status,setStatus]=useState('Loading actual state…');const [setup,setSetup]=useState<Setup|null>(null);
 const refresh=useCallback(async()=>{try{const [p,s]=await Promise.all([permissions(),state()]);setStatus(`${s.paused?'Paused':'Capture enabled'} · foreground: ${p.foreground} · background: ${p.background}\nLocation services: ${p.enabled?'on':'off'} · native registration: ${p.registered?'present':'absent'}`);if(configured)setSetup(await rpc('get_my_setup_state',{}));}catch(e){setStatus(safeError(e));}},[]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 return <Page title="Tracking"><Copy>{status}</Copy><Copy>Registration is not proof of reliable tracking. iOS controls callback delivery. Force-quit, expired signing and permission changes can interrupt observations.</Copy><Link href="/sign-in">Sign in / recover access</Link><Copy>Pair: {setup?.pair?.status??'not paired'}. Consent: {setup?.settings?.collection_consent_at?'saved':'not granted'}.</Copy>
 <Action title="Pause now" run={async()=>{await pause();await refresh();void sync();}}/>
 <Copy>First, allow foreground location to save a place. Background access is a separate choice for visits while the phone is locked.</Copy>
 <Action title="1. Request foreground location" run={async()=>{await Location.requestForegroundPermissionsAsync();await refresh();}}/>
 <Action title="2. Request background location" run={async()=>{const p=await Location.getForegroundPermissionsAsync();if(!p.granted)throw new Error('PERMISSION_REQUIRED');await Location.requestBackgroundPermissionsAsync();await refresh();}}/>
 <Action title="Open iPhone settings" run={()=>Linking.openSettings()}/><Copy>Denied permission leaves account and privacy controls available. M1 shares no visits or coordinates with your friend.</Copy>
 <Action title="Consent to collecting my saved-place visits" run={async()=>{await rpc('update_my_settings',{patch:{collection_consent:true}});await refresh();}}/>
 <Action title="Start / resume on this iPhone" run={async()=>{await resume();await refresh();}}/>
 <Copy>Starting requires connectivity and replaces monitoring on any previous installation for your account.</Copy>
 <Action title="Refresh and sync one batch" run={async()=>{await reconcile();await refresh();}}/>
 </Page>;
}
