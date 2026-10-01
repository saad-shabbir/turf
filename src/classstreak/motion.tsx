import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,Animated,Pressable,View,Platform,type PressableProps} from 'react-native';
import * as Haptics from 'expo-haptics';
const AnimatedPressable=Animated.createAnimatedComponent(Pressable);
export function SoftPressable({style,onPressIn,onPressOut,...props}:PressableProps){
 const reduced=useReducedMotion();const [pressed,setPressed]=useState(false);const [scale]=useState(()=>new Animated.Value(1));
 return <AnimatedPressable accessibilityRole="button" {...props} style={[typeof style==='function'?style({pressed}):style,{transform:[{scale}]}]} onPressIn={e=>{setPressed(true);if(!reduced)Animated.timing(scale,{toValue:.97,duration:120,useNativeDriver:true}).start();if(Platform.OS!=='web')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});onPressIn?.(e);}} onPressOut={e=>{setPressed(false);Animated.timing(scale,{toValue:1,duration:120,useNativeDriver:true}).start();onPressOut?.(e);}}/>;
}
export function useReducedMotion(){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active)setReduced(v);});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;sub.remove();};},[]);
 return reduced;
}
export function Entrance({children}:{children:React.ReactNode}){
 const reduced=useReducedMotion();const [value]=useState(()=>new Animated.Value(1));
 useEffect(()=>{if(!reduced){value.setValue(0);Animated.timing(value,{toValue:1,duration:200,useNativeDriver:true}).start();}return()=>value.stopAnimation();},[reduced,value]);
 return <Animated.View style={{flex:1,opacity:value,transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[6,0]})}]}}>{children}</Animated.View>;
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
