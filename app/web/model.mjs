import { SHELL_SITES } from './lychee.mjs';
export const MATERIALS = {
  lychee: {name:'冰霜荔枝',sequenceFrames:80,subtitle:'咔嚓破壳，软软揉拉',interval:.24,amount:2/23,kind:'rind'},
  peach: {name:'蜜桃',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  orange: {name:'橘子',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  mangosteen: {name:'山竹',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  'egg-tart': {name:'蛋挞',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  cheese: {name:'奶酪块',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  mochi: {name:'笑脸烤年糕',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  daifuku: {name:'豆大福',sequenceFrames:80,interval:.24,amount:2/23,kind:'rind'},
  strawberry: {name:'脆皮草莓',subtitle:'薄薄的壳，慢慢捏碎',interval:.19,amount:.105,kind:'crack'},
  cookie: {name:'黄油曲奇',subtitle:'酥酥的，一捏就掉渣',interval:.24,amount:.14,kind:'crumb'},
  paw: {name:'桃桃猫爪',subtitle:'软乎乎，松手就回弹',interval:.32,amount:0,kind:'soft'},
};
export const AVAILABLE_MATERIALS = ['lychee','peach','orange','mangosteen','egg-tart','cheese','mochi','daifuku'];
export function nextMaterial(current){
  return AVAILABLE_MATERIALS[(AVAILABLE_MATERIALS.indexOf(current)+1)%AVAILABLE_MATERIALS.length];
}
export class SqueezeModel {
  get slimeMaterial(){return Boolean(MATERIALS[this.material]?.sequenceFrames);}
  constructor(material='lychee'){this.select(material);}
  select(material){if(!MATERIALS[material]) throw new Error('未知材质');this.material=material;this.reset();}
  reset(){this.damage=0;this.pressure=0;this.held=false;this.elapsed=0;this.fractures=[];this.contact={x:.5,y:.5};this.broken=[];this.pull={x:0,y:0};this.pullTarget={x:0,y:0};this.travel=0;this.moveClock=0;this.squash=0;this.restFlatten=0;this.shellWear=SHELL_SITES.map(()=>0);this.shellOpening=SHELL_SITES.map(()=>0);this.detached=[];this.holdTime=0;this.burstFired=false;this.burstAge=-1;this.burstQueue=[];}
  get burstActive(){return this.burstAge>=0&&this.burstAge<.75;}
  get tension(){return this.burstFired?Math.max(0,1-this.burstAge/.18):Math.max(0,Math.min(1,this.holdTime-1.5));}
  get burstImpact(){const t=this.burstAge;return t<0||t>=.75?0:t<.22?Math.sin(Math.PI*t/.22):Math.sin((t-.22)*27)*Math.exp(-(t-.22)*9)*.22;}
  startBurst(){
    this.burstFired=true;this.burstAge=0;this.elapsed=0;
    const cx=(this.contact.x-.5)*240,cy=(this.contact.y-.5)*240;
    const order=SHELL_SITES.map((s,i)=>({i,d:Math.hypot(s.x-cx,s.y-cy)})).filter(s=>!this.detached.includes(s.i)).sort((a,b)=>a.d-b.d);
    this.burstQueue=order.map((s,j)=>({index:s.i,at:.025+.17*j/Math.max(1,order.length-1)}));
    for(const {i} of order){this.shellWear[i]=1;if(!this.broken.includes(i))this.broken.push(i);}
    this.damage=1;
    return {kind:'burst',...this.contact,detached:[],pieces:[],seed:this.fractures.length};
  }
  get shellMoving(){return this.shellOpening.some((v,i)=>Math.abs(v-this.shellWear[i])>.001);}
  get shellRemaining(){return this.slimeMaterial?SHELL_SITES.length-this.detached.length:0;}
  get phase(){if(this.burstQueue.length)return 'bursting';if(this.slimeMaterial)return this.shellRemaining===0?'gel':this.damage>0?'breaking':'shell';return this.damage>=1?'gel':this.damage>0?'breaking':'shell';}
  move(p){
    if(!this.held||!this.slimeMaterial||this.damage<.3||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    const dx=p.x-this.contact.x,dy=p.y-this.contact.y,limit=Math.min(1,.36/(Math.hypot(dx,dy)||1));
    const next={x:dx*limit,y:dy*limit};
    this.travel+=Math.hypot(next.x-this.pullTarget.x,next.y-this.pullTarget.y);this.pullTarget=next;
  }
  press(p){if(!this.held)this.holdTime=0;if(this.slimeMaterial)this.squash=Math.max(this.squash,.56);this.held=true;this.elapsed=0;this.contact={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};this.pressure=Math.max(this.pressure,.15);return this.burstQueue.length?[]:[this.pulse()];}
  pulse(){
    const mat=MATERIALS[this.material];
    if(this.slimeMaterial){
      const hasShell=this.shellRemaining>0;
      const nearby=SHELL_SITES.map((s,i)=>({i,d:(s.x-(this.contact.x-.5)*240)**2+(s.y-(this.contact.y-.5)*240)**2})).sort((a,b)=>a.d-b.d);
      const pieces=nearby.filter(s=>!this.broken.includes(s.i)).slice(0,2).map(s=>s.i);
      const detached=[];
      // 裂过的壳继续受力才扩大缺口；裂开与脱离是不同状态。
      for(const {i} of nearby.filter(s=>this.broken.includes(s.i)&&!this.detached.includes(s.i)).slice(0,3)){
        const prior=this.shellWear[i];this.shellWear[i]=Math.min(1,prior+.24);
        if(prior>=.99&&this.shellOpening[i]>.75&&detached.length<1){this.detached.push(i);detached.push(i);}
      }
      for(const i of pieces)this.shellWear[i]=.18;
      const e={kind:hasShell?'rind':'gel',...this.contact,pieces,detached,seed:this.fractures.length,damage:this.damage};
      this.broken.push(...pieces);this.damage=this.broken.length/SHELL_SITES.length;if(pieces.length)this.fractures.push(e);return e;
    }
    const kind=this.damage>=1 ? (this.material==='cookie'?'dust':'squish') : mat.kind;
    const e={kind,...this.contact,amount:mat.amount,seed:this.fractures.length,damage:this.damage};
    if(mat.amount && this.damage<1){this.damage=Math.min(1,Math.round((this.damage+mat.amount)*1000)/1000);this.fractures.push(e);}
    return e;
  }
  release(){if(this.held&&this.slimeMaterial&&this.damage>.3)this.restFlatten=Math.min(.2,this.restFlatten+.055*this.squash);const events=this.held&&this.slimeMaterial&&Math.hypot(this.pull.x,this.pull.y)>.06?[{kind:'fold',...this.contact}]:[];this.held=false;this.holdTime=0;this.elapsed=0;this.pullTarget={x:0,y:0};this.travel=0;return events;}
  step(dt,heldElapsed=null){
    if(!Number.isFinite(dt)||dt<0)return [];
    const result=[];
    if(this.burstActive){
      this.burstAge=Math.min(.75,this.burstAge+Math.min(dt,.25));
      const detached=this.burstQueue.filter(s=>s.at<=this.burstAge+1e-9).map(s=>s.index);
      this.burstQueue=this.burstQueue.filter(s=>s.at>this.burstAge+1e-9);
      if(detached.length){this.detached.push(...detached);result.push({kind:'burst-shards',silent:true,burst:true,...this.contact,detached});}
      if(!this.burstQueue.length)this.restFlatten=Math.max(this.restFlatten,.12);
    }
    if(this.held&&this.slimeMaterial&&!this.burstFired&&this.shellRemaining>0){
      this.holdTime=Number.isFinite(heldElapsed)&&heldElapsed>=0?Math.max(this.holdTime,heldElapsed):this.holdTime+Math.min(dt,.25);
      if(this.holdTime+1e-9>=2.5)result.push(this.startBurst());
    }
    const target=this.held?1:0;
    // 史莱姆受压快、回拢慢；留下有限的塑性变形，重置才重新成团。
    if(this.slimeMaterial){this.squash=target+(this.squash-target)*Math.exp(-dt*(this.held?11:3.2));if(this.squash<.001)this.squash=0;}
    this.pressure=target+(this.pressure-target)*Math.exp(-dt*(this.held?5:12));
    if(this.pressure<.001)this.pressure=0;
    for(const axis of ['x','y']){this.pull[axis]+=(this.pullTarget[axis]-this.pull[axis])*(1-Math.exp(-dt*(this.held?17:7)));if(Math.abs(this.pull[axis])<.0001)this.pull[axis]=0;}
    for(let i=0;i<this.shellOpening.length;i++){
      this.shellOpening[i]+=(this.shellWear[i]-this.shellOpening[i])*(1-Math.exp(-dt*12));
      if(Math.abs(this.shellOpening[i]-this.shellWear[i])<.001)this.shellOpening[i]=this.shellWear[i];
    }
    this.moveClock+=dt;
    if(this.held&&!this.burstActive&&this.slimeMaterial&&this.travel>.035&&this.moveClock>=.13){result.push({kind:'stretch',...this.contact});this.moveClock=0;this.travel=0;}
    if(this.held&&!this.burstActive&&!(this.slimeMaterial&&this.shellRemaining===0)){this.elapsed+=Math.min(dt,.25);const interval=MATERIALS[this.material].interval-(this.slimeMaterial?.1*this.tension:0);
      while(this.elapsed+1e-9>=interval&&!(this.slimeMaterial&&this.shellRemaining===0)){this.elapsed-=interval;result.push(this.pulse());}}
    return result;
  }
}
export class TaskStatus {
  constructor(){this.bind(null);}
  bind(session){this.session=session;this.turn=null;this.seq=-1;this.value='disconnected';}
  disconnect(){this.value='disconnected';}
  accept(e){
    if(!this.session||e.session!==this.session||!Number.isFinite(e.seq)||e.seq<=this.seq)return false;
    if(e.event==='UserPromptSubmit'){
      if(!e.turn)return false;
      this.turn=e.turn;this.value='working';this.seq=e.seq;return true;
    }
    if(!e.turn||e.turn!==this.turn)return false;
    if(['ready','interrupted'].includes(this.value))return false;
    const next={PermissionRequest:'attention',PreToolUse:'working',PostToolUse:'working',Stop:'ready',Interrupt:'interrupted'}[e.event];
    if(!next)return false;
    this.value=next;this.seq=e.seq;return true;
  }
}
