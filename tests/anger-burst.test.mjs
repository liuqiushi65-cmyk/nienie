import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractiveSqueezeModel } from '../app/web/sequence.mjs';
const center={x:.5,y:.5};
const advance=(m,t,dt=.01)=>{const events=[];for(let age=0;age<t-1e-8;age+=dt)events.push(...m.step(Math.min(dt,t-age)));return events;};
for(const fruit of ['lychee','peach','orange','mangosteen','egg-tart','cheese','mochi','daifuku'])test(`${fruit} 连续两秒只炸一次，留下无壳软芯，松手后仍完成飞散`,()=>{
 const m=new InteractiveSqueezeModel(fruit);m.press(center);
 assert.ok(!advance(m,1.99).some(e=>e.kind==='anger'));assert.equal(m.coreOnly,false);
 assert.equal(advance(m,.01).filter(e=>e.kind==='anger').length,1);
 assert.equal(m.coreOnly,true);assert.equal(m.phase,'gel');assert.equal(m.shellRemaining,0);
 assert.equal(m.burstActive,true);assert.equal(m.angerVisible,true);
 m.release();advance(m,.8);assert.equal(m.burstActive,false);assert.equal(m.angerVisible,true);
 advance(m,1.7);assert.equal(m.angerVisible,false);assert.equal(m.coreOnly,true);
 m.press(center);assert.ok(!advance(m,3).some(e=>e.kind==='anger'));
 m.move({x:.8,y:.5});advance(m,.15);assert.ok(m.pull.x>.1);
 m.release();m.reset();assert.equal(m.coreOnly,false);assert.equal(m.angerVisible,false);
});
test('短按不能累计为爆炸；原末帧上的残壳仍能长按炸掉',()=>{
 const m=new InteractiveSqueezeModel();
 for(let i=0;i<7;i++){m.press(center);assert.ok(!advance(m,.6).some(e=>e.kind==='anger'));m.release();}
 assert.equal(m.coreOnly,false);assert.equal(m.phase,'gel');
 m.press(center);assert.equal(advance(m,2).filter(e=>e.kind==='anger').length,1);
});
test('两秒阈值采用实际连续按住时间，切换与重置清除气泡和蓄力',()=>{
 const m=new InteractiveSqueezeModel();m.press(center);
 assert.deepEqual(m.step(.016,1.999).filter(e=>e.kind==='anger'),[]);
 assert.equal(m.step(.016,2).filter(e=>e.kind==='anger').length,1);
 m.select('peach');assert.equal(m.coreOnly,false);assert.equal(m.angerVisible,false);assert.equal(m.burstActive,false);
 m.press(center);advance(m,1.9);m.release();m.press(center);advance(m,.2);assert.equal(m.coreOnly,false);
});

test('起爆的同一次按压移动鼠标不会拖歪软芯，松手后不残留拉伸目标',()=>{
 const m=new InteractiveSqueezeModel();m.press(center);advance(m,2);m.move({x:.9,y:.8});
 assert.deepEqual(m.pullTarget,{x:0,y:0});m.release();advance(m,3);
 assert.deepEqual(m.pull,{x:0,y:0});assert.deepEqual(m.pullTarget,{x:0,y:0});
});
