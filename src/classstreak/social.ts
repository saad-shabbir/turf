import * as Contacts from "expo-contacts";
import * as Clipboard from "expo-clipboard";
import {AppState,Share} from "react-native";
import {backend} from "../auth/client";
import {call} from "./api";
import {inviteLink} from "./Friends";
export async function matchContacts(){
 if(!(await Contacts.requestPermissionsAsync()).granted)throw new Error("Contacts access is off. You can still share a link or use a code.");
 const contacts=await Contacts.Contact.getAllDetails([Contacts.ContactField.PHONES],{limit:500});
 const phones=[...new Set(contacts.flatMap(c=>(c.phones??[]).map(p=>(p.number??"").replace(/[^+\d]/g,"")).map(n=>/^\d{10}$/.test(n)?"+1"+n:n).filter(n=>/^\+[1-9]\d{7,14}$/.test(n))))].slice(0,500);
 return call<{id:string;first_name:string}[]>("cs_contacts",{action:"match",phones});
}
export const copyInvite=(code:string)=>Clipboard.setStringAsync("ClassStreak: "+code);
export const shareInvite=(code:string)=>Share.share({message:`Join me on ClassStreak. ${inviteLink(code)}\nFriend code: ${code}`});
export async function clipboardSetup(){
 const text=await Clipboard.getStringAsync();return {invite_code:text.match(/(?:ClassStreak:\s*|\/j\/)([A-Z0-9]{12})(?:\b|$)/i)?.[1]?.toUpperCase(),studio_code:text.match(/(?:ClassStreak studio:\s*|\/s\/)([0-9a-f-]{36})(?:\b|$)/i)?.[1]};
}
export function subscribeSocial(authId:string,refresh:()=>Promise<void>){
 let refreshing=false;const reload=()=>{if(refreshing||AppState.currentState!=="active")return;refreshing=true;void refresh().finally(()=>{refreshing=false;}).catch(()=>{});};
 const channel=backend().channel("cs:"+authId).on("postgres_changes",{event:"*",schema:"public",table:"cs_revisions",filter:"auth_id=eq."+authId},reload).subscribe();
 const timer=setInterval(reload,15000);return()=>{clearInterval(timer);void backend().removeChannel(channel);};
}
