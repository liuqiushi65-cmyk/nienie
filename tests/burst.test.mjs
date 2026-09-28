import test from 'node:test';
import assert from 'node:assert/strict';
import {SqueezeModel} from '../app/web/model.mjs';
const advance=(m,seconds,dt=.01)=>{const events=[];for(let t=0;t<seconds-1e-8;t+=dt)events.push(...m.step(Math.min(dt,seconds-t)));return events;};

test('连续长按满 2.5 秒才触发一次压爆，250 毫秒内清空残壳',()=>{
 const m=new SqueezeModel('lychee');m.press({x:.4,y:.5});
 assert.ok(!advance(m,2.49).some(e=>e.kind==='burst'));assert.ok(m.shellRemaining>0);
 const start=advance(m,.01);assert.equal(start.filter(e=>e.kind==='burst').length,1);
 assert.ok(m.shellRemaining>0,'壳必须经历连锁碎裂，不能同帧消失');
 const chain=advance(m,.25);assert.equal(m.shellRemaining,0);assert.ok(chain.some(e=>e.detached?.length));
 assert.ok(!advance(m,4).some(e=>e.kind==='burst'));assert.equal(m.burstActive,false);
 m.release();assert.equal(m.press({x:.5,y:.5})[0].kind,'gel');assert.ok(!advance(m,3).some(e=>e.kind==='burst'));
});
test('松手取消蓄力但保留裂纹，多次短按不能累计为压爆',()=>{
 const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});advance(m,1.8);const damage=m.damage;m.release();
 assert.equal(m.holdTime,0);advance(m,1);assert.equal(m.damage,damage);assert.equal(m.burstFired,false);
 m.press({x:.5,y:.5});assert.ok(!advance(m,1).some(e=>e.kind==='burst'));m.release();
 m.reset();const events=[];for(let i=0;i<18;i++){events.push(...m.press({x:.5,y:.5}),...advance(m,.12));m.release();advance(m,.05);}
 assert.ok(!events.some(e=>e.kind==='burst'));
});
test('临界阶段脆裂节奏加密，重置和换物清除压爆及尾动画',()=>{
 const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});
 const early=advance(m,1).filter(e=>e.kind==='rind').length;advance(m,.5);
 const late=advance(m,.99).filter(e=>e.kind==='rind').length;assert.ok(late>early);
 advance(m,.04);assert.equal(m.burstFired,true);m.select('paw');assert.equal(m.burstActive,false);assert.equal(m.burstFired,false);assert.equal(m.holdTime,0);
 m.press({x:.5,y:.5});assert.ok(!advance(m,3).some(e=>e.kind==='burst'));
});
test('压爆触发时间不随常见帧间隔变化，触发后松手也能完成已开始的破裂',()=>{
 for(const dt of [.01,.025,.05,.125]){
  const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});const events=advance(m,2.5,dt);
  assert.equal(events.filter(e=>e.kind==='burst').length,1);m.release();advance(m,.25,dt);assert.equal(m.shellRemaining,0);
 }
});

test('渲染短暂停顿不会把实际长按阈值向后拖延',()=>{
 const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});
 assert.ok(!m.step(.016,2.49).some(e=>e.kind==='burst'));
 assert.equal(m.step(.016,2.5).filter(e=>e.kind==='burst').length,1);
});
