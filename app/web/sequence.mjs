import { SqueezeModel, MATERIALS } from './model.mjs';

// 帧数是素材合同；打包时必须与 manifest 一致，不能静默使用旧素材。
export const LYCHEE_SEQUENCE_COUNT=80;
export class InteractiveSqueezeModel extends SqueezeModel {
  get sequenceMode(){return this.slimeMaterial;}
  get sequenceCount(){return MATERIALS[this.material].sequenceFrames||LYCHEE_SEQUENCE_COUNT;}
  get sequenceFrame(){return Math.min(this.sequenceCount-1,Math.floor(this.sequencePosition+1e-8));}
  reset(){super.reset();this.sequencePosition=0;this.coreOnly=false;this.angerAge=-1;this.burstNeedsRelease=false;}
  get angerVisible(){return this.angerAge>=0&&this.angerAge<2.4;}
  get burstActive(){return this.sequenceMode?this.angerAge>=0&&this.angerAge<.72:super.burstActive;}
  get tension(){return this.sequenceMode?(!this.coreOnly&&this.held?Math.max(0,Math.min(1,(this.holdTime-1.45)/.55)):0):super.tension;}
  get burstImpact(){return this.sequenceMode?(this.burstActive?Math.sin(Math.PI*Math.min(1,this.angerAge/.32))*.45:0):super.burstImpact;}
  explode(){
    const frame=this.sequenceFrame;
    this.coreOnly=true;this.burstFired=true;this.angerAge=0;this.burstNeedsRelease=true;
    this.advance(this.sequenceCount);this.squash=0;this.restFlatten=0;this.pull={x:0,y:0};this.pullTarget={x:0,y:0};this.elapsed=0;
    return {kind:'anger',frame,...this.contact};
  }
  get phase(){return this.sequenceMode?(this.damage>=1?'gel':this.damage>0?'breaking':'shell'):super.phase;}
  get shellRemaining(){return this.sequenceMode?Math.ceil((1-this.damage)*23):super.shellRemaining;}
  advance(frames){this.sequencePosition=Math.min(this.sequenceCount-1,this.sequencePosition+frames);this.damage=this.sequencePosition/(this.sequenceCount-1);}
  pulse(){
    if(!this.sequenceMode)return super.pulse();
    if(this.phase==='gel')return {kind:'gel',...this.contact};
    this.advance(2);
    const e={kind:'rind',...this.contact,seed:this.fractures.length};this.fractures.push(e);return e;
  }
  press(p){
    if(!this.sequenceMode)return super.press(p);
    if(this.held)return [];
    if(this.phase==='gel')return super.press(p);
    this.held=true;this.elapsed=0;this.holdTime=0;
    this.contact={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};
    return [this.pulse()];
  }
  move(p){if(this.sequenceMode&&(this.burstActive||this.burstNeedsRelease))return;if(!this.sequenceMode||this.phase==='gel')super.move(p);}
  release(){
    if(this.sequenceMode&&this.burstNeedsRelease){this.burstNeedsRelease=false;this.held=false;this.elapsed=0;this.holdTime=0;this.pullTarget={x:0,y:0};this.travel=0;return [];}
    if(!this.sequenceMode||this.phase==='gel')return super.release();
    this.held=false;this.elapsed=0;this.holdTime=0;return [];
  }
  step(dt,heldElapsed=null){
    if(!Number.isFinite(dt)||dt<0)return [];
    if(!this.sequenceMode)return super.step(dt,heldElapsed);
    const elapsed=Math.min(dt,.25);
    if(this.angerAge>=0)this.angerAge=Math.min(2.4,this.angerAge+elapsed);
    if(this.held&&!this.coreOnly){
      this.holdTime=Number.isFinite(heldElapsed)&&heldElapsed>=0?Math.max(this.holdTime,heldElapsed):this.holdTime+elapsed;
      if(this.holdTime+1e-9>=2)return [this.explode()];
    }
    // 起爆后的同一次按压不立即把内芯压扁；先完成飞散，再等一次新的捏压。
    if(this.burstActive||this.burstNeedsRelease)return [];
    if(this.phase==='gel')return super.step(dt,heldElapsed);
    if(!this.held)return [];
    this.advance(elapsed*18);
    this.elapsed+=elapsed;const events=[];
    while(this.elapsed+1e-9>=.24){
      this.elapsed-=.24;
      const e={kind:'rind',...this.contact,seed:this.fractures.length};this.fractures.push(e);events.push(e);
    }
    return events;
  }
}
