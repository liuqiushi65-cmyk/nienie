// 复用应用状态机与软泥音效补拍交互演示，不伪造新的 Codex 回复。
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {InteractiveSqueezeModel} from '../app/web/sequence.mjs';
import {SequenceLycheeRenderer} from '../app/web/sequence-renderer.mjs';
import {synthesize} from '../app/web/audio.mjs';
const require=createRequire('/Users/lexie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const OUT='artifacts/xiaohongshu/slime-tail',FPS=30,SR=48000,DURATION=6;
fs.mkdirSync(OUT,{recursive:true});
globalThis.document={createElement:()=>createCanvas(1,1)};
const backgrounds=await Promise.all([0,1,2,3].map(i=>loadImage(`${OUT}/background-${i}.png`))),core=await loadImage('artifacts/anger-burst/cheese-core.png');
const slime=JSON.parse(fs.readFileSync('artifacts/slime-audio/samples.json'));
const canvas=createCanvas(1080,1920),c=canvas.getContext('2d');
const m=new InteractiveSqueezeModel('cheese');m.explode();m.release();for(let i=0;i<12;i++)m.step(.25);
const r=Object.create(SequenceLycheeRenderer.prototype);Object.assign(r,{core,loaded:true,shards:[],burstTexture:null});
const samples=new Float32Array(SR*DURATION),soundEvents=[],states=[];
function events(es,t){for(const e of es){
 if(!['gel','stretch','fold'].includes(e.kind))throw new Error(`意外音效 ${e.kind}`);
 const a=synthesize(e.kind,SR,71+soundEvents.length*193,slime),at=Math.round(t*SR);
 for(let i=0;i<a.length&&at+i<samples.length;i++)samples[at+i]+=a[i]*.65;
 soundEvents.push({kind:e.kind,t});
}}
const encoder=spawn('ffmpeg',['-y','-f','rawvideo','-pixel_format','rgba','-video_size','1080x1920','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',`${OUT}/slime-silent.mp4`],{stdio:['pipe','ignore',fs.openSync(`${OUT}/encode.log`,'w')]});
let lastHeld=false,point={x:.5,y:.7};
for(let f=0;f<FPS*DURATION;f++){
 const t=f/FPS;
 const held=(t>=.6&&t<1.3)||(t>=1.85&&t<3.15)||(t>=3.7&&t<4.95);
 if(held&&!lastHeld){point={x:.5,y:.7};events(m.press(point),t);}
 if(held){
   const u=t<1.3?0:t<3.15?(t-1.85)/1.3:(t-3.7)/1.25;
   point={x:.5+(t<1.3?0:(t<3.15?1:-1)*.23*Math.sin(Math.PI*u/2)),y:.7-.26*Math.sin(Math.PI*u)};
   m.move(point);
 }
 if(!held&&lastHeld)events(m.release(),t);
 events(m.step(1/FPS),t);lastHeld=held;
 c.drawImage(backgrounds[t<1.65?0:t<3.5?1:t<5?2:3],0,0);
 // 保留实际录屏中的工具栏，给拉伸腾出镜头空间。
 const scale=2.55-.50*Math.min(1,t/.45)+.5*Math.max(0,Math.min(1,(t-5.35)/.65)),cy=1410+(2.55-scale)*85;
 c.save();c.translate(540,cy);c.scale(scale,scale);r.draw(c,m,1/FPS);c.restore();
 if(t>.45&&t<5.45){
  const x=540+(point.x-.5)*240*1.25*scale,y=cy+(point.y-.5)*240*1.25*scale;
  if(held){c.beginPath();c.arc(x,y,26,0,Math.PI*2);c.fillStyle='#FFE07355';c.fill();}
  c.save();c.translate(x,y);c.beginPath();c.moveTo(0,0);c.lineTo(2,32);c.lineTo(10,24);c.lineTo(18,37);c.lineTo(25,33);c.lineTo(17,20);c.lineTo(30,18);c.closePath();c.fillStyle='#1D2834';c.fill();c.strokeStyle='white';c.lineWidth=2;c.stroke();c.restore();
 }
 if([0,30,75,135,179].includes(f))fs.writeFileSync(`${OUT}/slime-${f}.png`,canvas.toBuffer('image/png'));
 states.push({t,held:m.held,phase:m.phase,coreOnly:m.coreOnly,squash:m.squash,pull:{...m.pull}});
 const raw=c.getImageData(0,0,1080,1920).data;
 if(!encoder.stdin.write(Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength)))await once(encoder.stdin,'drain');
}
encoder.stdin.end();const [code]=await once(encoder,'close');if(code)throw new Error(`编码失败 ${code}`);
fs.writeFileSync(`${OUT}/slime.f32le`,Buffer.from(samples.buffer));
fs.writeFileSync(`${OUT}/render-report.json`,JSON.stringify({duration:DURATION,fps:FPS,soundEvents,states,kind:'应用原状态机、奶酪内芯和用户选定软泥音效的离线交互演示'},null,2));
console.log('6 秒软泥交互渲染完成',soundEvents.length,'个同期音效');
