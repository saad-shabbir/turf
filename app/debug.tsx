import { useCallback,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Action,Copy,Page } from '../src/components/ui';
import { backend } from '../src/auth/client';
import { database,read,state } from '../src/db/local';
import { permissions,registeredRegions } from '../src/location/lifecycle';
import { safeError } from '../src/domain/model';
import { sync } from '../src/sync/worker';
export default function Debug(){
 const [report,setReport]=useState('Loading…');
 const refresh=useCallback(async()=>{
  const s=await state();const db=await database();const local=await db.getAllAsync('SELECT event_id,status,error,created_at FROM outbox WHERE owner=? ORDER BY seq DESC LIMIT 100',s.owner??'');
  const health=await db.getFirstAsync<{count:number;oldest:string|null}>("SELECT count(*) count,min(created_at) oldest FROM outbox WHERE owner=? AND status='queued'",s.owner??'');
  const results:Record<string,unknown>={permissions:await permissions(),local_state:s,native_regions:await registeredRegions(),queue:health,retention_warning:health?.oldest&&Date.now()-Date.parse(health.oldest)>27*86400000?'Unsent evidence approaching 30-day deletion':'none',last_callback:await read('last_callback',null),last_upload:await read('last_upload',null),safe_error:await read('safe_error',null),local_events:local};
  try {for(const table of ['geofence_events','visits']){const {data,error}=await backend().from(table).select('*').order(table==='visits'?'created_at':'received_at',{ascending:false}).limit(100);results[table]=error?'REQUEST_FAILED':data;}}catch(e){results.backend=safeError(e);}
  setReport(JSON.stringify(results,null,2));
 },[]);
 useFocusEffect(useCallback(()=>{void refresh().catch(e=>setReport(safeError(e)));},[refresh]));
 return <Page title="My diagnostics"><Copy>Owner-only real observations. observed_at is callback time; received_at is server time. Incomplete and review visits do not establish a duration. Do not share unredacted screenshots.</Copy><Action title="Sync one batch and refresh" run={async()=>{await sync();await refresh();}}/><Copy>{report}</Copy></Page>;
}
