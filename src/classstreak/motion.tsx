import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,Animated,Pressable,View,type PressableProps} from 'react-native';
export function useReducedMotion(){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active)setReduced(v);});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;sub.remove();};},[]);
 return reduced;
}
export function BouncePressable({onPress,children,...props}:PressableProps){
 const reduced=useReducedMotion();const [scale]=useState(()=>new Animated.Value(1));
 return <Animated.View style={{transform:[{scale}]}}><Pressable {...props} onPress={event=>{if(!reduced)Animated.sequence([Animated.timing(scale,{toValue:1.1,duration:90,useNativeDriver:true}),Animated.spring(scale,{toValue:1,useNativeDriver:true,speed:25,bounciness:8})]).start();onPress?.(event);}}>{children}</Pressable></Animated.View>;
}
export function Confetti({accent,tint}:{accent:string;tint:string}){
 const reduced=useReducedMotion();const [fall]=useState(()=>new Animated.Value(0));
 useEffect(()=>{if(!reduced)Animated.timing(fall,{toValue:1,duration:1400,useNativeDriver:true}).start();return()=>fall.stopAnimation();},[fall,reduced]);
 if(reduced)return null;
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',top:0,left:0,right:0,height:350,overflow:'hidden'}}>{Array.from({length:18},(_,i)=><Animated.View key={i} style={{position:'absolute',left:`${(i*37)%97}%`,width:i%2?5:8,height:10,backgroundColor:i%2?accent:tint,opacity:fall.interpolate({inputRange:[0,.8,1],outputRange:[1,1,0]}),transform:[{translateY:fall.interpolate({inputRange:[0,1],outputRange:[-30-i*8,370]})},{rotate:`${i*31}deg`}]}}/>)}</View>;
}
