import React,{useRef,useState} from 'react';
import {Modal,Pressable,ScrollView,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button,Icon,Row,Txt,useTheme} from './ui';
import {formatPlanTime,validTime} from './planning';

function Wheel({values,value,onChange,label}:{values:string[];value:string;onChange:(value:string)=>void;label:string}){
 const t=useTheme();const ref=useRef<ScrollView>(null);const initial=useRef(Math.max(0,values.indexOf(value))*48);
 return <View style={{flex:1,height:240}}><View pointerEvents="none" style={{position:'absolute',left:0,right:0,top:96,height:48,borderRadius:14,backgroundColor:t.line}}/>
  <ScrollView ref={ref} accessibilityLabel={label} showsVerticalScrollIndicator={false} snapToInterval={48} decelerationRate="fast" contentContainerStyle={{paddingVertical:96}} onLayout={()=>ref.current?.scrollTo({y:initial.current,animated:false})} onScroll={event=>{const index=Math.max(0,Math.min(values.length-1,Math.round(event.nativeEvent.contentOffset.y/48)));if(values[index]!==value)onChange(values[index]!);}} scrollEventThrottle={32}>
   {values.map((item,index)=><Pressable key={item} accessibilityRole="button" accessibilityLabel={`${label} ${item}`} accessibilityState={{selected:item===value}} onPress={()=>{onChange(item);ref.current?.scrollTo({y:index*48,animated:true});}} style={{height:48,alignItems:'center',justifyContent:'center'}}><Txt size={26} bold={item===value} muted={item!==value}>{item}</Txt></Pressable>)}
  </ScrollView>
 </View>;
}

export function PlanTimePicker({value,onChange,label='Choose a time'}:{value:string;onChange:(value:string)=>void;label?:string}){
 const t=useTheme();const [open,setOpen]=useState(false);const [hour,setHour]=useState('7');const [minute,setMinute]=useState('00');const [period,setPeriod]=useState('PM');
 const show=()=>{const parts=(validTime(value)?value:'19:00').split(':').map(Number);setHour(String(parts[0]!%12||12));setMinute(String(parts[1]).padStart(2,'0'));setPeriod(parts[0]!<12?'AM':'PM');setOpen(true);};
 return <><Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${formatPlanTime(value)}`} onPress={show} style={{backgroundColor:t.paper,paddingVertical:17,paddingHorizontal:18,borderRadius:20,borderColor:t.line,borderWidth:1}}><Row><Icon name="clock" size={22}/><Txt size={22} style={{flex:1}}>{formatPlanTime(value)}</Txt><Icon name="chevron" size={18}/></Row></Pressable>
  <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#00000035'}}><Pressable accessibilityLabel="Cancel time selection" onPress={()=>setOpen(false)} style={{flex:1}}/><SafeAreaView edges={['bottom']} style={{backgroundColor:t.paper,borderTopLeftRadius:30,borderTopRightRadius:30,padding:24,gap:18}}>
   <View style={{width:42,height:4,borderRadius:3,backgroundColor:t.line,alignSelf:'center'}}/><Row><Txt serif size={28} style={{flex:1}}>{label}</Txt><Pressable accessibilityLabel="Close time picker" onPress={()=>setOpen(false)} style={{padding:12}}><Icon name="x"/></Pressable></Row>
   <Row style={{gap:8}}><Wheel label="Hour" values={Array.from({length:12},(_,i)=>String(i+1))} value={hour} onChange={setHour}/><Txt size={28}>:</Txt><Wheel label="Minute" values={Array.from({length:60},(_,i)=>String(i).padStart(2,'0'))} value={minute} onChange={setMinute}/><Wheel label="AM or PM" values={['AM','PM']} value={period} onChange={setPeriod}/></Row>
   <Button dark title="Set time" onPress={()=>{onChange(`${String(Number(hour)%12+(period==='PM'?12:0)).padStart(2,'0')}:${minute}`);setOpen(false);}}/>
  </SafeAreaView></View></Modal>
 </>;
}
