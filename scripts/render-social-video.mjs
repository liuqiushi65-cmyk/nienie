// 用项目的实际状态机、透明图集、渲染器和音效离线制作竖屏演示。
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {InteractiveSqueezeModel} from '../app/web/sequence.mjs';
import {SequenceLycheeRenderer} from '../app/web/sequence-renderer.mjs';
import {ToyRenderer} from '../app/web/renderer.mjs';
import {synthesize} from '../app/web/audio.mjs';
const require=createRequire('/Users/lexie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('/System/Library/Fonts/PingFang.ttc','PingFang');
const out='artifacts/xiaohongshu';fs.mkdirSync(out,{recursive:true});
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.window={devicePixelRatio:3,matchMedia:()=>({matches:false})};
const W=1080,H=1920,FPS=30,DURATION=24,SR=44100;
const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const toyCanvas=createCanvas(1080,930),tc=toyCanvas.getContext('2d');tc.scale(3,3);
const slime=JSON.parse(fs.readFileSync('artifacts/slime-audio/samples.json'));
const samples=new Float32Array(SR*DURATION),soundEvents=[],states=[];
const mats=['lychee','mochi','daifuku'];const assets={};
for(const material of mats){
 const dir=`artifacts/${material}-sequence`,a=JSON.parse(fs.readFileSync(`${dir}/manifest.json`));
 assets[material]={atlas:a,pages:await Promise.all(a.pages.map(p=>loadImage(`${dir}/${p}`))),core:await loadImage(`artifacts/anger-burst/${material}-core.png`)};
}
let m,r,renderer,scene=-1,lastHeld=false;
function select(material){
 m=new InteractiveSqueezeModel(material);r=Object.create(SequenceLycheeRenderer.prototype);
 Object.assign(r,assets[material],{surface:createCanvas(448,448),material,shards:[],loaded:true,failed:false,frame:-1,burstTexture:null});
 renderer=Object.create(ToyRenderer.prototype);Object.assign(renderer,{canvas:toyCanvas,ctx:tc,model:m,lychee:r,particles:[],hover:false});lastHeld=false;
}
function sound(kind,t){
 const data=synthesize(kind,SR,71+soundEvents.length*193,slime);const start=Math.round(t*SR);
 const gain=kind==='anger'?.8:kind==='completion'?1.7:.68;
 for(let j=0;j<data.length&&start+j<samples.length;j++)samples[start+j]+=data[j]*gain;
 soundEvents.push({kind,t});
}
function events(es,t){for(const e of es){r.emit(e);sound(e.kind,t);}}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function txt(text,x,y,size=30,color='#4b3d38',weight=400,align='left'){ctx.font=`${weight} ${size}px PingFang`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y);}
function background(t){
 ctx.fillStyle='#f6f2eb';ctx.fillRect(0,0,W,H);
 const g=ctx.createRadialGradient(540,1050,30,540,1050,860);g.addColorStop(0,'#fffdf9');g.addColorStop(1,'#eee6da');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#dfd6c8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(86,165);ctx.lineTo(994,165);ctx.stroke();
 txt('捏 一 会 儿',86,126,25,'#8d796d',600);txt('一个桌面解压小玩具',994,126,23,'#a28f82',400,'right');
}
function cursor(t,held){
 if(t<.7||t>18.4)return;let x=693+Math.sin(t*2)*14,y=1160+Math.cos(t*2)*12;
 if(m.phase==='gel'){x+=Math.sin(t*3)*60;y+=Math.cos(t*3)*25;}
 if(held){ctx.beginPath();ctx.arc(x,y,34+3*Math.sin(t*9),0,Math.PI*2);ctx.fillStyle='#d6aa9530';ctx.fill();}
 ctx.save();ctx.translate(x,y);ctx.rotate(-.22);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(4,47);ctx.lineTo(17,34);ctx.lineTo(30,56);ctx.lineTo(41,49);ctx.lineTo(28,29);ctx.lineTo(46,26);ctx.closePath();ctx.fillStyle='#fffaf4';ctx.strokeStyle='#866e60';ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.restore();
}
const encoder=spawn('ffmpeg',['-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',`${out}/silent.mp4`],{stdio:['pipe','ignore',fs.openSync(`${out}/encode.log`,'w')]});
let encoderError;encoder.on('error',e=>encoderError=e);
for(let f=0;f<FPS*DURATION;f++){
 const t=f/FPS,si=t<7?0:t<10.5?1:t<14.5?2:t<18.5?3:4;
 if(si!==scene){if(si===0)select('lychee');if(si===1)select('mochi');if(si===2)select('daifuku');if(si===4){m.reset();r.reset();lastHeld=false;sound('completion',t);}scene=si;}
 let held=false;
 if(si===0)held=t>.7&&(t-.7)%1.05<.86;
 if(si===1)held=(t-7)>.2&&(t-7-.2)%1.05<.86;
 if(si===2)held=t>=10.9&&t<13.35;
 if(si===3)held=(t-14.5)%.95<.62;
 if(held&&!lastHeld)events(m.press({x:.5,y:.5}),t);
 if(!held&&lastHeld)events(m.release(),t);
 if(held&&m.phase==='gel')m.move({x:.5+Math.sin(t*3)*.22,y:.5+Math.cos(t*3)*.07});
 events(m.step(1/FPS),t);lastHeld=held;
 renderer.notice=si===4?{age:t-18.5}:null;renderer.draw(1/FPS);
 background(t);
 let title,sub,tag;
 if(si===0){title=['把压力','捏碎一点。'];sub='给电脑做了个可以捏的小玩具';tag='一点点碎开，松手就停';}
 if(si===1){title=['今天想捏的，','不止荔枝。'];sub='还有一块笑眯眯的烤年糕';tag='咔嚓，咔嚓';}
 if(si===2){title=['忍不住了？','那就炸一下。'];sub='大福也可以替你发个小脾气';tag=m.coreOnly?'我炸了！':'长按 2 秒';}
 if(si===3){title=['炸完以后，','再揉一揉。'];sub='外壳碎掉，里面是软乎乎的豆沙';tag='软软的，慢慢回弹';}
 if(si===4){title=['有回复啦。','也缓过来了。'];sub='Codex 任务回复，小玩具就会复原';tag='捏一会儿，再继续吧';}
 txt(title[0],86,310,78,'#463a35',600);txt(title[1],86,418,78,'#463a35',600);txt(sub,90,500,31,'#978478');
 // 放大真实渲染画布，只改变演示镜头，不改交互模型和裂纹素材。
 const zoom=si===0?1.08:si===1?1.12:si===3?.84:si===2&&m.coreOnly?1.26-.42*Math.min(1,m.angerAge/.42):1.26;
 const dw=1080*zoom,dh=930*zoom;ctx.drawImage(toyCanvas,540-dw/2,(si===3?985:1040)-dh/2,dw,dh);
 if(si===4){
  const age=t-18.5;ctx.save();ctx.globalAlpha=Math.min(1,age/.25);
  roundRect(130,670,820,150,38,'#fffdf8','#b4d9c5');txt('CODEX · 本轮已回复',170,722,25,'#6a9b86',500);txt('你等的任务，有结果了',170,778,35,'#5b5047',500);ctx.restore();
 }
 if(si===2&&m.angerVisible){roundRect(385,712,310,97,35,'#fff8f1','#e7c5bc');txt('我炸了',487,775,37,'#9e5c51',600,'center');ctx.beginPath();ctx.arc(619,758,23,0,Math.PI*2);ctx.fillStyle='#e88476';ctx.fill();txt('><',619,765,20,'#fff8ed',600,'center');}
 cursor(t,held);
 roundRect(210,1490,660,91,46,'#fffaf3');txt(tag,540,1549,33,'#90796a',500,'center');
 txt('建议打开声音，听一点点碎裂',540,1695,25,'#ad9b8d',400,'center');
 for(let i=0;i<5;i++){ctx.fillStyle=i===si?'#af7c63':'#d9cdc0';ctx.beginPath();ctx.arc(488+i*26,1788,i===si?5:3,0,Math.PI*2);ctx.fill();}
 if([30,105,190,260,389,475,590,675].includes(f))fs.writeFileSync(`${out}/frame-${String(f).padStart(3,'0')}.png`,canvas.toBuffer('image/png'));
 if(f===30)fs.writeFileSync(`${out}/封面.png`,canvas.toBuffer('image/png'));
 if(f%30===0)states.push({t,material:m.material,frame:m.sequenceFrame,held:m.held,coreOnly:m.coreOnly,shards:r.shards.length});
 const raw=ctx.getImageData(0,0,W,H).data;
 if(!encoder.stdin.write(Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength)))await once(encoder.stdin,'drain');
 if(f%120===0)console.log(`已渲染 ${f/FPS}/${DURATION} 秒`);
}
encoder.stdin.end();const [code]=await once(encoder,'close');if(encoderError||code)throw encoderError||new Error(`编码失败 ${code}`);
const pcm=Buffer.alloc(samples.length*2);for(let i=0;i<samples.length;i++)pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),i*2);
fs.writeFileSync(`${out}/audio.s16le`,pcm);fs.writeFileSync(`${out}/render-report.json`,JSON.stringify({duration:DURATION,fps:FPS,size:[W,H],soundEvents,states,kind:'项目原状态机与渲染器离线演示，完成通知为演示事件'},null,2));console.log('画面和同期音效生成完成');
