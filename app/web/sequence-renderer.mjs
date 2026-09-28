import { textureTriangle } from './lychee-renderer.mjs';
import { gelPoint, SHELL_CELLS } from './lychee.mjs';
import { LYCHEE_SEQUENCE_COUNT } from './sequence.mjs';

// 打包器填入经过校验的本地透明素材，不在运行时请求远端。
const FRUIT_ATLASES=null;
export class SequenceLycheeRenderer {
  constructor(material='lychee',atlases=FRUIT_ATLASES){
    this.shards=[];this.failed=false;this.loaded=false;this.frame=-1;this.version=0;this.atlases=atlases||{};
    this.surface=document.createElement('canvas');this.ready=Promise.resolve(false);this.select(material);
  }
  select(material){
    if(this.material===material)return this.ready;
    this.reset();this.material=material;this.loaded=false;this.failed=false;this.frame=-1;this.pages=[];
    const version=++this.version,atlas=this.atlases[material];this.atlas=atlas;
    if(!atlas){this.ready=Promise.resolve(false);return this.ready;}
    this.surface.width=this.surface.height=atlas.size;
    const pages=atlas.pages.map(()=>new Image());this.pages=pages;this.core=new Image();
    const sources=[...atlas.pages,atlas.core];
    this.ready=Promise.all([...pages,this.core].map((img,i)=>new Promise(resolve=>{
      img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=sources[i];
    }))).then(results=>{
      if(version!==this.version)return false;
      this.loaded=results.every(Boolean)&&atlas.count===LYCHEE_SEQUENCE_COUNT;this.failed=!this.loaded;return this.loaded;
    });
    return this.ready;
  }
  reset(){this.frame=-1;this.shards=[];this.burstTexture=null;}
  emit(e){
    if(e.kind!=='anger'||!this.loaded)return;
    const frame=this.compose(e.frame),texture=document.createElement('canvas');
    texture.width=texture.height=this.atlas.size;texture.getContext('2d').drawImage(frame,0,0);
    this.burstTexture=texture;
    // 从起爆瞬间的表面切出不规则碎片，不使用另一颗完整水果替代。
    this.shards=SHELL_CELLS.flatMap((cell,index)=>{
      const edge=cell.filter((_,i)=>i%2===0).map(([x,y])=>[x*1.25,y*1.25]);
      const center=edge.reduce((a,p)=>[a[0]+p[0]/edge.length,a[1]+p[1]/edge.length],[0,0]);
      return Array.from({length:3},(_,part)=>{
        const from=Math.floor(part*edge.length/3),to=Math.floor((part+1)*edge.length/3);
        const poly=[center,...Array.from({length:to-from+1},(_,j)=>edge[(from+j)%edge.length])];
        return {poly,center,age:0,index:index*3+part};
      });
    });
  }
  drawShards(ctx,dt){
    if(!this.burstTexture)return;
    this.shards=this.shards.filter(p=>(p.age+=dt)<.72);
    for(const p of this.shards){
      const pose=burstShardTransform(p.center,p.index,p.age);
      ctx.save();ctx.globalAlpha=pose.alpha;ctx.translate(p.center[0]+pose.x,p.center[1]+pose.y);ctx.rotate(pose.rotation);ctx.scale(pose.scale,pose.scale);ctx.translate(-p.center[0],-p.center[1]);
      ctx.beginPath();p.poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.drawImage(this.burstTexture,-160,-160,320,320);ctx.restore();
    }
    if(!this.shards.length)this.burstTexture=null;
  }
  compose(frame){
    if(this.frame===frame)return this.surface;
    const {size,columns,perPage}=this.atlas,slot=frame%perPage;
    const c=this.surface.getContext('2d');c.clearRect(0,0,size,size);
    c.drawImage(this.pages[Math.floor(frame/perPage)],slot%columns*size,Math.floor(slot/columns)*size,size,size,0,0,size,size);
    this.frame=frame;return this.surface;
  }
  draw(ctx,m,dt=0){
    ctx.shadowColor='transparent';
    if(!this.loaded){ctx.fillStyle='#967d76';ctx.font='12px -apple-system';ctx.textAlign='center';ctx.fillText(this.failed?'素材加载失败，请重新打开':'捏捏准备中…',0,0);return;}
    const texture=m.coreOnly?this.core:this.compose(m.sequenceFrame);
    ctx.save();
    if(m.tension){ctx.translate(Math.sin(m.holdTime*65)*m.tension*1.6,Math.cos(m.holdTime*52)*m.tension*.7);}
    this.drawBody(ctx,m,texture);
    ctx.restore();this.drawShards(ctx,dt);
  }
  drawBody(ctx,m,texture){
    if(m.phase!=='gel'||(!m.squash&&!m.restFlatten&&!m.pull.x&&!m.pull.y)){
      ctx.drawImage(texture,-160,-160,320,320);return;
    }
    // 末帧成为揉拉纹理，切换时不会换成另一颗荔枝或另一种内芯。
    ctx.save();ctx.scale(1.25,1.25);
    const step=256/14;
    for(let row=0;row<14;row++)for(let col=0;col<14;col++){
      const x=-128+col*step,y=-128+row*step,quad=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
      const dst=quad.map(([a,b])=>gelPoint(a,b,m));
      for(const ids of [[0,1,2],[0,2,3]])textureTriangle(ctx,texture,ids.map(i=>quad[i]),ids.map(i=>dst[i]));
    }
    ctx.restore();
  }
}

// 先猛地向外弹，再减速收小淡出；碎片在透明窗口边界前消失。
export function burstShardTransform(center,index,age){
  const t=Math.max(0,Math.min(1,age/.72)),angle=Math.atan2(center[1],center[0])+(index%3-1)*.21;
  const margin=Math.max(12,Math.min(74,155-Math.max(Math.abs(center[0]),Math.abs(center[1]))));
  const travel=margin*(1-Math.exp(-t*5));
  return {x:Math.cos(angle)*travel,y:Math.sin(angle)*travel+12*t*t,scale:1-.72*t,rotation:(index%2?1:-1)*t*1.8,alpha:Math.max(0,1-Math.max(0,t-.2)/.8)};
}
