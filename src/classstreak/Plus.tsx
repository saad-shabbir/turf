import React from "react";
import {Pressable,View} from "react-native";
import {Button,Card,Icon,Row,Screen,Txt,useTheme} from "./ui";
export function Plus({close,start}:{close:()=>void;start:()=>void}){
 const t=useTheme();const items=[
  ["Unlimited friends","Free stops at 3"],
  ["Your stats","Best days, by studio, by workout type, 12 months back"],
  ["Every sticker style","Eight looks for your story, new ones each season"],
  ["Two streak freezes a month","Sick week? Your streak waits."],
 ];
 return <Screen style={{gap:10,padding:20}} footer={<><Button title="Start 14 days free" onPress={start}/><Txt muted size={11} style={{textAlign:"center"}}>Then $29.99 a year. That’s $2.50 a month. Cancel any time.</Txt></>}>
  <Row style={{justifyContent:"flex-end"}}><Pressable accessibilityRole="button" accessibilityLabel="Close ClassStreak Plus" onPress={close} style={{width:42,height:42,borderRadius:30,backgroundColor:t.card,borderWidth:1,borderColor:t.line,justifyContent:"center",alignItems:"center"}}><Icon name="x" size={19}/></Pressable></Row>
  <Txt bold size={12} style={{color:t.accent}}>ClassStreak+</Txt><Txt serif size={38}>See yourself better.</Txt><Txt muted size={14} style={{marginBottom:12}}>Everything free stays free. This adds the stuff you’d screenshot.</Txt>
  {items.map(([title,description])=><Card key={title} style={{borderRadius:20,padding:15}}><Row><View style={{padding:11,borderRadius:13,backgroundColor:t.tint}}><Icon name="lock" size={18}/></View><View style={{flex:1,gap:2}}><Txt bold size={14}>{title}</Txt><Txt muted size={12}>{description}</Txt></View></Row></Card>)}
 </Screen>;
}
