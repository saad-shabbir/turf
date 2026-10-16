import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolve}=require('metro-resolver');
const {getDefaultConfig}=require('expo/metro-config');
// Expo's own order lists ts before tsx, and Metro tries every platform for one extension
// before moving to the next, so a generic .ts file shadows a .ios.tsx file.
const {sourceExts}=getDefaultConfig(process.cwd()).resolver;
const context={
 originModulePath:path.resolve('src/classstreak/App.tsx'),
 sourceExts,assetExts:new Set(),preferNativePlatform:true,
 redirectModulePath:p=>p,getPackageForModule:()=>null,
 fileSystemLookup:p=>existsSync(p)?{exists:true,type:statSync(p).isDirectory()?'d':'f',realPath:p}:{exists:false},
};
test('Metro selects the iPhone Live Activity adapter, with safe fallback elsewhere',()=>{
 assert.equal(resolve(context,'./workoutLiveActivityNative','ios').filePath,path.resolve('src/classstreak/workoutLiveActivityNative.ios.ts'));
 assert.equal(resolve(context,'./workoutLiveActivityNative','android').filePath,path.resolve('src/classstreak/workoutLiveActivityNative.ts'));
});
test('Metro selects the iPhone home screen widget, with the no-op stub elsewhere',()=>{
 assert.equal(resolve(context,'./widgets','ios').filePath,path.resolve('src/classstreak/widgets.ios.tsx'));
 assert.equal(resolve(context,'./widgets','web').filePath,path.resolve('src/classstreak/widgets.tsx'));
});
test('Widget, Live Activity and invite links open the app root; the auth redirect keeps its route',async()=>{
 const {redirectSystemPath}=await import('../app/+native-intent.ts');
 for(const url of ['turf://home','turf://active-workout','turf://j/ABCDEF123456','https://classstreak.app/s/00000000-0000-0000-0000-000000000000'])assert.equal(redirectSystemPath({path:url,initial:true}),'/');
 for(const url of ['turf://account?code=abc','turf://account#type=recovery','turf://'])assert.equal(redirectSystemPath({path:url,initial:false}),url);
});
