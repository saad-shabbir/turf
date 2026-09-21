import React,{useState} from "react";
import {View} from "react-native";
import {CameraView,useCameraPermissions} from "expo-camera";
import {Button,Txt} from "./ui";
import type {Action} from "./SessionScreens";
export function Scanner({action}:{action:Action}){
 const [permission,request]=useCameraPermissions();const [scanned,setScanned]=useState(false);
 if(!permission?.granted)return <View style={{gap:14}}><Txt serif size={32}>Scan a friend’s QR</Txt><Txt muted>Use your camera to read a ClassStreak invite.</Txt><Button title="Allow camera" onPress={()=>void request()}/></View>;
 return <View style={{gap:14}}><Txt serif size={32}>Scan a code</Txt><CameraView style={{height:360,borderRadius:22}} barcodeScannerSettings={{barcodeTypes:["qr"]}} onBarcodeScanned={scanned?undefined:e=>{const match=e.data.match(/\/j\/([A-Z0-9]{12})(?:[/?#]|$)/i);if(match){setScanned(true);action("social",{action:"invite",payload:{code:match[1]}});action("navigate",{pane:"friends"});}else action("message",{text:"This is not a ClassStreak friend code."});}}/><Button secondary title="Enter a code instead" onPress={()=>action("navigate",{pane:"add-friends"})}/></View>;
}
