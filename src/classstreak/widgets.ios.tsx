import React from 'react';
import {Text,VStack,HStack,Image,ProgressView} from '@expo/ui/swift-ui';
import {font,foregroundStyle,widgetURL,tint} from '@expo/ui/swift-ui/modifiers';
import {createWidget,type WidgetEnvironment} from 'expo-widgets';
import type {Snapshot} from './model';
import {progress} from './engine';
type Props={count:number;goal:number;streak:number;friend:string;friendCount:number;accent:string;ink:string;signedIn:boolean};
function Layout(p:Props,e:WidgetEnvironment){
 'widget';
 if(!p.signedIn)return <VStack modifiers={[widgetURL('turf://home')]}><Text modifiers={[font({size:18,design:'serif',weight:'semibold'})]}>ClassStreak</Text><Text modifiers={[font({size:12})]}>Open to see your streak.</Text></VStack>;
 if(e.widgetFamily==='accessoryCircular')return <VStack spacing={0} modifiers={[widgetURL('turf://home')]}><Image systemName="flame"/><Text modifiers={[font({size:24,design:'serif',weight:'semibold'})]}>{p.streak}</Text></VStack>;
 return <HStack spacing={18} modifiers={[widgetURL('turf://home'),foregroundStyle(p.ink)]}><VStack spacing={2}><Image systemName="flame" modifiers={[foregroundStyle(p.accent)]}/><Text modifiers={[font({size:34,design:'serif',weight:'semibold'})]}>{p.streak}</Text><Text modifiers={[font({size:10})]}>weeks</Text></VStack><VStack alignment="leading" spacing={9}><Text modifiers={[font({size:13,weight:'semibold'})]}>{p.count} of {p.goal} this week</Text><ProgressView value={p.goal?Math.min(1,p.count/p.goal):0} modifiers={[tint(p.accent)]}/>{e.widgetFamily==='systemMedium'&&p.friend?<Text modifiers={[font({size:11})]}>{p.friend} is at {p.friendCount}. Go get them.</Text>:<Text modifiers={[font({size:11})]}>Go to class. It counts itself.</Text>}</VStack></HStack>;
}
const widget=createWidget<Props>('ClassStreakWidget',Layout);
export function updateWidget(s:Snapshot|null){
 const blank:Props={count:0,goal:0,streak:0,friend:'',friendCount:0,accent:'#CF3267',ink:'#3D1F31',signedIn:false};
 if(!s){widget.updateSnapshot(blank);return;}
 const stats=progress(s.sessions,s.weeks,s.goals,s.profile.tz,new Date());
 const ahead=s.friends.filter(f=>f.status==='accepted'&&f.weekly_count>stats.count).sort((a,b)=>a.weekly_count-b.weekly_count)[0];
 const p={...blank,count:stats.count,goal:stats.goal,streak:stats.streak,signedIn:true,friend:ahead?.first_name??'',friendCount:ahead?.weekly_count??0,accent:s.profile.theme==='sage'?'#2F795D':s.profile.theme==='clay'?'#BF6040':blank.accent,ink:s.profile.theme==='sage'?'#1F3A2F':s.profile.theme==='clay'?'#302B27':blank.ink};
 // No identifiers, tokens, Health records, photos or location data enter the app group.
 // Expire friend wording and then the snapshot if the main app cannot refresh it.
 widget.updateTimeline([{date:new Date(),props:p},{date:new Date(Date.now()+15*60000),props:{...p,friend:''}},{date:new Date(Date.now()+24*3600000),props:blank}]);
}
