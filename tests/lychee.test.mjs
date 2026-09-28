import test from 'node:test';
import assert from 'node:assert/strict';
import { SqueezeModel } from '../app/web/model.mjs';

test('荔枝从受力处逐步破壳，全部开裂仍保留脆裂反馈',()=>{
  const m=new SqueezeModel('lychee');
  const first=m.press({x:.3,y:.4})[0];
  assert.equal(first.kind,'rind'); assert.ok(first.pieces.length>0);
  assert.ok(m.damage>0&&m.damage<.2);
  for(let i=0;i<12;i++){m.step(.14);m.release();m.press({x:.3,y:.4});}
  assert.equal(m.damage,1);assert.equal(m.phase,'breaking');assert.ok(m.shellRemaining>0);
  m.release();assert.equal(m.press({x:.5,y:.5})[0].kind,'rind');
  assert.equal(m.damage,1);
});
test('全部壳碎完后静止长按不自动播放揉拉声，移动才产生拉伸声',()=>{
  const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});
  for(let i=0;i<1000;i++)m.step(.02);
  assert.equal(m.shellRemaining,0);
  assert.deepEqual(m.step(.2),[]);
  m.move({x:.8,y:.5});
  assert.ok(m.step(.15).some(e=>e.kind==='stretch'));
  assert.deepEqual(m.step(.2),[]);
});
test('拖拽有限幅，松手回缩但不修复外壳；取消后移动无效',()=>{
  const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});
  for(let i=0;i<200;i++)m.step(.02);
  m.move({x:99,y:-99});m.step(.2);
  assert.ok(Math.hypot(m.pull.x,m.pull.y)<=.37);
  assert.ok(Math.hypot(m.pull.x,m.pull.y)>.1);
  m.release();m.move({x:0,y:0});
  for(let i=0;i<100;i++)m.step(.02);
  assert.ok(Math.hypot(m.pull.x,m.pull.y)<.001);assert.equal(m.damage,1);
  m.reset();assert.equal(m.phase,'shell');assert.deepEqual(m.broken,[]);
});

test('相同受力时分帧不会改变破壳顺序，首裂跟随点击侧',()=>{
  const a=new SqueezeModel('lychee'),b=new SqueezeModel('lychee');
  a.press({x:.2,y:.5});b.press({x:.2,y:.5});
  for(let i=0;i<120;i++)a.step(.01);
  for(let i=0;i<24;i++)b.step(.05);
  assert.deepEqual(a.broken,b.broken);
  const right=new SqueezeModel('lychee');right.press({x:.8,y:.5});
  assert.ok(!right.broken.some(i=>a.fractures[0].pieces.includes(i)));
});
