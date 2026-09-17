import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { safeError } from '../domain/model';
export function Page({title,children}:{title:string;children:React.ReactNode}) {
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Text accessibilityRole="header" style={styles.title}>{title}</Text>{children}<View style={styles.nav}>{(['tracking','pairing','places','debug','settings'] as const).map(route=><Link key={route} href={`/${route}`} style={styles.link}>{route==='debug'?'My diagnostics':route}</Link>)}</View></ScrollView>;
}
export function Field({label,value,onChange,secret=false}:{label:string;value:string;onChange:(v:string)=>void;secret?:boolean}) {
 return <View><Text style={styles.text}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} style={styles.input}/></View>;
}
export function Copy({children}:{children:React.ReactNode}) { return <Text selectable style={styles.text}>{children}</Text>; }
export function Action({title,run}:{title:string;run:()=>Promise<unknown>}) {
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 return <View style={styles.action}><Button title={busy?'Working…':title} disabled={busy} onPress={()=>{setBusy(true);setMessage('');void run().catch(e=>setMessage(safeError(e))).finally(()=>setBusy(false));}}/>{message?<Text accessibilityRole="alert" style={styles.error}>{message}. Check setup or try again.</Text>:null}</View>;
}
const styles=StyleSheet.create({page:{padding:24,paddingBottom:60,gap:18,backgroundColor:'#f4f6f3',flexGrow:1},title:{fontSize:30,fontWeight:'700',color:'#173829'},text:{fontSize:16,lineHeight:24,color:'#24382d'},input:{backgroundColor:'white',borderWidth:1,borderColor:'#738678',padding:12,minHeight:48,borderRadius:8,fontSize:16},nav:{borderTopWidth:1,borderColor:'#bac5be',paddingTop:20,gap:12},link:{fontSize:17,paddingVertical:10,color:'#17573a',textTransform:'capitalize'},action:{minHeight:48,justifyContent:'center'},error:{color:'#8c2020',fontSize:16}});
