import test from 'node:test';
import assert from 'node:assert/strict';
import {burstShardTransform} from '../app/web/sequence-renderer.mjs';
test('壳片从原位向外飞，缩小淡出，结束后不留碎屑',()=>{
 for(const center of [[100,0],[-100,0],[0,95],[0,-95],[55,65]]){
  for(let i=0;i<3;i++){
   const start=burstShardTransform(center,i,0),flying=burstShardTransform(center,i,.2),end=burstShardTransform(center,i,.72);
   assert.ok(start.x===0&&start.y===0);assert.equal(start.alpha,1);assert.equal(start.scale,1);
   assert.ok(flying.x*center[0]+flying.y*center[1]>0);
   assert.ok(flying.alpha>0&&flying.scale<1);assert.equal(end.alpha,0);
   assert.ok(Object.values(end).every(Number.isFinite));assert.ok(Math.abs(end.x)<80&&Math.abs(end.y)<90);
  }
 }
});
