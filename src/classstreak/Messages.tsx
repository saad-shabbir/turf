import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,KeyboardAvoidingView,Platform,Pressable,ScrollView,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {call} from './api';
import {safeMessage,type Conversation,type Message,type Snapshot,type Thread as ThreadData} from './model';
import {UserAvatar} from './avatars';
import {Card,Empty,Icon,Row,Txt,useTheme} from './ui';
import type {Action} from './SessionScreens';

const when=(iso:string)=>{
 const d=new Date(iso);const today=new Date().toDateString()===d.toDateString();
 return today?d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
};

export function Conversations({snapshot:s,action}:{snapshot:Snapshot;action:Action}){
 const t=useTheme();const [list,setList]=useState<Conversation[]|null>(null);const [error,setError]=useState<unknown>(null);
 const unread=s.dm_unread??0;
 useEffect(()=>{let active=true;void call<Conversation[]>('cs_messages',{action:'list',payload:{}}).then(v=>{if(active)setList(v);}).catch(e=>{if(active)setError(e);});return()=>{active=false;};},[unread]);
 const friends=s.friends.filter(f=>f.status==='accepted'&&!f.is_demo);
 const started=new Set((list??[]).map(c=>c.peer_id));
 return <View style={{gap:12}}>
  <Txt serif size={32}>Messages</Txt>
  {!!error&&<Txt muted>{safeMessage(error)}</Txt>}
  {list===null&&!error&&<Txt muted>Loading your messages…</Txt>}
  {list?.map(c=><Pressable key={c.peer_id} accessibilityRole="button" accessibilityLabel={`Chat with ${c.first_name}${c.unread?`, ${c.unread} unread`:''}`} onPress={()=>action('navigate',{pane:'dm:'+c.peer_id})}><Card style={{padding:13}}><Row style={{gap:12}}><UserAvatar name={c.first_name} path={c.avatar_path} size={44}/><View style={{flex:1,gap:3}}><Row><Txt bold={c.unread>0} style={{flex:1}}>{c.first_name}</Txt><Txt muted size={11}>{when(c.last_at)}</Txt></Row><Txt muted={!c.unread} bold={c.unread>0} size={13} lines={1}>{c.last_from_me?'You: ':''}{c.last_body}</Txt></View>{c.unread>0&&<View style={{minWidth:20,height:20,borderRadius:10,backgroundColor:t.accent,alignItems:'center',justifyContent:'center',paddingHorizontal:5}}><Txt bold size={11} style={{color:'#fff'}}>{c.unread}</Txt></View>}</Row></Card></Pressable>)}
  {list&&!list.length&&!friends.length&&<Empty title="Say hi to your people." body="Add a friend to start a chat." action="Add friends" onPress={()=>action('navigate',{pane:'add-friends'})}/>}
  {friends.some(f=>!started.has(f.id))&&<><Txt bold size={13} style={{marginTop:6}}>Start a chat</Txt><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:14}}>{friends.filter(f=>!started.has(f.id)).map(f=><Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`Message ${f.first_name}`} onPress={()=>action('navigate',{pane:'dm:'+f.id})} style={{alignItems:'center',gap:5,minWidth:56}}><UserAvatar name={f.first_name} path={f.avatar_path} size={48}/><Txt size={11}>{f.first_name}</Txt></Pressable>)}</ScrollView></>}
 </View>;
}

type Pending={client_id:string;body:string;failed?:boolean};
export function Thread({peerId,snapshot:s,action}:{peerId:string;snapshot:Snapshot;action:Action}){
 const t=useTheme();const scroll=useRef<ScrollView>(null);
 const friend=s.friends.find(f=>f.id===peerId&&f.status==='accepted'&&!f.is_demo);
 const [thread,setThread]=useState<ThreadData|null>(null);const [pending,setPending]=useState<Pending[]>([]);const [draft,setDraft]=useState('');const [error,setError]=useState<unknown>(null);
 const load=useCallback(async()=>{const value=await call<ThreadData>('cs_messages',{action:'read',payload:{peer:peerId}});setThread(value);setError(null);},[peerId]);
 useEffect(()=>{
  if(!friend)return;let active=true;
  const tick=()=>{if(AppState.currentState==='active')void load().catch(e=>{if(active)setError(e);});};
  tick();const timer=setInterval(tick,4000);return()=>{active=false;clearInterval(timer);};
 },[friend,load]);
 const send=async(item:Pending)=>{
  try{const value=await call<ThreadData>('cs_messages',{action:'send',payload:{peer:peerId,body:item.body,client_id:item.client_id}});setThread(value);setPending(p=>p.filter(x=>x.client_id!==item.client_id));}
  catch(e){setPending(p=>p.map(x=>x.client_id===item.client_id?{...x,failed:true}:x));setError(e);}
 };
 const submit=()=>{const body=draft.trim();if(!body)return;const item={client_id:Crypto.randomUUID(),body:body.slice(0,1000)};setDraft('');setPending(p=>[...p,item]);void send(item);};
 const name=friend?.first_name??thread?.peer.first_name??'Friend';
 const shown:(Message|Pending&{pending:true})[]=[...(thread?.messages??[]),...pending.filter(p=>!thread?.messages.some(m=>m.client_id===p.client_id)).map(p=>({...p,pending:true as const}))];
 return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:t.paper}}>
  <Row style={{paddingHorizontal:12,paddingVertical:10,borderBottomWidth:1,borderColor:t.line,gap:10}}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to messages" onPress={()=>action('navigate',{pane:'messages'})} style={{padding:8}}><Icon name="back"/></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`View ${name}’s profile`} onPress={()=>friend&&action('navigate',{pane:'friend:'+peerId})} style={{flexDirection:'row',alignItems:'center',gap:10,flex:1}}><UserAvatar name={name} path={friend?.avatar_path??thread?.peer.avatar_path} size={36}/><Txt bold size={16}>{name}</Txt></Pressable>
  </Row>
  {!friend?<View style={{padding:20}}><Empty title="Chat unavailable" body="You can message people after you both accept the friend request." action="Back to friends" onPress={()=>action('navigate',{pane:'friends'})}/></View>:<>
   <ScrollView ref={scroll} onContentSizeChange={()=>scroll.current?.scrollToEnd({animated:false})} contentContainerStyle={{padding:16,gap:6,flexGrow:1,justifyContent:'flex-end'}} keyboardDismissMode="interactive">
    {thread&&!shown.length&&<Txt muted style={{textAlign:'center',padding:24}}>Say hi to {name}. Plan a workout together.</Txt>}
    {shown.map(m=>{const mine='pending' in m||m.from_me;const failed='pending' in m&&m.failed;return <View key={'id' in m?m.id:m.client_id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'80%',gap:2}}>
     <View style={{backgroundColor:mine?t.accent:t.card,borderWidth:mine?0:1,borderColor:t.line,borderRadius:18,borderBottomRightRadius:mine?5:18,borderBottomLeftRadius:mine?18:5,paddingHorizontal:13,paddingVertical:9,opacity:'pending' in m&&!failed?.6:1}}><Txt size={15} style={{color:mine?'#fff':t.ink}}>{m.body}</Txt></View>
     {failed?<Pressable accessibilityRole="button" onPress={()=>{setPending(p=>p.map(x=>x.client_id===m.client_id?{...x,failed:false}:x));void send(m);}}><Txt size={11} style={{color:t.accent,textAlign:'right'}}>Not sent. Tap to retry.</Txt></Pressable>:'created_at' in m&&<Txt muted size={10} style={{textAlign:mine?'right':'left'}}>{when(m.created_at)}{mine&&m.read?' · Seen':''}</Txt>}
    </View>;})}
   </ScrollView>
   {!!error&&<Txt muted size={12} style={{paddingHorizontal:16}}>{safeMessage(error)}</Txt>}
   <Row style={{paddingHorizontal:12,paddingTop:8,paddingBottom:10,gap:8,borderTopWidth:1,borderColor:t.line,alignItems:'flex-end'}}>
    <TextInput accessibilityLabel={`Message ${name}`} value={draft} onChangeText={v=>setDraft(v.slice(0,1000))} placeholder="Message" placeholderTextColor={t.muted} multiline style={{flex:1,minHeight:42,maxHeight:120,borderWidth:1,borderColor:t.line,borderRadius:21,paddingHorizontal:15,paddingTop:11,paddingBottom:11,fontSize:15,color:t.ink,backgroundColor:t.card}}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!draft.trim()} onPress={submit} style={{width:42,height:42,borderRadius:21,backgroundColor:draft.trim()?t.accent:t.line,alignItems:'center',justifyContent:'center'}}><Icon name="send" size={18} color="#fff"/></Pressable>
   </Row>
  </>}
 </KeyboardAvoidingView>;
}
