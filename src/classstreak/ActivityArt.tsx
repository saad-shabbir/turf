import React from 'react';
import {Image, View, type ViewStyle} from 'react-native';
import {activity} from './model';

const atlas=require('../../assets/exercise-atlas.png');
const artwork:Record<string,number>={reformer:0,mat:1,hot:2,barre:3,cycling:4,yoga:5,hiit:6,boxing:7,gym:8,climbing:9,run:10,cardio:10,other:11};
function artworkIndex(key:string) {
 if(key.startsWith('custom:')) {
  const name=key.slice(7).toLowerCase();
  if(/climb|boulder/.test(name))return 9;
  if(/run|walk|cardio|hike/.test(name))return 10;
  return 11;
 }
 return artwork[key]??11;
}

/** Locally bundled artwork, rendered from isolated cells without network requests. */
export function ActivityArt({activityKey,size=64,style}:{activityKey:string;size?:number;style?:ViewStyle}) {
 const index=artworkIndex(activityKey),column=index%4,row=Math.floor(index/4),scale=size/350;
 return <View accessible accessibilityLabel={activity(activityKey).label} style={[{width:size,height:size,alignItems:'center'},style]}>
  <View style={{width:296*scale,height:size,overflow:'hidden'}}><Image source={atlas} resizeMode="stretch" style={{position:'absolute',width:1280*scale,height:1280*scale,left:-(column*320+12)*scale,top:-[140,475,840][row]!*scale}}/></View>
 </View>;
}
