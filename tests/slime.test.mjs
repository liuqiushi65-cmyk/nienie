import test from 'node:test';
import assert from 'node:assert/strict';
import {SqueezeModel} from '../app/web/model.mjs';
import {gelPoint} from '../app/web/lychee.mjs';
const size=m=>({width:gelPoint(110,0,m)[0]-gelPoint(-110,0,m)[0],height:gelPoint(0,110,m)[1]-gelPoint(0,-110,m)[1]});
const slime=()=>{const m=new SqueezeModel('lychee');m.press({x:.5,y:.5});for(let i=0;i<200;i++)m.step(.02);m.release();m.step(4);return m;};

test('短点按当帧压扁至少四分之一并向两侧摊开',()=>{
  const m=slime(),before=size(m);m.press({x:.5,y:.5});const after=size(m);
  assert.ok(after.height<before.height*.75,JSON.stringify({before,after}));
  assert.ok(after.width>before.width*1.1);
});
test('长按压成宽片；松手有缓慢回拢且保留揉压形状',()=>{
  const m=slime(),before=size(m);m.press({x:.5,y:.5});m.step(.6);
  const held=size(m);assert.ok(held.height<before.height*.55);assert.ok(held.width>before.width*1.2);
  m.release();m.step(.1);const early=size(m);assert.ok(early.height<before.height*.85);
  m.step(5);assert.ok(size(m).height>held.height);assert.ok(m.restFlatten>0);assert.equal(m.squash,0);
  assert.equal(m.damage,1);m.reset();assert.equal(m.restFlatten,0);assert.equal(m.squash,0);
});
test('反复揉压不会越摊越大，极端拖拽的网格保持在窗口内',()=>{
  const m=slime();for(let i=0;i<100;i++){m.press({x:.8,y:.2});m.step(.15);m.release();m.step(.1);}
  assert.ok(m.restFlatten<=.2);
  m.press({x:.8,y:.2});m.move({x:100,y:-100});m.step(.5);
  for(let x=-125;x<=125;x+=10)for(let y=-125;y<=125;y+=10){const [px,py]=gelPoint(x,y,m);assert.ok(Number.isFinite(px)&&Number.isFinite(py));assert.ok(Math.abs(px)<177&&py>-147&&py<136);}
});
test('慢回拢只作用于史莱姆，不改变猫爪和草莓的回弹规则',()=>{
  for(const kind of ['paw','strawberry']){const m=new SqueezeModel(kind);m.press({x:.5,y:.5});m.step(.2);m.release();m.step(1);assert.ok(m.pressure<.001);assert.equal(m.squash,0);assert.equal(m.restFlatten,0);}
});
