import { SequenceLycheeRenderer } from './sequence-renderer.mjs';
const TAU=Math.PI*2;
function seeded(seed){let n=seed>>>0;return ()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
export class ToyRenderer {
  constructor(canvas,model){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.model=model;this.particles=[];this.hover=false;this.hitPaths=[];this.last=0;this.lychee=new SequenceLycheeRenderer(model.material);this.resize();}
  resize(){const d=window.devicePixelRatio||1;this.canvas.width=360*d;this.canvas.height=310*d;this.ctx.setTransform(d,0,0,d,0,0);}
  point(x,y){
    const m=this.model,p=m.pressure,cx=(m.contact.x-.5)*240,cy=(m.contact.y-.5)*240;
    const fall=Math.exp(-((x-cx)**2+(y-cy)**2)/5000)*p;
    const softness=m.material==='paw'?1.3:1;
    return [x*(1+p*.085*softness)+(x-cx)*fall*.18,y*(1-p*.12*softness)+fall*13*softness];
  }
  move(x,y){this.ctx.moveTo(...this.point(x,y));}
  line(x,y){this.ctx.lineTo(...this.point(x,y));}
  curve(a,b,c,d,e,f){this.ctx.bezierCurveTo(...this.point(a,b),...this.point(c,d),...this.point(e,f));}
  ellipse(x,y,rx,ry,fill,rotation=0){const p=this.point(x,y);this.ctx.beginPath();this.ctx.ellipse(p[0],p[1],rx*(1+this.model.pressure*.075),ry*(1-this.model.pressure*.1),rotation,0,TAU);if(fill){this.ctx.fillStyle=fill;this.ctx.fill();}}
  gradient(x,y,r,colors){const g=this.ctx.createRadialGradient(x,y,2,x+18,y+28,r);colors.forEach(([at,c])=>g.addColorStop(at,c));return g;}
  body(){const c=this.ctx;c.beginPath();this.move(0,-69);this.curve(-42,-111,-108,-76,-99,-18);this.curve(-93,34,-40,106,0,113);this.curve(40,106,93,34,99,-18);this.curve(108,-76,42,-111,0,-69);c.closePath();}
  cookiePath(){const c=this.ctx;c.beginPath();for(let i=0;i<=80;i++){const a=i/80*TAU,r=97+Math.sin(a*12)*2.4+Math.sin(a*7)*1.6;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?this.line(x,y):this.move(x,y);}c.closePath();}
  pawBase(){const c=this.ctx;c.beginPath();this.move(-84,38);this.curve(-74,-22,-40,-41,0,-36);this.curve(39,-42,82,-15,90,41);this.curve(112,113,52,109,4,105);this.curve(-43,112,-108,106,-84,38);c.closePath();}
  fillStroke(fill,stroke,width=1){const c=this.ctx;c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  emit(event){
    if(this.model.sequenceMode){this.lychee.emit(event,this.model);return;}
    const rand=seeded(Date.now()+event.seed*53);const hard=['crack','crumb','dust'].includes(event.kind);
    if(!hard)return;
    const n=event.kind==='crumb'?15:event.kind==='dust'?4:8;
    for(let i=0;i<n;i++)this.particles.push({x:(event.x-.5)*190,y:(event.y-.5)*180,vx:(rand()-.5)*200,vy:-60-rand()*120,age:0,life:.55+rand()*.55,size:2+rand()*5,rotation:rand()*6,spin:(rand()-.5)*10,color:this.model.material==='cookie'?['#dfab64','#a57342','#edc589'][i%3]:['#f596a5','#e74c6d','#ffd6d9'][i%3]});
    this.particles=this.particles.slice(-100);
  }
  draw(dt=0){
    const c=this.ctx,m=this.model;c.clearRect(0,0,360,310);
    this.floatOffset=this.notice&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?-3*Math.sin(this.notice.age*Math.PI*2/3.2):0;
    c.save();c.translate(180,155+this.floatOffset);
    if(!m.sequenceMode){c.save();c.scale(1,.18);c.beginPath();c.ellipse(0,610,93+m.pressure*10,32,0,0,TAU);c.fillStyle=this.gradient(0,610,108,[[0,'rgba(65,31,34,.15)'],[1,'rgba(65,31,34,0)']]);c.fill();c.restore();}
    c.save();c.shadowColor='rgba(66,29,27,.16)';c.shadowBlur=18;c.shadowOffsetY=10;
    if(m.sequenceMode)this.lychee.draw(c,m,dt);else if(m.material==='strawberry')this.strawberry();else if(m.material==='cookie')this.cookie();else this.paw();c.restore();
    this.particles=this.particles.filter(p=>{p.age+=dt;if(p.age>=p.life)return false;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.rotation+=p.spin*dt;return true;});
    for(const p of this.particles){c.save();c.globalAlpha=Math.min(1,(p.life-p.age)*4);c.translate(p.x,p.y);c.rotate(p.rotation);c.beginPath();c.moveTo(-p.size,-p.size/2);c.lineTo(p.size,-p.size*.35);c.lineTo(p.size*.2,p.size);c.closePath();c.fillStyle=p.color;c.fill();c.restore();}
    if(this.hover&&!m.held&&m.damage<1&&!m.sequenceMode){c.save();c.globalAlpha=.6;const [x,y]=this.point((m.contact.x-.5)*240,(m.contact.y-.5)*240);c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=1.3;c.beginPath();c.arc(x,y,11,0,TAU);c.stroke();c.restore();}
    c.restore();
    if(this.notice)this.completionGlow();
  }
  completionGlow(){
    const c=this.ctx,d=window.devicePixelRatio||1,age=this.notice.age;
    if(!this.lightSurface)this.lightSurface=document.createElement('canvas');
    const surface=this.lightSurface;
    if(surface.width!==this.canvas.width||surface.height!==this.canvas.height){surface.width=this.canvas.width;surface.height=this.canvas.height;}
    const light=surface.getContext('2d');light.setTransform(d,0,0,d,0,0);
    light.clearRect(0,0,360,310);
    // 只保留轮廓外的绿色阴影；扣掉本体后放到原图背后，不再给果壳染色。
    light.save();light.shadowColor='#68eaaa';light.shadowBlur=28*d;
    light.drawImage(this.canvas,0,0,360,310);light.restore();
    light.globalCompositeOperation='destination-out';light.drawImage(this.canvas,0,0,360,310);
    light.globalCompositeOperation='source-over';
    const pulse=window.matchMedia('(prefers-reduced-motion: reduce)').matches?.5:.5+.08*Math.sin(age*Math.PI*2/3.2);
    const entrance=Math.min(1,age/.18),exit=Math.min(1,Math.max(0,12-age)/.65);
    c.save();c.globalCompositeOperation='destination-over';c.globalAlpha=pulse*entrance*exit;
    c.drawImage(surface,0,0,360,310);c.restore();
  }
  strawberry(){
    const c=this.ctx,m=this.model;
    this.body();this.fillStroke(this.gradient(-42,-63,190,[[0,'#ffabb2'],[.27,'#fa6581'],[.6,'#eb335d'],[1,'#ad1645']]),'#b3264b',.8);
    c.shadowColor='transparent';c.save();this.body();c.clip();
    // 蜡壳细小反光与果籽共同变形，保持受力位置连续。
    const rand=seeded(19);
    for(let row=0;row<8;row++)for(let col=0;col<8;col++){
      const y=-67+row*23+(col%2)*5,x=-91+col*26+(row%2)*11;
      if(Math.abs(x)>96-(y+35)*.32&&y>0)continue;
      const a=-x*.003;
      this.ellipse(x+1,y+1,3.1,5.3,'rgba(138,18,54,.22)',a);
      this.ellipse(x,y-1,1.9,3.8,['#ffe2a7','#ffcf95','#ffe8b7'][Math.floor(rand()*3)],a);
      this.ellipse(x-.5,y-2, .7,1.4,'rgba(255,255,255,.8)',a);
    }
    this.ellipse(-43,-43,24,53,this.gradient(-49,-60,68,[[0,'rgba(255,255,255,.42)'],[1,'rgba(255,255,255,0)']]),-.4);
    for(const f of m.fractures)this.crack(f);
    if(m.damage>.42){
      const opening=(m.damage-.42)/.58;
      c.save();const [x,y]=this.point(4,23);c.translate(x,y);c.rotate(-.15);c.beginPath();c.ellipse(0,0,42*opening,63*opening,0,0,TAU);c.fillStyle='#b7234a';c.fill();
      c.translate(0,3);c.beginPath();c.ellipse(0,0,38*opening,58*opening,0,0,TAU);c.fillStyle=this.gradient(-14,-24,81,[[0,'#ffedf0'],[.45,'#ffbccb'],[1,'#e57594']]);c.fill();
      for(let i=0;i<7;i++){c.beginPath();c.ellipse(Math.sin(i*4)*19*opening,(i-3)*12*opening,7*opening,3*opening,.3,0,TAU);c.fillStyle='rgba(255,255,255,.4)';c.fill();}c.restore();
    }
    c.restore();
    // 叶冠也响应按压，外观始终保持同一颗草莓。
    for(let i=0;i<5;i++){c.save();const [x,y]=this.point(0,-77);c.translate(x,y);c.rotate((i-2)*.54);c.beginPath();c.moveTo(0,7);c.bezierCurveTo(-24,-3,-18,-27,0,-44+(i%2)*7);c.bezierCurveTo(17,-25,21,-5,0,7);c.fillStyle=this.gradient(-5,-24,50,[[0,'#a4cf75'],[.45,'#659744'],[1,'#366031']]);c.fill();c.beginPath();c.moveTo(0,3);c.lineTo(0,-31);c.strokeStyle='rgba(212,238,160,.35)';c.lineWidth=1;c.stroke();c.restore();}
    c.save();c.lineCap='round';c.strokeStyle='#52763b';c.lineWidth=6;c.beginPath();this.move(0,-83);this.curve(-4,-101,1,-108,9,-112);c.stroke();c.restore();
  }
  crack(f){
    const c=this.ctx,rand=seeded(f.seed*67+15);
    const x=(f.x-.5)*160+(rand()-.5)*70,y=(f.y-.5)*160+(rand()-.5)*65;
    for(let arm=0;arm<3;arm++){
      const a=arm*TAU/3+rand()*2,length=20+rand()*32;
      c.beginPath();this.move(x,y);
      const mid=[x+Math.cos(a)*length*.5,y+Math.sin(a)*length*.5];this.line(mid[0]+4,mid[1]);this.line(x+Math.cos(a)*length,y+Math.sin(a)*length);
      c.strokeStyle='rgba(117,18,46,.62)';c.lineWidth=2.1;c.lineJoin='round';c.stroke();c.strokeStyle='rgba(255,223,222,.94)';c.lineWidth=.8;c.stroke();
    }
  }
  cookie(){
    const c=this.ctx,m=this.model,rand=seeded(12);
    // 用扇形分块的位移表现掰断，形变与软芯材质有明显区别。
    for(let sector=0;sector<7;sector++){
      const a=sector*TAU/7,mid=a+TAU/14,broken=sector<Math.ceil(m.damage*7),spread=broken?m.damage*17:0;
      c.save();c.translate(Math.cos(mid)*spread,Math.sin(mid)*spread+spread*.23);
      c.beginPath();c.moveTo(0,0);c.arc(0,0,130,a-.012,a+TAU/7+.012);c.closePath();c.clip();
      this.cookiePath();this.fillStroke(this.gradient(-36,-50,180,[[0,'#ffe1a4'],[.4,'#eec27d'],[.74,'#cf9252'],[1,'#a86a37']]),'#b07a45',2);
      c.shadowColor='transparent';c.save();this.cookiePath();c.clip();
      const r=seeded(12);
      for(let i=0;i<180;i++){const x=(r()-.5)*200,y=(r()-.5)*200;this.ellipse(x,y,.6+r()*1.3,.6+r()*.7,i%3?'rgba(149,85,31,.14)':'rgba(255,244,201,.6)');}
      for(let i=0;i<19;i++){
        const a=r()*TAU,rad=18+Math.sqrt(r())*64,x=Math.cos(a)*rad,y=Math.sin(a)*rad;
        c.save();c.translate(...this.point(x,y));c.rotate(r()*TAU);c.beginPath();c.moveTo(-6,-4);c.lineTo(2,-7);c.quadraticCurveTo(10,-3,6,5);c.lineTo(-3,7);c.closePath();c.fillStyle=this.gradient(-3,-4,16,[[0,'#87573b'],[.5,'#5c3728'],[1,'#35251e']]);c.fill();c.strokeStyle='rgba(94,43,19,.3)';c.lineWidth=3;c.stroke();c.restore();
      }
      c.restore();c.restore();
    }
    if(m.damage>0){c.save();c.strokeStyle='rgba(116,71,34,.75)';c.lineWidth=1.5;
      for(let i=0;i<Math.ceil(m.damage*7);i++){const a=i*TAU/7;c.beginPath();this.move(0,0);this.line(Math.cos(a+.09)*38,Math.sin(a+.09)*38);this.line(Math.cos(a-.05)*66,Math.sin(a-.05)*66);this.line(Math.cos(a)*96,Math.sin(a)*96);c.stroke();}c.restore();}
  }
  paw(){
    const c=this.ctx;
    const fur=this.gradient(-37,-55,170,[[0,'#fffaf4'],[.55,'#f5e6df'],[1,'#d7b8b3']]);
    const pads=[[-76,-32,28,38,-.37],[-30,-65,28,37,-.16],[25,-66,28,38,.13],[71,-37,28,37,.38]];
    for(const [x,y,rx,ry,a]of pads)this.ellipse(x,y,rx,ry,fur,a);
    this.pawBase();this.fillStroke(fur,'rgba(185,143,139,.45)',1);
    c.shadowColor='transparent';
    for(const [x,y,rx,ry,a]of pads){this.ellipse(x,y-1,rx*.65,ry*.7,this.gradient(x-9,y-14,50,[[0,'#ffd4de'],[.43,'#f6acc3'],[1,'#d7769d']]),a);this.ellipse(x-6,y-12,5,9,'rgba(255,249,248,.38)',a);}
    c.beginPath();this.move(0,3);this.curve(-16,-14,-33,-7,-38,12);this.curve(-40,26,-64,38,-51,58);this.curve(-40,77,-13,62,0,62);this.curve(15,62,41,77,54,57);this.curve(66,37,41,26,39,10);this.curve(34,-8,15,-15,0,3);c.closePath();
    this.fillStroke(this.gradient(-17,8,104,[[0,'#ffe0e8'],[.35,'#f5b3cc'],[.8,'#df88ae'],[1,'#c56e9a']]),'rgba(207,124,159,.5)',1);
    this.ellipse(-23,18,10,17,'rgba(255,246,248,.4)',.6);
    this.ellipse(-25,87,24,5,'rgba(255,255,255,.3)');
  }
  hit(x,y){
    if(this.model.sequenceMode){
      if(x<0||y<0||x>=360||y>=310)return false;
      const d=window.devicePixelRatio||1;return this.ctx.getImageData(Math.floor(x*d),Math.floor(y*d),1,1).data[3]>70;
    }
    x-=180;y-=155;
    const m=this.model;
    if(m.material==='cookie')return (x*x+y*y)<(106+m.damage*18)**2;
    if(m.material==='strawberry')return y>-115&&y<118&&Math.abs(x)<(y<0?99:104-y*.67);
    return (x*x/(96*96)+(y-40)**2/(73*73)<1)||[[-76,-32],[-30,-65],[25,-66],[71,-37]].some(([a,b])=>(x-a)**2/32**2+(y-b)**2/41**2<1);
  }
  contact(x,y){const scale=this.model.sequenceMode?300:240;return {x:(x-180)/scale+.5,y:(y-155-(this.floatOffset||0))/scale+.5};}
}
