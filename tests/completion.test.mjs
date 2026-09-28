import test from 'node:test';
import assert from 'node:assert/strict';
import { CompletionNotice, completionThreadURL } from '../app/web/completion.mjs';

const done=(turn='1',extra={})=>({type:'agent-turn-complete',session:'task-a',turn,title:'修复登录',at:1001,...extra});
test('提醒跳转只接受任务 UUID，拒绝外部地址及路径注入',()=>{
  const id='01a0c7eb-8e5d-7822-84f4-b204ca59fb09';
  assert.equal(completionThreadURL(id),`codex://threads/${id}`);
  for(const invalid of [null,undefined,{},'',`https://example.com`,`${id}?q=hello`,`${id}/../new`,`${id}\n`])assert.equal(completionThreadURL(invalid),null);
});
test('跳转目标跟随当前提醒，不能提前打开队列中的下一个任务',()=>{
  const a='01a0c7eb-8e5d-7822-84f4-b204ca59fb09',b='01a0c888-1111-7222-8333-123456789abc';
  const n=new CompletionNotice({startedAt:1000});
  n.receive([done('1',{session:a}),done('2',{session:b})],1002);n.step(0,false);
  assert.equal(completionThreadURL(n.active.session),`codex://threads/${a}`);
  n.dismiss();assert.equal(completionThreadURL(n.active?.session),null);
  n.step(0,false);assert.equal(completionThreadURL(n.active.session),`codex://threads/${b}`);
});
test('真实完成事件只提醒一次，历史、重复和其他事件不触发',()=>{
  const n=new CompletionNotice({startedAt:1000});
  n.receive([done('old',{at:999}),done('approval',{type:'approval-requested'}),done(),done()],1002);
  assert.equal(n.step(.01,false)?.title,'修复登录');assert.equal(n.active.turn,'1');
  n.dismiss();n.receive([done()],1003);assert.equal(n.step(.01,false),null);
  assert.equal(n.active,null);
});
test('多个任务逐条显示；正在捏压时排队，不打断当前动作',()=>{
  const n=new CompletionNotice({startedAt:1000});
  n.receive([done(),done('2',{session:'task-b',title:'生成视频'})],1002);
  assert.equal(n.step(.1,true),null);assert.equal(n.active,null);
  assert.equal(n.step(.1,false)?.session,'task-a');
  n.step(12,false);assert.equal(n.active.session,'task-b');
  n.dismiss();assert.equal(n.active,null);assert.equal(n.step(.1,false),null);
});
test('过期事件和已处理事件跨重启不重复提醒，非法数据忽略',()=>{
  const n=new CompletionNotice({startedAt:1000,seen:[JSON.stringify(['task-a','1'])]});
  n.receive([done(),done('2',{at:1001}),done('3',{at:NaN}),done('4',{session:''}),null],2000);
  assert.equal(n.step(.1,false),null);
  const restored=new CompletionNotice({startedAt:2000,seen:n.seenKeys});
  restored.receive([done('2',{at:2001})],2002);assert.equal(restored.step(.1,false),null);
});
test('提醒持续有限时间；标题按纯文本保留，不解释为 HTML',()=>{
  const n=new CompletionNotice({startedAt:1000});
  n.receive([done('1',{title:'<img src=x onerror=alert(1)>'})],1002);
  n.step(0,false);assert.equal(n.active.title,'<img src=x onerror=alert(1)>');
  n.step(11,false);assert.ok(n.active);n.step(1,false);assert.equal(n.active,null);
});
