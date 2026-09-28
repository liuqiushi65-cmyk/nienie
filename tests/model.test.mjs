import test from 'node:test';
import assert from 'node:assert/strict';
import { SqueezeModel, TaskStatus } from '../app/web/model.mjs';

test('点按产生局部破裂，松手不修复外壳', () => {
  const m = new SqueezeModel('strawberry');
  const events = m.press({x: .3, y: .5});
  assert.equal(events[0].kind, 'crack');
  assert.equal(events[0].x, .3);
  assert.ok(m.damage > 0);
  const damage = m.damage;
  m.release(); m.step(1);
  assert.equal(m.damage, damage);
  assert.equal(m.held, false);
  assert.ok(m.pressure < .01);
});

test('按住累积破裂，完整破壳后只揉软芯', () => {
  const m = new SqueezeModel('strawberry');
  const events = [...m.press({x: .5, y: .5})];
  for(let i=0;i<200;i++) events.push(...m.step(.016));
  assert.equal(m.damage, 1);
  assert.ok(events.filter(e=>e.kind==='crack').length > 2);
  m.release();
  assert.equal(m.press({x: .5,y: .5})[0].kind, 'squish');
  assert.equal(m.damage, 1);
});

test('取消及丢失焦点后不继续碎裂', () => {
  const m = new SqueezeModel('cookie');
  m.press({x:.4,y:.4}); m.release();
  const d=m.damage;
  for(let i=0;i<100;i++) assert.deepEqual(m.step(.02), []);
  assert.equal(m.damage,d);
});

test('猫爪不永久碎裂，曲奇只产生酥碎事件', () => {
  const paw = new SqueezeModel('paw');
  assert.equal(paw.press({x:.4,y:.6})[0].kind,'soft');
  for(let i=0;i<100;i++) paw.step(.02);
  assert.equal(paw.damage,0);
  paw.release(); paw.step(1);
  assert.ok(paw.pressure<.01);
  const cookie = new SqueezeModel('cookie');
  assert.equal(cookie.press({x:.5,y:.5})[0].kind,'crumb');
});

test('重置及切换清除受力与破裂，不串物体', () => {
  const m = new SqueezeModel('strawberry');
  m.press({x:.4,y:.4}); m.select('cookie');
  assert.equal(m.material,'cookie'); assert.equal(m.damage,0);
  assert.equal(m.held,false); assert.equal(m.pressure,0);
  assert.deepEqual(m.fractures,[]);
  m.press({x:.5,y:.5}); m.reset();
  assert.equal(m.damage,0); assert.deepEqual(m.fractures,[]);
});

test('帧间隔不改变长按破壳速度', () => {
  const a=new SqueezeModel('strawberry'), b=new SqueezeModel('strawberry');
  a.press({x:.5,y:.5});b.press({x:.5,y:.5});
  for(let i=0;i<100;i++) a.step(.01);
  for(let i=0;i<20;i++) b.step(.05);
  assert.equal(a.damage,b.damage);
  assert.equal(a.fractures.length,b.fractures.length);
});

test('任务绑定隔离、旧轮次与重复事件不覆盖当前状态', () => {
  const s=new TaskStatus();
  assert.equal(s.value,'disconnected');
  s.bind('A');
  assert.equal(s.accept({session:'B',turn:'1',event:'UserPromptSubmit',seq:1}),false);
  s.accept({session:'A',turn:'1',event:'UserPromptSubmit',seq:2});
  assert.equal(s.value,'working');
  s.accept({session:'A',turn:'1',event:'PermissionRequest',seq:3});
  assert.equal(s.value,'attention');
  s.accept({session:'A',turn:'1',event:'PostToolUse',seq:4});
  assert.equal(s.value,'working');
  s.accept({session:'A',turn:'2',event:'UserPromptSubmit',seq:5});
  assert.equal(s.accept({session:'A',turn:'1',event:'Stop',seq:6}),false);
  assert.equal(s.value,'working');
  s.accept({session:'A',turn:'2',event:'Stop',seq:7});
  assert.equal(s.value,'ready');
  assert.equal(s.accept({session:'A',turn:'2',event:'Stop',seq:7}),false);
  assert.equal(s.accept({session:'A',turn:'2',event:'PostToolUse',seq:8}),false);
  assert.equal(s.value,'ready');
});

test('中断与状态过期不能伪装成成功', () => {
  const s=new TaskStatus();s.bind('A');
  s.accept({session:'A',turn:'1',event:'UserPromptSubmit',seq:1});
  s.accept({session:'A',turn:'1',event:'Interrupt',seq:2});
  assert.equal(s.value,'interrupted');
  s.disconnect(); assert.equal(s.value,'disconnected');
});
