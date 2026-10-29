import * as Notifications from 'expo-notifications';
import {read,write} from '../db/local';
import {call} from './api';

const PROJECT_ID='75c75ece-53c4-4a69-8989-43513fe97cae';
// Remote push needs the aps-environment entitlement, which the current build
// does not have. Registration then fails quietly and the inbox keeps working;
// the first build with the entitlement registers on its next launch.
export async function registerPush(){
 if(!(await Notifications.getPermissionsAsync()).granted)return false;
 const last=await read<{at:number;token:string|null}|null>('cs:push_registration',null);
 if(last&&Date.now()-last.at<12*3600000&&last.token===null)return false;
 let token:string|null=null;let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const result=await Promise.race([Notifications.getExpoPushTokenAsync({projectId:PROJECT_ID}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),10000);})]);
  token=result.data;
 }catch{token=null;}finally{if(timer)clearTimeout(timer);}
 if(token)await call('cs_push_token',{push_token:token,enabled:true});
 await write('cs:push_registration',{at:Date.now(),token});
 return !!token;
}
export async function unregisterPush(){
 const last=await read<{token:string|null}|null>('cs:push_registration',null);
 if(last?.token)await call('cs_push_token',{push_token:last.token,enabled:false}).catch(()=>{});
 await write('cs:push_registration',null);
}
