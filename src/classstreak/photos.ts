import {File} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as MediaLibrary from "expo-media-library";
import NativeShare from "react-native-share";
import * as Clipboard from "expo-clipboard";
import {authenticatedOwner,backend} from "../auth/client";
import {read,write,transaction} from "../db/local";
import {call} from "./api";
import {inviteLink} from "./Friends";
import {track} from './analytics';
type Upload={id:string;owner:string;session_id:string;path:string;base64:string;note:string};
export async function queuePhoto(uri:string,sessionId:string,note:string){
 const owner=await authenticatedOwner();const id=Crypto.randomUUID();const file=new File(uri);if(file.size>10485760)throw new Error("Choose a smaller photo.");
 const upload:Upload={id,owner,session_id:sessionId,path:`${owner}/${sessionId}/${id}.jpg`,base64:await file.base64(),note};
 await transaction(async db=>{const rows=await read<Upload[]>("cs:uploads",[],db);if(rows.length>=10)throw new Error("Ten photos are waiting to sync. Connect to the internet before saving another.");await write("cs:uploads",[...rows,upload],db);});
 return syncPhotos();
}
let syncing:Promise<boolean>|undefined;
export function syncPhotos(){syncing??=work().finally(()=>{syncing=undefined;});return syncing;}
async function work(){
 const owner=await authenticatedOwner();const rows=await read<Upload[]>("cs:uploads",[]);
 for(const row of rows.filter(r=>r.owner===owner)){
  try{
   const binary=Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0));
   const {error}=await backend().storage.from("classstreak-photos").upload(row.path,binary.buffer,{contentType:"image/jpeg",upsert:true});if(error)throw error;
   await call("cs_attach_photo",{session_id:row.session_id,path:row.path,note:row.note||null});
   await transaction(async db=>{await write("cs:uploads",(await read<Upload[]>("cs:uploads",[],db)).filter(r=>r.id!==row.id),db);});
  }catch{return false;}
 }
 return true;
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
