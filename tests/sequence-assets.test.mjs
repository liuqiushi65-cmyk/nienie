import test from 'node:test';
import assert from 'node:assert/strict';
import { SequenceLycheeRenderer } from '../app/web/sequence-renderer.mjs';

test('图集按需加载；切换后旧加载不能覆盖新物体，加载失败明确报告',async()=>{
  const oldDocument=globalThis.document,oldImage=globalThis.Image,images=[];
  globalThis.document={createElement:()=>({width:0,height:0})};
  globalThis.Image=class{constructor(){images.push(this);}set src(value){this.source=value;}};
  try{
    const atlas={size:448,count:80,pages:['a','b','c','d','e'],core:'core'};
    const r=new SequenceLycheeRenderer('lychee',{lychee:atlas,peach:atlas,orange:atlas});
    const old=r.ready;assert.equal(images.length,6);assert.equal(r.loaded,false);
    const peach=r.select('peach');assert.equal(images.length,12);
    images.slice(0,6).forEach(i=>i.onload());await old;assert.equal(r.loaded,false);assert.equal(r.material,'peach');
    images.slice(6).forEach(i=>i.onload());assert.equal(await peach,true);assert.equal(r.loaded,true);
    await r.select('peach');assert.equal(images.length,12);
    const orange=r.select('orange');images.slice(12).forEach((i,n)=>n===5?i.onerror():i.onload());
    assert.equal(await orange,false);assert.equal(r.failed,true);assert.equal(r.loaded,false);
    await r.select('cookie');assert.equal(r.pages.length,0);assert.equal(r.failed,false);
  }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
