import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractiveSqueezeModel } from '../app/web/sequence.mjs';

const center={x:.5,y:.5};
test('点按只推进一小段；松手后帧和破损停留原处',()=>{
  const m=new InteractiveSqueezeModel();
  assert.equal(m.sequenceFrame,0);
  assert.equal(m.press(center)[0].kind,'rind');
  assert.ok(m.sequenceFrame>0&&m.sequenceFrame<6);
  m.release();const frame=m.sequenceFrame,damage=m.damage;
  for(let i=0;i<600;i++)assert.deepEqual(m.step(1/60),[]);
  assert.equal(m.sequenceFrame,frame);assert.equal(m.damage,damage);
  m.press(center);assert.ok(m.sequenceFrame>frame);
});
test('两秒前的长按推进与刷新率无关，保留原碎壳声',()=>{
  const a=new InteractiveSqueezeModel(),b=new InteractiveSqueezeModel();
  a.press(center);b.press(center);const events=[];
  for(let i=0;i<90;i++)events.push(...a.step(1/60));
  for(let i=0;i<45;i++)b.step(1/30);
  assert.equal(a.sequenceFrame,b.sequenceFrame);
  assert.ok(a.damage>0&&a.damage<1);assert.equal(a.burstFired,false);
  assert.ok(events.length>=5);assert.ok(events.every(e=>e.kind==='rind'));
});
test('碎完停在末帧，拖动才拉伸；静止长按不循环碎裂声',()=>{
  const m=new InteractiveSqueezeModel();m.press(center);
  m.move({x:.8,y:.5});assert.deepEqual(m.pullTarget,{x:0,y:0});
  for(let i=0;i<600;i++)m.step(1/60);
  assert.equal(m.phase,'gel');assert.equal(m.sequenceFrame,m.sequenceCount-1);
  assert.equal(m.damage,1);assert.equal(m.shellRemaining,0);
  for(let i=0;i<60;i++)assert.deepEqual(m.step(1/60),[]);
  m.release();m.press(center);m.move({x:.8,y:.5});assert.ok(m.step(.14).some(e=>e.kind==='stretch'));
  assert.ok(m.pull.x>.1);m.release();
  for(let i=0;i<240;i++)m.step(1/60);
  assert.equal(m.sequenceFrame,m.sequenceCount-1);assert.equal(m.pull.x,0);
});
test('取消、重置和材质切换不会携带旧的按压进度',()=>{
  const m=new InteractiveSqueezeModel();m.press(center);m.step(.2);m.release();
  const frame=m.sequenceFrame;m.move({x:.9,y:.9});m.step(.1);assert.equal(m.sequenceFrame,frame);
  m.reset();assert.equal(m.sequenceFrame,0);assert.equal(m.held,false);assert.equal(m.phase,'shell');
  m.select('cookie');assert.equal(m.press(center)[0].kind,'crumb');
  m.select('lychee');assert.equal(m.sequenceFrame,0);assert.equal(m.phase,'shell');
});
test('非法时间不改变状态，重复按下不重复推进',()=>{
  const m=new InteractiveSqueezeModel();m.press(center);const frame=m.sequenceFrame;
  assert.deepEqual(m.press(center),[]);
  for(const dt of [NaN,Infinity,-1])assert.deepEqual(m.step(dt),[]);
  assert.equal(m.sequenceFrame,frame);
});
for(const material of ['peach','orange','mangosteen','egg-tart','cheese','mochi','daifuku'])test(`${material} 使用真实序列，松手停帧，碎完可揉拉并正确重置`,()=>{
  const m=new InteractiveSqueezeModel(material);assert.equal(m.sequenceMode,true);assert.equal(m.sequenceCount,80);
  assert.equal(m.press(center)[0].kind,'rind');m.step(.2);m.release();
  const frame=m.sequenceFrame;m.step(.2);assert.equal(m.sequenceFrame,frame);
  m.press(center);for(let i=0;i<60;i++)m.step(.1);
  assert.equal(m.phase,'gel');assert.equal(m.sequenceFrame,79);assert.equal(m.burstFired,true);
  assert.deepEqual(m.step(.2),[]);m.release();m.press(center);m.move({x:.85,y:.5});
  assert.ok(m.step(.14).some(e=>e.kind==='stretch'));assert.ok(m.pull.x>.1);
  assert.ok(m.release().some(e=>e.kind==='fold'));for(let i=0;i<200;i++)m.step(.05);
  assert.equal(m.pull.x,0);m.reset();assert.equal(m.sequenceFrame,0);assert.equal(m.damage,0);
});
