import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import {read,write} from '../db/local';
import {backend} from '../auth/client';
import {call} from './api';

const PROJECT_ID='75c75ece-53c4-4a69-8989-43513fe97cae';
type Registration={at:number;token:string|null;runtime?:string|null};
// Registers this phone for push, with the app's runtime version so update
// notifications reach only phones that can take the update. Without the push
// entitlement registration fails quietly and the inbox keeps working. A
// successful registration is repeated at most every 12 hours unless the token
// or runtime changed (an update can change the runtime).
export async function registerPush(){
 if(!(await Notifications.getPermissionsAsync()).granted)return false;
 const last=await read<Registration|null>('cs:push_registration',null);
 const runtime=Updates.runtimeVersion??null;
 if(last&&Date.now()-last.at<12*3600000&&(last.token===null||(last.runtime??null)===runtime))return !!last.token;
 let token:string|null=null;let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const result=await Promise.race([Notifications.getExpoPushTokenAsync({projectId:PROJECT_ID}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),10000);})]);
  token=result.data;
 }catch{token=null;}finally{if(timer)clearTimeout(timer);}
 if(token){await call('cs_push_token',{push_token:token,enabled:true,runtime_version:runtime});await write('cs:push_release',null);}
 await write('cs:push_registration',{at:Date.now(),token,runtime} satisfies Registration);
 return !!token;
}
// Returns the token if the server could not be told (offline sign-out), so the
// app can release it later; otherwise the old account's alerts would keep
// reaching this phone.
export async function unregisterPush():Promise<string|null>{
 const last=await read<{token:string|null}|null>('cs:push_registration',null);
 let pending:string|null=null;
 if(last?.token)await call('cs_push_token',{push_token:last.token,enabled:false}).catch(()=>{pending=last.token;});
 await write('cs:push_registration',null);
 return pending;
}
// Signed out: knowing the token is enough to delete it, nothing more.
export async function releasePushToken(){
 const token=await read<string|null>('cs:push_release',null);if(!token)return;
 const {error}=await backend().rpc('cs_push_release',{push_token:token});
 if(!error)await write('cs:push_release',null);
}
