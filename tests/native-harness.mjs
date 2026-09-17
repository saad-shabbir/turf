// Unit-only native adapters. SQLite here is plaintext; it does NOT establish
// SQLCipher/Keychain correctness on an iPhone. No synthetic path ships in the app.
import { registerHooks,stripTypeScriptTypes } from 'node:module';
import { readFileSync,mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID,randomBytes } from 'node:crypto';
const folder=mkdtempSync(join(tmpdir(),'turf-unit-'));
const secure=new Map();
export const native={failStorage:false,keyOptions:null,refreshes:0,networkFails:false,uploads:[],session:null,tasks:new Map(),registered:false,
 result:{accepted:[],duplicates:[],rejected:[],server_time:new Date().toISOString()}};
globalThis.__turfMocks={
 'expo-crypto':{randomUUID,getRandomBytesAsync:async n=>randomBytes(n)},
 'expo-secure-store':{AFTER_FIRST_UNLOCK:1,getItemAsync:async k=>secure.get(k)??null,setItemAsync:async(k,v,o)=>{native.keyOptions=o;secure.set(k,v);}},
 'expo-sqlite':{openDatabaseAsync:async()=>{
  if(native.failStorage)throw new Error('STORAGE_ERROR');
  const db=new DatabaseSync(join(folder,'test.db'));
  return {execAsync:async sql=>db.exec(sql.replace(/PRAGMA key[^;]*;/,'')),
    getFirstAsync:async(sql,...args)=>sql==='PRAGMA cipher_version'?{cipher_version:'UNIT MOCK'}:db.prepare(sql).get(...args)??null,
    getAllAsync:async(sql,...args)=>db.prepare(sql).all(...args),runAsync:async(sql,...args)=>db.prepare(sql).run(...args),closeAsync:async()=>db.close()};
 }},
 '@supabase/supabase-js':{createClient:()=>({auth:{
  getSession:async()=>({data:{session:native.session},error:null}),refreshSession:async()=>{native.refreshes++;return{data:{session:null},error:new Error('expired')};},
 },rpc:async(name,args)=>{native.uploads.push({name,args});if(native.networkFails)return{data:null,error:{message:'offline'}};return{data:native.result,error:null};}})},
 'expo-task-manager':{defineTask:(name,fn)=>native.tasks.set(name,fn),getRegisteredTasksAsync:async()=>[]},
 'expo-location':{GeofencingEventType:{Enter:1,Exit:2}},
};
registerHooks({
 resolve(specifier,context,next){
  if(Object.hasOwn(globalThis.__turfMocks,specifier))return{url:'mock:'+specifier,shortCircuit:true};
  if(specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !/\.[mc]?[jt]sx?$/.test(specifier)){
   const path=fileURLToPath(new URL(specifier,context.parentURL));return next(pathToFileURL(path+'.ts').href,context);
  }
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith('mock:')){const name=url.slice(5),keys=Object.keys(globalThis.__turfMocks[name]);return{format:'module',shortCircuit:true,source:keys.map(k=>`export const ${k}=globalThis.__turfMocks[${JSON.stringify(name)}][${JSON.stringify(k)}];`).join('\n')};}
  if(url.endsWith('.ts'))return{format:'module',shortCircuit:true,source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'))};
  return next(url,context);
 }
});
process.env.EXPO_PUBLIC_SUPABASE_URL='https://synthetic.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_unit_fixture';
