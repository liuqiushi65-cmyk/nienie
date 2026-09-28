import { SHELL_SITES, SHELL_CELLS, gelPoint, shellPlate } from './lychee.mjs';
function outline(ctx,poly){ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
export function textureTriangle(ctx,img,src,dst){
  const [a,b,c]=src,[p,q,r]=dst;
  const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  if(Math.abs(det)<1e-7)return;
  const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det;
  const xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det;
  const yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det;
  const yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
  ctx.save();
  // 亚像素重叠消除相邻三角形抗锯齿白缝。
  const center=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3];
  outline(ctx,dst.map(v=>{const dx=v[0]-center[0],dy=v[1]-center[1],k=1+.35/Math.hypot(dx,dy);return [center[0]+dx*k,center[1]+dy*k];}));ctx.clip();
  ctx.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);
  ctx.drawImage(img,-128,-128,256,256);ctx.restore();
}
export class LycheeRenderer {
  constructor(){
    this.shards=[];this.failed=false;
    this.shell=new Image();this.core=new Image();
    this.ready=Promise.all([['shell','assets/lychee-shell.png'],['core','assets/lychee-core.png']].map(([key,url])=>new Promise(resolve=>{
      this[key].onload=()=>resolve(true);this[key].onerror=()=>{this.failed=true;resolve(false);};this[key].src=url;
    })));
  }
  emit(e,m){
    for(const index of e.detached||[]){
      const plate=shellPlate(index,m.shellOpening[index]);
      let chunks=[plate];
      if(e.burst){
        const edge=plate.filter((_,i)=>i%2===0),center=edge.reduce((a,p)=>[a[0]+p[0]/edge.length,a[1]+p[1]/edge.length],[0,0]);
        chunks=Array.from({length:3},(_,part)=>{
          const from=Math.floor(part*edge.length/3),to=Math.floor((part+1)*edge.length/3);
          return [center,...Array.from({length:to-from+1},(_,j)=>edge[(from+j)%edge.length])];
        });
      }
      // 壳先沿软泥表面碎开，碎屑从当时的受力位置脱离。
      chunks.forEach((source,part)=>this.shards.push({source,pose:source.map(([x,y])=>gelPoint(x,y,m)),age:0,vx:e.burst?(SHELL_SITES[index].x*.22+(part-1)*18):(index%2?1:-1)*14,vy:e.burst?-12-part*9:16,life:e.burst?.72:.65}));
    }
  }
  reset(){this.shards=[];this.paintKey=null;}
  compose(m){
    const key=m.shellOpening.join(',')+'|'+m.detached.join(',');
    if(key===this.paintKey)return this.surface;
    this.paintKey=key;
    if(!this.surface){
      this.surface=document.createElement('canvas');this.skin=document.createElement('canvas');
      for(const canvas of [this.surface,this.skin])canvas.width=canvas.height=512;
    }
    const body=this.surface.getContext('2d'),skin=this.skin.getContext('2d');
    for(const c of [body,skin]){c.setTransform(2,0,0,2,256,256);c.clearRect(-128,-128,256,256);}
    body.drawImage(this.core,-128,-128,256,256);
    // 带壳物体只有一个外轮廓，内芯不会从完整的壳边缘漏出一圈。
    body.globalCompositeOperation='destination-in';body.drawImage(this.shell,-128,-128,256,256);body.globalCompositeOperation='source-over';
    if(m.damage===0)skin.drawImage(this.shell,-128,-128,256,256);
    else for(let i=0;i<SHELL_CELLS.length;i++)if(!m.detached.includes(i)){
      const opening=m.shellOpening[i],poly=shellPlate(i,opening);
      skin.save();outline(skin,poly);skin.clip();skin.drawImage(this.shell,-128,-128,256,256);skin.restore();
      if(opening>.06){outline(skin,poly);skin.strokeStyle='rgba(245,213,182,.85)';skin.lineWidth=.65+opening*1.2;skin.stroke();}
    }
    // 裂口厚度只落在真实果壳内，不给透明区域画出多边形边框。
    skin.globalCompositeOperation='destination-in';skin.drawImage(this.shell,-128,-128,256,256);skin.globalCompositeOperation='source-over';
    body.drawImage(this.skin,-128,-128,256,256);
    return this.surface;
  }
  draw(ctx,m,dt){
    if(!this.shell.complete||!this.core.complete||!this.shell.naturalWidth||!this.core.naturalWidth){
      ctx.fillStyle='#967d76';ctx.font='12px -apple-system';ctx.textAlign='center';ctx.fillText(this.failed?'素材加载失败，请重新打开':'荔枝准备中…',0,0);return;
    }
    ctx.shadowColor='transparent';
    // 壳、裂口、内芯先合成同一张表面，再一起过网格，永远共用受力坐标。
    const texture=this.compose(m),step=256/14;
    for(let row=0;row<14;row++)for(let col=0;col<14;col++){
      const x=-128+col*step,y=-128+row*step,quad=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
      const dst=quad.map(([a,b])=>gelPoint(a,b,m));
      for(const ids of [[0,1,2],[0,2,3]])textureTriangle(ctx,texture,ids.map(i=>quad[i]),ids.map(i=>dst[i]));
    }
    this.shards=this.shards.filter(p=>(p.age+=dt)<p.life);
    for(const shard of this.shards){
      const t=shard.age;ctx.save();ctx.globalAlpha=Math.min(1,(shard.life-t)*4);
      const pose=shard.pose.map(([x,y])=>[x+shard.vx*t,y+shard.vy*t+180*t*t]);
      for(let i=1;i<shard.source.length-1;i++)textureTriangle(ctx,this.shell,[shard.source[0],shard.source[i],shard.source[i+1]],[pose[0],pose[i],pose[i+1]]);
      ctx.restore();
    }
  }
}
