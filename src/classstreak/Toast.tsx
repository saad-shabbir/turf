import React,{useEffect,useMemo,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,PanResponder,Pressable,View,type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon,Txt,useTheme} from './ui';
import {toastDuration,type ToastTone} from './toastRules';

export type ToastMessage={id:number;text:string;tone:ToastTone};
const ERROR_RED='#C2412D';

// Read once and kept current, so a notice knows these settings the moment it
// appears (Reduce Motion: fade only; VoiceOver: stay twice as long).
let reduceMotion=false,screenReader=false;
void AccessibilityInfo.isReduceMotionEnabled().then(v=>{reduceMotion=v;}).catch(()=>{});
void AccessibilityInfo.isScreenReaderEnabled().then(v=>{screenReader=v;}).catch(()=>{});
AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{reduceMotion=v;});
AccessibilityInfo.addEventListener('screenReaderChanged',v=>{screenReader=v;});
const enter=(opacity:Animated.Value,y:Animated.Value)=>Animated.parallel([Animated.timing(opacity,{toValue:1,duration:180,useNativeDriver:true}),reduceMotion?Animated.timing(y,{toValue:0,duration:0,useNativeDriver:true}):Animated.spring(y,{toValue:0,useNativeDriver:true,speed:18,bounciness:4})]);
const pill=(ink:string):ViewStyle=>({flexDirection:'row',alignItems:'center',gap:10,maxWidth:520,alignSelf:'center',backgroundColor:ink,borderRadius:24,paddingVertical:10,paddingLeft:10,paddingRight:16,shadowColor:'#000',shadowOpacity:.18,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:6});

// Floating notices sit just below the status bar, over the screen, and never
// push the content down. Taps outside them pass through.
export function TopNotices({children}:{children:React.ReactNode}){
 const insets=useSafeAreaInsets();
 return <View pointerEvents="box-none" style={{position:'absolute',top:insets.top+8,left:12,right:12,gap:8,zIndex:50,elevation:50}}>{children}</View>;
}

// Slide/fade in, leave by itself after a moment (longer for errors and long
// text), and go early on a tap or an upward swipe. VoiceOver reads it out.
export function Toast({toast,onDone}:{toast:ToastMessage;onDone:(id:number)=>void}){
 const t=useTheme();
 const [y]=useState(()=>new Animated.Value(-14));const [opacity]=useState(()=>new Animated.Value(0));
 const label=`${toast.tone==='error'?'Error. ':''}${toast.text}`;
 const controls=useMemo(()=>{
  // Closing twice is harmless: onDone only clears the toast with this id.
  const close=()=>{Animated.parallel([Animated.timing(opacity,{toValue:0,duration:160,useNativeDriver:true}),Animated.timing(y,{toValue:reduceMotion?0:-28,duration:160,useNativeDriver:true})]).start(()=>onDone(toast.id));};
  const pan=PanResponder.create({
   onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dy)>4&&Math.abs(g.dy)>Math.abs(g.dx),
   onPanResponderMove:(_,g)=>{y.setValue(Math.min(0,g.dy));},
   onPanResponderRelease:(_,g)=>{if(g.dy<-18||g.vy<-.3)close();else Animated.spring(y,{toValue:0,useNativeDriver:true}).start();},
   onPanResponderTerminate:()=>{Animated.spring(y,{toValue:0,useNativeDriver:true}).start();},
  });
  return {close,pan};
 },[onDone,opacity,toast.id,y]);
 useEffect(()=>{enter(opacity,y).start();AccessibilityInfo.announceForAccessibility(label);},[label,opacity,y]);
 useEffect(()=>{const timer=setTimeout(controls.close,toastDuration(toast.text,toast.tone,screenReader));return()=>clearTimeout(timer);},[controls,toast.text,toast.tone]);
 const icon=toast.tone==='success'?'check':toast.tone==='error'?'alert':'info';
 const iconBg=toast.tone==='success'?t.accent:toast.tone==='error'?ERROR_RED:'#ffffff2e';
 return <Animated.View {...controls.pan.panHandlers} style={{opacity,transform:[{translateY:y}],alignSelf:'center',maxWidth:'100%'}}>
  <Pressable accessible accessibilityRole="alert" accessibilityLabel={label} accessibilityHint="Double-tap to dismiss." accessibilityLiveRegion="polite" onAccessibilityEscape={controls.close} onPress={controls.close} style={pill(t.ink)}>
   <View style={{width:26,height:26,borderRadius:13,backgroundColor:iconBg,alignItems:'center',justifyContent:'center'}}><Icon name={icon} size={14} color="#fff"/></View>
   <Txt size={14} style={{color:'#fff',flexShrink:1}}>{toast.text}</Txt>
  </Pressable>
 </Animated.View>;
}

// Same pill, but it stays until tapped: Restart, or "Not now" to tuck it away
// until the app is opened again (the update then applies by itself).
export function UpdatePill({onRestart,onLater}:{onRestart:()=>void;onLater:()=>void}){
 const t=useTheme();
 const [y]=useState(()=>new Animated.Value(-14));const [opacity]=useState(()=>new Animated.Value(0));
 useEffect(()=>{enter(opacity,y).start();AccessibilityInfo.announceForAccessibility('A new version of ClassStreak is ready.');},[opacity,y]);
 const pan=useMemo(()=>PanResponder.create({
  onMoveShouldSetPanResponder:(_,g)=>g.dy<-6&&Math.abs(g.dy)>Math.abs(g.dx),
  onPanResponderMove:(_,g)=>{y.setValue(Math.min(0,g.dy));},
  onPanResponderRelease:(_,g)=>{if(g.dy<-18||g.vy<-.3)onLater();else Animated.spring(y,{toValue:0,useNativeDriver:true}).start();},
 }),[onLater,y]);
 return <Animated.View {...pan.panHandlers} style={{opacity,transform:[{translateY:y}],alignSelf:'center',maxWidth:'100%'}}>
  <View style={[pill(t.ink),{paddingRight:6}]}>
   <View style={{width:26,height:26,borderRadius:13,backgroundColor:t.accent,alignItems:'center',justifyContent:'center'}}><Icon name="download" size={14} color="#fff"/></View>
   <Txt size={14} style={{color:'#fff',flexShrink:1}}>A new version of ClassStreak is ready</Txt>
   <Pressable accessibilityRole="button" accessibilityLabel="Restart ClassStreak to update" onPress={onRestart} hitSlop={6} style={{backgroundColor:'#fff',borderRadius:16,paddingHorizontal:13,paddingVertical:7}}><Txt bold size={13} style={{color:t.ink}}>Restart</Txt></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onLater} hitSlop={8} style={{padding:6}}><Icon name="x" size={14} color="#ffffffb3"/></Pressable>
  </View>
 </Animated.View>;
}

export function UpdatingOverlay(){
 const t=useTheme();
 useEffect(()=>{AccessibilityInfo.announceForAccessibility('Updating ClassStreak');},[]);
 return <View accessibilityViewIsModal style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'#00000040',alignItems:'center',justifyContent:'center',zIndex:60,elevation:60}}>
  <View accessible accessibilityLabel="Updating ClassStreak" style={{backgroundColor:t.card,borderRadius:22,paddingVertical:22,paddingHorizontal:26,alignItems:'center',gap:12,shadowColor:'#000',shadowOpacity:.15,shadowRadius:16,shadowOffset:{width:0,height:6}}}>
   <ActivityIndicator color={t.accent}/>
   <Txt bold size={15}>Updating ClassStreak…</Txt>
  </View>
 </View>;
}
