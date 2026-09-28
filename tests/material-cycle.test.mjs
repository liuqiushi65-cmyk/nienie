import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMaterial, AVAILABLE_MATERIALS } from '../app/web/model.mjs';
import { InteractiveSqueezeModel } from '../app/web/sequence.mjs';

test('换一下依次切换八种捏捏并回到荔枝；重置不换种类',()=>{
  const model=new InteractiveSqueezeModel();
  for(const expected of ['peach','orange','mangosteen','egg-tart','cheese','mochi','daifuku','lychee']){
    model.press({x:.5,y:.5});model.select(nextMaterial(model.material));
    assert.equal(model.material,expected);assert.equal(model.damage,0);assert.equal(model.held,false);
    model.press({x:.5,y:.5});model.reset();
    assert.equal(model.material,expected);assert.equal(model.damage,0);
  }
  assert.equal(model.sequenceFrame,0);
  assert.equal(nextMaterial('未知物体'),'lychee');
});

test('可选列表包含四种水果和四种点心，旧物体不再进入循环',()=>{
  assert.deepEqual(AVAILABLE_MATERIALS,['lychee','peach','orange','mangosteen','egg-tart','cheese','mochi','daifuku']);
  for(const removed of ['paw','strawberry','cookie']){
    assert.equal(AVAILABLE_MATERIALS.includes(removed),false);
    assert.equal(nextMaterial(removed),'lychee');
  }
});
