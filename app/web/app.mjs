import { SqueezeModel, TaskStatus, MATERIALS, nextMaterial, AVAILABLE_MATERIALS } from './model.mjs';
import { InteractiveSqueezeModel } from './sequence.mjs';
import { CompletionNotice, completionThreadURL } from './completion.mjs';
import { SoundEngine } from './audio.mjs';
import { ToyRenderer } from './renderer.mjs';
const $=id=>document.getElementById(id);
const desktop=Boolean(window.webkit?.messageHandlers?.host);
const diagnostics=new URLSearchParams(location.search).has('diagnostics');
const native=(type,payload={})=>window.webkit?.messageHandlers?.host?.postMessage({type,...payload});
const model=new InteractiveSqueezeModel(),sound=new SoundEngine(),task=new TaskStatus();
const renderer=new ToyRenderer($('surface'),model);
let rememberedCompletions=[];try{rememberedCompletions=JSON.parse(localStorage.getItem('seen-completions')||'[]');}catch{}
const notice=new CompletionNotice({seen:rememberedCompletions});
let heldAt=0;
let raf=0,last=0,activePointer=null,generation=0,maskAt=0,sessions=[];
let preferences={};try{preferences=JSON.parse(localStorage.getItem('preferences')||'{}')||{};}catch{}
let volume=Number.isFinite(preferences.volume)?Math.max(0,Math.min(1,preferences.volume)):.38;
let muted=Boolean(preferences.muted);
if(preferences.visualVersion===2&&AVAILABLE_MATERIALS.includes(preferences.material))model.select(preferences.material);
if(preferences.session)task.bind(preferences.session);
sound.configure(volume,muted);
const save=()=>localStorage.setItem('preferences',JSON.stringify({visualVersion:2,volume,muted,material:model.material,session:task.session}));
function nativeMask(){
  if(!window.webkit?.messageHandlers?.host)return;
  const rects=[];
  // 从实际绘制的 alpha 轮廓生成点击区，透明像素让给桌面。
  const d=window.devicePixelRatio||1,c=renderer.ctx;
  const data=c.getImageData(0,0,renderer.canvas.width,renderer.canvas.height).data,w=renderer.canvas.width;
  const surfaceRect=$('surface').getBoundingClientRect();
  for(let y=0;y<310;y+=6){let start=-1;
    for(let x=0;x<=360;x+=6){const alpha=x<360?data[(Math.floor((y+3)*d)*w+Math.min(w-1,Math.floor((x+3)*d)))*4+3]:0;
      if(alpha>70&&start<0)start=x;
      if(alpha<=70&&start>=0){rects.push({x:start+surfaceRect.x,y:y+surfaceRect.y,w:x-start,h:6});start=-1;}}
  }
  for(const el of [$('drag'),$('swap'),$('reset'),$('hide'),...($('completion-bubble').hidden?[]:[$('completion-bubble')])]){
    const r=el.getBoundingClientRect();rects.push({x:r.x,y:r.y,w:r.width,h:r.height});}
  native('mask',{rects});
}
function draw(dt=0){renderer.notice=notice.active?{age:notice.age}:null;renderer.draw(dt);if(diagnostics&&window.nienieSnapshot)$('surface').dataset.snapshot=JSON.stringify(window.nienieSnapshot());if(performance.now()-maskAt>90){maskAt=performance.now();nativeMask();}}
function animate(now){raf=0;const elapsed=last?Math.max(0,(now-last)/1000):.016,dt=Math.min(.05,elapsed);last=now;
  const completed=notice.step(elapsed,model.held||model.angerVisible);if(completed){
    generation++;model.reset();renderer.particles=[];renderer.lychee.reset();sound.stop();
    native('completion');
    sound.playCompletion(()=>notice.active===completed);
  }
  renderNotice();
  const events=model.step(dt,model.held?(now-heldAt)/1000:null);for(const e of events){renderer.emit(e);sound.play(e);}renderAnger();draw(dt);
  if(notice.active||notice.queue.length||model.angerVisible||model.held||model.burstActive||model.pressure>.001||model.squash>.001||model.shellMoving||Math.hypot(model.pull.x,model.pull.y)>.0001||renderer.lychee.shards.length||renderer.particles.length){if(!desktop)raf=requestAnimationFrame(animate);}else {last=0;nativeMask();if(desktop)native('animate',{value:false});}}
function wake(){if(desktop){native('animate',{value:true});}else if(!raf)raf=requestAnimationFrame(animate);}
window.hostFrame=animate;
function renderAnger(){
  const bubble=$('anger-bubble');bubble.hidden=!model.angerVisible;
  bubble.style.opacity=model.angerVisible?String(Math.min(1,(2.4-model.angerAge)/.4)):0;
}
function renderNotice(){
  $('completion-bubble').hidden=!notice.active;
  $('open-completion').disabled=!completionThreadURL(notice.active?.session);
  $('open-completion').title='点击进入对应 Codex 对话';
  $('completion-title').textContent=notice.active?.title||'';
  $('completion-queue').textContent=notice.queue.length?`还有 ${notice.queue.length} 个任务回复`:'';
}
function dismissNotice(clearQueue=false){notice.dismiss(clearQueue);renderNotice();draw();nativeMask();wake();}
$('dismiss-completion').addEventListener('click',()=>dismissNotice());
$('open-completion').addEventListener('click',()=>{
  const session=notice.active?.session,url=completionThreadURL(session);
  if(!url)return;
  if(desktop)native('open-thread',{session,turn:notice.active.turn});
  else window.location.href=url;
});
window.hostThreadOpened=({session,turn,opened})=>{
  // 系统接收跳转后才关闭原提醒；异步回调不能误关下一条提醒。
  if(notice.active?.session!==session||notice.active?.turn!==turn)return;
  if(opened)dismissNotice();
  else $('open-completion').title='暂时无法打开 Codex，点击重试';
};
window.receiveCompletions=data=>{
  const before=JSON.stringify(notice.seenKeys);notice.receive(data?.events);
  const after=JSON.stringify(notice.seenKeys);if(before!==after)localStorage.setItem('seen-completions',after);
  if(notice.queue.length)wake();
};
function choose(material){cancel();model.select(material);renderer.particles=[];renderer.lychee.reset();sound.stop();
  renderer.lychee.select(material).then(()=>{if(model.material===material){draw();nativeMask();}});
  renderAnger();$('swap').title=`换一下 · 下一个${MATERIALS[nextMaterial(material)].name}`;draw();nativeMask();save();}
function cancel(playRelease=false){generation++;const released=model.release();if(playRelease===true)for(const e of released)sound.play(e);renderer.hover=false;$('surface').classList.remove('pressing');
  if(activePointer!==null){try{$('surface').releasePointerCapture(activePointer);}catch{}activePointer=null;}
  native('capture',{value:false});wake();}
$('surface').addEventListener('pointerdown',async ev=>{
  if(ev.button!==0||activePointer!==null)return;
  const r=$('surface').getBoundingClientRect(),x=ev.clientX-r.x,y=ev.clientY-r.y;
  if((model.sequenceMode&&!renderer.lychee.loaded)||!renderer.hit(x,y))return;
  if(notice.active)dismissNotice();
  ev.preventDefault();activePointer=ev.pointerId;const current=++generation;
  $('surface').setPointerCapture(ev.pointerId);native('capture',{value:true});$('surface').classList.add('pressing');
  if(!model.held)heldAt=performance.now();
  const events=model.press(renderer.contact(x,y));for(const e of events)renderer.emit(e);draw();wake();
  try{await sound.unlock();if(generation===current)for(const e of events)sound.play(e);}catch{native('error',{message:'声音暂不可用，仍然可以捏'});}
});
// 为辅助功能和键盘提供同一套捏压逻辑；普通鼠标 click 不重复触发。
async function accessiblePress(){
  if(model.sequenceMode&&!renderer.lychee.loaded)return;
  if(notice.active)dismissNotice();
  if(!model.held)heldAt=performance.now();
  const current=++generation,events=model.press({x:.5,y:.5});
  for(const e of events)renderer.emit(e);draw();wake();
  try{await sound.unlock();if(generation===current)for(const e of events)sound.play(e);}catch{}
}
$('surface').addEventListener('click',ev=>{if(ev.detail===0){accessiblePress();setTimeout(()=>{model.release();wake();},130);}});
$('surface').addEventListener('keydown',ev=>{if((ev.key===' '||ev.key==='Enter')&&!ev.repeat){ev.preventDefault();accessiblePress();}});
$('surface').addEventListener('keyup',ev=>{if(ev.key===' '||ev.key==='Enter'){ev.preventDefault();model.release();wake();}});
$('surface').addEventListener('pointermove',ev=>{const r=$('surface').getBoundingClientRect(),x=ev.clientX-r.x,y=ev.clientY-r.y;renderer.hover=renderer.hit(x,y);if(model.held){model.move(renderer.contact(x,y));wake();}else if(model.squash===0&&Math.hypot(model.pull.x,model.pull.y)<.001)model.contact=renderer.contact(x,y);if(!raf)draw();});
$('surface').addEventListener('pointerleave',()=>{renderer.hover=false;if(!raf)draw();});
window.addEventListener('pointerup',()=>{if(activePointer!==null)cancel(true);});
window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
$('surface').addEventListener('lostpointercapture',()=>{if(activePointer!==null)cancel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();sound.stop();}});
$('swap').addEventListener('click',()=>{dismissNotice(true);choose(nextMaterial(model.material));});
$('reset').addEventListener('click',()=>{dismissNotice(true);choose(model.material);});
$('hide').addEventListener('click',()=>native('hide'));$('drag').addEventListener('pointerdown',ev=>{if(ev.button===0)native('drag');});
function replay(){
  const selected=sessions.find(s=>s.session===task.session);task.bind(task.session);
  if(selected){for(const e of selected.events)task.accept(e);
    if(Date.now()/1000-selected.updated>900)task.disconnect();}
}
window.receiveBridge=(data)=>{
  if(!Array.isArray(data.sessions))return;
  sessions=data.sessions;
  if(!task.session&&data.preferredSession&&sessions.some(s=>s.session===data.preferredSession))task.bind(data.preferredSession);
  replay();save();nativeMask();
};
window.hostRelease=cancel;
window.hostHide=()=>{dismissNotice(true);cancel();};
window.addEventListener('error',e=>native('error',{message:e.message}));
window.hostHover=()=>{};
// UI 验证只提供观察快照；合成事件必须通过正常 DOM 输入。
window.nienieSnapshot=()=>({material:model.material,coreOnly:model.coreOnly,angerAge:model.angerAge,angerVisible:model.angerVisible,angerPlays:sound.angerPlays||0,shardCount:renderer.lychee.shards.length,damage:model.damage,phase:model.phase,holdTime:model.holdTime,burstFired:model.burstFired,burstActive:model.burstActive,burstPlays:sound.burstPlays||0,shellRemaining:model.shellRemaining,lastSound:sound.lastKind||null,rindPlays:sound.rindPlays||0,squash:model.squash,restFlatten:model.restFlatten,attachedShell:model.broken.filter(i=>!model.detached.includes(i)).length,detachedShell:model.detached.length,shellMoving:model.shellMoving,pull:{...model.pull},sequenceFrame:model.sequenceFrame,sequenceCount:model.sequenceCount,assetsReady:renderer.lychee.loaded,pressure:model.pressure,held:model.held,fractures:model.fractures.length,particles:renderer.particles.length,audioState:sound.ctx?.state||'locked',task:task.value,completionPlays:sound.completionPlays,completionActive:!!notice.active,completionTitle:notice.active?.title||null,completionAge:notice.age,completionQueue:notice.queue.length,completionStartedAt:notice.startedAt,floatOffset:renderer.floatOffset||0,muted,volume,visibility:document.visibilityState,lastFrame:last});
choose(model.material);native('ready');
renderer.lychee.ready.then(()=>{draw();nativeMask();});
if(!window.webkit?.messageHandlers?.host)document.body.classList.add('preview');
