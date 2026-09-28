import { synthesizeHmph } from './anger-voice.mjs';
// 碎壳、完成音和生气短哼为原创程序合成；软泥使用 CC0 离线实录。
// 打包器内嵌本地 PCM，运行时无需网络请求。
const SLIME_AUDIO=null;
const slimeDecoded=new WeakMap();
function recordedSlime(kind,rate,seed,asset){
  if(!asset)throw new Error('缺少用户选定的软泥实录，请重新构建');
  if(!slimeDecoded.has(asset)){
    const clips={};
    for(const name of ['gel','stretch','fold'])clips[name]=asset.clips[name].map(pcm=>{
      const raw=atob(pcm),samples=new Float32Array(raw.length/2);
      for(let i=0;i<samples.length;i++){
        const word=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
        samples[i]=(word>=32768?word-65536:word)/32768;
      }
      return samples;
    });
    slimeDecoded.set(asset,clips);
  }
  const samples=slimeDecoded.get(asset)[kind][(seed>>>0)%6];
  const out=new Float32Array(Math.floor(samples.length*rate/asset.rate));
  for(let i=0;i<out.length;i++){
    const position=i*asset.rate/rate,index=Math.floor(position),fraction=position-index;
    out[i]=samples[index]*(1-fraction)+(samples[index+1]||0)*fraction;
  }
  return out;
}
export function synthesize(kind,rate=44100,seed=1,slimeAudio=SLIME_AUDIO){
  if(['gel','stretch','fold'].includes(kind))return recordedSlime(kind,rate,seed,slimeAudio);
  if(kind==='anger')return synthesizeHmph(rate);
  if(kind==='completion'){
    // 低音量、圆润的上扬 biu；无噪声爆点，起止平滑。
    const duration=.32,out=new Float32Array(Math.floor(rate*duration));let phase=0;
    for(let i=0;i<out.length;i++){
      const t=i/rate;phase+=2*Math.PI*(420+600*(1-Math.exp(-t/.065)))/rate;
      const envelope=(1-Math.exp(-t/.012))*Math.exp(-t/ .075)*Math.min(1,(out.length-1-i)/(rate*.05));
      out[i]=.16*envelope*(Math.sin(phase)+.08*Math.sin(phase*2));
    }
    return out;
  }
  if(['rind','gel','stretch','fold','burst'].includes(kind))return lycheeSound(kind,rate,seed);
  let rng=seed>>>0;
  const random=()=>{rng=(1664525*rng+1013904223)>>>0;return rng/4294967296;};
  const soft=kind==='soft'||kind==='squish', dust=kind==='dust';
  const duration=soft?.28:kind==='crumb'?.37:dust?.18:.26;
  const out=new Float32Array(Math.floor(rate*duration));
  const bursts=Array.from({length:soft?3:kind==='crumb'?22:11},(_,i)=>({
    at:i===0?.002:random()*duration*.8,decay:soft?.035:.003+random()*.013,amp:.25+random()*.65,
  }));
  let low=0,previous=0;
  const freq=85+random()*70;
  for(let i=0;i<out.length;i++){
    const t=i/rate,n=random()*2-1;
    low+= (n-low)*(soft?.055:.34);
    const high=n-previous;previous=n;
    let env=0;
    for(const b of bursts){const d=t-b.at;if(d>=0)env+=b.amp*Math.exp(-d/b.decay)*Math.min(1,d*rate/5);}
    const tail=Math.pow(Math.max(0,1-t/duration),2);
    const body=soft?Math.sin(2*Math.PI*(freq*t-85*t*t))*.42*Math.exp(-t*17):0;
    const sample=soft?low*env*.9+body:(kind==='crumb'?low*.9+high*.13:high*.19+low*.5)*env;
    out[i]=Math.tanh(sample*(dust?.6:1.6))*.65*tail*Math.min(1,i/24);
  }
  return out;
}
export class SoundEngine {
  constructor({slimeAudio=SLIME_AUDIO}={}){this.slimeAudio=slimeAudio;this.voices=new Set();this.volume=.38;this.muted=false;this.lastVariant=-1;this.completionEpoch=0;this.completionPlays=0;}
  async unlock(){
    if(!this.ctx){
      this.ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
      this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:this.volume;
      const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=8;
      this.master.connect(limiter);limiter.connect(this.ctx.destination);
      this.buffers={};
      for(const kind of ['crack','crumb','soft','squish','dust','rind','gel','stretch','fold','burst','completion','anger'])this.buffers[kind]=Array.from({length:6},(_,v)=>{
        const data=synthesize(kind,this.ctx.sampleRate,71+v*193+kind.length*241,this.slimeAudio);
        const b=this.ctx.createBuffer(1,data.length,this.ctx.sampleRate);b.copyToChannel(data,0);return b;
      });
    }
    if(this.ctx.state!=='running')await this.ctx.resume();
  }
  configure(volume,muted){this.volume=volume;this.muted=muted;if(this.master)this.master.gain.setTargetAtTime(muted?0:volume,this.ctx.currentTime,.012);}
  async playCompletion(stillActive){
    if(this.muted||this.volume<=0)return;
    const epoch=++this.completionEpoch,started=Date.now();
    try{await this.unlock();}catch{return;}
    // 音频恢复被系统推迟时，不在用户开始捏或提醒结束后突然补响。
    if(epoch!==this.completionEpoch||!stillActive()||Date.now()-started>700)return;
    this.play({kind:'completion',x:.5});
  }
  play(e){
    if(e.silent||!this.ctx||this.muted||this.ctx.state!=='running')return;
    // 起爆提示单独突出，停止按住期间尚未结束的碎裂尾音。
    if(e.kind==='anger'){for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
    if(this.voices.size>=6){const oldest=this.voices.values().next().value;oldest.stop();this.voices.delete(oldest);}
    let v=Math.floor(Math.random()*5);if(v>=this.lastVariant)v++;this.lastVariant=v;
    const source=this.ctx.createBufferSource();source.buffer=this.buffers[e.kind][v];source.playbackRate.value=['burst','completion','anger','gel','stretch','fold'].includes(e.kind)?1:.95+Math.random()*.1;
    const pan=this.ctx.createStereoPanner();pan.pan.value=(e.x-.5)*.7;
    source.connect(pan);pan.connect(this.master);this.voices.add(source);
    source.onended=()=>{source.disconnect();pan.disconnect();this.voices.delete(source);};source.start();this.lastKind=e.kind;if(e.kind==='rind')this.rindPlays=(this.rindPlays||0)+1;if(e.kind==='burst')this.burstPlays=(this.burstPlays||0)+1;
    if(e.kind==='completion')this.completionPlays++;if(e.kind==='anger')this.angerPlays=(this.angerPlays||0)+1;
  }
  stop(){this.completionEpoch++;this.burstPlays=0;this.lastKind=null;this.rindPlays=0;for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
}

// 原创候选：果壳的短促断裂和细密冰渣，果肉的摩擦、湿泡与回折。
function lycheeSound(kind,rate,seed){
  let rng=seed>>>0;const rand=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  const burst=kind==='burst',hard=kind==='rind'||burst,pull=kind==='stretch',duration=burst?.72:hard?.36:pull?.42:.31;
  const out=new Float32Array(Math.floor(rate*duration));
  const grains=Array.from({length:burst?68:hard?32:12},(_,i)=>({at:i===0?.002:burst?(i<38?.008+rand()*.18:.2+rand()*.47):rand()*duration*.8,decay:burst&&i===0?.024:hard?.002+rand()*.009:.008+rand()*.024,amp:i===0?1:burst&&i>=38?.05+rand()*.14:.12+rand()*.48,freq:150+rand()*550}));
  // 脆裂只需要噪声包络；预先累积短脉冲，避免在爆点首次播放时反复计算指数和无用正弦。
  const hardEnvelope=hard?new Float32Array(out.length):null;
  if(hard)for(const g of grains){
    const start=Math.ceil(g.at*rate),end=Math.min(out.length,Math.ceil((g.at+g.decay*9)*rate)),fall=Math.exp(-1/(rate*g.decay));
    let level=g.amp*Math.exp(-(start/rate-g.at)/g.decay);
    for(let i=start;i<end;i++){hardEnvelope[i]+=level*Math.min(1,(i-g.at*rate)/8);level*=fall;}
  }
  let low=0,mid=0;
  for(let i=0;i<out.length;i++){
    const t=i/rate,n=rand()*2-1;low+=(n-low)*.035;mid+=(n-mid)*.4;
    let cracks=hard?hardEnvelope[i]:0,bubbles=0;
    if(!hard)for(const g of grains){const d=t-g.at;if(d<0)continue;const e=g.amp*Math.exp(-d/g.decay)*Math.min(1,d*rate/8);cracks+=e;bubbles+=Math.sin(2*Math.PI*(g.freq*d-700*d*d))*e;}
    const envelope=Math.sin(Math.PI*Math.min(1,t/duration))**.7;
    const friction=pull?(mid-low)*.26*envelope:low*.6*envelope;
    const thump=burst?Math.sin(2*Math.PI*105*t)*.18*Math.exp(-t*25):0;
    const sample=thump+(hard?((n-mid)*.48+mid*.7)*cracks+low*.3*envelope:friction+bubbles*(kind==='fold'?.44:.28));
    out[i]=Math.tanh(sample*1.5)*.62*Math.min(1,i/45)*Math.min(1,(out.length-1-i)/240);
  }
  return out;
}
