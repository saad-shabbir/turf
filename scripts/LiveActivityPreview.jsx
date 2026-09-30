import React from 'react';
import {View} from 'react-native';
import {Card,Icon,Row,Screen,Txt} from '../src/classstreak/ui';

// Browser illustration of the native SwiftUI layout. It is not an iOS surface.
export function LiveActivityPreview(){
 const accent='#E8BD97';
 const goal=<View style={{gap:9}}><Row><Txt bold size={12} style={{color:'#fff',flex:1}}>2/3 goal this week</Txt><Txt size={10} style={{color:'#CEC7BB'}}>Workout in progress</Txt></Row><View style={{height:4,borderRadius:4,backgroundColor:'#55574B'}}><View style={{height:4,width:'66.67%',borderRadius:4,backgroundColor:accent}}/></View></View>;
 return <Screen style={{gap:26}}><Txt muted size={10} bold>LAYOUT PREVIEW · NOT A LIVE IPHONE TEST</Txt><Txt serif size={33}>Your workout, at a glance.</Txt><Txt muted size={13}>A visual preview of the Lock Screen and Dynamic Island layouts. Actual availability and background behavior still need an iPhone test.</Txt>
  <View style={{backgroundColor:'#C7C2AE',borderRadius:30,padding:16,paddingTop:35,gap:32}}><View style={{alignItems:'center',gap:3}}><Txt size={13} style={{color:'#494C3F'}}>Wednesday, September 30</Txt><Txt size={60} style={{color:'#494C3F'}}>19:42</Txt></View><Card style={{backgroundColor:'#252821',borderWidth:0,padding:17,gap:18}}><Row style={{gap:10}}><Icon name="flame" color={accent} size={25}/><View style={{flex:1,gap:5}}><Txt bold size={9} style={{color:'#D8CDBE'}}>CLASSSTREAK · WORKOUT</Txt><Txt bold size={17} style={{color:'#fff'}}>Weights</Txt></View><View style={{alignItems:'flex-end',gap:3}}><Txt bold size={25} style={{color:'#fff'}}>32:18</Txt><Txt size={10} style={{color:'#CEC7BB'}}>elapsed</Txt></View></Row>{goal}</Card><Txt size={10} style={{textAlign:'center',color:'#494C3F'}}>Lock Screen layout</Txt></View>
  <View style={{gap:14}}><Txt bold size={13}>Dynamic Island · compact</Txt><View style={{alignSelf:'center',width:235,borderRadius:99,paddingVertical:11,paddingHorizontal:17,backgroundColor:'#10120F'}}><Row><Icon name="flame" color={accent} size={18}/><View style={{flex:1}}/><Txt bold size={13} style={{color:accent}}>32:18</Txt></Row></View></View>
  <View style={{gap:12}}><Txt bold size={13}>Dynamic Island · expanded</Txt><Card style={{backgroundColor:'#10120F',borderWidth:0,gap:20}}><Row style={{alignItems:'flex-start'}}><View style={{flex:1,gap:5}}><Txt bold size={10} style={{color:accent}}>CLASSSTREAK</Txt><Txt bold size={17} style={{color:'#fff'}}>Weights</Txt></View><Txt bold size={25} style={{color:'#fff'}}>32:18</Txt></Row>{goal}</Card></View><Txt muted size={12}>After the arrival alert, open ClassStreak to start the Live Activity. The timer keeps the original arrival time.</Txt>
 </Screen>;
}
