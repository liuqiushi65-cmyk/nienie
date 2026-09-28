import test from 'node:test';
import assert from 'node:assert/strict';
import {SqueezeModel} from '../app/web/model.mjs';

test('初次受压先开裂，壳片仍附着，没有立即飞片',()=>{
  const m=new SqueezeModel('lychee'),e=m.press({x:.4,y:.4})[0];
  assert.ok(e.pieces.length>0);assert.deepEqual(e.detached,[]);
  assert.equal(m.detached.length,0);
  for(const i of e.pieces){assert.ok(m.shellWear[i]>0&&m.shellWear[i]<.3);}
  m.step(.1);assert.ok(m.shellOpening.some(v=>v>0));
  assert.ok(Math.max(...m.shellOpening)<.3);
});
test('松手不继续损坏，裂缝留下；重置恢复完整壳',()=>{
  const m=new SqueezeModel('lychee');m.press({x:.4,y:.4});m.step(.25);m.release();
  const wear=[...m.shellWear],detached=[...m.detached];
  for(let i=0;i<200;i++)m.step(.02);
  assert.deepEqual(m.shellWear,wear);assert.deepEqual(m.detached,detached);
  assert.ok(m.shellOpening.some(v=>v>0));assert.equal(m.shellMoving,false);
  m.reset();assert.ok(m.shellWear.every(v=>v===0));assert.ok(m.shellOpening.every(v=>v===0));assert.deepEqual(m.detached,[]);
});
test('中途局部脱落，剩余碎壳仍附着于软泥',()=>{
  const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});
  for(let i=0;i<90;i++)m.step(.02);
  assert.ok(m.damage>0&&m.damage<1);
  assert.ok(m.detached.length>0);assert.ok(m.detached.length<m.broken.length);
  assert.equal(new Set(m.detached).size,m.detached.length);
  assert.ok(m.broken.some(i=>!m.detached.includes(i)&&m.shellWear[i]>.1));
});
