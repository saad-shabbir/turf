import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolve}=require('metro-resolver');
const context={
 originModulePath:path.resolve('src/classstreak/workoutLiveActivity.ts'),
 sourceExts:['js','jsx','json','ts','tsx'],assetExts:new Set(),preferNativePlatform:true,
 redirectModulePath:p=>p,getPackageForModule:()=>null,
 fileSystemLookup:p=>existsSync(p)?{exists:true,type:statSync(p).isDirectory()?'d':'f',realPath:p}:{exists:false},
};
test('Metro selects the iPhone Live Activity adapter, with safe fallback elsewhere',()=>{
 assert.equal(resolve(context,'./workoutLiveActivityNative','ios').filePath,path.resolve('src/classstreak/workoutLiveActivityNative.ios.ts'));
 assert.equal(resolve(context,'./workoutLiveActivityNative','android').filePath,path.resolve('src/classstreak/workoutLiveActivityNative.ts'));
});
