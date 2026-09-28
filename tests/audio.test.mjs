import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesize, SoundEngine } from '../app/web/audio.mjs';
import fs from 'node:fs';
const slimeAsset=JSON.parse(fs.readFileSync(new URL('../artifacts/slime-audio/samples.json',import.meta.url),'utf8'));
for(const kind of ['crack','crumb','soft','squish','dust','rind','gel','stretch','fold','burst'])test(`音频 ${kind} 有界、有尾音且不同采样不相同`,()=>{
  const a=synthesize(kind,44100,42,slimeAsset),b=synthesize(kind,44100,43,slimeAsset);
  assert.ok(a.length>4000&&a.length<44100);
  let energy=0,diff=0;
  for(let i=0;i<a.length;i++) {assert.ok(Number.isFinite(a[i])&&Math.abs(a[i])<=.9);energy+=a[i]*a[i];diff+=Math.abs(a[i]-b[i]);}
  assert.ok(energy>1);assert.ok(diff>1);assert.ok(Math.abs(a.at(-1))<.001);
});

test('软泥音来自所选实录片段，原采样率下逐样本一致，重采样保留时长',()=>{
  for(const kind of ['gel','stretch','fold'])for(let variant=0;variant<6;variant++){
    const pcm=Buffer.from(slimeAsset.clips[kind][variant],'base64');
    const a=synthesize(kind,slimeAsset.rate,variant,slimeAsset);
    assert.equal(a.length,pcm.length/2);
    for(let i=0;i<a.length;i++)assert.equal(a[i],pcm.readInt16LE(i*2)/32768);
    for(const rate of [22050,48000]){
      const b=synthesize(kind,rate,variant,slimeAsset);
      assert.equal(b.length,Math.floor(a.length*rate/slimeAsset.rate));
      assert.ok(Math.abs(b.at(-1))<.001);
    }
  }
});

test('软泥播放保留原音高，连续两次不使用同一片段',()=>{
  const s=new SoundEngine();
  s.ctx={state:'running',createBufferSource:()=>({playbackRate:{},connect(){},disconnect(){},start(){},stop(){}}),createStereoPanner:()=>({pan:{},connect(){},disconnect(){}})};
  s.buffers={gel:Array.from({length:6},(_,id)=>({id}))};s.master={};
  let previous;
  for(let i=0;i<12;i++){
    s.play({kind:'gel',x:.5});const current=[...s.voices].at(-1);
    assert.equal(current.playbackRate.value,1);assert.notEqual(current.buffer,previous);previous=current.buffer;
  }
});

test('完成提示是轻柔的短上扬音，起止归零且峰值低于碎裂声',()=>{
  const rate=44100,a=synthesize('completion',rate);
  assert.ok(a.length>=rate*.25&&a.length<=rate*.4);
  let peak=0,energy=0;
  for(const v of a){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));energy+=v*v;}
  assert.ok(peak>.04&&peak<.16);assert.ok(Math.sqrt(energy/a.length)<.07);
  assert.ok(Math.abs(a[0])<.001&&Math.abs(a.at(-1))<.001);
  const crossings=(start,end)=>{let n=0;for(let i=Math.floor(start*rate)+1;i<end*rate;i++)if(a[i-1]<=0&&a[i]>0)n++;return n;};
  assert.ok(crossings(.13,.18)>crossings(.01,.06));
});

test('完成音只播放一次，静音或恢复音频期间取消时不补响',async()=>{
  const s=new SoundEngine(),played=[];s.play=e=>played.push(e.kind);s.unlock=async()=>{};
  await s.playCompletion(()=>true);assert.deepEqual(played,['completion']);
  s.configure(.5,true);await s.playCompletion(()=>true);assert.equal(played.length,1);
  s.configure(.5,false);let resume;s.unlock=()=>new Promise(resolve=>{resume=resolve;});
  const pending=s.playCompletion(()=>true);s.stop();resume();await pending;assert.equal(played.length,1);
  s.unlock=async()=>{};await s.playCompletion(()=>false);assert.equal(played.length,1);
});

test('原创短哼在不同采样率下保持短促、低音量及平滑起止',()=>{
 const rms=x=>Math.sqrt(x.reduce((n,v)=>n+v*v,0)/x.length);
 for(const rate of [22050,44100,48000]){
  const a=synthesize('anger',rate,42);
  assert.ok(a.length>=rate*.3&&a.length<=rate*.6,'短哼应在 0.3–0.6 秒内结束，不盖住下一次互动');
  assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<.2));
  assert.ok(a.some(v=>Math.abs(v)>.05),'提示需要有可辨别的信号');
  assert.ok(rms(a)>.005&&rms(a)<.1);
  assert.ok(Math.abs(a[0])<.001);
  assert.ok(Math.abs(a.at(-1))<.001);
  assert.deepEqual(a,synthesize('anger',rate,43),'提示不随机变调或变换内容');
 }
});

test('生气短哼播放时停止残余碎裂声，静音时不播放',()=>{
 const s=new SoundEngine();let stopped=0,started=0;
 const old={stop(){stopped++;}};s.voices.add(old);
 s.ctx={state:'running',createBufferSource:()=>({playbackRate:{},connect(){},disconnect(){},start(){started++;}}),createStereoPanner:()=>({pan:{},connect(){},disconnect(){}})};
 s.buffers={anger:Array(6).fill({})};s.master={};
 s.muted=true;s.play({kind:'anger',x:.5});assert.equal(started,0);assert.equal(stopped,0);
 s.muted=false;s.play({kind:'anger',x:.5});
 assert.equal(stopped,1);assert.equal(started,1);assert.equal(s.voices.size,1);
 assert.equal([...s.voices][0].playbackRate.value,1);assert.equal(s.angerPlays,1);
});
