import {build} from 'esbuild';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {fresh,actor,rpc,A} from '../tests/database-harness.mjs';
await mkdir('build/gallery',{recursive:true});
const db=await fresh();
await actor(db,A);
await rpc(db,'cs_bootstrap',[{first_name:'Saad',last_name:'Shabbir',selected:['reformer','yoga','gym'],goals:{reformer:2,yoga:1,gym:2},days:[1,3,5],time:'evening',tz:'America/Los_Angeles'}]);
await rpc(db,'cs_settings',['place',{name:'Club Pilates Summerlin',activity_key:'reformer',lat:0,lng:0,radius_m:100}]);
await writeFile('build/gallery/fixture.json',JSON.stringify(await rpc(db,'cs_seed_demo',[false,[]])));
await db.close();
const fonts=['fraunces/600SemiBold/Fraunces_600SemiBold','manrope/400Regular/Manrope_400Regular','manrope/600SemiBold/Manrope_600SemiBold','manrope/700Bold/Manrope_700Bold','manrope/800ExtraBold/Manrope_800ExtraBold'];
let css='';
for(const font of fonts){const name=font.split('/').at(-1);await copyFile('node_modules/@expo-google-fonts/'+font+'.ttf','build/gallery/'+name+'.ttf');css+=`@font-face{font-family:${name};src:url(${name}.ttf)}`;}
await writeFile('build/gallery/index.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ClassStreak · September design review</title><style>${css}*{box-sizing:border-box}html,body,#root{margin:0;height:100%;font-family:Manrope_400Regular}#root{display:flex;flex-direction:column;background:#F3F0E9}nav{min-height:36px;flex-shrink:0;background:#252622;color:#fff;display:flex;align-items:center;gap:7px;padding:7px 9px;font-size:9px}select{border:0;border-radius:4px;padding:3px;max-width:145px;font-size:10px;background:#fff;color:#252622}main{flex:1;min-height:0;display:flex;flex-direction:column}button,input,select{font:inherit}</style></head><body><div id="root"></div><script src="bundle.js"></script></body></html>`);

const nativeAdapters=`
import React from 'react';
import {View,Image} from 'react-native-web';
import picture from './assets/community-workouts.png';
import {galleryFriend,galleryFriendProfile,galleryFriendFeed} from './scripts/gallery-fixtures.mjs';
let previewNudged=false;
export const ImpactFeedbackStyle={Light:'light'};
export const impactAsync=async()=>{};
export const call=async(name,args)=>{
 if(name==='cs_friend_profile'&&args.peer===galleryFriend.id)return galleryFriendProfile(previewNudged);
 if(name==='cs_social'&&args.action==='nudge'&&args.payload.id===galleryFriend.id){previewNudged=true;return {...__CLASSSTREAK_FIXTURE__,friends:[{...galleryFriend,nudge_available:false}],feed:[galleryFriendFeed]};}
 return null;
};
export const readPhoto=async()=>null;
export const queuePhoto=async()=>true;
export const saveToPhotos=async()=>{};
export const sharePhoto=async()=>{};
export const captureRef=async()=>picture;
export const CameraView=React.forwardRef((p,r)=>{
 React.useImperativeHandle(r,()=>({takePictureAsync:async()=>({uri:picture})}));
 return <View style={[p.style,{backgroundColor:'#767767',overflow:'hidden'}]}><Image source={{uri:picture}} resizeMode="cover" style={{position:'absolute',width:'200%',height:'100%',left:0}}/></View>;
});
export const BlurView=({children,style})=><View style={style}>{children}</View>;
export const useCameraPermissions=()=>[{granted:true},async()=>({granted:true})];
export const launchImageLibraryAsync=async()=>({canceled:false,assets:[{uri:picture}]});
export const Accuracy={Balanced:3};
export const getForegroundPermissionsAsync=async()=>({granted:false});
export const requestForegroundPermissionsAsync=async()=>({granted:false});
export const requestBackgroundPermissionsAsync=async()=>({granted:false});
export const getCurrentPositionAsync=async()=>({coords:{latitude:0,longitude:0}});
export const enableNotifications=async()=>true;
export const scheduleReminders=async()=>{};
export const notificationResponse=()=>({remove(){}});
export default {open:async()=>{}};
`;
await build({
 entryPoints:['scripts/gallery.jsx'],outfile:'build/gallery/bundle.js',bundle:true,loader:{'.js':'jsx','.png':'file','.jpg':'file'},assetNames:'assets/[name]-[hash]',platform:'browser',minify:false,
 define:{global:'globalThis',__CLASSSTREAK_FIXTURE__:await readFile('build/gallery/fixture.json','utf8'),'process.env.NODE_ENV':'"development"','process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY':'"preview"'},
 alias:{'react-native':'react-native-web'},resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.jsx','.js','.json'],
 plugins:[{name:'preview-only-native-adapters',setup(b){
  b.onResolve({filter:/^\.\.\/db\/local$/},()=>({path:'preview-memory-store',namespace:'preview-store'}));
  b.onLoad({filter:/.*/,namespace:'preview-store'},()=>({loader:'js',contents:`const prefix='classstreak-preview:';export const read=async(key,fallback)=>{const raw=localStorage.getItem(prefix+key);return raw===null?fallback:JSON.parse(raw);};export const write=async(key,value)=>{localStorage.setItem(prefix+key,JSON.stringify(value));};export const transaction=async(fn)=>fn({});`}));
  b.onResolve({filter:/^(expo-haptics|expo-location|react-native-share|react-native-view-shot|expo-camera|expo-image-picker|expo-blur)$|^\.\/(api|photos|notifications)$/},args=>({path:args.path,namespace:'preview'}));
  b.onLoad({filter:/.*/,namespace:'preview'},()=>({loader:'jsx',resolveDir:process.cwd(),contents:nativeAdapters}));
 }}],
});
await writeFile('build/gallery/review.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClassStreak · Phone preview</title><style>body{margin:0;background:#242620;display:flex;justify-content:center;padding:22px}iframe{border:0;background:#F3F0E9;max-width:100%;border-radius:24px;box-shadow:0 15px 65px #0006}@media(max-width:500px){body{padding:0}iframe{border-radius:0;width:100vw;height:100dvh}}</style></head><body><iframe title="ClassStreak phone preview" width="390" height="844" src="./?page=home-empty"></iframe><script>const p=new URLSearchParams(location.search),f=document.querySelector('iframe');f.width=Math.max(320,Math.min(430,Number(p.get('width'))||390));f.height=Number(p.get('height'))||844;f.src='./?page='+encodeURIComponent(p.get('page')||'home-empty')+'&theme='+encodeURIComponent(p.get('theme')||'clay');</script></body></html>`);
console.log('Gallery uses actual app components and explicitly labeled disposable fixtures. Device, storage and notification actions stay in the preview.');
