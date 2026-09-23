import React, {useState} from 'react';
import {View} from 'react-native';
import {activity,customKey,fullDays,timeLabel,type ActivityKey,type Schedule} from './model';
import {Button,Card,Chip,Icon,Input,Row,Txt,useTheme} from './ui';
export function CustomActivity({onAdd}:{onAdd:(key:ActivityKey)=>void}){
 const [open,setOpen]=useState(false);const [name,setName]=useState('');
 return <View style={{gap:10}}><Button secondary small icon="plus" title="Custom" onPress={()=>setOpen(!open)}/>{open&&<Card style={{gap:10}}><Input label="Your activity" placeholder="For example, climbing" value={name} onChange={v=>setName(v.slice(0,40))}/><Button title="Add activity" disabled={!name.trim()} onPress={()=>{onAdd(customKey(name));setName('');setOpen(false);}}/></Card>}</View>;
}
export function ActivitySchedules({selected,schedules,onChange}:{selected:ActivityKey[];schedules:Schedule[];onChange:(value:Schedule[])=>void}){
 const t=useTheme();return <View style={{gap:16}}>{selected.map(key=>{
 const current=schedules.find(s=>s.activity_key===key)??{activity_key:key,days:[],time:'evening'};
 const change=(patch:Partial<Schedule>)=>onChange([...schedules.filter(s=>s.activity_key!==key),{...current,...patch}]);
 return <Card key={key} style={{gap:16}}><Row><View style={{padding:10,borderRadius:14,backgroundColor:t.tint}}><Icon name={activity(key).icon}/></View><Txt serif size={23} style={{flex:1}}>{activity(key).label}</Txt></Row><Txt muted size={12}>Make room for your next session.</Txt><Row style={{gap:6,flexWrap:'wrap'}}>{fullDays.map((day,i)=><View key={day} style={{width:'22%'}}><Chip title={day.slice(0,3)} selected={current.days.includes(i)} onPress={()=>change({days:current.days.includes(i)?current.days.filter(d=>d!==i):[...current.days,i].sort()})}/></View>)}</Row><Txt bold size={12}>Usually around</Txt><View style={{gap:7}}>{(['morning','midday','evening'] as const).map(time=><Chip key={time} title={timeLabel[time]} selected={current.time===time} onPress={()=>change({time})}/>)}</View></Card>;
 })}</View>;
}
