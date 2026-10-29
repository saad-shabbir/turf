import {File} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as MediaLibrary from "expo-media-library";
import NativeShare from "react-native-share";
import * as Clipboard from "expo-clipboard";
import {authenticatedOwner,backend,localOwner} from "../auth/client";
import {read,write,transaction} from "../db/local";
import {call} from "./api";
import {inviteLink} from "./Friends";
import {track} from './analytics';
type Upload={id:string;owner:string;session_id:string;path:string;base64:string;note:string;workout_kind?:'pre'|'mid'|'post';share?:boolean};
// A workout photo belongs to a workout in progress or its saved session (same
// id for timer workouts). share controls whether friends see it in the feed.
export async function queuePhoto(uri:string,sessionId:string,note:string,workout?:{kind:'pre'|'mid'|'post';share:boolean}){
 const owner=await localOwner();const id=Crypto.randomUUID();const file=new File(uri);if(file.size>10485760)throw new Error("Choose a smaller photo.");
 const upload:Upload={id,owner,session_id:sessionId,path:`${owner}/${sessionId}/${id}.jpg`,base64:await file.base64(),note,...(workout?{workout_kind:workout.kind,share:workout.share}:{})};
 await transaction(async db=>{const rows=await read<Upload[]>("cs:uploads",[],db);if(rows.length>=10)throw new Error("Ten photos are waiting to sync. Connect to the internet before saving another.");await write("cs:uploads",[...rows,upload],db);});
 // Offline the photo stays queued on this phone and uploads later.
 return syncPhotos().catch(error=>{if(error instanceof Error&&error.message==="NETWORK")return false;throw error;});
}
let syncing:Promise<boolean>|undefined;
export function syncPhotos(){syncing??=work().finally(()=>{syncing=undefined;});return syncing;}
async function work(){
 const owner=await authenticatedOwner();const rows=await read<Upload[]>("cs:uploads",[]);let complete=true;
 const done=(id:string)=>transaction(async db=>{await write("cs:uploads",(await read<Upload[]>("cs:uploads",[],db)).filter(r=>r.id!==id),db);});
 for(const row of rows.filter(r=>r.owner===owner)){
  try{
   const binary=Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0));
   const {error}=await backend().storage.from("classstreak-photos").upload(row.path,binary.buffer,{contentType:"image/jpeg",upsert:true});if(error)throw error;
   if(row.workout_kind){
    await call("cs_workout",{action:"photo",payload:{id:row.session_id,path:row.path,kind:row.workout_kind,share:row.share!==false,caption:row.note||null}});
   }else await call("cs_attach_photo",{session_id:row.session_id,path:row.path,note:row.note||null});
   await done(row.id);
  }catch(error){
   // A workout that ended somewhere this photo cannot follow (a location visit
   // saved under a new id) will never accept it. Keep everything else queued.
   if(error instanceof Error&&error.message==="FORBIDDEN"&&row.workout_kind)await done(row.id);else complete=false;
  }
 }
 return complete;
}
export async function saveToPhotos(uri:string){
 const permission=await MediaLibrary.requestPermissionsAsync(true);if(!permission.granted)throw new Error("Allow saving photos in iPhone Settings.");
  await MediaLibrary.Asset.create(uri);
  track('sticker_shared',{destination:'photos'});
}
export async function sharePhoto(uri:string,code:string){
 const link=inviteLink(code);await Clipboard.setStringAsync(link);
  await NativeShare.open({url:uri,type:"image/jpeg",message:`Join me on ClassStreak: ${link}\nFriend code: ${code}`,failOnCancel:false});
  track('sticker_shared',{destination:'share_sheet'});
}
export async function discardQueuedPhotos(sessionId:string){await transaction(async db=>{await write('cs:uploads',(await read<Upload[]>('cs:uploads',[],db)).filter(row=>row.session_id!==sessionId),db);});}
// Authenticated downloads enforce current friendship on every request; no public/signed URL.
export async function readPhoto(path:string){
 await authenticatedOwner();const {data,error}=await backend().storage.from("classstreak-photos").download(path);if(error)throw new Error("That photo is no longer available.");
 return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onloadend=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Photo unavailable"));reader.onerror=reject;reader.readAsDataURL(data);});
}
