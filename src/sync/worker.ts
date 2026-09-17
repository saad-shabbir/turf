import { authenticatedOwner, rpc } from '../auth/client';
import { database, read, transaction, write } from '../db/local';
import { emptyState, safeError, type Closure, type Observation } from '../domain/model';

let running: Promise<void> | undefined;
export function sync() {
  running ??= run().finally(()=>{running=undefined;}); return running;
}
async function run() {
  try {
    const owner=await authenticatedOwner(); const db=await database();
    const rows=await db.getAllAsync<{payload:string}>('SELECT payload FROM outbox WHERE owner=? AND status=\'queued\' ORDER BY seq LIMIT 25',owner);
    const controls=await db.getAllAsync<{payload:string}>('SELECT payload FROM closures WHERE owner=? LIMIT 25',owner);
    if (!rows.length && !controls.length) return;
    const events=rows.map(r=>JSON.parse(r.payload) as Observation);
    const closures=controls.map(r=>JSON.parse(r.payload) as Closure);
    const result=await rpc('ingest_geofence_batch',{events,pending_session_closures:closures});
    await transaction(async tx => {
      if ((await read('state',emptyState,tx)).owner!==owner) return;
      for(const id of [...result.accepted,...result.duplicates]) await tx.runAsync("UPDATE outbox SET status='acknowledged',error=NULL WHERE owner=? AND event_id=?",owner,id);
      for(const rejection of result.rejected) await tx.runAsync("UPDATE outbox SET status='rejected',error=? WHERE owner=? AND event_id=?",rejection.code,owner,rejection.event_id);
      for(const closure of closures) await tx.runAsync('DELETE FROM closures WHERE owner=? AND session_id=?',owner,closure.session_id);
      await write('last_upload',result.server_time,tx); await write('safe_error',null,tx);
    });
  } catch(error) { await write('safe_error',safeError(error)).catch(()=>{}); }
}
