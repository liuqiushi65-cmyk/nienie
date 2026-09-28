// 同一组不规则细胞同时决定破裂位置和绘制边界。
export const SHELL_SITES=[{x:0,y:0},...Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4+.19)*(49+i%3*4),y:Math.sin(i*Math.PI/4+.19)*(48+i%2*7)})),...Array.from({length:14},(_,i)=>({x:Math.cos(i*Math.PI/7+.07)*(99+i%3*4),y:Math.sin(i*Math.PI/7+.07)*(99+i%2*6)}))];
export const SHELL_CELLS=SHELL_SITES.map((site,index)=>{
  let poly=[[-128,-128],[128,-128],[128,128],[-128,128]];
  SHELL_SITES.forEach((other,j)=>{
    if(index===j)return;
    const nx=other.x-site.x,ny=other.y-site.y,limit=(other.x**2+other.y**2-site.x**2-site.y**2)/2;
    const next=[];
    for(let k=0;k<poly.length;k++){
      const a=poly[k],b=poly[(k+1)%poly.length],da=a[0]*nx+a[1]*ny-limit,db=b[0]*nx+b[1]*ny-limit;
      if(da<=0)next.push(a);
      if((da<=0)!==(db<=0)){const t=da/(da-db);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
    }
    poly=next;
  });return poly.flatMap((a,i)=>{
    const b=poly[(i+1)%poly.length],reverse=a[0]>b[0]||(a[0]===b[0]&&a[1]>b[1]);
    const from=reverse?b:a,to=reverse?a:b,dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy),steps=Math.max(2,Math.ceil(length/7));
    const salt=Math.round(from[0]*31+from[1]*19+to[0]*13+to[1]*7);
    const edge=Array.from({length:steps+1},(_,j)=>{
      const t=j/steps,noise=j===0||j===steps?0:Math.sin(salt+j*47.7)*1.5;
      return [from[0]+dx*t-dy/(length||1)*noise,from[1]+dy*t+dx/(length||1)*noise];
    });return (reverse?edge.reverse():edge).slice(0,-1);
  });
});
// 底部托住的黏弹性泥团：上部塌下，两侧摊开，局部按压形成凹窝。
export function gelPoint(x,y,m){
  const cx=(m.contact.x-.5)*240,cy=(m.contact.y-.5)*240,s=(m.squash||0)*(.45+.55*m.damage)*(1-.2*(m.tension||0)),rest=m.restFlatten||0;
  const weight=Math.exp(-((x-cx)**2+(y-cy)**2)/11500);
  const dent=Math.exp(-((x-cx)**2/2600+(y-cy)**2/5000));
  const impact=m.burstImpact||0,flatten=.52*s+.65*rest+.13*impact;
  let px=x*(1+.32*s+.4*rest+.07*impact)+(x-cx)*dent*s*.09+m.pull.x*240*weight;
  let py=104+(y-104)*(1-flatten)+dent*s*16+m.pull.y*240*weight;
  // 在视窗边缘逐渐增加阻力，极端拖拉不被画布硬切断。
  const edge=(v,k,limit)=>v>k?k+(limit-k)*(1-Math.exp(-(v-k)/(limit-k))):v;
  px=Math.sign(px)*edge(Math.abs(px),149,176);
  py=py>116?edge(py,116,135):-edge(-py,127,146);
  return [px,py];
}

// 缺口从细裂缝逐渐张开，缩成的小片仍粘在同一物质坐标上。
export function shellPlate(index,opening){
  const site=SHELL_SITES[index],scale=1-.83*opening*opening;
  return SHELL_CELLS[index].map(([x,y])=>[site.x+(x-site.x)*scale,site.y+(y-site.y)*scale]);
}
