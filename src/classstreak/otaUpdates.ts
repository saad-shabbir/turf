import * as Updates from 'expo-updates';
import {shouldCheckForUpdate} from './updateRules';

// Checks at most every 15 minutes, downloads in the background and reports
// when a new version is ready. It never reloads the app by itself.
let lastCheck:number|null=null;let busy=false;let ready=false;
export async function checkForAppUpdate():Promise<boolean>{
 if(ready)return true;
 const now=Date.now();
 if(!shouldCheckForUpdate({now,lastCheck,enabled:Updates.isEnabled,dev:__DEV__,busy}))return false;
 busy=true;lastCheck=now;
 try{
  const result=await Updates.checkForUpdateAsync();
  if(!result.isAvailable)return false;
  const fetched=await Updates.fetchUpdateAsync();
  ready=fetched.isNew;return ready;
 }catch{return false;}finally{busy=false;}
}
export const restartForUpdate=()=>Updates.reloadAsync();
