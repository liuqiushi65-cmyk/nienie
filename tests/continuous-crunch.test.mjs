import test from 'node:test';
import assert from 'node:assert/strict';
import {SqueezeModel} from '../app/web/model.mjs';

test('分段长按到全壳开裂后，残壳仍继续破碎并发出脆裂事件',()=>{
  const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});
  for(let round=0;round<3;round++){for(let i=0;i<60;i++)m.step(.02);m.release();m.press({x:.5,y:.5});}
  assert.equal(m.damage,1);assert.ok(m.shellRemaining>0);assert.equal(m.phase,'breaking');
  const before=m.shellRemaining,events=[];
  for(let i=0;i<100;i++)events.push(...m.step(.02));
  assert.ok(m.shellRemaining<before);assert.ok(events.filter(e=>e.kind==='rind').length>=5);
});
test('持续长按通过压爆清空残壳，结束后才切换软泥',()=>{
  const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});let last;
  for(let i=0;i<1000;i++){
    const remaining=m.shellRemaining,events=m.step(.02);
    if(remaining>0&&events.length){assert.ok(events.every(e=>e.silent||['rind','burst'].includes(e.kind)));for(const e of events)if(!e.silent)last=e;}
  }
  assert.equal(m.shellRemaining,0);assert.equal(m.detached.length,m.shellWear.length);
  assert.equal(m.phase,'gel');assert.equal(last.kind,'burst');assert.deepEqual(m.step(.25),[]);
  m.release();assert.equal(m.press({x:.5,y:.5})[0].kind,'gel');
});
test('反复点按不会卡在残壳上；松手不再产生新的脆裂事件',()=>{
  const m=new SqueezeModel('lychee');
  for(let i=0;i<100;i++){
    const remaining=m.shellRemaining,event=m.press({x:.4,y:.6})[0];
    if(remaining>0)assert.equal(event.kind,'rind');
    m.step(.1);m.release();assert.deepEqual(m.step(.15),[]);
  }
  assert.equal(m.shellRemaining,0);
});
