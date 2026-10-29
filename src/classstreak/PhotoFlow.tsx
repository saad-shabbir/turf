import React,{useEffect,useRef,useState} from 'react';
import {Image,Modal,Pressable,StyleSheet,Switch,TextInput,View,useWindowDimensions,ActivityIndicator} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CameraView,useCameraPermissions} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {captureRef} from 'react-native-view-shot';
import {Gesture,GestureDetector,GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated,{useAnimatedStyle,useSharedValue,withSpring} from 'react-native-reanimated';
import {activity,durationLabel,safeMessage,type ActivityKey,type PhotoKind,type Snapshot} from './model';
import {progress,type Candidate} from './engine';
import {Icon,Logo,Row,Txt,useTheme} from './ui';
import type {Action} from './SessionScreens';
import {queuePhoto,saveToPhotos,sharePhoto} from './photos';
import {startButtonWorkout} from './buttonWorkout';
import {markPhotoStart,syncLiveWorkout} from './live';
import {defaultPhotoKind,verifyChoices} from './workoutRules';

type Mode='verify'|'share';
type Step='choose'|'camera'|'review';
const KIND_LABEL:Record<PhotoKind,string>={pre:'Pre-workout',mid:'Mid-workout',post:'Post-workout'};
const SIZES=[.82,1,1.2] as const;
const STAMP_WIDTH=232;

// One camera flow. "Verify a workout" is live camera only and starts (pre) or
// ends (post) the timer with proof; "Just share a photo" may use the library
// and never changes the timer. The sticker is stamped into the saved image.
export function PhotoFlow({snapshot:s,activeWorkout,sessionId,verify=false,action,now,onSaved,onClose}:{snapshot:Snapshot;activeWorkout:Candidate|null;sessionId?:string;verify?:boolean;action:Action;now:Date;onSaved:()=>Promise<void>;onClose:()=>void}){
 const insets=useSafeAreaInsets();const {width,height}=useWindowDimensions();
 const running=activeWorkout?.visit_id?activeWorkout:null;
 const [mode,setMode]=useState<Mode>(sessionId?'share':'verify');const [step,setStep]=useState<Step>(sessionId||verify?'camera':'choose');
 const [uri,setUri]=useState<string|null>(null);const [kind,setKind]=useState<PhotoKind>(sessionId?'post':'pre');
 const [share,setShare]=useState(true);const [caption,setCaption]=useState('');const [captionOpen,setCaptionOpen]=useState(false);
 const [takenAt,setTakenAt]=useState(()=>new Date());const [sizeIndex,setSizeIndex]=useState(1);const [busy,setBusy]=useState(false);const [note,setNote]=useState('');
 const goals=[...new Set([...s.goals.map(g=>g.activity_key),...s.pending_goals.map(g=>g.activity_key),...s.places.filter(p=>p.enabled).map(p=>p.activity_key)])];
 const [activityKey,setActivityKey]=useState<ActivityKey>(running?.activity_key??goals[0]??'gym');
 const canvas=useRef<View>(null);const camera=useRef<CameraView>(null);const [facing,setFacing]=useState<'back'|'front'>('back');
 const [permission,requestPermission]=useCameraPermissions();
 const stats=progress(s.sessions,s.weeks,s.goals,s.profile.tz,now);
 const session=sessionId?s.sessions.find(x=>x.id===sessionId&&!x.removed_at):s.sessions.filter(x=>!x.removed_at&&x.source!=='seed'&&x.source!=='simulated'&&Date.parse(x.started_at)>=now.getTime()-7*86400000).sort((a,b)=>b.started_at.localeCompare(a.started_at))[0];
 // Where the photo is attached: the running workout, else (share mode) the session.
 const target=mode==='verify'?(running?.visit_id??null):sessionId?session?.id??null:running?.visit_id??session?.id??null;
 const allowed:PhotoKind[]=mode==='verify'?verifyChoices(!!running):['pre','mid','post'];
 const canPost=!!target||(mode==='verify'&&kind==='pre');

 const begin=(m:Mode)=>{setMode(m);setStep('camera');setNote('');};
 const accept=(photo:string)=>{
  setUri(photo);setStep('review');setTakenAt(new Date());
  const started=running?Date.parse(running.entered_at):null;const suggested=defaultPhotoKind(started,Date.now());
  setKind(mode==='verify'?(allowed.includes(suggested)?suggested:allowed[0]!):sessionId?'post':suggested);
  setActivityKey(running?.activity_key??(sessionId?session?.activity_key:undefined)??activityKey);
 };
 const capture=async()=>{try{const photo=await camera.current?.takePictureAsync({quality:.85});if(photo?.uri)accept(photo.uri);}catch(error){setNote(safeMessage(error));}};
 const library=async()=>{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.9});if(!result.canceled&&result.assets[0])accept(result.assets[0].uri);};
 const exportImage=()=>captureRef(canvas,{format:'jpg',quality:.9,result:'tmpfile',width:1080});

 const primaryTitle=busy?'Saving…':mode==='verify'&&kind==='pre'?'Start workout':mode==='verify'&&kind==='post'?'End workout':!target?'Save to Photos':share?'Post':'Save privately';
 const primary=async()=>{
  setBusy(true);setNote('');
  try{
   const image=await exportImage();
   if(mode==='verify'&&kind==='pre'){
    const candidate=await startButtonWorkout(s,activityKey,{photo:true});
    await markPhotoStart(candidate.visit_id!);
    // Report first so the upload lands in this workout's folder. Offline, the
    // app reports and uploads on a later tick.
    await syncLiveWorkout(candidate,s.profile.notification_preferences.workout_check!==false).catch(()=>{});
    await queuePhoto(image,candidate.visit_id!,caption.trim(),{kind:'pre',share});
    action('workout_started',{candidate});onClose();return;
   }
   if(!target){await saveToPhotos(image);action('message',{text:'Saved to your Photos.'});onClose();return;}
   const synced=await queuePhoto(image,target,caption.trim(),{kind,share});await onSaved().catch(()=>{});
   if(mode==='verify'&&kind==='post'){action('workout_stop',{visit_id:target});onClose();return;}
   action('message',{text:synced?(share?'Posted to your friends’ feeds.':'Saved privately to this workout.'):'Saved on this phone. It will upload when you’re back online.'});onClose();
  }catch(error){setNote(safeMessage(error));}finally{setBusy(false);}
 };
 const run=(fn:()=>Promise<void>)=>{setBusy(true);setNote('');void fn().catch(error=>setNote(safeMessage(error))).finally(()=>setBusy(false));};

 const elapsed=running?now.getTime()-Date.parse(running.entered_at):session&&!running?session.duration_sec*1000:0;
 const stamp=<Stamp label={activity(activityKey).label} kind={kind} at={takenAt} duration={kind==='post'&&elapsed>0?durationLabel(Math.floor(elapsed/1000)):null} streak={stats.streak} tz={s.profile.tz} scale={SIZES[sizeIndex]!}/>;

 return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
  <GestureHandlerRootView style={{flex:1,backgroundColor:'#111'}}>
   {step==='choose'&&<View style={{flex:1,paddingTop:insets.top+12,paddingBottom:insets.bottom+20,paddingHorizontal:20,gap:16}}>
    <Row><CircleButton icon="x" label="Close" onPress={onClose}/><View style={{flex:1}}/></Row>
    <View style={{flex:1,justifyContent:'center',gap:16}}>
     <Txt serif size={32} style={{color:'#fff'}}>What’s this photo for?</Txt>
     <BigChoice icon="check" title="Verify a workout" body={running?`Live camera only. Check in during your ${running.workout_label.toLowerCase()} or end it with proof.`:'Live camera only. Snap your arrival to start the timer with proof.'} onPress={()=>begin('verify')}/>
     <BigChoice icon="image" title="Just share a photo" body="Camera or library. Posts to your feed and never changes your timer." onPress={()=>begin('share')}/>
    </View>
   </View>}
   {step==='camera'&&<View style={{flex:1}}>
    {permission?.granted?<CameraView ref={camera} facing={facing} style={StyleSheet.absoluteFill}/>:<View style={[StyleSheet.absoluteFill,{alignItems:'center',justifyContent:'center',padding:30,gap:16}]}><Txt serif size={28} style={{color:'#fff',textAlign:'center'}}>Your camera is off.</Txt><Txt style={{color:'#ddd',textAlign:'center'}}>{mode==='verify'?'Verifying needs a live photo.':'Turn it on, or choose a photo from your library.'}</Txt><Pill title="Turn on camera" onPress={()=>void requestPermission()}/></View>}
    <Row style={{position:'absolute',top:insets.top+10,left:16,right:16}}><CircleButton icon={sessionId||verify?'x':'back'} label={sessionId||verify?'Close':'Back'} onPress={()=>sessionId||verify?onClose():setStep('choose')}/><View style={{flex:1,alignItems:'center'}}><View style={{backgroundColor:'#00000066',borderRadius:99,paddingHorizontal:14,paddingVertical:7}}><Txt bold size={13} style={{color:'#fff'}}>{mode==='verify'?'Verify a workout':'Share a photo'}</Txt></View></View><CircleButton icon="flip" label="Flip camera" onPress={()=>setFacing(f=>f==='back'?'front':'back')}/></Row>
    {!!note&&<Txt size={13} style={{position:'absolute',bottom:insets.bottom+130,left:20,right:20,color:'#fff',textAlign:'center'}}>{note}</Txt>}
    <Row style={{position:'absolute',bottom:insets.bottom+24,left:24,right:24,justifyContent:'space-between'}}>
     {mode==='share'?<CircleButton icon="image" label="Choose from library" onPress={()=>void library()} size={52}/>:<View style={{width:52}}/>}
     <Pressable accessibilityRole="button" accessibilityLabel="Take photo" disabled={!permission?.granted} onPress={()=>void capture()} style={{width:78,height:78,borderRadius:39,borderWidth:5,borderColor:'#fff',alignItems:'center',justifyContent:'center',opacity:permission?.granted?1:.4}}><View style={{width:60,height:60,borderRadius:30,backgroundColor:'#fff'}}/></Pressable>
     <View style={{width:52}}/>
    </Row>
   </View>}
   {step==='review'&&uri&&<View style={{flex:1}}>
    <View ref={canvas} collapsable={false} style={{width,height,backgroundColor:'#111',overflow:'hidden'}}>
     <Image source={{uri}} style={StyleSheet.absoluteFill} resizeMode="cover"/>
     <DraggableSticker width={width} height={height} top={insets.top+118} bottom={insets.bottom+170}>{stamp}</DraggableSticker>
    </View>
    <View style={{position:'absolute',top:insets.top+10,left:16,right:16,gap:10}}>
     <Row><CircleButton icon="back" label="Retake" onPress={()=>{setUri(null);setStep('camera');}}/><View style={{flex:1}}/><CircleButton icon="star" label={`Sticker size ${['small','medium','large'][sizeIndex]}`} onPress={()=>setSizeIndex(i=>(i+1)%SIZES.length)}/></Row>
     <Row style={{backgroundColor:'#00000077',borderRadius:99,padding:3,gap:0,alignSelf:'center'}}>{(['pre','mid','post'] as const).map(k=>{const enabled=allowed.includes(k);return <Pressable key={k} accessibilityRole="tab" accessibilityState={{selected:kind===k,disabled:!enabled}} disabled={!enabled} onPress={()=>setKind(k)} style={{paddingHorizontal:14,paddingVertical:8,borderRadius:99,backgroundColor:kind===k?'#fff':'transparent',opacity:enabled?1:.35}}><Txt bold size={12} style={{color:kind===k?'#111':'#fff'}}>{KIND_LABEL[k]}</Txt></Pressable>;})}</Row>
     {mode==='verify'&&kind==='pre'&&goals.length>1&&<Pressable accessibilityRole="button" accessibilityLabel={`Workout type ${activity(activityKey).label}. Tap to change.`} onPress={()=>setActivityKey(k=>goals[(goals.indexOf(k)+1)%goals.length]!)} style={{alignSelf:'center',backgroundColor:'#00000077',borderRadius:99,paddingHorizontal:14,paddingVertical:7}}><Txt bold size={12} style={{color:'#fff'}}>{activity(activityKey).label} · change</Txt></Pressable>}
    </View>
    <View style={{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:16,paddingTop:14,paddingBottom:insets.bottom+14,gap:12,backgroundColor:'#000000AA'}}>
     {!!note&&<Txt size={13} style={{color:'#fff'}}>{note}</Txt>}
     <Row style={{gap:10}}>
      <Row style={{flex:1,gap:8}}><Switch accessibilityLabel="Share to feed" value={share&&canPost} disabled={!canPost} onValueChange={setShare}/><View style={{flex:1}}><Txt bold size={13} style={{color:'#fff'}}>Share to feed</Txt><Txt size={11} style={{color:'#ccc'}} lines={1}>{canPost?(share?'Your friends':'Only you'):'Log a workout to post'}</Txt></View></Row>
      <CircleButton icon="comment" label={caption?'Edit caption':'Add a caption'} onPress={()=>setCaptionOpen(true)} active={!!caption}/>
      <CircleButton icon="download" label="Save to Photos" onPress={()=>run(async()=>{await saveToPhotos(await exportImage());setNote('Saved to your Photos.');})}/>
      <CircleButton icon="share" label="Share to your story" onPress={()=>run(async()=>{await sharePhoto(await exportImage(),s.profile.invite_code);})}/>
     </Row>
     <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void primary()} style={{height:54,borderRadius:27,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,opacity:busy?.6:1}}>{busy&&<ActivityIndicator color="#111"/>}<Txt bold size={16} style={{color:'#111'}}>{primaryTitle}</Txt></Pressable>
    </View>
    {captionOpen&&<CaptionSheet visible value={caption} onDone={value=>{setCaption(value);setCaptionOpen(false);}}/>}
   </View>}
  </GestureHandlerRootView>
 </Modal>;
}

// Drag anywhere; on release the sticker springs to the nearest of three rows.
// A tap moves it to the next row. Runs on the UI thread, so it tracks the finger.
function DraggableSticker({width,height,top,bottom,children}:{width:number;height:number;top:number;bottom:number;children:React.ReactNode}){
 const [size,setSize]=useState({w:STAMP_WIDTH,h:150});
 const rows=useSharedValue<number[]>([top,(height-150)/2,height-bottom-150]);
 const x=useSharedValue(20),y=useSharedValue(height-bottom-150),startX=useSharedValue(0),startY=useSharedValue(0),row=useSharedValue(2),maxX=useSharedValue(width-STAMP_WIDTH-20);
 useEffect(()=>{
  const next=[top,Math.max(top,(height-size.h)/2),Math.max(top,height-bottom-size.h)];rows.set(next);maxX.set(Math.max(0,width-size.w-12));
  y.set(withSpring(next[row.get()]!,{damping:18}));x.set(Math.min(x.get(),Math.max(0,width-size.w-12)));
 },[size,width,height,top,bottom,rows,maxX,x,y,row]);
 const pan=Gesture.Pan().minDistance(2).onBegin(()=>{startX.set(x.get());startY.set(y.get());}).onUpdate(e=>{
  const r=rows.get();x.set(Math.min(Math.max(12,startX.get()+e.translationX),maxX.get()));y.set(Math.min(Math.max(r[0]!-40,startY.get()+e.translationY),r[2]!+40));
 }).onEnd(()=>{
  const r=rows.get();const at=y.get();let best=0;for(let i=1;i<r.length;i++)if(Math.abs(r[i]!-at)<Math.abs(r[best]!-at))best=i;
  row.set(best);y.set(withSpring(r[best]!,{damping:18}));
 });
 const tap=Gesture.Tap().onEnd(()=>{const r=rows.get();const next=(row.get()+1)%3;row.set(next);y.set(withSpring(r[next]!,{damping:18}));});
 const style=useAnimatedStyle(()=>({transform:[{translateX:x.get()},{translateY:y.get()}]}));
 return <GestureDetector gesture={Gesture.Exclusive(pan,tap)}><Animated.View accessible accessibilityRole="adjustable" accessibilityLabel="Workout sticker" accessibilityHint="Drag to move. Tap to move it to the next position." onLayout={e=>{const {width:w,height:h}=e.nativeEvent.layout;if(Math.abs(w-size.w)>1||Math.abs(h-size.h)>1)setSize({w,h});}} style={[{position:'absolute',left:0,top:0},style]}>{children}</Animated.View></GestureDetector>;
}

export function Stamp({label,kind,at,duration,streak,tz,scale=1}:{label:string;kind:PhotoKind;at:Date;duration:string|null;streak:number;tz:string;scale?:number}){
 const when=at.toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:tz});
 return <View style={{width:STAMP_WIDTH*scale,padding:14*scale,borderRadius:18*scale,backgroundColor:'#14161499',borderWidth:1,borderColor:'#ffffff33',gap:6*scale}}>
  <Txt bold size={10*scale} style={{color:'#fff',opacity:.85,letterSpacing:1}}>{KIND_LABEL[kind].toUpperCase()}</Txt>
  <Txt serif size={24*scale} style={{color:'#fff'}} lines={2}>{label}</Txt>
  <Txt size={11*scale} style={{color:'#fff',opacity:.9}}>{when}</Txt>
  <Row style={{gap:14*scale}}>
   {duration&&<View><Txt size={9*scale} style={{color:'#fff',opacity:.75}}>Time</Txt><Txt bold size={16*scale} style={{color:'#fff'}}>{duration}</Txt></View>}
   <View><Txt size={9*scale} style={{color:'#fff',opacity:.75}}>Streak</Txt><Row style={{gap:3}}><Icon name="flame" size={14*scale} color="#fff"/><Txt bold size={16*scale} style={{color:'#fff'}}>{streak} wk</Txt></Row></View>
  </Row>
  <Logo white size={15*scale}/>
 </View>;
}

function CaptionSheet({visible,value,onDone}:{visible:boolean;value:string;onDone:(value:string)=>void}){
 const t=useTheme();const [draft,setDraft]=useState(value);const insets=useSafeAreaInsets();
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>onDone(value)}>
  <Pressable accessibilityLabel="Close caption" onPress={()=>onDone(draft.trim())} style={{flex:1,backgroundColor:'#00000066',justifyContent:'flex-end'}}>
   <Pressable onPress={()=>{}} style={{backgroundColor:t.paper,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:insets.bottom+20,gap:12}}>
    <Row><Txt bold size={16} style={{flex:1}}>Caption</Txt><Pressable accessibilityRole="button" onPress={()=>onDone(draft.trim())} style={{padding:6}}><Txt bold style={{color:t.accent}}>Done</Txt></Pressable></Row>
    <TextInput autoFocus accessibilityLabel="Caption" value={draft} onChangeText={v=>setDraft(v.slice(0,240))} placeholder="Say something about this workout" placeholderTextColor={t.muted} multiline style={{minHeight:70,borderWidth:1,borderColor:t.line,borderRadius:14,padding:12,fontSize:15,color:t.ink,backgroundColor:t.card}}/>
    <Txt muted size={11} style={{textAlign:'right'}}>{draft.length}/240</Txt>
   </Pressable>
  </Pressable>
 </Modal>;
}
function CircleButton({icon,label,onPress,size=42,active}:{icon:string;label:string;onPress:()=>void;size?:number;active?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{width:size,height:size,borderRadius:size/2,backgroundColor:active?'#fff':'#00000066',alignItems:'center',justifyContent:'center'}}><Icon name={icon} size={size*.45} color={active?'#111':'#fff'}/></Pressable>;
}
function Pill({title,onPress}:{title:string;onPress:()=>void}){
 return <Pressable accessibilityRole="button" onPress={onPress} style={{backgroundColor:'#fff',borderRadius:99,paddingHorizontal:22,paddingVertical:13}}><Txt bold style={{color:'#111'}}>{title}</Txt></Pressable>;
}
function BigChoice({icon,title,body,onPress}:{icon:string;title:string;body:string;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={body} onPress={onPress} style={({pressed})=>({backgroundColor:pressed?'#2a2a2a':'#1e1e1e',borderRadius:24,padding:22,gap:10,borderWidth:1,borderColor:'#333'})}>
  <View style={{width:46,height:46,borderRadius:23,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}}><Icon name={icon} size={22} color="#111"/></View>
  <Txt serif size={26} style={{color:'#fff'}}>{title}</Txt><Txt size={14} style={{color:'#bbb'}}>{body}</Txt>
 </Pressable>;
}
