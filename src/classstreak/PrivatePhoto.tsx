import React,{useEffect,useState} from "react";
import {Image,View} from "react-native";
import {readPhoto} from "./photos";
import {Txt} from "./ui";
export function PrivatePhoto({path}:{path:string}){
 const [uri,setUri]=useState<string|null>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;void readPhoto(path).then(value=>{if(active)setUri(value);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[path]);
 return uri?<Image source={{uri}} style={{width:"100%",aspectRatio:9/13,borderRadius:18}} resizeMode="cover"/>:<View style={{padding:20}}><Txt muted size={12}>{failed?"Photo no longer available.":"Opening photo…"}</Txt></View>;
}
