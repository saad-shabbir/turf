import React,{useEffect,useState} from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import {File} from 'expo-file-system';
import {authenticatedOwner,backend} from '../auth/client';
import {call} from './api';
import type {Snapshot} from './model';
import {readPhoto} from './photos';
import {Avatar} from './ui';

// Private photos are downloaded with the signed-in session, so each one is
// fetched once per app run and shared by every avatar that shows it.
const cache=new Map<string,Promise<string>>();
export function cachedPhoto(path:string){
 let value=cache.get(path);
 if(!value){value=readPhoto(path);cache.set(path,value);value.catch(()=>cache.delete(path));}
 return value;
}
export function clearPhotoCache(){cache.clear();}

export function UserAvatar({name,path,size,own}:{name:string;path?:string|null;size?:number;own?:boolean}){
 const [loaded,setLoaded]=useState<{path:string;uri:string}|null>(null);
 useEffect(()=>{
  if(!path)return;let active=true;
  void cachedPhoto(path).then(uri=>{if(active)setLoaded({path,uri});}).catch(()=>{});
  return()=>{active=false;};
 },[path]);
 const uri=path&&loaded?.path===path?loaded.uri:null;
 return <Avatar name={name} size={size} own={own} source={uri?{uri}:undefined}/>;
}

// Square crop happens in the system picker. The result is uploaded under
// {auth id}/avatar/, which only you can write and only friends can read.
export async function chooseAvatar(source:'camera'|'library',previous:string|null|undefined):Promise<Snapshot|null>{
 const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.5};
 if(source==='camera'){
  if(!(await ImagePicker.requestCameraPermissionsAsync()).granted)throw new Error('Allow camera access in iPhone Settings to take a profile photo.');
 }
 const result=source==='camera'?await ImagePicker.launchCameraAsync({...options,cameraType:ImagePicker.CameraType.front}):await ImagePicker.launchImageLibraryAsync(options);
 if(result.canceled||!result.assets[0])return null;
 const owner=await authenticatedOwner();const path=`${owner}/avatar/${Crypto.randomUUID()}.jpg`;
 const file=new File(result.assets[0].uri);if(file.size>5242880)throw new Error('Choose a smaller photo.');
 const binary=Uint8Array.from(atob(await file.base64()),c=>c.charCodeAt(0));
 const {error}=await backend().storage.from('classstreak-photos').upload(path,binary.buffer,{contentType:'image/jpeg',upsert:false});
 if(error)throw new Error('Your photo didn’t upload. Check your connection and try again.');
 const snapshot=await call<Snapshot>('cs_set_avatar',{path});
 if(previous&&previous!==path)void backend().storage.from('classstreak-photos').remove([previous]).catch(()=>{});
 return snapshot;
}
export async function removeAvatar(previous:string|null|undefined){
 const snapshot=await call<Snapshot>('cs_set_avatar',{path:null});
 if(previous)void backend().storage.from('classstreak-photos').remove([previous]).catch(()=>{});
 return snapshot;
}
