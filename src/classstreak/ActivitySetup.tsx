import React, {useState} from 'react';
import {Switch,View} from 'react-native';
import {activity,customKey,fullDays,timeLabel,type ActivityKey,type Schedule} from './model';
import {Button,Card,Chip,Input,Row,Txt,useTheme} from './ui';
import {ActivityArt} from './ActivityArt';
import {PlanTimePicker} from './PlanTimePicker';
import {periodTime} from './planning';
export function CustomActivity({onAdd}:{onAdd:(key:ActivityKey)=>void}){
 const [open,setOpen]=useState(false);const [name,setName]=useState('');
 return <View style={{gap:10}}><Button secondary small icon="plus" title="Custom" onPress={()=>setOpen(!open)}/>{open&&<Card style={{gap:10}}><Input label="Your activity" placeholder="For example, climbing" value={name} onChange={v=>setName(v.slice(0,40))}/><Button title="Add activity" disabled={!name.trim()} onPress={()=>{onAdd(customKey(name));setName('');setOpen(false);}}/></Card>}</View>;
}
export function ActivitySchedules({selected,schedules,onChange}:{selected:ActivityKey[];schedules:Schedule[];onChange:(value:Schedule[])=>void}){
 const t=useTheme();return <View style={{gap:16}}>{selected.map(key=>{
 const current=schedules.find(s=>s.activity_key===key)??{activity_key:key,days:[],time:'evening'};
 const change=(patch:Partial<Schedule>)=>onChange([...schedules.filter(s=>s.activity_key!==key),{...current,...patch}]);
 return <Card key={key} style={{gap:17,borderWidth:0,padding:20}}><Row><ActivityArt activityKey={key} size={62}/><Txt serif size={25} style={{flex:1}}>{activity(key).label}</Txt></Row><Row style={{gap:6,flexWrap:'wrap'}}>{fullDays.map((day,i)=><View key={day} style={{width:'22%'}}><Chip title={day.slice(0,3)} selected={current.days.includes(i)} onPress={()=>change({days:current.days.includes(i)?current.days.filter(d=>d!==i):[...current.days,i].sort()})}/></View>)}</Row><Txt bold size={12}>Usually around</Txt><Row style={{gap:7,flexWrap:'wrap'}}>{(['morning','midday','evening'] as const).map(time=><Chip key={time} title={timeLabel[time]} selected={current.time===time&&!current.exact_time} onPress={()=>change({time,exact_time:undefined})}/>)}<Chip title="Night" selected={current.exact_time==='21:00'} onPress={()=>change({time:'evening',exact_time:'21:00'})}/><Chip title="Specific time" icon="clock" selected={!!current.exact_time&&current.exact_time!=='21:00'} onPress={()=>change({exact_time:current.exact_time??periodTime(current.time)})}/></Row>{current.exact_time&&<PlanTimePicker value={current.exact_time} onChange={exact_time=>change({exact_time})}/>}<Row><View style={{flex:1}}><Txt bold size={12}>A little encouragement</Txt><Txt muted size={11}>{current.exact_time?'1 hour before, on your chosen days':'A reminder around your usual time'}</Txt></View><Switch accessibilityLabel={`Reminders for ${activity(key).label}`} value={current.reminder_enabled!==false} onValueChange={reminder_enabled=>change({reminder_enabled})} thumbColor="#fff" trackColor={{false:t.line,true:t.ink}}/></Row></Card>;
 })}</View>;
}
