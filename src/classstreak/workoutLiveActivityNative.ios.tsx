import React from 'react';
import {HStack,VStack,Text,Image,ProgressView,Spacer} from '@expo/ui/swift-ui';
import {font,foregroundStyle,padding,monospacedDigit,frame,lineLimit,minimumScaleFactor,activityBackgroundTint,tint} from '@expo/ui/swift-ui/modifiers';
import {createLiveActivity,type LiveActivityEnvironment} from 'expo-widgets';
import type {WorkoutActivityProps} from './workoutLiveActivityNative';

export function WorkoutActivityLayout(p:WorkoutActivityProps,e:LiveActivityEnvironment){
 'widget';
 const accent=e.isLuminanceReduced?'#FFFFFF':p.accent;
 const timer=<Text timerInterval={{lower:new Date(p.startedAt),upper:new Date(p.startedAt+14400000)}} countsDown={false} modifiers={[font({size:28,weight:'semibold',design:'rounded'}),monospacedDigit(),foregroundStyle('#FFFFFF')]} />;
 const goalText=p.goal>0?`${p.count}/${p.goal} goal this week`:`${p.count} workouts this week`;
 const goal=<VStack alignment="leading" spacing={6}><HStack><Text modifiers={[font({size:12,weight:'semibold'}),foregroundStyle('#FFFFFF')]}>{goalText}</Text><Spacer/><Text modifiers={[font({size:10}),foregroundStyle('#CEC7BB')]}>{e.isStale?'Open to check timer':'Workout in progress'}</Text></HStack><ProgressView value={p.goal>0?Math.min(1,p.count/p.goal):0} modifiers={[tint(accent)]}/></VStack>;
 return {
  banner:<VStack alignment="leading" spacing={14} modifiers={[padding({all:18}),activityBackgroundTint('#252821')]}><HStack spacing={12}><Image systemName="flame.fill" color={accent} size={26}/><VStack alignment="leading" spacing={4}><Text modifiers={[font({size:11,weight:'semibold'}),foregroundStyle('#D8CDBE')]}>CLASSSTREAK · WORKOUT</Text><Text modifiers={[font({size:20,weight:'semibold'}),foregroundStyle('#FFFFFF'),lineLimit(1),minimumScaleFactor(.7)]}>{p.label}</Text></VStack><Spacer/><VStack alignment="trailing" spacing={3}>{timer}<Text modifiers={[font({size:10}),foregroundStyle('#CEC7BB')]}>elapsed</Text></VStack></HStack>{goal}</VStack>,
  compactLeading:<Image systemName="flame.fill" color={accent} size={18}/>,
  compactTrailing:<Text timerInterval={{lower:new Date(p.startedAt),upper:new Date(p.startedAt+14400000)}} countsDown={false} modifiers={[font({size:13,weight:'semibold'}),monospacedDigit(),foregroundStyle(accent),frame({width:62})]}/>,
  minimal:<Image systemName="flame.fill" color={accent} size={18}/>,
  expandedLeading:<VStack alignment="leading" spacing={5} modifiers={[padding({leading:8,top:8})]}><Text modifiers={[font({size:10,weight:'semibold'}),foregroundStyle(accent)]}>CLASSSTREAK</Text><Text modifiers={[font({size:17,weight:'semibold'}),foregroundStyle('#FFFFFF'),lineLimit(1),minimumScaleFactor(.7)]}>{p.label}</Text></VStack>,
  expandedTrailing:<VStack alignment="trailing" modifiers={[padding({trailing:8,top:8})]}>{timer}</VStack>,
  expandedBottom:<VStack modifiers={[padding({all:10})]}>{goal}</VStack>,
 };
}
let activity:ReturnType<typeof createLiveActivity<WorkoutActivityProps>>|undefined;
const factory=()=>activity??=createLiveActivity<WorkoutActivityProps>('ClassStreakWorkout',WorkoutActivityLayout);
export const workoutActivityDriver={supported:true,list:()=>factory().getInstances(),start:(props:WorkoutActivityProps,staleDate:Date)=>factory().start(props,'turf://active-workout',staleDate)};
