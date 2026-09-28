import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SqueezeModel, TaskStatus, MATERIALS, nextMaterial, AVAILABLE_MATERIALS } from '../app/web/model.mjs';
import { InteractiveSqueezeModel } from '../app/web/sequence.mjs';
import { CompletionNotice, completionThreadURL } from '../app/web/completion.mjs';

// 跑真实应用的事件绑定；只替代绘图、音频和系统跳转，不向系统发送测试链接。
function app(){
  const elements=new Map(),messages=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,width:360,height:310,hidden:false,style:{},dataset:{},handlers:{},
      classList:{add(){},remove(){}},getBoundingClientRect:()=>({x:0,y:0,width:360,height:310}),
      addEventListener(type,fn){this.handlers[type]=fn;}});
    return elements.get(id);
  };
  class SoundEngine{configure(){}stop(){}playCompletion(){}}
  class ToyRenderer{
    constructor(canvas){this.canvas=canvas;this.ctx={getImageData:()=>({data:new Uint8Array(360*310*4)})};this.particles=[];
      this.lychee={loaded:true,shards:[],reset(){},select:()=>Promise.resolve(true),ready:Promise.resolve(true)};}
    draw(){}
  }
  const window={webkit:{messageHandlers:{host:{postMessage:m=>messages.push(m)}}},addEventListener(){}};
  const context=vm.createContext({window,document:{getElementById:element,addEventListener(){},visibilityState:'visible'},
    localStorage:{getItem:()=>null,setItem(){}},location:{search:''},performance:{now:()=>100},URLSearchParams,
    SqueezeModel,TaskStatus,MATERIALS,nextMaterial,AVAILABLE_MATERIALS,InteractiveSqueezeModel,CompletionNotice,completionThreadURL,SoundEngine,ToyRenderer});
  const source=fs.readFileSync(new URL('../app/web/app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source,context);
  const session='01a0c7eb-8e5d-7822-84f4-b204ca59fb09';
  window.receiveCompletions({events:['1','2'].map(turn=>({type:'agent-turn-complete',session,turn,title:`任务 ${turn}`,at:Date.now()/1000}))});
  window.hostFrame(100);
  return {window,element,session,opens:()=>messages.filter(m=>m.type==='open-thread')};
}

test('提醒正文发送当前任务，失败保留提醒，成功关闭；旧回调不能关闭同任务下一轮',()=>{
  const a=app();
  a.element('open-completion').handlers.click();
  assert.equal(a.opens().length,1);const request=a.opens()[0];
  assert.equal(request.session,a.session);assert.equal(request.turn,'1');
  a.window.hostThreadOpened({...request,opened:false});
  assert.equal(a.element('completion-bubble').hidden,false);
  a.window.hostThreadOpened({...request,opened:true});
  assert.equal(a.element('completion-bubble').hidden,true);
  a.window.hostFrame(120);assert.equal(a.element('completion-title').textContent,'任务 2');
  a.window.hostThreadOpened({...request,opened:true});
  assert.equal(a.element('completion-bubble').hidden,false);
  a.element('open-completion').handlers.click();assert.equal(a.opens()[1].turn,'2');
});

test('关闭按钮只关闭当前提醒，不发送跳转；下一条仍可显示',()=>{
  const a=app();a.element('dismiss-completion').handlers.click();
  assert.equal(a.opens().length,0);assert.equal(a.element('completion-bubble').hidden,true);
  a.window.hostFrame(120);assert.equal(a.element('completion-title').textContent,'任务 2');
});
