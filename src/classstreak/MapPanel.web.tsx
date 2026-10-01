import React from "react";
import { Pressable, View } from "react-native";
import { Icon, Txt, useTheme } from "./ui";
import type { MapPanelProps } from "./MapPanel";
export default function MapPanel({ latitude, longitude, radius, onPin }: MapPanelProps) {
 const t=useTheme(); return <Pressable accessibilityLabel="Illustrative preview map. Select a pin." onPress={() => onPin(latitude,longitude)} style={{ height:250,backgroundColor:"#e9eee7",borderRadius:18,overflow:"hidden",alignItems:"center",justifyContent:"center",gap:8 }}>
  {[35,95,155,210].map(top=><View key={top} style={{position:"absolute",height:14,width:"130%",top,backgroundColor:"#fff",transform:[{rotate:"-18deg"}]}} />)}
  <View style={{width:radius/2+55,height:radius/2+55,borderRadius:150,backgroundColor:"#CF2E6622",borderWidth:1,borderColor:t.accent,alignItems:"center",justifyContent:"center"}}><Icon name="pin" color={t.accent} size={32}/></View>
  <Txt size={11} style={{backgroundColor:"#fff",padding:6}}>Illustrative map · preview only</Txt>
 </Pressable>;
}
