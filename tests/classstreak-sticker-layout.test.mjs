import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitSticker} from '../src/classstreak/sticker-layout.ts';

test('Dragging a scaled sticker clamps all four edges to the exported photo canvas',()=>{
 const canvas={width:390,height:577},size={width:310,height:210};
 assert.deepEqual(fitSticker({x:-80,y:-20,scale:.72},canvas,size),{x:0,y:0,scale:.72});
 const bottom=fitSticker({x:800,y:900,scale:.72},canvas,size);
 assert.ok(Math.abs(bottom.x+size.width*bottom.scale-canvas.width)<1e-9);
 assert.ok(Math.abs(bottom.y+size.height*bottom.scale-canvas.height)<1e-9);
});
test('Pinch limits keep stickers legible normally but shrink further when the canvas requires it',()=>{
 const size={width:310,height:210};
 assert.equal(fitSticker({x:0,y:0,scale:.01},{width:390,height:577},size).scale,.35);
 assert.equal(fitSticker({x:0,y:0,scale:20},{width:390,height:577},size).scale,1.15);
 const small=fitSticker({x:90,y:90,scale:1},{width:100,height:80},size);
 assert.ok(small.scale<.35);assert.ok(small.x+size.width*small.scale<=100);assert.ok(small.y+size.height*small.scale<=80);
});
test('Changing canvas orientation or sticker design height keeps the full sticker in frame',()=>{
 for(const canvas of [{width:320,height:330},{width:430,height:636},{width:844,height:330}])for(const size of [{width:280,height:160},{width:310,height:280}])for(const scale of [.35,.72,1,1.15]){
  const result=fitSticker({x:300,y:600,scale},canvas,size);assert.ok(result.x>=0&&result.y>=0);
  assert.ok(result.x+size.width*result.scale<=canvas.width+1e-9);assert.ok(result.y+size.height*result.scale<=canvas.height+1e-9);
 }
});
test('Degenerate measurements or touch values never produce NaN, negative scales or invisible off-canvas positions',()=>{
 for(const canvas of [{width:0,height:0},{width:NaN,height:-1},{width:390,height:577}]){
  const value=fitSticker({x:NaN,y:Infinity,scale:NaN},canvas,{width:0,height:Infinity});
  assert.ok(Object.values(value).every(Number.isFinite));assert.ok(value.scale>=0&&value.x>=0&&value.y>=0);
 }
});
